import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { revisionSchema } from "@/lib/quotations/rules";
import { requestQuotationRevision } from "@/lib/quotations/service";

/** Customer asks for a revised quotation; a comment is required. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSameOrigin(request))
      return failure("FORBIDDEN", "Same-origin request required.", 403);
    const auth = await requireApiUser(["CUSTOMER"]);
    if (!auth.ok) return auth.response;
    const { comment } = revisionSchema.parse(await request.json());
    return success(
      requestQuotationRevision(
        getDb(),
        auth.user.id,
        (await context.params).id,
        comment,
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
