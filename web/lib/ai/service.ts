import type { DatabaseSync } from "node:sqlite";
import { recordAudit } from "@/lib/audit";
import { now, transaction } from "@/lib/db";
import { requestFromRow, type RequestRow } from "@/lib/drawings/store";
import { RepositoryError, notFound } from "@/lib/repositories/errors";
import { FileStorage, fileExtensionOf } from "@/lib/storage/files";
import {
  AiReviewError,
  type DrawingMediaType,
  type DrawingReviewer,
} from "./drawing-reviewer";
import { normaliseReview, type DrawingReview } from "./review-schema";

/** Drawing types the AI can read directly. CAD formats are reviewed by hand. */
const AI_MEDIA_TYPES: Record<string, DrawingMediaType> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
/**
 * Drawings are sent inline (base64, about 4/3 of the file size), so the file
 * is capped to keep the whole request under the API's inline request limit.
 */
export const MAX_AI_FILE_BYTES = 14 * 1024 * 1024;

export function aiSupportsFile(fileName: string) {
  return fileExtensionOf(fileName) in AI_MEDIA_TYPES;
}

export type DrawingAnalysis = {
  id: number;
  status: "COMPLETED" | "FAILED";
  model: string;
  review: DrawingReview | null;
  error: string;
  inputTokens: number;
  outputTokens: number;
  requestedBy: string;
  createdAt: string;
};

type AnalysisRow = {
  id: number;
  status: "COMPLETED" | "FAILED";
  model: string;
  result: string | null;
  error: string;
  input_tokens: number;
  output_tokens: number;
  requested_by: string;
  created_at: string;
};

function loadRequest(db: DatabaseSync, requestId: string) {
  const row = db
    .prepare("SELECT * FROM manufacturing_requests WHERE id = ?")
    .get(requestId) as RequestRow | undefined;
  if (!row) throw notFound("Request");
  return { row, request: requestFromRow(row) };
}

/** Latest AI review of a request's drawing, or null if none was run. */
export function latestAnalysis(
  db: DatabaseSync,
  requestId: string,
): DrawingAnalysis | null {
  const row = db
    .prepare(
      `SELECT a.*, COALESCE(u.first_name || ' ' || u.last_name, a.requested_by) AS requested_by
       FROM drawing_analyses a LEFT JOIN users u ON u.id = a.requested_by
       WHERE a.request_id = ? ORDER BY a.id DESC LIMIT 1`,
    )
    .get(requestId) as AnalysisRow | undefined;
  if (!row) return null;
  let review: DrawingReview | null = null;
  if (row.status === "COMPLETED" && row.result) {
    try {
      review = normaliseReview(JSON.parse(row.result));
    } catch {
      review = null;
    }
  }
  return {
    id: row.id,
    status: row.status,
    model: row.model,
    review,
    error: row.error,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
  };
}

/**
 * Runs the AI review of a request's drawing for an admin and stores the
 * result (or the failure). Requires the customer's consent and a PDF or image
 * drawing. Throws RepositoryError for anything the admin must fix.
 */
export async function analyseRequestDrawing(
  db: DatabaseSync,
  requestId: string,
  adminId: string,
  reviewer: DrawingReviewer | null,
  files = new FileStorage(),
): Promise<DrawingAnalysis> {
  if (!reviewer)
    throw new RepositoryError(
      "AI_NOT_CONFIGURED",
      "AI review is not set up. Add GEMINI_API_KEY to the server environment.",
      503,
    );
  const { row, request } = loadRequest(db, requestId);
  if (!request.aiReviewAllowed)
    throw new RepositoryError(
      "AI_NOT_ALLOWED",
      "The customer has not allowed AI-assisted review of this drawing.",
      409,
    );
  const mediaType = AI_MEDIA_TYPES[fileExtensionOf(request.file.name)];
  if (!mediaType)
    throw new RepositoryError(
      "AI_UNSUPPORTED_FILE",
      `AI review reads PDF, PNG and JPG drawings. Review this ${request.file.extension.toUpperCase()} file manually.`,
      422,
    );
  if (request.file.size > MAX_AI_FILE_BYTES)
    throw new RepositoryError(
      "AI_FILE_TOO_LARGE",
      "AI review handles drawings up to 14 MB. Review this file manually.",
      422,
    );

  const bytes = await files.read(row.storage_key);
  const save = (fields: {
    status: "COMPLETED" | "FAILED";
    model: string;
    result: string | null;
    error: string;
    inputTokens: number;
    outputTokens: number;
  }) =>
    transaction(db, () => {
      db.prepare(
        `INSERT INTO drawing_analyses
           (request_id, status, model, result, error, input_tokens, output_tokens, requested_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        requestId,
        fields.status,
        fields.model,
        fields.result,
        fields.error,
        fields.inputTokens,
        fields.outputTokens,
        adminId,
        now(),
      );
      recordAudit(db, {
        actorId: adminId,
        action:
          fields.status === "COMPLETED"
            ? "AI_REVIEW_COMPLETED"
            : "AI_REVIEW_FAILED",
        entityType: "REQUEST",
        entityId: requestId,
        detail:
          fields.status === "COMPLETED"
            ? `${fields.model}, ${fields.inputTokens} input / ${fields.outputTokens} output tokens`
            : fields.error,
      });
    });

  try {
    const result = await reviewer.review({
      request,
      file: { bytes, mediaType },
    });
    save({
      status: "COMPLETED",
      model: result.model,
      result: JSON.stringify(result.review),
      error: "",
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
  } catch (error) {
    const message =
      error instanceof AiReviewError
        ? error.message
        : "The AI service could not be reached. Try again in a minute.";
    if (!(error instanceof AiReviewError))
      console.error("AI drawing review failed", error);
    save({
      status: "FAILED",
      model: reviewer.model,
      result: null,
      error: message,
      inputTokens: 0,
      outputTokens: 0,
    });
    throw new RepositoryError("AI_REVIEW_FAILED", message, 502);
  }
  return latestAnalysis(db, requestId) as DrawingAnalysis;
}

/** Customer allows or withdraws AI-assisted review for one of their requests. */
export function setAiReviewConsent(
  db: DatabaseSync,
  customerId: string,
  requestId: string,
  allowed: boolean,
) {
  const { request } = loadRequest(db, requestId);
  if (request.customerId !== customerId) throw notFound("Request");
  transaction(db, () => {
    db.prepare(
      "UPDATE manufacturing_requests SET ai_review_allowed = ?, updated_at = ? WHERE id = ?",
    ).run(allowed ? 1 : 0, now(), requestId);
    recordAudit(db, {
      actorId: customerId,
      action: allowed ? "AI_REVIEW_ALLOWED" : "AI_REVIEW_WITHDRAWN",
      entityType: "REQUEST",
      entityId: requestId,
    });
  });
  return { aiReviewAllowed: allowed };
}
