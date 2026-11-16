import { CatalogBrowser } from "@/components/catalog/catalog-browser";
import { getRepositories } from "@/lib/repositories";
export const metadata = { title: "Industrial Product Catalog" };
export default async function Catalog({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const repo = getRepositories();
  const [categories, products, params] = await Promise.all([
    repo.catalog.categories(),
    repo.catalog.list({ pageSize: 100 }),
    searchParams,
  ]);
  return (
    <main id="main" className="container workspace-page">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Catalog</p>
          <h1>Industrial Product Catalog</h1>
          <p>
            {products.total} products across {categories.length} industrial
            categories.
          </p>
        </div>
      </div>
      <CatalogBrowser
        key={JSON.stringify(params)}
        categories={categories}
        brands={[...new Set(products.items.map((p) => p.brand))].sort()}
      />
    </main>
  );
}
