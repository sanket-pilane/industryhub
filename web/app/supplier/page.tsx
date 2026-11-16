import Link from "next/link";
import { ProgressBar, formatDate } from "@/components/operations/display";
import "@/components/operations/operations.css";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listJobs } from "@/lib/jobs/queries";
import { findSupplierByUser } from "@/lib/suppliers/profile";

export const metadata = { title: "Supplier jobs" };

export default async function SupplierHome() {
  const user = await requireUser(["SUPPLIER"]);
  const db = getDb();
  const supplier = findSupplierByUser(db, user.id);
  const jobs = supplier ? listJobs(db, { supplierId: supplier.id }) : [];
  const verified = supplier?.verificationStatus === "VERIFIED";

  return (
    <main id="main">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Supplier workspace</p>
          <h1>Assigned jobs</h1>
          <p>
            Production jobs INDUSTRIHUB has assigned to{" "}
            {supplier?.companyName ?? "you"}.
          </p>
        </div>
      </div>

      {!verified && (
        <div className="notice" role="status">
          <strong>
            {supplier?.verificationStatus === "REJECTED"
              ? "Your account was not verified"
              : "Verification pending"}
          </strong>
          <p>
            {supplier?.verificationStatus === "REJECTED"
              ? "INDUSTRIHUB could not verify your account, so no jobs can be assigned. Contact the INDUSTRIHUB operations team."
              : "Jobs appear here after INDUSTRIHUB verifies your account."}
          </p>
        </div>
      )}

      <section className="panel" aria-labelledby="jobs-heading">
        <h2 id="jobs-heading">Your jobs</h2>
        {jobs.length === 0 ? (
          <div className="empty-state">
            <h2>No jobs yet</h2>
            <p>
              {verified
                ? "New jobs show up here as soon as INDUSTRIHUB assigns them to you."
                : "Once your account is verified, assigned jobs will be listed here."}
            </p>
          </div>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Assigned jobs"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th className="quote-id">Job</th>
                  <th>Part</th>
                  <th>Qty</th>
                  <th>Material</th>
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
                        href={`/supplier/jobs/${job.id}`}
                      >
                        {job.id}
                      </Link>
                    </td>
                    <td>{job.partName}</td>
                    <td>{job.quantity}</td>
                    <td>{job.material}</td>
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
