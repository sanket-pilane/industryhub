import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { reasonSchema } from "@/lib/quotations/rules";
import { rejectRequest } from "@/lib/quotations/service";

/** Admin rejects a request; a reason is required. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSameOrigin(request))
      return failure("FORBIDDEN", "Same-origin request required.", 403);
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;
    const { reason } = reasonSchema.parse(await request.json());
    return success(
      rejectRequest(getDb(), auth.user.id, (await context.params).id, reason),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
