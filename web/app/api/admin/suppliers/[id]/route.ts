import { z } from "zod";
import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { setSupplierVerification } from "@/lib/admin/suppliers";
import { getDb } from "@/lib/db";

const schema = z.object({
  verificationStatus: z.enum(["VERIFIED", "REJECTED"], {
    error: "Choose Verified or Rejected.",
  }),
});

/** Verifies or rejects a supplier. */
export async function PATCH(
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
      setSupplierVerification(
        getDb(),
        auth.user.id,
        id,
        body.verificationStatus,
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
