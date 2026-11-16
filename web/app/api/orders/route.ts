import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listOrdersForCustomer } from "@/lib/orders/queries";
import { placeOrderSchema } from "@/lib/orders/schemas";
import { placeOrder } from "@/lib/orders/service";

export async function GET() {
  try {
    const auth = await requireApiUser(["CUSTOMER"]);
    if (!auth.ok) return auth.response;
    return success(listOrdersForCustomer(getDb(), auth.user.id));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Places an order. Prices come from the database; the body carries product ids and quantities only. */
export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const auth = await requireApiUser(["CUSTOMER"]);
    if (!auth.ok) return auth.response;
    const input = placeOrderSchema.parse(await request.json());
    return success(await placeOrder(getDb(), auth.user, input));
  } catch (error) {
    return handleApiError(error);
  }
}
