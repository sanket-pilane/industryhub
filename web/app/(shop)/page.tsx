import Image from "next/image";
import Link from "next/link";
import { AddToCart } from "@/components/cart/add-to-cart";
import { ProductSearch } from "@/components/search/product-search";
import { Icon, type IconName } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/button";
import { getRepositories } from "@/lib/repositories";
import { formatMoney } from "@/lib/utils/money";
const popularSearches = [
  "Bearing",
  "Pneumatic cylinder",
  "Contactor",
  "SKF-6205",
];

export default async function Home() {
  const repo = getRepositories();
  const [{ items: products }, categories] = await Promise.all([
    repo.catalog.list(),
    repo.catalog.categories(),
  ]);
  const groups = [
    { slug: "mechanical", name: "Mechanical", symbol: "gear" },
    { slug: "electrical", name: "Electrical", symbol: "ϟ" },
    { slug: "automation", name: "Automation", symbol: "⌁" },
    { slug: "tools", name: "Tools & MRO", symbol: "▦" },
  ];
  const capabilities: { icon: IconName; title: string; text: string }[] = [
    {
      icon: "factory",
      title: "CNC machining",
      text: "Milling, turning and precision bores",
    },
    {
      icon: "shield",
      title: "Inspection & QC",
      text: "Material and dimensional reports",
    },
    {
      icon: "truck",
      title: "Production delivery",
      text: "Tracked dispatch and GST invoice",
    },
  ];
  return (
    <main id="main">
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow desktop-only">
              Industrial commerce + custom manufacturing
            </p>
            <p className="eyebrow mobile-only">
              Industrial B2B + custom manufacturing
            </p>
            <h1 className="desktop-only">
              Precision parts. Built to specification.
            </h1>
            <h1 className="mobile-only">
              Precision parts, without procurement friction.
            </h1>
            <p className="hero-description desktop-only">
              Source industrial components or upload a CAD drawing for a
              production-ready quotation—one trusted workflow from RFQ to
              delivery.
            </p>
            <p className="hero-description mobile-only">
              Shop verified components or upload a CAD drawing for a
              production-ready quote.
            </p>
            <ProductSearch
              variant="hero"
              placeholder="Search by part, brand or SKU"
            />
            <div className="popular-searches">
              <span>Popular:</span>
              {popularSearches.map((q) => (
                <Link
                  key={q}
                  href={`/catalog?${new URLSearchParams({ q }).toString()}`}
                >
                  {q}
                </Link>
              ))}
            </div>
            <div className="hero-actions">
              <LinkButton href="/catalog">
                Browse Catalog
                <Icon name="arrowInverse" />
              </LinkButton>
              <LinkButton href="/upload-drawing" variant="secondary">
                Upload Drawing
              </LinkButton>
            </div>
            <p className="hero-assurance">
              ✓ Verified suppliers &nbsp; ✓ GST invoices &nbsp; ✓ QC
              traceability
            </p>
          </div>
          <aside className="manufacturing-card">
            <p className="eyebrow">Custom manufacturing</p>
            <h2>Upload once. Track every stage.</h2>
            <div className="spec-row">
              <span>Gear_Housing_RevC.step</span>
              <span>Drawing ready</span>
            </div>
            <div className="spec-row">
              <span>Material: EN8 Steel</span>
              <span>Specification set</span>
            </div>
            <div className="spec-row">
              <span>25 pcs · CNC milling</span>
              <span>Quote in 24h</span>
            </div>
          </aside>
        </div>
      </section>
      <section className="category-section" id="categories">
        <div className="container">
          <div className="section-heading">
            <h2>Shop by category</h2>
            <Link href="/catalog">View all products →</Link>
          </div>
          <div className="category-grid">
            {groups.map((group) => (
              <Link
                href={`/catalog?group=${group.slug}`}
                className="category-card"
                key={group.slug}
              >
                {group.symbol === "gear" ? (
                  <Icon name="gear" />
                ) : (
                  <>
                    <span
                      className="category-symbol desktop-only"
                      aria-hidden="true"
                    >
                      {group.symbol}
                    </span>
                    <span className="mobile-only">
                      <Icon
                        name={
                          group.slug === "electrical"
                            ? "grid"
                            : group.slug === "automation"
                              ? "factory"
                              : "grid"
                        }
                      />
                    </span>
                  </>
                )}
                <div>
                  <h3>{group.name}</h3>
                  <p>
                    {
                      products.filter((p) =>
                        categories.some(
                          (c) =>
                            c.slug === p.category && c.group === group.slug,
                        ),
                      ).length
                    }{" "}
                    demo products
                  </p>
                </div>
                <span className="category-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="featured-section" id="featured">
        <div className="container">
          <div className="section-heading">
            <h2>
              <span className="desktop-only">Featured industrial products</span>
              <span className="mobile-only">Featured products</span>
            </h2>
            <Link href="/catalog">Open catalog →</Link>
          </div>
          <div className="featured-grid">
            {products
              .filter((p) => p.featured)
              .map((p) => (
                <div
                  className={`featured-card featured-${p.category}`}
                  key={p.id}
                >
                  <div className="product-visual">
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt={p.name}
                        width={96}
                        height={96}
                        className="desktop-only"
                      />
                    ) : (
                      <span className="desktop-only" aria-hidden="true">
                        {p.symbol}
                      </span>
                    )}
                    <span
                      className="mobile-only mobile-symbol"
                      aria-hidden="true"
                    >
                      {p.symbol}
                    </span>
                  </div>
                  <div className="product-info">
                    <h3>{p.name}</h3>
                    <p className="desktop-only">{p.description}</p>
                    <p className="mobile-stock">
                      {p.stockQuantity > 0
                        ? "In stock · Ships today"
                        : "Made to order"}
                    </p>
                    <strong className="desktop-price">
                      {formatMoney(p.pricePaise)} ·{" "}
                      {p.stockQuantity > 0 ? "In stock" : "Made to order"}
                    </strong>
                    <AddToCart productId={p.id} name={p.name} />
                  </div>
                  <strong className="mobile-price">
                    {formatMoney(p.pricePaise)}
                  </strong>
                </div>
              ))}
          </div>
        </div>
      </section>
      <section className="capabilities" id="resources">
        <div className="container">
          <h2>Custom manufacturing capabilities</h2>
          {capabilities.map((item) => (
            <div className="capability" key={item.title}>
              <Icon name={item.icon} />
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="workflow-strip">
        <div className="container">
          <h2>Have a custom part or engineering drawing?</h2>
          <p>Upload → Engineer review → Quote → Production → QC → Delivery</p>
          <LinkButton href="/upload-drawing" variant="secondary">
            Start RFQ <Icon name="arrow" />
          </LinkButton>
        </div>
      </section>
    </main>
  );
}
