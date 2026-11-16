// @vitest-environment node
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, SEED } from "../helpers/db";
import {
  createProduct,
  getAdminProduct,
  listAllProducts,
  listCategories,
  rupeesToPaise,
  slugify,
  updateProduct,
} from "@/lib/admin/catalog";
import { productFromRow } from "@/lib/repositories/sqlite";

const base = (
  db: DatabaseSync,
  overrides: Partial<Parameters<typeof createProduct>[2]> = {},
) => ({
  sku: "NEW-SKU-1",
  name: "Brass Gate Valve 1 inch",
  categorySlug: listCategories(db)[0].slug,
  brand: "Leader",
  description: "Full bore, threaded ends",
  price: "1499.50",
  gstPercent: 18,
  stockQuantity: 25,
  ...overrides,
});

describe("rupees to paise", () => {
  it.each([
    ["0", 0],
    ["1", 100],
    ["1499", 149900],
    ["1499.5", 149950],
    ["1499.50", 149950],
    ["0.07", 7],
    ["0.1", 10],
    ["19.99", 1999],
    ["1,499.05", 149905],
    ["16.35", 1635], // 16.35 * 100 is 1634.9999999999998 with floats
    ["1.15", 115], // 1.15 * 100 is 114.99999999999999 with floats
    [4.35, 435],
  ])("converts %s to %s paise exactly", (input, paise) => {
    expect(rupeesToPaise(input)).toBe(paise);
  });

  it.each(["", "abc", "-5", "1.234", "1e3", "12.", ".5", "100000000", "1 000"])(
    "rejects %j",
    (input) => {
      expect(() => rupeesToPaise(input)).toThrowError(
        expect.objectContaining({ code: "VALIDATION_ERROR" }),
      );
    },
  );
});

describe("slugify", () => {
  it("builds a url-safe slug", () => {
    expect(slugify('  Brass Gate Valve, 1" (Heavy)! ')).toBe(
      "brass-gate-valve-1-heavy",
    );
    expect(slugify("!!!")).toBe("product");
  });
});

describe("creating products", () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = createTestDb();
  });

  it("creates a product with exact paise, a slug and the next id, and records audit", () => {
    const product = createProduct(db, SEED.admin, base(db));
    expect(product).toMatchObject({
      id: "PRD-0013",
      sku: "NEW-SKU-1",
      slug: "brass-gate-valve-1-inch",
      pricePaise: 149950,
      gstPercent: 18,
      stockQuantity: 25,
      isActive: true,
    });
    const audit = db.prepare("SELECT action, entity_id FROM audit_log").get();
    expect(audit).toEqual({ action: "PRODUCT_CREATED", entity_id: "PRD-0013" });
    // The shopper-facing mapper can read the new row.
    const row = db
      .prepare("SELECT * FROM products WHERE id = 'PRD-0013'")
      .get() as Parameters<typeof productFromRow>[0];
    expect(productFromRow(row).pricePaise).toBe(149950);
  });

  it("rejects a duplicate SKU with 409 DUPLICATE_SKU", () => {
    const existing = db.prepare("SELECT sku FROM products LIMIT 1").get() as {
      sku: string;
    };
    expect(() =>
      createProduct(db, SEED.admin, base(db, { sku: existing.sku })),
    ).toThrowError(
      expect.objectContaining({ code: "DUPLICATE_SKU", status: 409 }),
    );
    expect(() =>
      createProduct(
        db,
        SEED.admin,
        base(db, { sku: existing.sku.toLowerCase() }),
      ),
    ).toThrowError(expect.objectContaining({ status: 409 }));
    expect(listAllProducts(db)).toHaveLength(12);
  });

  it("makes the slug unique when two products share a name", () => {
    const first = createProduct(db, SEED.admin, base(db));
    const second = createProduct(
      db,
      SEED.admin,
      base(db, { sku: "NEW-SKU-2" }),
    );
    expect(first.slug).toBe("brass-gate-valve-1-inch");
    expect(second.slug).toBe("brass-gate-valve-1-inch-2");
    expect(second.id).toBe("PRD-0014");
  });

  it("validates GST, stock, category and price", () => {
    expect(() =>
      createProduct(db, SEED.admin, base(db, { gstPercent: 7 })),
    ).toThrowError(/GST/);
    expect(() =>
      createProduct(db, SEED.admin, base(db, { stockQuantity: -1 })),
    ).toThrowError(/Stock/);
    expect(() =>
      createProduct(db, SEED.admin, base(db, { stockQuantity: 1.5 })),
    ).toThrowError(/Stock/);
    expect(() =>
      createProduct(db, SEED.admin, base(db, { categorySlug: "nope" })),
    ).toThrowError(/category/);
    expect(() =>
      createProduct(db, SEED.admin, base(db, { price: "12.345" })),
    ).toThrowError(/rupees/);
    for (const gst of [0, 5, 12, 18, 28])
      expect(
        createProduct(
          db,
          SEED.admin,
          base(db, { sku: `G-${gst}`, name: `GST ${gst}`, gstPercent: gst }),
        ).gstPercent,
      ).toBe(gst);
  });
});

describe("editing products", () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = createTestDb();
  });

  it("changes price, GST and stock", () => {
    const updated = updateProduct(db, SEED.admin, "PRD-0001", {
      price: "99.99",
      gstPercent: 12,
      stockQuantity: 7,
    });
    expect(updated).toMatchObject({
      pricePaise: 9999,
      gstPercent: 12,
      stockQuantity: 7,
    });
    expect(db.prepare("SELECT action FROM audit_log").get()).toEqual({
      action: "PRODUCT_UPDATED",
    });
  });

  it("deactivates a product: listed for admins, hidden from the shop", () => {
    updateProduct(db, SEED.admin, "PRD-0001", { isActive: false });
    expect(getAdminProduct(db, "PRD-0001")?.isActive).toBe(false);
    expect(listAllProducts(db)).toHaveLength(12);
    const visible = db
      .prepare("SELECT COUNT(*) AS n FROM products WHERE is_active = 1")
      .get();
    expect(visible).toEqual({ n: 11 });
    updateProduct(db, SEED.admin, "PRD-0001", { isActive: true });
    expect(getAdminProduct(db, "PRD-0001")?.isActive).toBe(true);
  });

  it("rejects empty or invalid changes and unknown products", () => {
    expect(() => updateProduct(db, SEED.admin, "PRD-0001", {})).toThrowError(
      /at least one/,
    );
    expect(() =>
      updateProduct(db, SEED.admin, "PRD-0001", { stockQuantity: -3 }),
    ).toThrowError(/Stock/);
    expect(() =>
      updateProduct(db, SEED.admin, "PRD-0001", { gstPercent: 3 }),
    ).toThrowError(/GST/);
    expect(() =>
      updateProduct(db, SEED.admin, "PRD-9999", { isActive: false }),
    ).toThrowError(expect.objectContaining({ status: 404 }));
    expect(
      getAdminProduct(db, "PRD-0001")?.stockQuantity,
    ).toBeGreaterThanOrEqual(0);
  });
});
