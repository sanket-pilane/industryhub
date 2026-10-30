import { handleApiError, success } from "@/lib/api/response";
import { getRepositories } from "@/lib/repositories";
export async function GET() {
  try {
    return success(await getRepositories().catalog.categories());
  } catch (error) {
    return handleApiError(error);
  }
}
