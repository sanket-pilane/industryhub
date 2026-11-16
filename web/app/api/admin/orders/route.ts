import { z } from "zod";
import { orderStatuses } from "../../../../../shared/enums";
import { handleApiError, success } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listAllOrders } from "@/lib/orders/queries";

const filterSchema = z.object({ status: z.enum(orderStatuses).optional() });

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;
    const params = new URL(request.url).searchParams;
    const { status } = filterSchema.parse({
      status: params.get("status") ?? undefined,
    });
    return success(listAllOrders(getDb(), status));
  } catch (error) {
    return handleApiError(error);
  }
}
