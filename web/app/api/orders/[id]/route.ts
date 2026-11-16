import { handleApiError, success } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getOrderForCustomer } from "@/lib/orders/queries";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiUser(["CUSTOMER"]);
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    return success(getOrderForCustomer(getDb(), id, auth.user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
