import Link from "next/link";
import { formatStamp } from "@/components/operations/display";
import "@/components/operations/operations.css";
import { latestAudit } from "@/lib/admin/audit";
import { dashboardCounts } from "@/lib/admin/dashboard";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/utils/money";

export const metadata = { title: "Admin dashboard" };

export default async function AdminHome() {
  await requireUser(["ADMIN"]);
  const db = getDb();
  const counts = dashboardCounts(db);
  const audit = latestAudit(db, 10);

  const cards: { label: string; value: string; href: string }[] = [
    {
      label: "Requests awaiting review",
      value: String(counts.requestsAwaitingReview),
      href: "/admin/requests",
    },
    {
      label: "Quotes awaiting customer",
      value: String(counts.quotesAwaitingCustomer),
      href: "/admin/requests",
    },
    {
      label: "Advance paid, awaiting assignment",
      value: String(counts.awaitingAssignment),
      href: "/admin/jobs",
    },
    {
      label: "Jobs in production",
      value: String(counts.jobsInProduction),
      href: "/admin/jobs?status=IN_PRODUCTION",
    },
    {
      label: "QC awaiting review",
      value: String(counts.qcAwaitingReview),
      href: "/admin/jobs?status=QC_SUBMITTED",
    },
    {
      label: "Paid orders to fulfil",
      value: String(counts.ordersToFulfil),
      href: "/admin/orders",
    },
    {
      label: "Revenue collected",
      value: formatMoney(counts.revenuePaise),
      href: "/admin/orders",
    },
    {
      label: "Supplier verifications pending",
      value: String(counts.suppliersPending),
      href: "/admin/suppliers",
    },
  ];

  return (
    <main id="main">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Admin workspace</p>
          <h1>Dashboard</h1>
          <p>
            What needs attention across requests, production, orders and
            suppliers.
          </p>
        </div>
      </div>

      <section aria-label="Key figures" className="op-kpis">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="op-kpi">
            <span className="op-kpi-label">{card.label}</span>
            <span className="op-kpi-value">{card.value}</span>
          </Link>
        ))}
      </section>

      <section className="panel" aria-labelledby="recent-heading">
        <div className="op-section-head">
          <h2 id="recent-heading">Recent activity</h2>
          <Link className="table-link" href="/admin/audit">
            View audit log
          </Link>
        </div>
        {audit.length === 0 ? (
          <p className="muted">No activity recorded yet.</p>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Latest audit entries"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id}>
                    <td>{formatStamp(row.createdAt)}</td>
                    <td>{row.actorName}</td>
                    <td>{row.action}</td>
                    <td>
                      {row.entityType}
                      <span className="table-sub">{row.entityId}</span>
                    </td>
                    <td className="op-detail-cell">{row.detail || "-"}</td>
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
