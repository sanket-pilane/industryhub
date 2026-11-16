import { z } from "zod";
import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { updateProduct } from "@/lib/admin/catalog";
import { getDb } from "@/lib/db";

const patchSchema = z
  .object({
    price: z.union([z.string(), z.number()]).optional(),
    gstPercent: z
      .number()
      .refine(
        (v) => [0, 5, 12, 18, 28].includes(v),
        "GST must be 0, 5, 12, 18 or 28 percent.",
      )
      .optional(),
    stockQuantity: z
      .number()
      .int("Stock must be a whole number.")
      .min(0, "Stock cannot be negative.")
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

/** Edits a product's price (in rupees), GST, stock or active flag. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;
    const changes = patchSchema.parse(await request.json());
    const { id } = await context.params;
    return success(updateProduct(getDb(), auth.user.id, id, changes));
  } catch (error) {
    return handleApiError(error);
  }
}
