import { NextResponse, type NextRequest } from "next/server";
import { findUserById } from "@/lib/auth/accounts";
import { homePathFor, roleForPath } from "@/lib/auth/roles";
import { SESSION_COOKIE, sessionSecret } from "@/lib/auth/session-config";
import { verifySessionToken } from "@/lib/auth/session-token";
import { getDb } from "@/lib/db";

/**
 * Sends each page request to the right place before anything renders:
 * signed-out visitors to /login, and signed-in users away from pages of
 * another role. Layouts and API routes still check the session themselves.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const id = token ? verifySessionToken(token, sessionSecret()) : null;
  const user = id ? findUserById(getDb(), id) : null;
  const go = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));

  if (pathname === "/login" || pathname === "/signup")
    return user ? go(homePathFor(user.role)) : NextResponse.next();
  if (!user) return go("/login");
  if (roleForPath(pathname) !== user.role) return go(homePathFor(user.role));
  return NextResponse.next();
}

export const config = {
  // Pages only: skip API routes, Next.js assets and files with an extension.
  matcher: ["/((?!api/|_next/|.*\\.[\\w]+$).*)"],
};
