import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/quotations/format";
import { listQuotationsForCustomer } from "@/lib/quotations/service";
import { formatMoney } from "@/lib/utils/money";
import "@/components/quotations/quotations.css";

export const metadata = { title: "My quotations" };

export default async function Quotations() {
  const user = await requireUser(["CUSTOMER"]);
  const quotes = listQuotationsForCustomer(getDb(), user.id);
  return (
    <main id="main" className="container workspace-page">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Custom manufacturing</p>
          <h1>My quotations</h1>
          <p>Production quotations issued for your drawings, newest first.</p>
        </div>
        <LinkButton href="/upload-drawing">Upload drawing</LinkButton>
      </div>
      <section className="panel">
        {quotes.length === 0 ? (
          <div className="empty-state">
            <h2>No quotations yet</h2>
            <p>
              Once our engineers review a drawing you submitted, the quotation
              appears here.
            </p>
            <LinkButton href="/drawings" variant="secondary">
              View my drawings
            </LinkButton>
          </div>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Quotations"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th className="quote-id">Quotation</th>
                  <th>Part</th>
                  <th>Version</th>
                  <th className="num">Total</th>
                  <th>Valid until</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td className="quote-id">
                      <Link className="table-link" href={`/quotations/${q.id}`}>
                        {q.id}
                      </Link>
                      <span className="table-sub">Request {q.requestId}</span>
                    </td>
                    <td>{q.partName}</td>
                    <td>v{q.version}</td>
                    <td className="num">{formatMoney(q.totalPaise)}</td>
                    <td>{formatDate(q.validUntil)}</td>
                    <td>
                      <StatusBadge status={q.status} />
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
