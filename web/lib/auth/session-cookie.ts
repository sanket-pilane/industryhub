import "server-only";
import { cookies } from "next/headers";
import { createSessionToken } from "./session-token";
import { SESSION_COOKIE, sessionSecret } from "./session-config";

export async function setSessionCookie(
  request: Request,
  userId: string,
  remember: boolean,
) {
  const maxAge = remember ? 7 * 24 * 60 * 60 : 8 * 60 * 60;
  (await cookies()).set(
    SESSION_COOKIE,
    createSessionToken(sessionSecret(), Date.now() + maxAge * 1000, userId),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      ...(remember ? { maxAge } : {}),
    },
  );
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
