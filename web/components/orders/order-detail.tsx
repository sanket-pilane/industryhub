import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { Timeline } from "@/components/ui/timeline";
import {
  DELIVERY_LABELS,
  isIntraState,
  type DeliveryMethod,
} from "@/lib/orders/pricing";
import { describeProvider } from "@/lib/orders/providers";
import type { OrderDetail } from "@/lib/orders/queries";
import { formatMoney } from "@/lib/utils/money";
import { OrderTotals } from "./order-totals";

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function OrderBadges({ order }: { order: OrderDetail }) {
  return (
    <p className="order-badges">
      <StatusBadge status={order.status} />
      <StatusBadge
        status={order.paymentStatus}
        label={`Payment ${order.paymentStatus.toLowerCase()}`}
      />
    </p>
  );
}

/** Items, totals, delivery, payments and history, shared by the customer and admin views. */
export function OrderBody({
  order,
  admin = false,
}: {
  order: OrderDetail;
  admin?: boolean;
}) {
  const address = order.shippingAddress;
  const delivery =
    DELIVERY_LABELS[order.deliveryMethod as DeliveryMethod] ??
    order.deliveryMethod;
  return (
    <div className="order-grid">
      <section
        className="panel order-items"
        aria-labelledby="order-items-heading"
      >
        <h2 id="order-items-heading">Items</h2>
        <div
          className="table-scroll"
          role="region"
          aria-label="Order items"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>GST</th>
                <th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.productId}>
                  <td>
                    {item.name}
                    <span className="table-sub">{item.sku}</span>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{formatMoney(item.unitPricePaise)}</td>
                  <td>
                    {item.gstPercent}% · {formatMoney(item.taxPaise)}
                  </td>
                  <td>{formatMoney(item.totalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <OrderTotals totals={order} intraState={isIntraState(address.state)} />
      </section>

      <section className="panel" aria-labelledby="order-delivery-heading">
        <h2 id="order-delivery-heading">Delivery and billing</h2>
        <dl className="profile-grid">
          <div>
            <dt>Ship to</dt>
            <dd>
              {address.label}
              <br />
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}
              <br />
              {address.city}, {address.state} {address.pincode}
            </dd>
          </div>
          <div>
            <dt>Delivery method</dt>
            <dd>{delivery}</dd>
          </div>
          <div>
            <dt>Billing GSTIN</dt>
            <dd>{order.billingGstin || "Not provided"}</dd>
          </div>
          {admin && (
            <div>
              <dt>Customer</dt>
              <dd>
                {order.customer.name}
                <span className="table-sub">
                  {order.customer.companyName} · {order.customer.email}
                </span>
              </dd>
            </div>
          )}
          {order.courier && (
            <div>
              <dt>Courier and tracking</dt>
              <dd>
                {order.courier}
                <span className="table-sub">
                  Tracking number {order.trackingNumber}
                </span>
              </dd>
            </div>
          )}
          {order.invoiceNumber && (
            <div>
              <dt>Invoice</dt>
              <dd>
                {order.invoiceNumber}
                {!admin && (
                  <span className="table-sub">
                    <Link
                      className="table-link"
                      href={`/orders/${order.id}/invoice`}
                    >
                      View invoice
                    </Link>
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="panel" aria-labelledby="order-payments-heading">
        <h2 id="order-payments-heading">Payment attempts</h2>
        {order.payments.length === 0 ? (
          <p className="muted">No payment has been attempted yet.</p>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Payment attempts"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {order.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{dateTime.format(new Date(p.createdAt))}</td>
                    <td>{describeProvider(p.provider)}</td>
                    <td>{p.providerReference || "None"}</td>
                    <td>{formatMoney(p.amountPaise)}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="order-history-heading">
        <h2 id="order-history-heading">Order history</h2>
        <Timeline
          label="Order status history"
          entries={order.history.map((h) => ({
            id: h.id,
            status: h.status,
            at: h.changedAt,
            by: h.changedByName,
            comment: h.comment,
          }))}
        />
      </section>
    </div>
  );
}
