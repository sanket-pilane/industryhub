import { formatMoney } from "@/lib/utils/money";

export interface Totals {
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  shippingPaise: number;
  totalPaise: number;
}

/** Subtotal, GST split, shipping and total. Shipping is not taxed. */
export function OrderTotals({
  totals,
  intraState,
  className = "order-totals",
}: {
  totals: Totals;
  intraState: boolean;
  className?: string;
}) {
  return (
    <dl className={className}>
      <div>
        <dt>Subtotal</dt>
        <dd>{formatMoney(totals.subtotalPaise)}</dd>
      </div>
      {intraState ? (
        <>
          <div>
            <dt>CGST</dt>
            <dd>{formatMoney(totals.cgstPaise)}</dd>
          </div>
          <div>
            <dt>SGST</dt>
            <dd>{formatMoney(totals.sgstPaise)}</dd>
          </div>
        </>
      ) : (
        <div>
          <dt>IGST</dt>
          <dd>{formatMoney(totals.igstPaise)}</dd>
        </div>
      )}
      <div>
        <dt>Shipping</dt>
        <dd>
          {totals.shippingPaise === 0
            ? "Free"
            : formatMoney(totals.shippingPaise)}
        </dd>
      </div>
      <div className="order-grand-total">
        <dt>Total</dt>
        <dd>{formatMoney(totals.totalPaise)}</dd>
      </div>
    </dl>
  );
}
