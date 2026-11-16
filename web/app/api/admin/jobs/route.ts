import { z } from "zod";
import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { assignSupplier } from "@/lib/jobs/service";
import { listJobs } from "@/lib/jobs/queries";
import { jobStatuses } from "../../../../../shared/enums";

const assignSchema = z.object({
  requestId: z.string().trim().min(1, "Choose a request."),
  supplierId: z.string().trim().min(1, "Choose a verified supplier."),
  targetDate: z.string().trim().min(1, "Choose a target date."),
});

/** Lists jobs, optionally filtered by ?status=. */
export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;
    const status = new URL(request.url).searchParams.get("status");
    const filter = jobStatuses.find((s) => s === status);
    return success(listJobs(getDb(), { status: filter }));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Assigns a verified supplier to a request whose advance is paid. */
export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;
    const input = assignSchema.parse(await request.json());
    return success(assignSupplier(getDb(), auth.user.id, input));
  } catch (error) {
    return handleApiError(error);
  }
}
