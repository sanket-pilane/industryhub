import type { DatabaseSync } from "node:sqlite";
import { recordAudit } from "@/lib/audit";
import { nextNumber, now, transaction } from "@/lib/db";
import { RepositoryError, notFound } from "@/lib/repositories/errors";
import { formatMoney } from "@/lib/utils/money";

export const GST_RATES = [0, 5, 12, 18, 28] as const;
export type GstRate = (typeof GST_RATES)[number];

export type AdminProduct = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  brand: string;
  pricePaise: number;
  gstPercent: number;
  stockQuantity: number;
  isActive: boolean;
};

export type CategoryOption = { slug: string; name: string; group: string };

const MAX_RUPEES = 99_999_999; // keeps paise well inside the safe integer range

/**
 * Converts a rupee amount typed as text ("1499", "1499.5", "1,499.50") into
 * integer paise without floating-point arithmetic.
 */
export function rupeesToPaise(input: string | number): number {
  const text = String(input).trim().replace(/,/g, "");
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match)
    throw new RepositoryError(
      "VALIDATION_ERROR",
      "Enter the price in rupees, with at most two decimal places.",
      400,
    );
  const rupees = Number(match[1]);
  const paise = Number((match[2] ?? "").padEnd(2, "0") || "0");
  if (rupees > MAX_RUPEES)
    throw new RepositoryError("VALIDATION_ERROR", "Price is too large.", 400);
  return rupees * 100 + paise;
}

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || "product"
  );
}

function uniqueSlug(db: DatabaseSync, name: string) {
  const base = slugify(name);
  let slug = base;
  for (
    let n = 2;
    db.prepare("SELECT 1 FROM products WHERE slug = ?").get(slug);
    n += 1
  )
    slug = `${base}-${n}`;
  return slug;
}

export function listCategories(db: DatabaseSync): CategoryOption[] {
  return (
    db
      .prepare(
        "SELECT slug, name, group_name FROM categories ORDER BY group_name, name",
      )
      .all() as {
      slug: string;
      name: string;
      group_name: string;
    }[]
  ).map((c) => ({ slug: c.slug, name: c.name, group: c.group_name }));
}

type ProductListRow = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category_slug: string;
  category_name: string;
  brand: string;
  price_paise: number;
  gst_percent: number;
  stock_quantity: number;
  is_active: number;
};

const PRODUCT_SELECT = `SELECT p.id, p.slug, p.sku, p.name, p.category_slug, c.name AS category_name,
    p.brand, p.price_paise, p.gst_percent, p.stock_quantity, p.is_active
  FROM products p JOIN categories c ON c.slug = p.category_slug`;

function toAdminProduct(row: ProductListRow): AdminProduct {
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    brand: row.brand,
    pricePaise: row.price_paise,
    gstPercent: row.gst_percent,
    stockQuantity: row.stock_quantity,
    isActive: row.is_active === 1,
  };
}

/** Every product, inactive ones included. */
export function listAllProducts(db: DatabaseSync): AdminProduct[] {
  return (
    db
      .prepare(`${PRODUCT_SELECT} ORDER BY p.sort_order, p.id`)
      .all() as ProductListRow[]
  ).map(toAdminProduct);
}

export function getAdminProduct(
  db: DatabaseSync,
  id: string,
): AdminProduct | null {
  const row = db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(id) as
    ProductListRow | undefined;
  return row ? toAdminProduct(row) : null;
}

export type NewProduct = {
  sku: string;
  name: string;
  categorySlug: string;
  brand: string;
  description: string;
  price: string | number;
  gstPercent: number;
  stockQuantity: number;
};

function checkGst(gst: number) {
  if (!(GST_RATES as readonly number[]).includes(gst))
    throw new RepositoryError(
      "VALIDATION_ERROR",
      "GST must be 0, 5, 12, 18 or 28 percent.",
      400,
    );
}

