/**
 * CSRF guard for state-changing routes.
 *
 * Browsers send Sec-Fetch-Site, which page scripts cannot forge, so it is
 * trusted first; it also stays correct behind preview/forwarding proxies that
 * serve the app over https while Next.js listens on http.
 * Without it (older clients), compare Origin with the public host. Next may
 * normalize request.url to localhost, so Host / X-Forwarded-* carry the origin
 * the browser actually used. A cross-site page cannot set those headers on a
 * fetch without a CORS preflight, which these routes never approve.
 */
export function isSameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const value = request.headers.get("origin");
  if (!value) return false;
  try {
    const origin = new URL(value);
    const internal = new URL(request.url);
    const first = (header: string) =>
      request.headers.get(header)?.split(",")[0]?.trim() || null;
    const host =
      first("x-forwarded-host") ?? request.headers.get("host") ?? internal.host;
    const proto = first("x-forwarded-proto");
    const protocol = proto ? `${proto}:` : internal.protocol;
    return (
      ["http:", "https:"].includes(origin.protocol) &&
      origin.protocol === protocol &&
      origin.host === host &&
      origin.origin === value
    );
  } catch {
    return false;
  }
}
