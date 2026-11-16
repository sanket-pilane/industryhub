import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { quoteSchema } from "@/lib/orders/schemas";
import { quoteOrder } from "@/lib/orders/service";

/** Server-side totals for the checkout summary. Creates nothing. */
export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const auth = await requireApiUser(["CUSTOMER"]);
    if (!auth.ok) return auth.response;
    const input = quoteSchema.parse(await request.json());
    return success(quoteOrder(getDb(), auth.user.id, input));
  } catch (error) {
    return handleApiError(error);
  }
}
