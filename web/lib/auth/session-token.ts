import { createHmac, timingSafeEqual } from "node:crypto";

/** Session token: base64url({ id, expiresAt }) + "." + HMAC-SHA256 signature. */
function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(
  secret: string,
  expiresAt: number,
  id: string,
) {
  const payload = Buffer.from(JSON.stringify({ id, expiresAt })).toString(
    "base64url",
  );
  return `${payload}.${signature(payload, secret)}`;
}

export function verifySessionToken(
  token: string,
  secret: string,
  now = Date.now(),
): string | null {
  try {
    const [payload, signed, extra] = token.split(".");
    if (!payload || !signed || extra) return null;
    const expected = Buffer.from(signature(payload, secret));
    const actual = Buffer.from(signed);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return null;
    const value: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    );
    if (
      typeof value !== "object" ||
      value === null ||
      !("id" in value) ||
      !("expiresAt" in value)
    )
      return null;
    return typeof value.id === "string" &&
      typeof value.expiresAt === "number" &&
      value.expiresAt > now
      ? value.id
      : null;
  } catch {
    return null;
  }
}
