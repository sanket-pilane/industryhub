import { productsResponseSchema } from "../../../shared/schemas/catalog";
export async function fetchProducts(query: string, signal?: AbortSignal) {
  const response = await fetch(`/api/products?${query}`, { signal });
  const result = productsResponseSchema.parse(await response.json());
  if (!result.success) throw new Error(result.error.message);
  if (!response.ok) throw new Error("Unable to load products. Please retry.");
  return result;
}
