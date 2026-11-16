export const SESSION_COOKIE = "industrihub-session";

let warned = false;

/** HMAC key for session cookies; a fixed development key when unset. */
export function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production" && !warned) {
    warned = true;
    console.warn("SESSION_SECRET is not set; using the development secret.");
  }
  return "industrihub-development-secret-change-in-production";
}
