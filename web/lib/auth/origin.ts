/** Next may normalize request.url to localhost; Host preserves the public origin. */
export function isSameOrigin(request: Request) {
  const value = request.headers.get("origin");
  if (!value) return false;
  try {
    const origin = new URL(value);
    const internal = new URL(request.url);
    const host = request.headers.get("host") ?? internal.host;
    return (
      ["http:", "https:"].includes(origin.protocol) &&
      origin.protocol === internal.protocol &&
      origin.host === host &&
      origin.origin === value
    );
  } catch {
    return false;
  }
}
