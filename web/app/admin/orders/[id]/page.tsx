import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminOrderActions } from "@/components/orders/admin-order-actions";
import { OrderBadges, OrderBody } from "@/components/orders/order-detail";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getOrder } from "@/lib/orders/queries";
import { RepositoryError } from "@/lib/repositories/errors";
import "@/components/orders/orders.css";

export const metadata = { title: "Order" };

export default async function AdminOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser(["ADMIN"]);
  const { id } = await params;
  let order;
  try {
    order = getOrder(getDb(), id);
  } catch (error) {
    if (error instanceof RepositoryError && error.status === 404) notFound();
    throw error;
  }
  return (
    <main id="main">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">
            <Link href="/admin/orders">Orders</Link>
          </p>
          <h1>Order {order.id}</h1>
          <p>
            {order.customer.name}, {order.customer.companyName}
          </p>
          <OrderBadges order={order} />
        </div>
      </div>
      <section className="panel" aria-labelledby="order-actions-heading">
        <h2 id="order-actions-heading">Update order</h2>
        <AdminOrderActions
          orderId={order.id}
          status={order.status}
          paymentStatus={order.paymentStatus}
        />
      </section>
      <OrderBody order={order} admin />
    </main>
  );
}
