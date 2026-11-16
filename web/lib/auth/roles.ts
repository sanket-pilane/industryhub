import type { Role } from "../../../shared/enums";

/** Where each role lands after signing in. */
export function homePathFor(role: Role) {
  return role === "ADMIN" ? "/admin" : role === "SUPPLIER" ? "/supplier" : "/";
}

/** Which role may open a page path (API routes check roles themselves). */
export function roleForPath(pathname: string): Role {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "ADMIN";
  if (pathname === "/supplier" || pathname.startsWith("/supplier/"))
    return "SUPPLIER";
  return "CUSTOMER";
}
