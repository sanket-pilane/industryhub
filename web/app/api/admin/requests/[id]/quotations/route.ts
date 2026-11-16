import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { createQuotationSchema } from "@/lib/quotations/rules";
import { createQuotation } from "@/lib/quotations/service";

/**
 * Admin issues the next quotation version for a request. Totals are computed
 * on the server; 409 when the request is not under review or revision.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSameOrigin(request))
      return failure("FORBIDDEN", "Same-origin request required.", 403);
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;
    const input = createQuotationSchema.parse(await request.json());
    const quotation = createQuotation(
      getDb(),
      auth.user.id,
      (await context.params).id,
      input,
    );
    return success(quotation);
  } catch (error) {
    return handleApiError(error);
  }
}
