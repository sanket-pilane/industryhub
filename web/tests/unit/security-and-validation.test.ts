import { describe, expect, it } from "vitest";
import { homePathFor, roleForPath } from "@/lib/auth/roles";
import {
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth/session-token";
import { parseEnvironment } from "@/lib/env";
import { productQuerySchema, safeReturnPath } from "@/lib/validators";
import { formatMoney, lineTotal } from "@/lib/utils/money";
import { isSameOrigin } from "@/lib/auth/origin";
describe("origin validation", () => {
  it("uses the public host when Next normalizes the internal request URL", () => {
    expect(
      isSameOrigin(
        new Request("http://localhost:3100/api/auth/session", {
          headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" },
        }),
      ),
    ).toBe(true);
    expect(
      isSameOrigin(
        new Request("http://localhost:3100/api/auth/session", {
          headers: { host: "127.0.0.1:3100", origin: "https://evil.test" },
        }),
      ),
    ).toBe(false);
    expect(
      isSameOrigin(new Request("http://localhost:3100/api/auth/session")),
    ).toBe(false);
  });
  it("trusts the browser's Sec-Fetch-Site over Origin/Host", () => {
    const request = (site: string) =>
      new Request("http://127.0.0.1:3000/api/auth/session", {
        headers: {
          host: "127.0.0.1:3000",
          origin: "http://127.0.0.1:3000",
          "sec-fetch-site": site,
        },
      });
    expect(isSameOrigin(request("same-origin"))).toBe(true);
    for (const site of ["cross-site", "same-site", "none"])
      expect(isSameOrigin(request(site))).toBe(false);
  });
  it("accepts an https page served through a forwarding proxy", () => {
    const viaProxy = (origin: string) =>
      new Request("http://127.0.0.1:3000/api/auth/session", {
        headers: {
          host: "127.0.0.1:3000",
          origin,
          "x-forwarded-host": "preview.example.dev",
          "x-forwarded-proto": "https",
        },
      });
    expect(isSameOrigin(viaProxy("https://preview.example.dev"))).toBe(true);
    expect(isSameOrigin(viaProxy("https://evil.test"))).toBe(false);
  });
});
describe("session integrity", () => {
  it("rejects tampered, expired and differently signed tokens", () => {
    const token = createSessionToken("test-secret", 5000, "USR-0001");
    expect(verifySessionToken(token, "test-secret", 1000)).toBe("USR-0001");
    expect(verifySessionToken(`x${token}`, "test-secret", 1000)).toBeNull();
    expect(verifySessionToken(token, "wrong-secret", 1000)).toBeNull();
    expect(verifySessionToken(token, "test-secret", 5000)).toBeNull();
    expect(verifySessionToken("malformed", "test-secret")).toBeNull();
    // a payload re-signed with another user id fails the signature check
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ id: "USR-0003", expiresAt: 5000 }),
    ).toString("base64url");
    expect(
      verifySessionToken(`${forged}.${signature}`, "test-secret", 1000),
    ).toBeNull();
  });
  it("allows only existing local return routes", () => {
    for (const path of [
      "https://evil.test",
      "//evil.test",
      "/supplier",
      "/login",
      "/\\evil.test",
    ])
      expect(safeReturnPath(path)).toBe("/");
    expect(safeReturnPath("/")).toBe("/");
  });
});
describe("boundary validation", () => {
  it("treats blank settings as unset and rejects a short session secret", () => {
    expect(parseEnvironment({ DATABASE_PATH: "", SESSION_SECRET: "" })).toEqual(
      {},
    );
    expect(() => parseEnvironment({ SESSION_SECRET: "too-short" })).toThrow();
    expect(
      parseEnvironment({ SESSION_SECRET: "x".repeat(32) }).SESSION_SECRET,
    ).toHaveLength(32);
  });
  it("validates paging and parses false without truthiness bugs", () => {
    expect(productQuerySchema.parse({ inStock: "false" }).inStock).toBe(false);
    for (const input of [
      { page: "0" },
      { pageSize: "101" },
      { page: "2.5" },
      { inStock: "yes" },
    ])
      expect(productQuerySchema.safeParse(input).success).toBe(false);
  });
});
describe("integer money", () => {
  it("calculates GST without fractional currency arithmetic", () => {
    expect(lineTotal(48500, 3, 18)).toEqual({
      subtotalPaise: 145500,
      taxPaise: 26190,
      totalPaise: 171690,
    });
    expect(lineTotal(101, 1, 18).taxPaise).toBe(18);
    expect(formatMoney(128000)).toBe("₹1,280");
  });
  it("rejects unsafe or invalid amounts", () => {
    expect(() => lineTotal(1.1, 2, 18)).toThrow();
    expect(() => lineTotal(10, 0, 18)).toThrow();
    expect(() => lineTotal(Number.MAX_SAFE_INTEGER, 2, 18)).toThrow();
  });
});
describe("role routing", () => {
  it("sends each role to its own workspace", () => {
    expect(homePathFor("CUSTOMER")).toBe("/");
    expect(homePathFor("SUPPLIER")).toBe("/supplier");
    expect(homePathFor("ADMIN")).toBe("/admin");
  });
  it("maps page paths to the role allowed to open them", () => {
    expect(roleForPath("/admin")).toBe("ADMIN");
    expect(roleForPath("/admin/orders/ORD-1")).toBe("ADMIN");
    expect(roleForPath("/supplier/jobs/JOB-1")).toBe("SUPPLIER");
    for (const path of [
      "/",
      "/catalog",
      "/orders",
      "/administrator",
      "/suppliers",
    ])
      expect(roleForPath(path)).toBe("CUSTOMER");
  });
});
