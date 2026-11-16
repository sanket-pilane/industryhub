import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { startEngineeringReview } from "@/lib/quotations/service";

/** Admin moves a SUBMITTED request into engineering review. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSameOrigin(request))
      return failure("FORBIDDEN", "Same-origin request required.", 403);
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;
    return success(
      startEngineeringReview(getDb(), auth.user.id, (await context.params).id),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
