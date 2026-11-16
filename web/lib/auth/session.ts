import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserProfile } from "../../../shared/contracts";
import type { Role } from "../../../shared/enums";
import { failure } from "@/lib/api/response";
import { getDb } from "@/lib/db";
import { findUserById } from "./accounts";
import { homePathFor } from "./roles";
import { SESSION_COOKIE, sessionSecret } from "./session-config";
import { verifySessionToken } from "./session-token";

export { SESSION_COOKIE, sessionSecret } from "./session-config";
export { homePathFor } from "./roles";

export async function getSessionUser(): Promise<UserProfile | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const id = token ? verifySessionToken(token, sessionSecret()) : null;
  return id ? findUserById(getDb(), id) : null;
}

/** Page guard: signed-out visitors go to /login, other roles to their own home. */
export async function requireUser(roles: Role[]): Promise<UserProfile> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect(homePathFor(user.role));
  return user;
}

/** API guard: 401 when signed out, 403 when the role is not allowed. */
export async function requireApiUser(
  roles: Role[],
): Promise<
  { ok: true; user: UserProfile } | { ok: false; response: Response }
> {
  const user = await getSessionUser();
  if (!user)
    return {
      ok: false,
      response: failure("UNAUTHENTICATED", "Sign in to continue.", 401),
    };
  if (!roles.includes(user.role))
    return {
      ok: false,
      response: failure(
        "FORBIDDEN",
        "You do not have access to this resource.",
        403,
      ),
    };
  return { ok: true, user };
}
