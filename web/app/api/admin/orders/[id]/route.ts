import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb, transaction } from "@/lib/db";
import { getOrder } from "@/lib/orders/queries";
import { adminOrderPatchSchema } from "@/lib/orders/schemas";
import { transitionOrder } from "@/lib/orders/status";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;
    return success(getOrder(getDb(), (await context.params).id));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Moves an order along CONFIRMED, PACKED, DISPATCHED, DELIVERED, or cancels it. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    const patch = adminOrderPatchSchema.parse(await request.json());
    const db = getDb();
    transaction(db, () =>
      transitionOrder(db, id, patch.status, auth.user.id, {
        courier: patch.courier,
        trackingNumber: patch.trackingNumber,
        comment: patch.comment,
      }),
    );
    return success(getOrder(db, id));
  } catch (error) {
    return handleApiError(error);
  }
}
