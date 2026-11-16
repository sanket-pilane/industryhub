import Link from "next/link";
import { notFound } from "next/navigation";
import { Invoice } from "@/components/orders/invoice";
import { PrintButton } from "@/components/orders/print-button";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getOrderForCustomer } from "@/lib/orders/queries";
import { RepositoryError } from "@/lib/repositories/errors";
import "@/components/orders/orders.css";

export const metadata = { title: "Tax invoice" };

export default async function InvoicePage({
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
  // An invoice exists only once payment has been received.
  if (order.paymentStatus !== "PAID" || !order.invoiceNumber) notFound();
  return (
    <main id="main" className="container workspace-page">
      <div className="page-title invoice-actions">
        <div>
          <p className="eyebrow text-brand">
            <Link href={`/orders/${order.id}`}>Order {order.id}</Link>
          </p>
          <h1>Invoice {order.invoiceNumber}</h1>
        </div>
        <PrintButton />
      </div>
      <Invoice order={order} />
    </main>
  );
}
