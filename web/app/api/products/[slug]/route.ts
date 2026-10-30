import { failure, handleApiError, success } from "@/lib/api/response";
import { getRepositories } from "@/lib/repositories";
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const product = await getRepositories().catalog.findBySlug(
      (await context.params).slug,
    );
    return product
      ? success(product)
      : failure("NOT_FOUND", "Product not found.", 404);
  } catch (error) {
    return handleApiError(error);
  }
}
