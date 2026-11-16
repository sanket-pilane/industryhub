import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { MAX_QC_BYTES } from "@/lib/jobs/qc-files";
import { submitQcDocument } from "@/lib/jobs/service";

/** Room for the form fields that travel with the file. */
const MAX_BODY_BYTES = MAX_QC_BYTES + 1024 * 1024;

/** The assigned supplier uploads a QC document (multipart: file, remarks). */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const auth = await requireApiUser(["SUPPLIER"]);
    if (!auth.ok) return auth.response;
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES)
      return failure("TOO_LARGE", "The file is larger than 20 MB.", 413);
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return failure(
        "VALIDATION_ERROR",
        "Send the QC document as multipart form data.",
        400,
      );
    }
    const file = form.get("file");
    if (!(file instanceof File))
      return failure("VALIDATION_ERROR", "Attach a QC document.", 400, {
        file: ["Attach a QC document."],
      });
    const remarks = form.get("remarks");
    if (typeof remarks !== "string" || !remarks.trim())
      return failure(
        "VALIDATION_ERROR",
        "Add remarks for the QC document.",
        400,
        {
          remarks: ["Add remarks for the QC document."],
        },
      );
    if (file.size > MAX_QC_BYTES)
      return failure("TOO_LARGE", "The file is larger than 20 MB.", 413);
    const { id } = await context.params;
    return success(
      await submitQcDocument(getDb(), auth.user.id, id, {
        fileName: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
        remarks,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
