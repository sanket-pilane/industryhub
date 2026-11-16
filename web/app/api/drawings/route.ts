import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { MAX_DRAWING_BYTES } from "@/lib/drawings/rules";
import { getDrawingStore } from "@/lib/drawings/store";
import { processDrawingUpload } from "@/lib/drawings/upload";

/** Room for the form fields that travel with the file. */
const MAX_BODY_BYTES = MAX_DRAWING_BYTES + 1024 * 1024;

export async function GET() {
  try {
    const auth = await requireApiUser(["CUSTOMER"]);
    if (!auth.ok) return auth.response;
    return success(await getDrawingStore().listForCustomer(auth.user.id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const auth = await requireApiUser(["CUSTOMER"]);
    if (!auth.ok) return auth.response;
    const { user } = auth;
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES)
      return failure("TOO_LARGE", "The file is larger than 50 MB.", 413);
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return failure(
        "VALIDATION_ERROR",
        "Send the drawing as multipart form data.",
        400,
      );
    }
    const outcome = await processDrawingUpload(
      form,
      user.id,
      getDrawingStore(),
    );
    return outcome.ok
      ? success(outcome.request)
      : failure(outcome.code, outcome.message, outcome.status, outcome.fields);
  } catch (error) {
    return handleApiError(error);
  }
}
