import { requireUser } from "@/lib/auth/session";
import { CartProvider } from "@/components/cart/cart-store";
import { SiteHeader } from "@/components/nav/site-header";
import { MobileNav } from "@/components/nav/site-nav";
import "./shop.css";

/** Customer pages share the navbar, cart state and toasts. */
export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser(["CUSTOMER"]);
  return (
    <CartProvider userId={user.id}>
      <SiteHeader user={user} />
      {children}
      <MobileNav />
    </CartProvider>
  );
}
