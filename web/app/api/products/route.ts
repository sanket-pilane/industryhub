import { success, handleApiError } from "@/lib/api/response";
import { getRepositories } from "@/lib/repositories";
import { productQuerySchema } from "@/lib/validators";
export async function GET(request: Request) {
  try {
    const query = productQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const { items, page, pageSize, total } =
      await getRepositories().catalog.list(query);
    return success(items, { page, pageSize, total });
  } catch (error) {
    return handleApiError(error);
  }
}
