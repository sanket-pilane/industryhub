import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { markDelivered } from "@/lib/jobs/service";

/** Marks a dispatched job (and its request) as delivered. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    markDelivered(getDb(), auth.user.id, id);
    return success({ id, status: "DELIVERED" });
  } catch (error) {
    return handleApiError(error);
  }
}
