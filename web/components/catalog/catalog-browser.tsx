"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { Category } from "../../../shared/contracts";
import { fetchProducts } from "@/lib/api/catalog";
import { Button } from "@/components/ui/button";
import { AddToCart } from "@/components/cart/add-to-cart";
import { formatMoney } from "@/lib/utils/money";

export function CatalogBrowser({
  categories,
  brands,
}: {
  categories: Category[];
  brands: string[];
}) {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const update = (key: string, value: string, query = search) => {
    if (timer.current) clearTimeout(timer.current);
    const next = new URLSearchParams(searchParams.toString());
    if (query) next.set("q", query);
    else next.delete("q");
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    // Native history updates App Router search params without remounting the
    // input after a server round trip, preserving edits made during debounce.
    window.history.replaceState(null, "", `/catalog?${next.toString()}`);
  };
  const apiParams = new URLSearchParams(searchParams.toString());
  apiParams.set("pageSize", "6");
  const query = useQuery({
    queryKey: ["products", apiParams.toString()],
    queryFn: ({ signal }) => fetchProducts(apiParams.toString(), signal),
  });
  const chips = [...searchParams.entries()].filter(
    ([key, value]) =>
      ["q", "category", "group", "brand", "inStock"].includes(key) &&
      value &&
      value !== "false",
  );
  return (
    <>
      <div className="catalog-toolbar">
        <form
          className="catalog-search"
          onSubmit={(e) => {
            e.preventDefault();
            update("q", search);
          }}
        >
          <label className="sr-only" htmlFor="catalog-search">
            Search catalog
          </label>
          <input
            id="catalog-search"
            type="search"
            value={search}
            placeholder="Search products, brands and SKUs"
            onChange={(e) => {
              const value = e.target.value;
              setSearch(value);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => update("q", value, value), 250);
            }}
          />
          <Button type="submit">Search</Button>
        </form>
        <label className="sr-only" htmlFor="sort">
          Sort products
        </label>
        <select
          id="sort"
          className="sort-select"
          value={searchParams.get("sort") ?? "relevance"}
          onChange={(e) => update("sort", e.target.value)}
        >
          <option value="relevance">Sort: Relevance</option>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low to high</option>
          <option value="price_desc">Price: High to low</option>
        </select>
      </div>
      {chips.length > 0 && (
        <div className="filter-chips" aria-label="Applied filters">
          {chips.map(([key, value]) => (
            <button
              className="filter-chip"
              key={key}
              onClick={() => {
                if (key === "q") setSearch("");
                update(key, "", key === "q" ? "" : search);
              }}
              aria-label={`Remove ${key} filter`}
            >
              {key === "inStock" ? "In stock" : value} ×
            </button>
          ))}
          <button
            className="filter-chip"
            onClick={() => {
              if (timer.current) clearTimeout(timer.current);
              setSearch("");
              window.history.replaceState(null, "", "/catalog");
            }}
          >
            Reset all
          </button>
        </div>
      )}
      <div className="catalog-layout">
        <aside className="catalog-filters" aria-label="Catalog filters">
          <h2>Filters</h2>
          <label>
            Category
            <select
              aria-label="Category"
              value={searchParams.get("category") ?? ""}
              onChange={(e) => update("category", e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option value={c.slug} key={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Brand
            <select
              aria-label="Brand"
              value={searchParams.get("brand") ?? ""}
              onChange={(e) => update("brand", e.target.value)}
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={searchParams.get("inStock") === "true"}
              onChange={(e) =>
                update("inStock", e.target.checked ? "true" : "")
              }
            />
            In stock only
          </label>
          <p className="muted">Local demo inventory.</p>
        </aside>
        <section aria-label="Product results" aria-busy={query.isFetching}>
          {query.isPending ? (
            <div className="catalog-grid" aria-label="Loading products">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="skeleton h-72" />
              ))}
              <span role="status" className="sr-only">
                Loading products…
              </span>
            </div>
          ) : query.isError ? (
            <div className="empty-state" role="alert">
              <h2>Unable to load products</h2>
              <p>{query.error.message}</p>
              <Button onClick={() => query.refetch()}>Try again</Button>
            </div>
          ) : (
            <>
              <p className="muted mb-4" role="status">
                {query.data.meta.total} products found
              </p>
              {query.data.data.length === 0 ? (
                <div className="empty-state">
                  <h2>No products found</h2>
                  <p>Try a product name or SKU, or clear your filters.</p>
                  <Button
                    onClick={() => {
                      setSearch("");
                      window.history.replaceState(null, "", "/catalog");
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="catalog-grid">
                  {query.data.data.map((product) => (
                    <article className="catalog-product" key={product.id}>
                      <div className="catalog-visual">
                        {product.image ? (
                          <Image
                            src={product.image}
                            alt={product.name}
                            width={150}
                            height={110}
                          />
                        ) : (
                          <span aria-hidden="true">{product.symbol}</span>
                        )}
                      </div>
                      <h2>{product.name}</h2>
                      <p>{product.description}</p>
                      <p>
                        {product.stockQuantity > 0
                          ? `${product.stockQuantity} in stock`
                          : "Made to order"}
                      </p>
                      <strong>{formatMoney(product.pricePaise)}</strong>
                      <p>Excl. {product.gstPercent}% GST</p>
                      <AddToCart productId={product.id} name={product.name} />
                      <details>
                        <summary>View specifications</summary>
                        <dl>
                          <dt>SKU</dt>
                          <dd>{product.sku}</dd>
                          <dt>Brand</dt>
                          <dd>{product.brand}</dd>
                          {Object.entries(product.specifications).map(
                            ([key, value]) => (
                              <div className="contents" key={key}>
                                <dt>{key}</dt>
                                <dd>{value}</dd>
                              </div>
                            ),
                          )}
                        </dl>
                      </details>
                    </article>
                  ))}
                </div>
              )}
              <div className="pagination">
                <Button
                  variant="secondary"
                  disabled={query.data.meta.page <= 1}
                  onClick={() =>
                    update("page", String(query.data.meta.page - 1))
                  }
                >
                  Previous
                </Button>
                <span>
                  Page {query.data.meta.page} of{" "}
                  {Math.max(
                    1,
                    Math.ceil(query.data.meta.total / query.data.meta.pageSize),
                  )}
                </span>
                <Button
                  variant="secondary"
                  disabled={
                    query.data.meta.page * query.data.meta.pageSize >=
                    query.data.meta.total
                  }
                  onClick={() =>
                    update("page", String(query.data.meta.page + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
