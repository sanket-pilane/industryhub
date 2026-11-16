import Link from "next/link";
import { AssignForm } from "@/components/operations/admin-forms";
import { ProgressBar, formatDate } from "@/components/operations/display";
import "@/components/operations/operations.css";
import { StatusBadge, statusLabel } from "@/components/ui/status-badge";
import { listVerifiedSuppliers } from "@/lib/admin/suppliers";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listAwaitingAssignment, listJobs } from "@/lib/jobs/queries";
import { jobStatuses } from "../../../../shared/enums";

export const metadata = { title: "Jobs" };

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  await requireUser(["ADMIN"]);
  const raw = (await searchParams).status;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  const status = jobStatuses.find((s) => s === requested);

  const db = getDb();
  const awaiting = listAwaitingAssignment(db);
  const suppliers = listVerifiedSuppliers(db).map((s) => ({
    id: s.id,
    companyName: s.companyName,
    city: s.city,
  }));
  const jobs = listJobs(db, { status });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main id="main">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Admin workspace</p>
          <h1>Jobs</h1>
          <p>
            Assign verified suppliers and follow production through QC and
            dispatch.
          </p>
        </div>
      </div>

      <section className="panel" aria-labelledby="awaiting-heading">
        <div className="op-section-head">
          <h2 id="awaiting-heading">Awaiting assignment ({awaiting.length})</h2>
        </div>
        {awaiting.length === 0 ? (
          <div className="empty-state">
            <h2>Nothing waiting</h2>
            <p>Requests appear here once the customer has paid the advance.</p>
          </div>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Requests awaiting assignment"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th className="quote-id">Request</th>
                  <th>Part</th>
                  <th>Qty</th>
                  <th>Customer target</th>
                  <th>Assign to a verified supplier</th>
                </tr>
              </thead>
              <tbody>
                {awaiting.map((r) => (
                  <tr key={r.id}>
                    <td className="quote-id">
                      <Link
                        className="table-link"
                        href={`/admin/requests/${r.id}`}
                      >
                        {r.id}
                      </Link>
                    </td>
                    <td>
                      {r.partName}
                      <span className="table-sub">
                        {r.material} · {r.customerCompany}
                      </span>
                    </td>
                    <td>{r.quantity}</td>
                    <td>{formatDate(r.targetDate)}</td>
                    <td>
                      <AssignForm
                        requestId={r.id}
                        suppliers={suppliers}
                        defaultDate={
                          r.targetDate >= today
                            ? r.targetDate.slice(0, 10)
                            : today
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="all-jobs-heading">
        <div className="op-section-head">
          <h2 id="all-jobs-heading">All jobs ({jobs.length})</h2>
          <nav className="op-filters" aria-label="Filter jobs by status">
            <Link
              href="/admin/jobs"
              aria-current={!status ? "true" : undefined}
            >
              All
            </Link>
            {jobStatuses.map((s) => (
              <Link
                key={s}
                href={`/admin/jobs?status=${s}`}
                aria-current={status === s ? "true" : undefined}
              >
                {statusLabel(s)}
              </Link>
            ))}
          </nav>
        </div>
        {jobs.length === 0 ? (
          <div className="empty-state">
            <h2>No jobs found</h2>
            <p>
              {status
                ? "No jobs have this status."
                : "Assign a supplier to create the first job."}
            </p>
          </div>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="All jobs"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th className="quote-id">Job</th>
                  <th>Part</th>
                  <th>Supplier</th>
                  <th>Target date</th>
                  <th>Status</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="quote-id">
                      <Link
                        className="table-link"
                        href={`/admin/jobs/${job.id}`}
                      >
                        {job.id}
                      </Link>
                    </td>
                    <td>
                      {job.partName}
                      <span className="table-sub">
                        {job.quantity} × {job.material}
                      </span>
                    </td>
                    <td>{job.supplierName}</td>
                    <td>{formatDate(job.targetDate)}</td>
                    <td>
                      <StatusBadge status={job.status} />
                    </td>
                    <td>
                      <ProgressBar
                        percent={job.progressPercent}
                        label={`Progress of ${job.id}`}
                      />
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
