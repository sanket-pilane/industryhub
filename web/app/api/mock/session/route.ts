import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { failure, handleApiError, success } from "@/lib/api/response";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { setMockSession } from "@/lib/auth/mock-cookie";
import { authenticateAccount } from "@/lib/auth/mock-users";
import { loginSchema } from "@/lib/validators";
import { isSameOrigin } from "@/lib/auth/origin";
import { demoCustomer } from "@/mocks/seed";

function guard(request: Request) {
  if (env.NEXT_PUBLIC_DATA_MODE !== "mock")
    return failure("NOT_FOUND", "Not found.", 404);
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
}
export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  try {
    const input = loginSchema.parse(await request.json());
    const isDemo =
      input.email.toLowerCase() === demoCustomer.email &&
      input.password === "Industrihub@123";
    const userId = isDemo
      ? demoCustomer.id
      : authenticateAccount(input.email, input.password)?.id;
    if (!userId)
      return failure(
        "INVALID_CREDENTIALS",
        "Email or password is incorrect. Check them and try again.",
        401,
      );
    await setMockSession(request, userId, input.remember);
    return success({ signedIn: true });
  } catch (error) {
    return handleApiError(error);
  }
}
export async function DELETE(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  (await cookies()).delete(SESSION_COOKIE);
  return success({ signedIn: false });
}
