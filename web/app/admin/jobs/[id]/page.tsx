import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DeliverButton,
  QcReviewPanel,
} from "@/components/operations/admin-forms";
import {
  ProgressBar,
  formatDate,
  formatStamp,
} from "@/components/operations/display";
import "@/components/operations/operations.css";
import { FileLinks } from "@/components/files/file-preview";
import { StatusBadge, statusLabel } from "@/components/ui/status-badge";
import { Timeline } from "@/components/ui/timeline";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatBytes } from "@/lib/drawings/rules";
import { loadJobDetail } from "@/lib/jobs/queries";

export const metadata = { title: "Job details" };

export default async function AdminJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser(["ADMIN"]);
  const { id } = await params;
  const job = loadJobDetail(getDb(), id);
  if (!job) notFound();

  const facts: [string, React.ReactNode][] = [
    [
      "Supplier",
      `${job.supplier.companyName}${job.supplier.city ? `, ${job.supplier.city}` : ""}`,
    ],
    [
      "Request",
      <Link
        key="request"
        className="table-link"
        href={`/admin/requests/${job.requestId}`}
      >
        {job.requestId}
      </Link>,
    ],
    ["Part", `${job.request.quantity} × ${job.request.partName}`],
    ["Material", job.request.material],
    ["Process", `${job.request.process}, ${job.request.finish}`],
    ["Tolerance", job.request.tolerance],
    ["Target date", formatDate(job.targetDate)],
    ["Request status", statusLabel(job.request.status)],
  ];
  if (job.courier || job.trackingNumber)
    facts.push(["Dispatch", `${job.courier}, tracking ${job.trackingNumber}`]);

  const pendingReview = job.status === "QC_SUBMITTED";

  return (
    <main id="main">
      <p>
        <Link className="table-link" href="/admin/jobs">
          Back to jobs
        </Link>
      </p>
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">{job.id}</p>
          <h1>{job.request.partName}</h1>
          <p>
            <StatusBadge status={job.status} />
          </p>
        </div>
        <div style={{ minWidth: 220 }}>
          <ProgressBar percent={job.progressPercent} />
        </div>
      </div>

      <div className="op-detail-grid">
        <div>
          <section className="panel" aria-labelledby="job-heading">
            <h2 id="job-heading">Job</h2>
            <dl className="profile-grid">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="panel" aria-labelledby="qc-heading">
            <h2 id="qc-heading">QC documents</h2>
            {job.documents.length === 0 ? (
              <p className="muted">
                The supplier has not uploaded any QC documents yet.
              </p>
            ) : (
              <ul className="op-qc-list">
                {job.documents.map((doc) => (
                  <li key={doc.id}>
                    <div className="op-qc-head">
                      <strong>{doc.id}</strong>
                      <StatusBadge status={doc.reviewStatus} />
                    </div>
                    <p>
                      <strong>{doc.fileName}</strong>{" "}
                      <FileLinks
                        url={`/api/qc/${doc.id}/file`}
                        fileName={doc.fileName}
                      />{" "}
                      <span className="muted">
                        ({formatBytes(doc.fileSize)}, uploaded{" "}
                        {formatStamp(doc.uploadedAt)})
                      </span>
                    </p>
                    {doc.remarks && <p>Supplier remarks: {doc.remarks}</p>}
                    {doc.reviewComment && (
                      <p>Review comment: {doc.reviewComment}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {pendingReview && (
            <section className="panel" aria-labelledby="review-heading">
              <h2 id="review-heading">QC review</h2>
              <QcReviewPanel jobId={job.id} />
            </section>
          )}
          {job.status === "DISPATCHED" && (
            <section className="panel" aria-labelledby="deliver-heading">
              <h2 id="deliver-heading">Delivery</h2>
              <p className="muted">
                Dispatched via {job.courier}, tracking {job.trackingNumber}.
                Confirm once the goods reach the customer.
              </p>
              <DeliverButton jobId={job.id} />
            </section>
          )}
        </div>

        <section className="panel" aria-labelledby="timeline-heading">
          <h2 id="timeline-heading">Update timeline</h2>
          <Timeline
            label="Job update timeline"
            entries={job.updates.map((u) => ({
              id: u.id,
              status: u.status,
              at: u.changedAt,
              by: u.changedBy,
              comment: `${u.progressPercent}% complete. ${u.remarks}`.trim(),
            }))}
          />
        </section>
      </div>
    </main>
  );
}
