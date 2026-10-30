import "server-only";
import { cookies } from "next/headers";
import { createMockToken } from "./mock-token";
import { mockSessionSecret, SESSION_COOKIE } from "./session";

export async function setMockSession(
  request: Request,
  userId: string,
  remember: boolean,
) {
  const maxAge = remember ? 7 * 24 * 60 * 60 : 8 * 60 * 60;
  (await cookies()).set(
    SESSION_COOKIE,
    createMockToken(mockSessionSecret(), Date.now() + maxAge * 1000, userId),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      ...(remember ? { maxAge } : {}),
    },
  );
}
