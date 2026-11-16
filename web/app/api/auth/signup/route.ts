import { failure, handleApiError, success } from "@/lib/api/response";
import { registerCustomer } from "@/lib/auth/accounts";
import { isSameOrigin } from "@/lib/auth/origin";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { getDb } from "@/lib/db";
import { signupSchema } from "@/lib/validators";

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const input = signupSchema.parse(await request.json());
    const result = registerCustomer(getDb(), input);
    if ("error" in result)
      return failure(
        "EMAIL_TAKEN",
        "An account with this email already exists. Sign in instead.",
        409,
      );
    await setSessionCookie(request, result.profile.id, true);
    return success({ signedIn: true, role: "CUSTOMER", home: "/" });
  } catch (error) {
    return handleApiError(error);
  }
}
