import { z } from "zod";
import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { reviewQc } from "@/lib/jobs/service";

const schema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, "Explain what the supplier must fix.")
    .max(1000),
});

/** Rejects the QC documents waiting on a job; a comment is required. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;
    const body = schema.parse(await request.json());
    const { id } = await context.params;
    return success(
      reviewQc(getDb(), auth.user.id, id, {
        approve: false,
        comment: body.comment,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
