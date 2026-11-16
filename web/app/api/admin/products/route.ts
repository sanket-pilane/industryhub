import { z } from "zod";
import { failure, handleApiError, success } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { requireApiUser } from "@/lib/auth/session";
import { createProduct } from "@/lib/admin/catalog";
import { getDb } from "@/lib/db";

const gst = z
  .number({ error: "Choose a GST rate." })
  .refine(
    (v) => [0, 5, 12, 18, 28].includes(v),
    "GST must be 0, 5, 12, 18 or 28 percent.",
  );

const createProductSchema = z.object({
  sku: z.string().trim().min(1, "Enter a SKU.").max(60),
  name: z.string().trim().min(1, "Enter a product name.").max(160),
  categorySlug: z.string().trim().min(1, "Choose a category."),
  brand: z.string().trim().min(1, "Enter a brand.").max(80),
  description: z.string().trim().min(1, "Enter a description.").max(1000),
  price: z.union([z.string(), z.number()], {
    error: "Enter the price in rupees.",
  }),
  gstPercent: gst,
  stockQuantity: z
    .number({ error: "Enter the stock quantity." })
    .int("Stock must be a whole number.")
    .min(0, "Stock cannot be negative."),
});

/** Creates a product. The price arrives in rupees and is stored as integer paise. */
export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;
    const input = createProductSchema.parse(await request.json());
    return success(createProduct(getDb(), auth.user.id, input));
  } catch (error) {
    return handleApiError(error);
  }
}
