import { failure, handleApiError, success } from "@/lib/api/response";
import { getDrawingReviewer } from "@/lib/ai/drawing-reviewer";
import { analyseRequestDrawing, latestAnalysis } from "@/lib/ai/service";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

/** The model can take up to a few minutes on a dense drawing. */
export const maxDuration = 300;

/** Latest AI review of the request's drawing (null when none has run). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;
    return success(latestAnalysis(getDb(), (await context.params).id));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Admin runs (or re-runs) the AI review of the request's drawing. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSameOrigin(request))
      return failure("FORBIDDEN", "Same-origin request required.", 403);
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;
    const analysis = await analyseRequestDrawing(
      getDb(),
      (await context.params).id,
      auth.user.id,
      getDrawingReviewer(),
    );
    return success(analysis);
  } catch (error) {
    return handleApiError(error);
  }
}
