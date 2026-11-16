import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/quotations/format";
import {
  ADMIN_FILTER_STATUSES,
  OPEN_REVIEW_STATUSES,
} from "@/lib/quotations/rules";
import { listRequestsForAdmin } from "@/lib/quotations/request-view";
import "@/components/quotations/quotations.css";

export const metadata = { title: "Manufacturing requests" };

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Open work" },
  { value: "ALL", label: "All" },
  ...ADMIN_FILTER_STATUSES.map((s) => ({
    value: s,
    label: s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " "),
  })),
];

export default async function AdminRequests({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  await requireUser(["ADMIN"]);
  const raw = (await searchParams).status;
  const status = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const known = FILTERS.some((f) => f.value === status);
  const active = known ? status : "";
  const rows = listRequestsForAdmin(
    getDb(),
    active === "ALL" ? null : active === "" ? OPEN_REVIEW_STATUSES : [active],
  );

  return (
    <main id="main">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Admin workspace</p>
          <h1>Manufacturing requests</h1>
          <p>
            {active === ""
              ? "Open work: submitted, under engineering review or awaiting a revised quotation."
              : "Filtered by status."}
          </p>
        </div>
      </div>
      <nav className="admin-filters" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Link
            key={f.value || "open"}
            href={
              f.value ? `/admin/requests?status=${f.value}` : "/admin/requests"
            }
            aria-current={active === f.value}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <section className="panel">
        {rows.length === 0 ? (
          <div className="empty-state">
            <h2>No requests here</h2>
            <p>Nothing matches this filter right now.</p>
          </div>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Manufacturing requests"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th className="quote-id">Request</th>
                  <th>Customer</th>
                  <th>Part</th>
                  <th className="num">Qty</th>
                  <th>Material</th>
                  <th>Submitted</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="quote-id">
                      <Link
                        className="table-link"
                        href={`/admin/requests/${r.id}`}
                      >
                        {r.id}
                      </Link>
                    </td>
                    <td>{r.companyName}</td>
                    <td>{r.partName}</td>
                    <td className="num">{r.quantity}</td>
                    <td>{r.material}</td>
                    <td>{formatDate(r.submittedAt)}</td>
                    <td>
                      <StatusBadge status={r.status} />
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
