import type { ProductQuery } from "../../../shared/contracts";
import { categories, demoCustomer, products, quotations } from "@/mocks/seed";
import type { Repositories } from "./contracts";

export class RepositoryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}
export function createMockRepositories(
  options: { latencyMs?: number; fail?: boolean } = {},
): Repositories {
  const delay = async () => {
    await new Promise((resolve) =>
      setTimeout(resolve, options.latencyMs ?? 180),
    );
    if (options.fail)
      throw new RepositoryError(
        "MOCK_UNAVAILABLE",
        "The demo service is temporarily unavailable. Please retry.",
      );
  };
  return {
    catalog: {
      async list(query: ProductQuery = {}) {
        await delay();
        const q = (query.q ?? "").trim().toLocaleLowerCase("en-IN");
        let items = products.filter((p) => {
          const category = categories.find((c) => c.slug === p.category);
          return (
            (!q ||
              [
                p.name,
                p.sku,
                p.brand,
                p.description,
                category?.name ?? "",
                ...Object.values(p.specifications),
              ]
                .join(" ")
                .toLocaleLowerCase("en-IN")
                .includes(q)) &&
            (!query.category || p.category === query.category) &&
            (!query.group || category?.group === query.group) &&
            (!query.brand ||
              p.brand.toLowerCase() === query.brand.toLowerCase()) &&
            (!query.inStock || p.stockQuantity > 0)
          );
        });
        if (query.sort === "price_asc")
          items = [...items].sort((a, b) => a.pricePaise - b.pricePaise);
        if (query.sort === "price_desc")
          items = [...items].sort((a, b) => b.pricePaise - a.pricePaise);
        if (query.sort === "newest") items = [...items].reverse();
        const page = Math.max(1, query.page ?? 1);
        const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 24));
        return structuredClone({
          items: items.slice((page - 1) * pageSize, page * pageSize),
          page,
          pageSize,
          total: items.length,
        });
      },
      async findBySlug(slug) {
        await delay();
        return structuredClone(products.find((p) => p.slug === slug) ?? null);
      },
      async categories() {
        await delay();
        return structuredClone(categories);
      },
    },
    profiles: {
      async getById(id) {
        await delay();
        return id === demoCustomer.id ? structuredClone(demoCustomer) : null;
      },
    },
    quotations: {
      async listForCustomer(customerId) {
        await delay();
        return structuredClone(
          quotations.filter((q) => q.customerId === customerId),
        );
      },
    },
  };
}
