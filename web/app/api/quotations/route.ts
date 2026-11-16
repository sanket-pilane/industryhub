import { handleApiError, success } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listQuotationsForCustomer } from "@/lib/quotations/service";

/** The signed-in customer's quotations, newest first. */
export async function GET() {
  try {
    const auth = await requireApiUser(["CUSTOMER"]);
    if (!auth.ok) return auth.response;
    return success(listQuotationsForCustomer(getDb(), auth.user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
