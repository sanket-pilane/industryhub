import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type {
  Category,
  Product,
  ProductQuery,
  Quotation,
  QuotationItem,
} from "../../../shared/contracts";
import type { QuotationStatus } from "../../../shared/enums";
import { findUserById } from "@/lib/auth/accounts";
import type { Repositories } from "./contracts";

type ProductRow = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category_slug: string;
  brand: string;
  description: string;
  price_paise: number;
  gst_percent: number;
  stock_quantity: number;
  specifications: string;
  image: string | null;
  symbol: string;
  featured: number;
};

export function productFromRow(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    category: row.category_slug,
    brand: row.brand,
    description: row.description,
    pricePaise: row.price_paise,
    gstPercent: row.gst_percent,
    stockQuantity: row.stock_quantity,
    specifications: JSON.parse(row.specifications) as Record<string, string>,
    image: row.image,
    symbol: row.symbol,
    featured: row.featured === 1,
  };
}

type QuotationRow = {
  id: string;
  request_id: string;
  customer_id: string;
  part_name: string;
  version: number;
  status: QuotationStatus;
  subtotal_paise: number;
  tax_paise: number;
  total_paise: number;
  advance_percent: number;
  lead_time_days: number;
  valid_until: string;
  terms: string;
  created_at: string;
};

export function loadQuotation(db: DatabaseSync, row: QuotationRow): Quotation {
  const items = (
    db
      .prepare(
        `SELECT description, quantity, unit_price_paise, gst_percent, tax_paise, total_paise
         FROM quotation_items WHERE quotation_id = ? ORDER BY id`,
      )
      .all(row.id) as {
      description: string;
      quantity: number;
      unit_price_paise: number;
      gst_percent: number;
      tax_paise: number;
      total_paise: number;
    }[]
  ).map((i): QuotationItem => ({
    description: i.description,
    quantity: i.quantity,
    unitPricePaise: i.unit_price_paise,
    gstPercent: i.gst_percent,
    taxPaise: i.tax_paise,
    totalPaise: i.total_paise,
  }));
  return {
    id: row.id,
    requestId: row.request_id,
    customerId: row.customer_id,
    partName: row.part_name,
    version: row.version,
    status: row.status,
    items,
    subtotalPaise: row.subtotal_paise,
    taxPaise: row.tax_paise,
    totalPaise: row.total_paise,
    advancePercent: row.advance_percent,
    leadTimeDays: row.lead_time_days,
    validUntil: row.valid_until,
    terms: row.terms,
    createdAt: row.created_at,
  };
}

export const QUOTATION_SELECT = `SELECT q.*, r.part_name FROM quotations q
  JOIN manufacturing_requests r ON r.id = q.request_id`;

/** Repositories backed by the SQLite database. */
export function createSqliteRepositories(db: DatabaseSync): Repositories {
  return {
    catalog: {
      async list(query: ProductQuery = {}) {
        const where = ["p.is_active = 1"];
        const params: SQLInputValue[] = [];
        const q = (query.q ?? "").trim().toLocaleLowerCase("en-IN");
        if (q) {
          where.push(
            "lower(p.name || ' ' || p.sku || ' ' || p.brand || ' ' || p.description || ' ' || c.name || ' ' || p.specifications) LIKE ? ESCAPE '\\'",
          );
          params.push(`%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
        }
        if (query.category) {
          where.push("p.category_slug = ?");
          params.push(query.category);
        }
        if (query.group) {
          where.push("c.group_name = ?");
          params.push(query.group);
        }
        if (query.brand) {
          where.push("lower(p.brand) = lower(?)");
          params.push(query.brand);
        }
        if (query.inStock) where.push("p.stock_quantity > 0");
        const order =
          query.sort === "price_asc"
            ? "p.price_paise ASC, p.sort_order"
            : query.sort === "price_desc"
              ? "p.price_paise DESC, p.sort_order"
              : query.sort === "newest"
                ? "p.sort_order DESC"
                : "p.sort_order ASC";
        const from = `FROM products p JOIN categories c ON c.slug = p.category_slug WHERE ${where.join(" AND ")}`;
        const { total } = db
          .prepare(`SELECT COUNT(*) AS total ${from}`)
          .get(...params) as {
          total: number;
        };
        const page = Math.max(1, query.page ?? 1);
        const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 24));
        const rows = db
          .prepare(`SELECT p.* ${from} ORDER BY ${order} LIMIT ? OFFSET ?`)
          .all(...params, pageSize, (page - 1) * pageSize) as ProductRow[];
        return { items: rows.map(productFromRow), page, pageSize, total };
      },
      async findBySlug(slug: string) {
        const row = db
          .prepare("SELECT * FROM products WHERE slug = ? AND is_active = 1")
          .get(slug) as ProductRow | undefined;
        return row ? productFromRow(row) : null;
      },
      async categories() {
        return (
          db
            .prepare(
              "SELECT slug, name, group_name FROM categories ORDER BY rowid",
            )
            .all() as {
            slug: string;
            name: string;
            group_name: Category["group"];
          }[]
        ).map((c) => ({ slug: c.slug, name: c.name, group: c.group_name }));
      },
    },
    profiles: {
      async getById(id: string) {
        return findUserById(db, id);
      },
    },
    quotations: {
      async listForCustomer(customerId: string) {
        const rows = db
          .prepare(
            `${QUOTATION_SELECT} WHERE q.customer_id = ? ORDER BY q.created_at DESC`,
          )
          .all(customerId) as QuotationRow[];
        return rows.map((row) => loadQuotation(db, row));
      },
    },
  };
}
