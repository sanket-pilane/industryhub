import { env } from "@/lib/env";
import { failure, handleApiError, success } from "@/lib/api/response";
import { setMockSession } from "@/lib/auth/mock-cookie";
import { registerAccount } from "@/lib/auth/mock-users";
import { isSameOrigin } from "@/lib/auth/origin";
import { signupSchema } from "@/lib/validators";
import { demoCustomer } from "@/mocks/seed";

export async function POST(request: Request) {
  if (env.NEXT_PUBLIC_DATA_MODE !== "mock")
    return failure("NOT_FOUND", "Not found.", 404);
  if (!isSameOrigin(request))
    return failure("FORBIDDEN", "Same-origin request required.", 403);
  try {
    const input = signupSchema.parse(await request.json());
    const result =
      input.email.toLowerCase() === demoCustomer.email
        ? ({ error: "EMAIL_TAKEN" } as const)
        : registerAccount(input);
    if ("error" in result)
      return failure(
        "EMAIL_TAKEN",
        "An account with this email already exists. Sign in instead.",
        409,
      );
    await setMockSession(request, result.profile.id, true);
    return success({ signedIn: true });
  } catch (error) {
    return handleApiError(error);
  }
}
