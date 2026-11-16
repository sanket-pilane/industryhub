import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderBadges, OrderBody } from "@/components/orders/order-detail";
import { RetryPaymentForm } from "@/components/orders/retry-payment-form";
import { LinkButton } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getOrderForCustomer } from "@/lib/orders/queries";
import { RepositoryError } from "@/lib/repositories/errors";
import { formatMoney } from "@/lib/utils/money";
import "@/components/orders/orders.css";

export const metadata = { title: "Order" };

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser(["CUSTOMER"]);
  const { id } = await params;
  let order;
  try {
    order = getOrderForCustomer(getDb(), id, user.id);
  } catch (error) {
    if (error instanceof RepositoryError && error.status === 404) notFound();
    throw error;
  }
  const needsPayment =
    order.paymentStatus !== "PAID" && order.status !== "CANCELLED";
  return (
    <main id="main" className="container workspace-page">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">
            <Link href="/orders">Orders</Link>
          </p>
          <h1>Order {order.id}</h1>
          <p>
            Placed{" "}
            {new Intl.DateTimeFormat("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(order.createdAt))}
          </p>
          <OrderBadges order={order} />
        </div>
        {order.paymentStatus === "PAID" && (
          <LinkButton href={`/orders/${order.id}/invoice`}>
            View invoice
          </LinkButton>
        )}
      </div>
      {needsPayment && (
        <section className="panel" aria-labelledby="order-pay-heading">
          <h2 id="order-pay-heading">
            {order.paymentStatus === "PENDING" && order.payments.length === 0
              ? "Complete your payment"
              : "Retry payment"}
          </h2>
          <p className="muted">
            {order.paymentStatus === "FAILED"
              ? "Your last payment did not go through. Your items are held for you."
              : order.paymentStatus === "PENDING" && order.payments.length > 0
                ? "Your last payment is still pending. Your items are held for you."
                : "Your items are held for you until payment is received."}
          </p>
          <RetryPaymentForm
            orderId={order.id}
            amountLabel={formatMoney(order.totalPaise)}
          />
        </section>
      )}
      {order.status === "CANCELLED" && (
        <p className="notice" role="status">
          This order was cancelled.
          {order.paymentStatus === "PAID"
            ? " A refund will be issued for the amount you paid."
            : ""}
        </p>
      )}
      <OrderBody order={order} />
    </main>
  );
}
