import { z } from "zod";
export const productSchema = z.object({
  id: z.string(),
  slug: z.string(),
  sku: z.string(),
  name: z.string(),
  category: z.string(),
  brand: z.string(),
  description: z.string(),
  pricePaise: z.number().int().nonnegative(),
  gstPercent: z.number(),
  stockQuantity: z.number().int().nonnegative(),
  specifications: z.record(z.string(), z.string()),
  image: z.string().nullable(),
  symbol: z.string(),
  featured: z.boolean(),
});
export const productsResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    data: z.array(productSchema),
    error: z.null(),
    meta: z.object({
      requestId: z.string(),
      page: z.number(),
      pageSize: z.number(),
      total: z.number(),
    }),
  }),
  z.object({
    success: z.literal(false),
    data: z.null(),
    error: z.object({ code: z.string(), message: z.string() }),
  }),
]);
