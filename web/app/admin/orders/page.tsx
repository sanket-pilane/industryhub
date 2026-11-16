import Link from "next/link";
import { orderStatuses, type OrderStatus } from "../../../../shared/enums";
import { StatusBadge, statusLabel } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listAllOrders } from "@/lib/orders/queries";
import { formatMoney } from "@/lib/utils/money";
import "@/components/orders/orders.css";

export const metadata = { title: "Orders" };

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  await requireUser(["ADMIN"]);
  const raw = (await searchParams).status;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const filter = orderStatuses.find((s) => s === value) as
    OrderStatus | undefined;
  const orders = listAllOrders(getDb(), filter);
  return (
    <main id="main">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Admin workspace</p>
          <h1>Orders</h1>
          <p>Catalog orders from all customers, newest first.</p>
        </div>
      </div>
      <nav className="order-filters" aria-label="Filter orders by status">
        <Link href="/admin/orders" aria-current={filter ? undefined : "page"}>
          All
        </Link>
        {orderStatuses.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            aria-current={filter === s ? "page" : undefined}
          >
            {statusLabel(s)}
          </Link>
        ))}
      </nav>
      <section className="panel">
        {orders.length === 0 ? (
          <p className="muted">
            {filter
              ? `No ${statusLabel(filter).toLowerCase()} orders.`
              : "No orders have been placed yet."}
          </p>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Orders"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th className="quote-id">Order</th>
                  <th>Customer</th>
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
                      <Link
                        className="table-link"
                        href={`/admin/orders/${o.id}`}
                      >
                        {o.id}
                      </Link>
                    </td>
                    <td>
                      {o.customerName}
                      <span className="table-sub">{o.companyName}</span>
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
