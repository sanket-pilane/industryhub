// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AiReviewError,
  GeminiDrawingReviewer,
  reviewJsonSchema,
  type DrawingReviewer,
  type GenerateContentClient,
} from "@/lib/ai/drawing-reviewer";
import {
  estimatedBatchHours,
  normaliseReview,
  type DrawingReview,
} from "@/lib/ai/review-schema";
import {
  analyseRequestDrawing,
  latestAnalysis,
  setAiReviewConsent,
} from "@/lib/ai/service";
import type { Database } from "@/lib/db";
import { DrawingStore } from "@/lib/drawings/store";
import { processDrawingUpload } from "@/lib/drawings/upload";
import { FileStorage } from "@/lib/storage/files";
import { SEED, addCustomer, createTestDb } from "../helpers/db";

export const SAMPLE_REVIEW: DrawingReview = {
  summary:
    "Aluminium gear housing with a precision bore and four tapped holes.",
  partType: "machined housing",
  overallDimensions: "220 × 170 × 95 mm",
  features: [
    { kind: "bore", description: "Ø85 H7 through bore" },
    { kind: "thread", description: "4× M10-6H, depth 18" },
  ],
  tolerances: ["Ø85 H7", "ISO 2768-m general"],
  surfaceFinish: ["Ra 1.6 on bore", "Clear anodise 15 µm"],
  manufacturability: [
    {
      severity: "warning",
      issue: "H7 bore needs boring or reaming",
      suggestion: "Finish-bore on the VMC with a boring head.",
    },
  ],
  mismatches: [],
  operations: [
    {
      operation: "Face and mill outline",
      machine: "3-axis VMC",
      setupMinutes: 45,
      cycleMinutesPerPart: 12,
    },
    {
      operation: "Bore Ø85 H7 and tap M10",
      machine: "3-axis VMC",
      setupMinutes: 30,
      cycleMinutesPerPart: 8,
    },
  ],
  quoteLineItems: [
    { description: "CNC machining, gear housing", quantity: 250 },
    { description: "Clear anodising", quantity: 250 },
  ],
  questionsForCustomer: [
    "Is the anodise thickness a minimum or nominal value?",
  ],
  confidence: "high",
};

const PDF = new TextEncoder().encode("%PDF-1.7\n% gear housing\n");
const DXF = new TextEncoder().encode("999\nplate\n0\nSECTION\n");

function fakeClient(response: object) {
  const generateContent = vi.fn().mockResolvedValue(response);
  return {
    client: { models: { generateContent } } as unknown as GenerateContentClient,
    generateContent,
  };
}

const geminiOk = (review: unknown = SAMPLE_REVIEW) => ({
  text: JSON.stringify(review),
  modelVersion: "gemini-3.6-flash",
  candidates: [{ finishReason: "STOP" }],
  usageMetadata: { promptTokenCount: 1800, candidatesTokenCount: 900 },
});

describe("review schema", () => {
  it("clamps estimates and line items to sane values", () => {
    const review = normaliseReview({
      ...SAMPLE_REVIEW,
      operations: [
        {
          operation: "x",
          machine: "y",
          setupMinutes: -5,
          cycleMinutesPerPart: 1e9,
        },
      ],
      quoteLineItems: [
        { description: "  Machining  ", quantity: 0 },
        { description: "", quantity: 4 },
        { description: "Inspection", quantity: 2.7 },
      ],
    });
    expect(review.operations[0]).toMatchObject({
      setupMinutes: 0,
      cycleMinutesPerPart: 10_000,
    });
    expect(review.quoteLineItems).toEqual([
      { description: "Machining", quantity: 1 },
      { description: "Inspection", quantity: 2 },
    ]);
    expect(() => normaliseReview({ summary: "missing fields" })).toThrow();
  });

  it("estimates batch hours as setups once plus cycle time per part", () => {
    // (45 + 30) setup + (12 + 8) × 250 = 5075 min = 84.6 h
    expect(estimatedBatchHours(SAMPLE_REVIEW.operations, 250)).toBe(84.6);
  });

  it("sends Gemini only JSON Schema keywords it supports", () => {
    const schema = reviewJsonSchema();
    expect(schema).not.toHaveProperty("$schema");
    const allowed = new Set([
      "type",
      "description",
      "enum",
      "items",
      "properties",
      "required",
      "additionalProperties",
    ]);
    const walk = (node: unknown): void => {
      // enum and required hold plain string lists, not sub-schemas
      if (!node || typeof node !== "object" || Array.isArray(node)) return;
      for (const [key, value] of Object.entries(node)) {
        expect(allowed, `unsupported keyword ${key}`).toContain(key);
        if (key === "properties") Object.values(value as object).forEach(walk);
        else walk(value);
      }
    };
    walk(schema);
  });
});

