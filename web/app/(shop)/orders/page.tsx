import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listOrdersForCustomer } from "@/lib/orders/queries";
import { formatMoney } from "@/lib/utils/money";
import "@/components/orders/orders.css";

export const metadata = { title: "My orders" };

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function Orders() {
  const user = await requireUser(["CUSTOMER"]);
  const orders = listOrdersForCustomer(getDb(), user.id);
  return (
    <main id="main" className="container workspace-page">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Orders</p>
          <h1>My orders</h1>
          <p>Catalog orders you have placed, newest first.</p>
        </div>
        <LinkButton href="/catalog" variant="secondary">
          Browse catalog
        </LinkButton>
      </div>
      <section className="panel">
        {orders.length === 0 ? (
          <div className="empty-state">
            <h2>No orders yet</h2>
            <p>
              Orders you place from the catalog appear here with their invoices.
            </p>
            <LinkButton href="/catalog">Browse catalog</LinkButton>
          </div>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Order history"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th className="quote-id">Order</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="quote-id">
                      <Link className="table-link" href={`/orders/${o.id}`}>
                        {o.id}
                      </Link>
                    </td>
                    <td>{dateFormat.format(new Date(o.createdAt))}</td>
                    <td>{o.itemCount}</td>
                    <td>{formatMoney(o.totalPaise)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>
                      <StatusBadge status={o.paymentStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
