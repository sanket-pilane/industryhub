import { CheckoutForm } from "@/components/checkout/checkout-form";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listAddresses } from "@/lib/orders/addresses";
import "@/components/orders/orders.css";

export const metadata = { title: "Checkout" };

export default async function Checkout() {
  const user = await requireUser(["CUSTOMER"]);
  const addresses = listAddresses(getDb(), user.id);
  return (
    <main id="main" className="container workspace-page">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Checkout</p>
          <h1>Checkout</h1>
          <p>
            Confirm your delivery details and pay. GST and shipping are
            calculated by our server.
          </p>
        </div>
      </div>
      <CheckoutForm addresses={addresses} profileGstin={user.gstin} />
    </main>
  );
}
