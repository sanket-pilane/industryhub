import type { DrawingRequest } from "../../../shared/contracts";
import { rfqSchema } from "@/lib/validators";
import { checkDrawingFile, matchesSignature } from "./rules";
import { sha256, type DrawingStore } from "./store";

export type UploadOutcome =
  | { ok: true; request: DrawingRequest }
  | {
      ok: false;
      status: 400 | 409;
      code: string;
      message: string;
      fields?: Record<string, string[]>;
    };

const TEXT_FIELDS = [
  "partName",
  "quantity",
  "material",
  "tolerance",
  "process",
  "finish",
  "targetDate",
  "notes",
] as const;

/** Validates a multipart drawing upload and saves it for the customer. */
export async function processDrawingUpload(
  form: FormData,
  customerId: string,
  store: DrawingStore,
): Promise<UploadOutcome> {
  const file = form.get("file");
  if (!(file instanceof File))
    return {
      ok: false,
      status: 400,
      code: "FILE_REQUIRED",
      message: "Attach a drawing file.",
    };
  const check = checkDrawingFile(file);
  if (!check.ok)
    return { ok: false, status: 400, code: check.code, message: check.message };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesSignature(check.extension, bytes))
    return {
      ok: false,
      status: 400,
      code: "INVALID_FILE",
      message: `The file content is not a valid ${check.extension.toUpperCase()} drawing.`,
    };

  const raw = Object.fromEntries(
    TEXT_FIELDS.map((key) => [key, String(form.get(key) ?? "")]),
  );
  const parsed = rfqSchema.safeParse({
    ...raw,
    confidential: form.get("confidential") === "true",
    aiReview: form.get("aiReview") === "true",
  });
  if (!parsed.success)
    return {
      ok: false,
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Please check the highlighted fields.",
      fields: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };

  if (form.get("allowDuplicate") !== "true") {
    const duplicate = await store.findDuplicate(customerId, sha256(bytes));
    if (duplicate)
      return {
        ok: false,
        status: 409,
        code: "DUPLICATE_DRAWING",
        message: `This file was already submitted as ${duplicate.id}.`,
      };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { confidential, aiReview, ...details } = parsed.data;
  const request = await store.save({
    customerId,
    details,
    aiReviewAllowed: aiReview,
    file: { name: file.name, extension: check.extension, bytes },
  });
  return { ok: true, request };
}
