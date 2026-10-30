import { describe, expect, it } from "vitest";
import { createMockToken, verifyMockToken } from "@/lib/auth/mock-token";
import { parseEnvironment } from "@/lib/env";
import { productQuerySchema, safeReturnPath } from "@/lib/validators";
import { formatMoney, lineTotal } from "@/lib/utils/money";
import { isSameOrigin } from "@/lib/auth/origin";
describe("origin validation", () => {
  it("uses the public host when Next normalizes the internal request URL", () => {
    expect(
      isSameOrigin(
        new Request("http://localhost:3100/api/mock/session", {
          headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" },
        }),
      ),
    ).toBe(true);
    expect(
      isSameOrigin(
        new Request("http://localhost:3100/api/mock/session", {
          headers: { host: "127.0.0.1:3100", origin: "https://evil.test" },
        }),
      ),
    ).toBe(false);
    expect(
      isSameOrigin(new Request("http://localhost:3100/api/mock/session")),
    ).toBe(false);
  });
});
describe("session integrity", () => {
  it("rejects tampered, expired and differently signed tokens", () => {
    const token = createMockToken("test-secret", 5000);
    expect(verifyMockToken(token, "test-secret", 1000)).toBe(
      "demo-customer-srushti",
    );
    expect(verifyMockToken(`x${token}`, "test-secret", 1000)).toBeNull();
    expect(verifyMockToken(token, "wrong-secret", 1000)).toBeNull();
    expect(verifyMockToken(token, "test-secret", 5000)).toBeNull();
    expect(verifyMockToken("malformed", "test-secret")).toBeNull();
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
  it("rejects invalid modes and missing/insecure Catalyst configuration", () => {
    expect(parseEnvironment({}).NEXT_PUBLIC_DATA_MODE).toBe("mock");
    expect(() =>
      parseEnvironment({ NEXT_PUBLIC_DATA_MODE: "unknown" }),
    ).toThrow();
    expect(() =>
      parseEnvironment({ NEXT_PUBLIC_DATA_MODE: "catalyst" }),
    ).toThrow();
    expect(() =>
      parseEnvironment({
        NEXT_PUBLIC_DATA_MODE: "catalyst",
        NEXT_PUBLIC_CATALYST_API_URL: "http://example.test",
      }),
    ).toThrow();
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
