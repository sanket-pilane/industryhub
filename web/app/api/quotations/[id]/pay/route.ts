import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { payAdvanceSchema } from "@/lib/quotations/rules";
import { payAdvance } from "@/lib/quotations/service";

/**
 * Pays the advance for an accepted quotation through the test-mode gateway.
 * No card or bank details are accepted: only the method and test outcome.
 * 404 not owner, 409 not accepted or already paid.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSameOrigin(request))
      return failure("FORBIDDEN", "Same-origin request required.", 403);
    const auth = await requireApiUser(["CUSTOMER"]);
    if (!auth.ok) return auth.response;
    const input = payAdvanceSchema.parse(await request.json());
    return success(
      await payAdvance(getDb(), auth.user.id, (await context.params).id, input),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
