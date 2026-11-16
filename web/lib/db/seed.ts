import type { DatabaseSync } from "node:sqlite";
import { hashPassword } from "@/lib/auth/passwords";
import {
  SAMPLE_PASSWORD,
  seedAddresses,
  seedCategories,
  seedProducts,
  seedSuppliers,
  seedUsers,
} from "./seed-data";

/** Loads the initial catalog and accounts into an empty database. */
export function seedDatabase(db: DatabaseSync) {
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM users").get() as {
    count: number;
  };
  if (count > 0) return;
  const created = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    const user = db.prepare(
      `INSERT INTO users (id, email, password_salt, password_hash, role, first_name, last_name,
         phone, company_name, gstin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const u of seedUsers) {
      const { salt, hash } = hashPassword(SAMPLE_PASSWORD);
      user.run(
        u.id,
        u.email,
        salt,
        hash,
        u.role,
        u.firstName,
        u.lastName,
        u.phone,
        u.companyName,
        u.gstin,
        created,
      );
    }
    const supplier = db.prepare(
      `INSERT INTO suppliers (id, user_id, company_name, gstin, city, state, capabilities,
         verification_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const s of seedSuppliers)
      supplier.run(
        s.id,
        s.userId,
        s.companyName,
        s.gstin,
        s.city,
        s.state,
        s.capabilities,
        s.verificationStatus,
        created,
      );
    const address = db.prepare(
      `INSERT INTO addresses (id, user_id, label, line1, line2, city, state, pincode, is_default,
         created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const a of seedAddresses)
      address.run(
        a.id,
        a.userId,
        a.label,
        a.line1,
        a.line2,
        a.city,
        a.state,
        a.pincode,
        a.isDefault ? 1 : 0,
        created,
      );
    const category = db.prepare(
      "INSERT INTO categories (slug, name, group_name) VALUES (?, ?, ?)",
    );
    for (const c of seedCategories) category.run(c.slug, c.name, c.group);
    const product = db.prepare(
      `INSERT INTO products (id, slug, sku, name, category_slug, brand, description, price_paise,
         gst_percent, stock_quantity, specifications, image, symbol, featured, sort_order,
         created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    seedProducts.forEach((p, index) =>
      product.run(
        p.id,
        p.slug,
        p.sku,
        p.name,
        p.category,
        p.brand,
        p.description,
        p.pricePaise,
        p.gstPercent,
        p.stockQuantity,
        JSON.stringify(p.specifications),
        p.image,
        p.symbol,
        p.featured ? 1 : 0,
        index,
        created,
      ),
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
