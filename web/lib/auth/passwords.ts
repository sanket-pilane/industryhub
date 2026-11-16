import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** scrypt with a 16-byte random salt and a 32-byte derived key. */
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: scryptSync(password, salt, 32).toString("hex") };
}

export function verifyPassword(password: string, salt: string, hash: string) {
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length || 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
