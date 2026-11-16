import Link from "next/link";
import { formatStamp } from "@/components/operations/display";
import "@/components/operations/operations.css";
import { auditEntityTypes, pageAudit } from "@/lib/admin/audit";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

export const metadata = { title: "Audit log" };

type Search = { page?: string | string[]; type?: string | string[] };
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireUser(["ADMIN"]);
  const search = await searchParams;
  const db = getDb();
  const types = auditEntityTypes(db);
  const requestedType = first(search.type);
  const entityType = types.find((t) => t === requestedType);
  const result = pageAudit(db, {
    page: Number(first(search.page)) || 1,
    entityType,
  });

  const href = (page: number) => {
    const query = new URLSearchParams();
    if (entityType) query.set("type", entityType);
    if (page > 1) query.set("page", String(page));
    const text = query.toString();
    return `/admin/audit${text ? `?${text}` : ""}`;
  };

  return (
    <main id="main">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Admin workspace</p>
          <h1>Audit log</h1>
          <p>Who changed what, newest first.</p>
        </div>
      </div>

      <section className="panel" aria-labelledby="audit-heading">
        <div className="op-section-head">
          <h2 id="audit-heading">Entries ({result.total})</h2>
          <nav className="op-filters" aria-label="Filter by entity type">
            <Link
              href="/admin/audit"
              aria-current={!entityType ? "true" : undefined}
            >
              All
            </Link>
            {types.map((t) => (
              <Link
                key={t}
                href={`/admin/audit?type=${encodeURIComponent(t)}`}
                aria-current={entityType === t ? "true" : undefined}
              >
                {t.replace(/_/g, " ").toLowerCase()}
              </Link>
            ))}
          </nav>
        </div>
        {result.rows.length === 0 ? (
          <div className="empty-state">
            <h2>No audit entries</h2>
            <p>Actions that change data are recorded here.</p>
          </div>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Audit entries"
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
                {result.rows.map((row) => (
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
        <div className="op-pager">
          <span role="status">
            Page {result.page} of {result.pages}
          </span>
          <div className="button-row">
            {result.page > 1 ? (
              <Link
                className="button button-secondary"
                href={href(result.page - 1)}
              >
                Previous
              </Link>
            ) : null}
            {result.page < result.pages ? (
              <Link
                className="button button-secondary"
                href={href(result.page + 1)}
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
