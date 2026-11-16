import { failure, handleApiError } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { findReadableQcDocument } from "@/lib/jobs/service";
import {
  FileStorage,
  fileResponseHeaders,
  wantsInline,
} from "@/lib/storage/files";

/**
 * Serves a QC document (download, or `?inline=1` to view PDFs and images): any admin, the supplier who uploaded it, and the
 * customer who owns the request. Everyone else gets 404.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiUser(["CUSTOMER", "SUPPLIER", "ADMIN"]);
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    const doc = findReadableQcDocument(getDb(), auth.user, id);
    if (!doc) return failure("NOT_FOUND", "QC document not found.", 404);
    let data: Uint8Array;
    try {
      data = await new FileStorage().read(doc.storageKey);
    } catch {
      return failure("NOT_FOUND", "QC document not found.", 404);
    }
    return new Response(data as BodyInit, {
      headers: fileResponseHeaders(doc.fileName, wantsInline(request)),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
