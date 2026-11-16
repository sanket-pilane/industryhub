"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart/cart-store";
import { ProductSearch } from "@/components/search/product-search";
import { Icon, type IconName } from "@/components/ui/icon";

const links: { href: string; label: string; short?: string; icon: IconName }[] =
  [
    { href: "/", label: "Home", icon: "home" },
    { href: "/catalog", label: "Catalog", icon: "grid" },
    {
      href: "/upload-drawing",
      label: "Upload Drawing",
      short: "Upload",
      icon: "quote",
    },
    {
      href: "/quotations",
      label: "Quotations",
      short: "Quotes",
      icon: "quoteInverse",
    },
    { href: "/orders", label: "Orders", icon: "package" },
    { href: "/cart", label: "Cart", icon: "cart" },
  ];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/upload-drawing")
    return (
      pathname.startsWith("/upload-drawing") || pathname.startsWith("/drawings")
    );
  if (href === "/cart")
    return pathname.startsWith("/cart") || pathname.startsWith("/checkout");
  return pathname.startsWith(href);
}

function CartBadge() {
  const { count, hydrated } = useCart();
  if (!hydrated || count === 0) return null;
  return (
    // key restarts the bump animation whenever the count changes
    <span className="cart-badge" key={count} aria-label={`${count} items`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Home and catalog have their own search, so the header one hides there. */
export function HeaderSearch() {
  const pathname = usePathname();
  if (pathname === "/" || pathname.startsWith("/catalog")) return null;
  return <ProductSearch />;
}

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="site-nav" aria-label="Main">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(pathname, link.href) ? "page" : undefined}
        >
          {link.label}
          {link.href === "/cart" && <CartBadge />}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="mobile-nav" aria-label="Main (mobile)">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(pathname, link.href) ? "page" : undefined}
        >
          <span className="mobile-nav-icon">
            <Icon name={link.icon} />
            {link.href === "/cart" && <CartBadge />}
          </span>
          <span>{link.short ?? link.label}</span>
        </Link>
      ))}
    </nav>
  );
}