describe("Gemini drawing reviewer", () => {
  const request = {
    id: "RFQ-IH-01001",
    customerId: SEED.customer,
    partName: "Gear Housing",
    quantity: 250,
    material: "Aluminium 6061",
    tolerance: "ISO 2768-m (medium)",
    process: "CNC milling",
    finish: "Anodised",
    targetDate: "2099-01-01",
    notes: "Bore H7",
    status: "UNDER_ENGINEERING_REVIEW" as const,
    revision: 1,
    file: {
      name: "housing.pdf",
      size: PDF.byteLength,
      extension: "pdf",
      checksum: "x",
    },
    aiReviewAllowed: true,
    submittedAt: "2026-11-16T00:00:00Z",
    updatedAt: "2026-11-16T00:00:00Z",
  };

  it("sends the drawing inline with the RFQ and asks for schema JSON", async () => {
    const { client, generateContent } = fakeClient(geminiOk());
    const result = await new GeminiDrawingReviewer(
      client,
      "gemini-3.6-flash",
    ).review({
      request,
      file: { bytes: PDF, mediaType: "application/pdf" },
    });
    const params = generateContent.mock.calls[0][0];
    expect(params.model).toBe("gemini-3.6-flash");
    const [drawing, text] = params.contents[0].parts;
    expect(drawing.inlineData).toEqual({
      mimeType: "application/pdf",
      data: Buffer.from(PDF).toString("base64"),
    });
    expect(text.text).toContain("Material chosen by customer: Aluminium 6061");
    expect(text.text).toContain("Quantity: 250");
    expect(params.config).toMatchObject({
      responseMimeType: "application/json",
      responseJsonSchema: reviewJsonSchema(),
    });
    expect(params.config.systemInstruction).toMatch(/Never include prices/);
    expect(result).toEqual({
      review: SAMPLE_REVIEW,
      model: "gemini-3.6-flash",
      inputTokens: 1800,
      outputTokens: 900,
    });
  });

  it("sends images with their own MIME type", async () => {
    const { client, generateContent } = fakeClient(geminiOk());
    await new GeminiDrawingReviewer(client).review({
      request,
      file: { bytes: new Uint8Array([0x89, 0x50]), mediaType: "image/png" },
    });
    expect(
      generateContent.mock.calls[0][0].contents[0].parts[0].inlineData.mimeType,
    ).toBe("image/png");
  });

  it("turns blocked, truncated and malformed answers into readable errors", async () => {
    const cases: [object, RegExp][] = [
      [
        { ...geminiOk(), promptFeedback: { blockReason: "SAFETY" } },
        /declined/,
      ],
      [{ ...geminiOk(), candidates: [{ finishReason: "SAFETY" }] }, /declined/],
      [
        { ...geminiOk(), candidates: [{ finishReason: "MAX_TOKENS" }] },
        /cut off/,
      ],
      [{ ...geminiOk(), text: "not json" }, /usable review/],
      [geminiOk({ summary: "incomplete" }), /usable review/],
    ];
    for (const [response, message] of cases) {
      const { client } = fakeClient(response);
      await expect(
        new GeminiDrawingReviewer(client).review({
          request,
          file: { bytes: PDF, mediaType: "application/pdf" },
        }),
      ).rejects.toThrow(message);
    }
  });
});

