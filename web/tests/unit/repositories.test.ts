import { describe, expect, it } from "vitest";
import { createMockRepositories } from "@/lib/repositories/mock";
describe("mock repositories", () => {
  const repo = createMockRepositories({ latencyMs: 0 });
  it("searches specifications and SKU, intersects filters, sorts and paginates", async () => {
    expect((await repo.catalog.list({ q: "25×52×15" })).total).toBe(2);
    expect((await repo.catalog.list({ q: "SKF-6205" })).items[0].brand).toBe(
      "SKF",
    );
    expect(
      (await repo.catalog.list({ group: "electrical", inStock: true })).total,
    ).toBe(2);
    const first = await repo.catalog.list({ sort: "price_asc", pageSize: 3 });
    const second = await repo.catalog.list({
      sort: "price_asc",
      pageSize: 3,
      page: 2,
    });
    expect(first.items).toHaveLength(3);
    expect(first.total).toBe(12);
    expect(first.items[2].pricePaise).toBeLessThanOrEqual(
      second.items[0].pricePaise,
    );
    expect((await repo.catalog.list({ q: "unobtainium" })).items).toEqual([]);
  });
  it("limits profile and quotation access by owner", async () => {
    expect(await repo.profiles.getById("other-customer")).toBeNull();
    expect(await repo.quotations.listForCustomer("other-customer")).toEqual([]);
    expect(
      await repo.quotations.listForCustomer("demo-customer-srushti"),
    ).toHaveLength(4);
  });
  it("does not leak mutable seed references", async () => {
    const result = await repo.catalog.list();
    result.items[0].pricePaise = 1;
    expect((await repo.catalog.list()).items[0].pricePaise).toBe(48500);
  });
  it("supports deterministic failure injection", async () => {
    await expect(
      createMockRepositories({ latencyMs: 0, fail: true }).catalog.list(),
    ).rejects.toMatchObject({ code: "MOCK_UNAVAILABLE" });
  });
});
