import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { startProduction } from "@/lib/jobs/service";

/** The assigned supplier starts production. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const auth = await requireApiUser(["SUPPLIER"]);
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    startProduction(getDb(), auth.user.id, id);
    return success({ id, status: "IN_PRODUCTION" });
  } catch (error) {
    return handleApiError(error);
  }
}
