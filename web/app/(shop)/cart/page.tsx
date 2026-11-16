import { CartView } from "@/components/cart/cart-view";
import { getRepositories } from "@/lib/repositories";
export const metadata = { title: "Cart" };
export default async function Cart() {
  const { items } = await getRepositories().catalog.list({ pageSize: 100 });
  return (
    <main id="main" className="container workspace-page">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Cart</p>
          <h1>Your cart</h1>
          <p>Review quantities and GST before checkout.</p>
        </div>
      </div>
      <CartView products={items} />
    </main>
  );
}
