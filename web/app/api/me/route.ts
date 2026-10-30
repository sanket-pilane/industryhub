import { failure, handleApiError, success } from "@/lib/api/response";
import { getSessionUser } from "@/lib/auth/session";
export async function GET() {
  try {
    const user = await getSessionUser();
    return user
      ? success(user)
      : failure("UNAUTHENTICATED", "Sign in to continue.", 401);
  } catch (error) {
    return handleApiError(error);
  }
}
