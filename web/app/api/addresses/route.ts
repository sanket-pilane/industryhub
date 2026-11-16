import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  addressSchema,
  createAddress,
  listAddresses,
} from "@/lib/orders/addresses";

export async function GET() {
  try {
    const auth = await requireApiUser(["CUSTOMER"]);
    if (!auth.ok) return auth.response;
    return success(listAddresses(getDb(), auth.user.id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const auth = await requireApiUser(["CUSTOMER"]);
    if (!auth.ok) return auth.response;
    const input = addressSchema.parse(await request.json());
    return success(createAddress(getDb(), auth.user.id, input));
  } catch (error) {
    return handleApiError(error);
  }
}
