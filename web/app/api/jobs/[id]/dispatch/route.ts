import { z } from "zod";
import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { dispatchJob } from "@/lib/jobs/service";

const schema = z.object({
  courier: z.string().trim().min(1, "Enter the courier name.").max(80),
  trackingNumber: z
    .string()
    .trim()
    .min(1, "Enter the tracking number.")
    .max(80),
});

/** The assigned supplier dispatches the goods after QC approval. */
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
    dispatchJob(getDb(), auth.user.id, id, body);
    return success({ id, status: "DISPATCHED" });
  } catch (error) {
    return handleApiError(error);
  }
}
