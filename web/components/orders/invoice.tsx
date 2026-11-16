import { isIntraState } from "@/lib/orders/pricing";
import type { OrderDetail } from "@/lib/orders/queries";
import { SELLER } from "@/lib/orders/seller";
import { amountInWords } from "@/lib/orders/words";
import { formatMoney } from "@/lib/utils/money";

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

/** Printable GST tax invoice for a paid order. */
export function Invoice({ order }: { order: OrderDetail }) {
  const paidAt =
    order.payments.find((p) => p.status === "PAID")?.createdAt ??
    order.updatedAt;
  const address = order.shippingAddress;
  const intra = isIntraState(address.state);
  const taxTotal = order.cgstPaise + order.sgstPaise + order.igstPaise;
  return (
    <article
      className="invoice-sheet"
      aria-label={`Tax invoice ${order.invoiceNumber}`}
    >
      <header className="invoice-head">
        <div>
          <h2>Tax invoice</h2>
          <p className="muted">Original for recipient</p>
        </div>
        <dl className="invoice-meta">
          <div>
            <dt>Invoice number</dt>
            <dd>{order.invoiceNumber}</dd>
          </div>
          <div>
            <dt>Invoice date</dt>
            <dd>{dateFormat.format(new Date(paidAt))}</dd>
          </div>
          <div>
            <dt>Order</dt>
            <dd>{order.id}</dd>
          </div>
          <div>
            <dt>Place of supply</dt>
            <dd>{address.state}</dd>
          </div>
        </dl>
      </header>

      <div className="invoice-parties">
        <section aria-label="Seller">
          <h3>Sold by</h3>
          <p>
            <strong>{SELLER.legalName}</strong>
            <br />
            {SELLER.addressLines.join(", ")}
            <br />
            {SELLER.city}, {SELLER.state} {SELLER.pincode}
            <br />
            GSTIN: {SELLER.gstin}
          </p>
        </section>
        <section aria-label="Buyer">
          <h3>Billed to</h3>
          <p>
            <strong>{order.customer.companyName}</strong>
            <br />
            {order.customer.name}
            <br />
            GSTIN: {order.billingGstin || "Unregistered"}
          </p>
        </section>
        <section aria-label="Ship to">
          <h3>Ship to</h3>
          <p>
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ""}
            <br />
            {address.city}, {address.state} {address.pincode}
          </p>
        </section>
      </div>

      <div
        className="table-scroll"
        role="region"
        aria-label="Invoice lines"
        tabIndex={0}
      >
        <table className="invoice-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>HSN</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Taxable value</th>
              <th>GST %</th>
              <th>Tax</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={item.productId}>
                <td>{index + 1}</td>
                <td>
                  {item.name}
                  <span className="table-sub">{item.sku}</span>
                </td>
                <td>—</td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.unitPricePaise)}</td>
                <td>{formatMoney(item.unitPricePaise * item.quantity)}</td>
                <td>{item.gstPercent}%</td>
                <td>{formatMoney(item.taxPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="invoice-totals">
        <div>
          <dt>Taxable value</dt>
          <dd>{formatMoney(order.subtotalPaise)}</dd>
        </div>
        {intra ? (
          <>
            <div>
              <dt>CGST</dt>
              <dd>{formatMoney(order.cgstPaise)}</dd>
            </div>
            <div>
              <dt>SGST</dt>
              <dd>{formatMoney(order.sgstPaise)}</dd>
            </div>
          </>
        ) : (
          <div>
            <dt>IGST</dt>
            <dd>{formatMoney(order.igstPaise)}</dd>
          </div>
        )}
        <div>
          <dt>Total tax</dt>
          <dd>{formatMoney(taxTotal)}</dd>
        </div>
        <div>
          <dt>Shipping</dt>
          <dd>{formatMoney(order.shippingPaise)}</dd>
        </div>
        <div className="order-grand-total">
          <dt>Grand total</dt>
          <dd>{formatMoney(order.totalPaise)}</dd>
        </div>
      </dl>

      <p className="invoice-words">
        <strong>Amount in words:</strong> {amountInWords(order.totalPaise)}
      </p>
      <p className="muted invoice-foot">
        This is a computer-generated invoice and needs no signature. Payment
        received in full.
      </p>
    </article>
  );
}
