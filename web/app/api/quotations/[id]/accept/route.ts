import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { acceptQuotation } from "@/lib/quotations/service";

/** Customer accepts the latest, unexpired quotation. 404 not owner, 409 not actionable. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSameOrigin(request))
      return failure("FORBIDDEN", "Same-origin request required.", 403);
    const auth = await requireApiUser(["CUSTOMER"]);
    if (!auth.ok) return auth.response;
    return success(
      acceptQuotation(getDb(), auth.user.id, (await context.params).id),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
