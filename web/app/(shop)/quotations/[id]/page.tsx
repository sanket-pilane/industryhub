import Link from "next/link";
import { notFound } from "next/navigation";
import { PayAdvanceForm } from "@/components/quotations/pay-advance-form";
import { QuotationActions } from "@/components/quotations/quotation-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/quotations/format";
import { advanceAmounts } from "@/lib/quotations/rules";
import {
  actionBlockReason,
  getQuotationForCustomer,
  listAdvancePayments,
} from "@/lib/quotations/service";
import { formatMoney } from "@/lib/utils/money";
import "@/components/quotations/quotations.css";

export const metadata = { title: "Quotation" };

const stamp = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function QuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser(["CUSTOMER"]);
  const { id } = await params;
  const db = getDb();
  const quote = getQuotationForCustomer(db, user.id, id);
  if (!quote) notFound();

  const { advancePaise, balancePaise } = advanceAmounts(
    quote.totalPaise,
    quote.advancePercent,
  );
  const blocked = actionBlockReason(db, quote);
  const payments = listAdvancePayments(db, quote.id);
  const advancePaid = payments.some((p) => p.status === "PAID");
  const requestStatus = (
    db
      .prepare("SELECT status FROM manufacturing_requests WHERE id = ?")
      .get(quote.requestId) as { status: string }
  ).status;
  const canPay =
    quote.status === "ACCEPTED" &&
    !advancePaid &&
    (requestStatus === "ACCEPTED" || requestStatus === "ADVANCE_PENDING");

  return (
    <main id="main" className="container workspace-page">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Quotation</p>
          <h1>
            {quote.id} <StatusBadge status={quote.status} />
          </h1>
          <p>
            {quote.partName} · version {quote.version} · request{" "}
            <Link className="table-link" href={`/drawings/${quote.requestId}`}>
              {quote.requestId}
            </Link>
          </p>
        </div>
      </div>

      {quote.status === "QUOTED" && blocked && (
        <p className="notice" role="status">
          <strong>No action available.</strong> {blocked}
        </p>
      )}
      {quote.status === "SUPERSEDED" && (
        <p className="notice" role="status">
          <strong>Superseded.</strong> A newer version of this quotation has
          been issued. Open your request to see it.
        </p>
      )}

      <section className="panel">
        <h2>Line items</h2>
        <div
          className="table-scroll"
          role="region"
          aria-label="Line items"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th className="num">Qty</th>
                <th className="num">Unit price</th>
                <th className="num">GST</th>
                <th className="num">Line total</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item, i) => (
                <tr key={i}>
                  <td>{item.description}</td>
                  <td className="num">{item.quantity}</td>
                  <td className="num">{formatMoney(item.unitPricePaise)}</td>
                  <td className="num">
                    {item.gstPercent}% ({formatMoney(item.taxPaise)})
                  </td>
                  <td className="num">{formatMoney(item.totalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="quote-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(quote.subtotalPaise)}</dd>
          </div>
          <div>
            <dt>GST</dt>
            <dd>{formatMoney(quote.taxPaise)}</dd>
          </div>
          <div className="quote-grand">
            <dt>Total</dt>
            <dd>{formatMoney(quote.totalPaise)}</dd>
          </div>
          <div>
            <dt>Advance ({quote.advancePercent}%)</dt>
            <dd>{formatMoney(advancePaise)}</dd>
          </div>
          <div>
            <dt>Balance</dt>
            <dd>{formatMoney(balancePaise)}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h2>Commercial terms</h2>
        <dl className="profile-grid">
          <div>
            <dt>Lead time</dt>
            <dd>{quote.leadTimeDays} days from advance payment</dd>
          </div>
          <div>
            <dt>Valid until</dt>
            <dd>{formatDate(quote.validUntil)}</dd>
          </div>
          <div>
            <dt>Issued</dt>
            <dd>{formatDate(quote.createdAt)}</dd>
          </div>
          <div>
            <dt>Terms</dt>
            <dd>{quote.terms || "Standard INDUSTRIHUB terms apply."}</dd>
          </div>
        </dl>
      </section>

      {!blocked && <QuotationActions quotationId={quote.id} />}

      {canPay && (
        <PayAdvanceForm
          quotationId={quote.id}
          amountLabel={formatMoney(advancePaise)}
          retry={payments.length > 0}
        />
      )}
      {advancePaid && (
        <p className="notice" role="status">
          <strong>Advance paid.</strong> Thank you. We are assigning a verified
          manufacturing partner to your order.
        </p>
      )}

      {payments.length > 0 && (
        <section className="panel">
          <h2>Advance payment attempts</h2>
          <div
            className="table-scroll"
            role="region"
            aria-label="Payment attempts"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Date</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.id}
                      <span className="table-sub">{p.providerReference}</span>
                    </td>
                    <td>{stamp.format(new Date(p.createdAt))}</td>
                    <td className="num">{formatMoney(p.amountPaise)}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
