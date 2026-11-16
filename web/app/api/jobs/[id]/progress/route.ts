import { z } from "zod";
import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { recordProgress } from "@/lib/jobs/service";

const schema = z.object({
  progressPercent: z
    .number({ error: "Enter the progress as a number." })
    .int("Progress must be a whole number.")
    .min(0, "Progress cannot be below 0.")
    .max(99, "Progress is at most 99 until you submit QC documents."),
  remarks: z.string().trim().min(1, "Add remarks for this update.").max(1000),
});

/** The assigned supplier reports production progress (0 to 99, never decreasing). */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const auth = await requireApiUser(["SUPPLIER"]);
    if (!auth.ok) return auth.response;
    const body = schema.parse(await request.json());
    const { id } = await context.params;
    return success(
      recordProgress(getDb(), auth.user.id, id, {
        percent: body.progressPercent,
        remarks: body.remarks,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
