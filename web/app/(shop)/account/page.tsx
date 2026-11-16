import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { SignOut } from "@/components/auth/sign-out";
import { CartSummaryCard } from "@/components/cart/cart-summary-card";
import { LinkButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDrawingStore } from "@/lib/drawings/store";
import { getRepositories } from "@/lib/repositories";
import { formatMoney } from "@/lib/utils/money";

export const metadata = { title: "Account" };

export default async function Account() {
  // The layout also guards, but layouts and pages render in parallel.
  const user = await requireUser(["CUSTOMER"]);
  const [quotes, drawings] = await Promise.all([
    getRepositories().quotations.listForCustomer(user.id),
    getDrawingStore().listForCustomer(user.id),
  ]);
  const profile = [
    ["Full name", `${user.firstName} ${user.lastName}`],
    ["Work email", user.email],
    ["Company", user.companyName],
    ["GSTIN", user.gstin || "Not added"],
    ["Phone", user.phone || "Not added"],
    ["Role", user.role === "CUSTOMER" ? "Customer" : user.role],
  ];
  return (
    <main id="main" className="container workspace-page">
      <div className="page-title">
        <div className="account-heading">
          <span className="avatar account-avatar" aria-hidden="true">
            {user.initials}
          </span>
          <div>
            <p className="eyebrow text-brand">Account</p>
            <h1>Welcome, {user.firstName}</h1>
            <p>{user.companyName}</p>
          </div>
        </div>
        <SignOut />
      </div>
      <div className="account-grid">
        <section className="panel">
          <h2>Business profile</h2>
          <dl className="profile-grid">
            {profile.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <CartSummaryCard />
      </div>
      <section className="panel">
        <h2>Drawing requests</h2>
        {drawings.length === 0 ? (
          <p className="muted">No drawings submitted yet.</p>
        ) : (
          <ul className="drawing-list">
            {drawings.slice(0, 3).map((d) => (
              <li key={d.id}>
                <strong>{d.id}</strong> · {d.partName} (Rev {d.revision}) ·{" "}
                {d.quantity} pcs
                <StatusBadge status={d.status} />
              </li>
            ))}
          </ul>
        )}
        <div className="button-row">
          <LinkButton href="/upload-drawing">Upload drawing</LinkButton>
          {drawings.length > 0 && (
            <LinkButton href="/drawings" variant="secondary">
              View all drawings ({drawings.length})
            </LinkButton>
          )}
        </div>
      </section>
      <section className="panel">
        <h2>Quotations</h2>
        {quotes.length === 0 ? (
          <p className="muted">
            No quotations yet. Requests you submit will appear here.
          </p>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Quotations table"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th className="quote-id">Quote ID</th>
                  <th>Part</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Total incl. GST</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td className="quote-id">
                      <Link className="table-link" href={`/quotations/${q.id}`}>
                        {q.id}
                      </Link>
                    </td>
                    <td>{q.partName}</td>
                    <td>v{q.version}</td>
                    <td>
                      <StatusBadge status={q.status} />
                    </td>
                    <td>{formatMoney(q.totalPaise)}</td>
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
