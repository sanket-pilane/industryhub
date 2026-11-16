import {
  CreateProductForm,
  ProductTableRow,
} from "@/components/operations/catalog-forms";
import "@/components/operations/operations.css";
import { listAllProducts, listCategories } from "@/lib/admin/catalog";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/utils/money";

export const metadata = { title: "Catalog" };

export default async function AdminCatalogPage() {
  await requireUser(["ADMIN"]);
  const db = getDb();
  const products = listAllProducts(db);
  const categories = listCategories(db);

  return (
    <main id="main">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Admin workspace</p>
          <h1>Catalog</h1>
          <p>
            Every product, including inactive ones that customers cannot see.
          </p>
        </div>
      </div>

      <section className="panel" aria-labelledby="products-heading">
        <h2 id="products-heading">Products ({products.length})</h2>
        <div
          className="table-scroll"
          role="region"
          aria-label="Products"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th className="quote-id">SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>GST</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <ProductTableRow
                  key={`${p.id}-${p.pricePaise}-${p.gstPercent}-${p.stockQuantity}-${p.isActive}`}
                  product={{
                    id: p.id,
                    sku: p.sku,
                    name: p.name,
                    categoryName: p.categoryName,
                    priceRupees: `${Math.floor(p.pricePaise / 100)}.${String(p.pricePaise % 100).padStart(2, "0")}`,
                    priceLabel: formatMoney(p.pricePaise),
                    gstPercent: p.gstPercent,
                    stockQuantity: p.stockQuantity,
                    isActive: p.isActive,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="create-heading">
        <h2 id="create-heading">Add a product</h2>
        <CreateProductForm
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        />
      </section>
    </main>
  );
}
