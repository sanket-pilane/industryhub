import { failure, handleApiError, success } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  actionBlockReason,
  getQuotationForCustomer,
  listAdvancePayments,
} from "@/lib/quotations/service";
import { advanceAmounts } from "@/lib/quotations/rules";

/** One quotation, only for its owning customer (404 for anyone else). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiUser(["CUSTOMER"]);
    if (!auth.ok) return auth.response;
    const db = getDb();
    const quote = getQuotationForCustomer(
      db,
      auth.user.id,
      (await context.params).id,
    );
    if (!quote) return failure("NOT_FOUND", "Quotation was not found.", 404);
    return success({
      quotation: quote,
      ...advanceAmounts(quote.totalPaise, quote.advancePercent),
      actionBlockedReason: actionBlockReason(db, quote),
      payments: listAdvancePayments(db, quote.id),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
