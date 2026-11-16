import { z } from "zod";
import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { notFound } from "@/lib/repositories/errors";
import {
  findSupplierByUser,
  updateCapabilities,
} from "@/lib/suppliers/profile";

const schema = z.object({
  capabilities: z
    .string()
    .max(1000, "Keep capabilities under 1000 characters."),
});

export async function GET() {
  try {
    const auth = await requireApiUser(["SUPPLIER"]);
    if (!auth.ok) return auth.response;
    const supplier = findSupplierByUser(getDb(), auth.user.id);
    if (!supplier) throw notFound("Supplier profile");
    return success(supplier);
  } catch (error) {
    return handleApiError(error);
  }
}

/** The supplier edits the capabilities text of their own profile. */
export async function PATCH(request: Request) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const auth = await requireApiUser(["SUPPLIER"]);
    if (!auth.ok) return auth.response;
    const body = schema.parse(await request.json());
    return success(
      updateCapabilities(getDb(), auth.user.id, body.capabilities),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
