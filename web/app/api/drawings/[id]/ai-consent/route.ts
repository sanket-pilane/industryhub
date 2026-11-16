import { z } from "zod";
import { failure, handleApiError, success } from "@/lib/api/response";
import { setAiReviewConsent } from "@/lib/ai/service";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

const consentSchema = z.object({ allowed: z.boolean() });

/** Customer allows or withdraws AI-assisted review for their own request. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSameOrigin(request))
      return failure("FORBIDDEN", "Same-origin request required.", 403);
    const auth = await requireApiUser(["CUSTOMER"]);
    if (!auth.ok) return auth.response;
    const { allowed } = consentSchema.parse(await request.json());
    return success(
      setAiReviewConsent(
        getDb(),
        auth.user.id,
        (await context.params).id,
        allowed,
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