function checkStock(stock: number) {
  if (!Number.isInteger(stock) || stock < 0 || stock > 10_000_000)
    throw new RepositoryError(
      "VALIDATION_ERROR",
      "Stock must be a whole number, 0 or more.",
      400,
    );
}

export function createProduct(
  db: DatabaseSync,
  adminId: string,
  input: NewProduct,
) {
  const pricePaise = rupeesToPaise(input.price);
  checkGst(input.gstPercent);
  checkStock(input.stockQuantity);
  return transaction(db, () => {
    const sku = input.sku.trim();
    if (
      db.prepare("SELECT 1 FROM products WHERE sku = ? COLLATE NOCASE").get(sku)
    )
      throw new RepositoryError(
        "DUPLICATE_SKU",
        `SKU ${sku} already exists.`,
        409,
      );
    if (
      !db
        .prepare("SELECT 1 FROM categories WHERE slug = ?")
        .get(input.categorySlug)
    )
      throw new RepositoryError(
        "VALIDATION_ERROR",
        "Choose a valid category.",
        400,
      );

    let id = nextNumber(db, "PRODUCT", "PRD-", 12, 4);
    while (db.prepare("SELECT 1 FROM products WHERE id = ?").get(id))
      id = nextNumber(db, "PRODUCT", "PRD-", 12, 4);
    const slug = uniqueSlug(db, input.name);
    const { next } = db
      .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM products")
      .get() as { next: number };
    db.prepare(
      `INSERT INTO products (id, slug, sku, name, category_slug, brand, description, price_paise,
         gst_percent, stock_quantity, specifications, image, symbol, featured, is_active,
         sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', NULL, '◆', 0, 1, ?, ?)`,
    ).run(
      id,
      slug,
      sku,
      input.name.trim(),
      input.categorySlug,
      input.brand.trim(),
      input.description.trim(),
      pricePaise,
      input.gstPercent,
      input.stockQuantity,
      next,
      now(),
    );
    recordAudit(db, {
      actorId: adminId,
      action: "PRODUCT_CREATED",
      entityType: "PRODUCT",
      entityId: id,
      detail: `${sku} ${input.name.trim()} at ${formatMoney(pricePaise)}`,
    });
    return getAdminProduct(db, id) as AdminProduct;
  });
}

export type ProductChanges = {
  price?: string | number;
  gstPercent?: number;
  stockQuantity?: number;
  isActive?: boolean;
};

export function updateProduct(
  db: DatabaseSync,
  adminId: string,
  id: string,
  changes: ProductChanges,
) {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  const notes: string[] = [];
  if (changes.price !== undefined) {
    const paise = rupeesToPaise(changes.price);
    sets.push("price_paise = ?");
    values.push(paise);
    notes.push(`price ${formatMoney(paise)}`);
  }
  if (changes.gstPercent !== undefined) {
    checkGst(changes.gstPercent);
    sets.push("gst_percent = ?");
    values.push(changes.gstPercent);
    notes.push(`GST ${changes.gstPercent}%`);
  }
  if (changes.stockQuantity !== undefined) {
    checkStock(changes.stockQuantity);
    sets.push("stock_quantity = ?");
    values.push(changes.stockQuantity);
    notes.push(`stock ${changes.stockQuantity}`);
  }
  if (changes.isActive !== undefined) {
    sets.push("is_active = ?");
    values.push(changes.isActive ? 1 : 0);
    notes.push(changes.isActive ? "activated" : "deactivated");
  }
  if (sets.length === 0)
    throw new RepositoryError(
      "VALIDATION_ERROR",
      "Change at least one field.",
      400,
    );
  return transaction(db, () => {
    if (!getAdminProduct(db, id)) throw notFound("Product");
    db.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`).run(
      ...values,
      id,
    );
    recordAudit(db, {
      actorId: adminId,
      action: "PRODUCT_UPDATED",
      entityType: "PRODUCT",
      entityId: id,
      detail: notes.join(", "),
    });
    return getAdminProduct(db, id) as AdminProduct;
  });
}