describe("AI review service", () => {
  let root: string;
  let db: Database;
  let store: DrawingStore;
  let files: FileStorage;
  const fakeReviewer = (impl?: DrawingReviewer["review"]): DrawingReviewer => ({
    model: "gemini-3.6-flash",
    review:
      impl ??
      vi.fn().mockResolvedValue({
        review: SAMPLE_REVIEW,
        model: "gemini-3.6-flash",
        inputTokens: 1800,
        outputTokens: 900,
      }),
  });

  async function upload(
    name: string,
    bytes: Uint8Array<ArrayBuffer>,
    aiReview: boolean,
  ) {
    const form = new FormData();
    form.append("file", new File([bytes], name));
    for (const [k, v] of Object.entries({
      partName: "Gear Housing",
      quantity: "250",
      material: "Aluminium 6061",
      tolerance: "ISO 2768-m (medium)",
      process: "CNC milling",
      finish: "Anodised",
      targetDate: "2099-01-15",
      notes: "",
      confidential: "true",
      allowDuplicate: "true",
    }))
      form.append(k, v);
    if (aiReview) form.append("aiReview", "true");
    const outcome = await processDrawingUpload(form, SEED.customer, store);
    if (!outcome.ok) throw new Error(outcome.message);
    return outcome.request;
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "industrihub-ai-"));
    db = createTestDb();
    files = new FileStorage(root);
    store = new DrawingStore(db, files);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("records the customer's opt-in from the upload form", async () => {
    expect((await upload("a.pdf", PDF, true)).aiReviewAllowed).toBe(true);
    expect((await upload("b.pdf", PDF, false)).aiReviewAllowed).toBe(false);
  });

  it("refuses to run without an API key, consent or a readable file", async () => {
    const noConsent = await upload("a.pdf", PDF, false);
    await expect(
      analyseRequestDrawing(db, noConsent.id, SEED.admin, null, files),
    ).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED", status: 503 });
    const reviewer = fakeReviewer();
    await expect(
      analyseRequestDrawing(db, noConsent.id, SEED.admin, reviewer, files),
    ).rejects.toMatchObject({ code: "AI_NOT_ALLOWED", status: 409 });
    const dxf = await upload("plate.dxf", DXF, true);
    await expect(
      analyseRequestDrawing(db, dxf.id, SEED.admin, reviewer, files),
    ).rejects.toMatchObject({ code: "AI_UNSUPPORTED_FILE", status: 422 });
    await expect(
      analyseRequestDrawing(db, "RFQ-NOPE", SEED.admin, reviewer, files),
    ).rejects.toMatchObject({ status: 404 });
    expect(reviewer.review).not.toHaveBeenCalled();
    expect(latestAnalysis(db, noConsent.id)).toBeNull();
  });

  it("saves a completed review and audits it", async () => {
    const request = await upload("a.pdf", PDF, true);
    const reviewer = fakeReviewer();
    const analysis = await analyseRequestDrawing(
      db,
      request.id,
      SEED.admin,
      reviewer,
      files,
    );
    expect(vi.mocked(reviewer.review).mock.calls[0][0].file).toEqual({
      bytes: PDF,
      mediaType: "application/pdf",
    });
    expect(analysis).toMatchObject({
      status: "COMPLETED",
      model: "gemini-3.6-flash",
      review: SAMPLE_REVIEW,
      requestedBy: "Meera Iyer",
      inputTokens: 1800,
      outputTokens: 900,
    });
    expect(latestAnalysis(db, request.id)?.review).toEqual(SAMPLE_REVIEW);
    const audit = db
      .prepare(
        "SELECT action, entity_id FROM audit_log WHERE action LIKE 'AI_%'",
      )
      .all();
    expect(audit).toEqual([
      expect.objectContaining({
        action: "AI_REVIEW_COMPLETED",
        entity_id: request.id,
      }),
    ]);
  });

  it("stores a failure with a safe message and reports 502", async () => {
    const request = await upload("a.pdf", PDF, true);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      analyseRequestDrawing(
        db,
        request.id,
        SEED.admin,
        fakeReviewer(() =>
          Promise.reject(new Error("socket hang up: key=secret")),
        ),
        files,
      ),
    ).rejects.toMatchObject({ code: "AI_REVIEW_FAILED", status: 502 });
    spy.mockRestore();
    const failed = latestAnalysis(db, request.id);
    expect(failed).toMatchObject({ status: "FAILED", review: null });
    expect(failed?.error).not.toContain("secret");

    await expect(
      analyseRequestDrawing(
        db,
        request.id,
        SEED.admin,
        fakeReviewer(() =>
          Promise.reject(new AiReviewError("The AI review was cut off.")),
        ),
        files,
      ),
    ).rejects.toThrow("The AI review was cut off.");
  });

  it("lets only the owner change consent, and audits it", async () => {
    const request = await upload("a.pdf", PDF, false);
    const other = addCustomer(db, "other@test.in");
    expect(() => setAiReviewConsent(db, other, request.id, true)).toThrow(
      /not found/,
    );
    expect(setAiReviewConsent(db, SEED.customer, request.id, true)).toEqual({
      aiReviewAllowed: true,
    });
    expect((await store.get(request.id))?.aiReviewAllowed).toBe(true);
    setAiReviewConsent(db, SEED.customer, request.id, false);
    expect(
      db
        .prepare("SELECT action FROM audit_log WHERE entity_id = ? ORDER BY id")
        .all(request.id)
        .map((r) => (r as { action: string }).action),
    ).toEqual(["AI_REVIEW_ALLOWED", "AI_REVIEW_WITHDRAWN"]);
  });
});
