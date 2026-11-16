import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { paymentSchema } from "@/lib/orders/schemas";
import { payOrder } from "@/lib/orders/service";

/** Pays or retries paying an order the signed-in customer owns. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const auth = await requireApiUser(["CUSTOMER"]);
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    const payment = paymentSchema.parse(await request.json());
    return success(await payOrder(getDb(), auth.user, id, payment));
  } catch (error) {
    return handleApiError(error);
  }
}
