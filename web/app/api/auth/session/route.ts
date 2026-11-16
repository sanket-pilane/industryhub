import { failure, handleApiError, success } from "@/lib/api/response";
import { authenticate } from "@/lib/auth/accounts";
import { isSameOrigin } from "@/lib/auth/origin";
import { homePathFor } from "@/lib/auth/session";
import {
  clearSessionCookie,
  setSessionCookie,
} from "@/lib/auth/session-cookie";
import { getDb } from "@/lib/db";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const input = loginSchema.parse(await request.json());
    const user = authenticate(getDb(), input.email, input.password);
    if (!user)
      return failure(
        "INVALID_CREDENTIALS",
        "Email or password is incorrect. Check them and try again.",
        401,
      );
    await setSessionCookie(request, user.id, input.remember);
    return success({
      signedIn: true,
      role: user.role,
      home: homePathFor(user.role),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  await clearSessionCookie();
  return success({ signedIn: false });
}
