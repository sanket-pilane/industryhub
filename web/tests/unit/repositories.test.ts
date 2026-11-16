// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db";
import { createSqliteRepositories } from "@/lib/repositories/sqlite";
import { SEED, addCustomer, createTestDb } from "../helpers/db";

describe("SQLite repositories", () => {
  let db: Database;
  let repo: ReturnType<typeof createSqliteRepositories>;
  beforeEach(() => {
    db = createTestDb();
    repo = createSqliteRepositories(db);
  });

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

  it("treats LIKE wildcards in a search as plain text", async () => {
    // unescaped, "S%F" and "6_05" would match SKF-6205
    expect((await repo.catalog.list({ q: "S%F" })).total).toBe(0);
    expect((await repo.catalog.list({ q: "6_05" })).total).toBe(0);
    expect((await repo.catalog.list({ q: "18%" })).total).toBe(12);
  });

  it("hides inactive products from the catalog", async () => {
    const { items } = await repo.catalog.list({ pageSize: 1 });
    db.prepare("UPDATE products SET is_active = 0 WHERE id = ?").run(
      items[0].id,
    );
    expect((await repo.catalog.list()).total).toBe(11);
    expect(await repo.catalog.findBySlug(items[0].slug)).toBeNull();
  });

  it("returns profiles only for active accounts", async () => {
    expect((await repo.profiles.getById(SEED.customer))?.email).toBe(
      "srushti.shinde@apexmotion.in",
    );
    expect(await repo.profiles.getById("USR-missing")).toBeNull();
    db.prepare("UPDATE users SET is_active = 0 WHERE id = ?").run(
      SEED.customer,
    );
    expect(await repo.profiles.getById(SEED.customer)).toBeNull();
  });

  it("lists quotations only for their customer, with line items", async () => {
    const other = addCustomer(db, "other@test.in");
    const at = new Date().toISOString();
    db.prepare(
      `INSERT INTO manufacturing_requests (id, customer_id, part_name, quantity, material,
        tolerance, process, finish, target_date, status, revision, file_name, file_size,
        file_extension, file_checksum, storage_key, submitted_at, updated_at)
       VALUES ('RFQ-T1', ?, 'Bracket', 10, 'EN8 Steel', 'ISO 2768-m (medium)', 'CNC milling',
        'As machined', '2099-01-01', 'QUOTED', 1, 'b.pdf', 10, 'pdf', 'abc', 'k', ?, ?)`,
    ).run(SEED.customer, at, at);
    db.prepare(
      `INSERT INTO quotations (id, request_id, customer_id, version, status, subtotal_paise,
        tax_paise, total_paise, lead_time_days, valid_until, terms, created_by, created_at, updated_at)
       VALUES ('QT-T1', 'RFQ-T1', ?, 1, 'QUOTED', 100000, 18000, 118000, 14, '2099-01-01', '', ?, ?, ?)`,
    ).run(SEED.customer, SEED.admin, at, at);
    db.prepare(
      `INSERT INTO quotation_items (quotation_id, description, quantity, unit_price_paise,
        gst_percent, tax_paise, total_paise) VALUES ('QT-T1', 'Machining', 10, 10000, 18, 18000, 118000)`,
    ).run();

    const mine = await repo.quotations.listForCustomer(SEED.customer);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      id: "QT-T1",
      partName: "Bracket",
      totalPaise: 118000,
      advancePercent: 50,
      items: [{ description: "Machining", quantity: 10, totalPaise: 118000 }],
    });
    expect(await repo.quotations.listForCustomer(other)).toEqual([]);
  });
});
