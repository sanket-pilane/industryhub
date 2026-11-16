import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ProgressBar,
  formatDate,
  formatStamp,
} from "@/components/operations/display";
import "@/components/operations/operations.css";
import {
  DispatchForm,
  ProgressForm,
  QcUploadForm,
  StartProductionButton,
} from "@/components/operations/supplier-job-actions";
import { FileLinks, FilePreview } from "@/components/files/file-preview";
import { StatusBadge } from "@/components/ui/status-badge";
import { Timeline } from "@/components/ui/timeline";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatBytes } from "@/lib/drawings/rules";
import { loadJobForSupplierUser } from "@/lib/jobs/queries";

export const metadata = { title: "Job details" };

export default async function SupplierJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser(["SUPPLIER"]);
  const { id } = await params;
  // Only the job's own supplier may see it; anyone else gets a 404.
  const job = loadJobForSupplierUser(getDb(), user.id, id);
  if (!job) notFound();

  const specs: [string, string][] = [
    ["Material", job.request.material],
    ["Tolerance", job.request.tolerance],
    ["Process", job.request.process],
    ["Surface finish", job.request.finish],
    ["Quantity", String(job.request.quantity)],
    ["Target date", formatDate(job.targetDate)],
  ];

  return (
    <main id="main">
      <p>
        <Link className="table-link" href="/supplier">
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
          <section className="panel" aria-labelledby="specs-heading">
            <h2 id="specs-heading">Specifications</h2>
            <dl className="profile-grid">
              {specs.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              <div style={{ gridColumn: "1 / -1" }}>
                <dt>Notes</dt>
                <dd>{job.request.notes || "No additional notes."}</dd>
              </div>
            </dl>
            <FilePreview
              url={`/api/drawings/${job.requestId}/file`}
              fileName={job.request.fileName}
              size={job.request.fileSize}
              title="Drawing"
            />
          </section>

          <section className="panel" aria-labelledby="actions-heading">
            <h2 id="actions-heading">Actions</h2>
            {job.status === "ASSIGNED" && (
              <>
                <p className="muted">
                  Start production when you have accepted this job.
                </p>
                <StartProductionButton jobId={job.id} />
              </>
            )}
            {job.status === "IN_PRODUCTION" && (
              <>
                <ProgressForm jobId={job.id} current={job.progressPercent} />
                <hr className="op-divider" />
                <QcUploadForm jobId={job.id} resubmit={false} />
              </>
            )}
            {job.status === "QC_REJECTED" && (
              <QcUploadForm jobId={job.id} resubmit />
            )}
            {job.status === "QC_SUBMITTED" && (
              <p className="info-note" role="status">
                Your QC documents are with INDUSTRIHUB for review.
              </p>
            )}
            {job.status === "QC_APPROVED" && <DispatchForm jobId={job.id} />}
            {job.status === "DISPATCHED" && (
              <p className="info-note" role="status">
                Dispatched via {job.courier}, tracking {job.trackingNumber}.
                INDUSTRIHUB will mark the job delivered.
              </p>
            )}
            {job.status === "DELIVERED" && (
              <p className="info-note" role="status">
                This job is complete and delivered.
              </p>
            )}
          </section>
        </div>

        <div>
          <section className="panel" aria-labelledby="qc-heading">
            <h2 id="qc-heading">QC documents</h2>
            {job.documents.length === 0 ? (
              <p className="muted">No QC documents uploaded yet.</p>
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
                        ({formatBytes(doc.fileSize)},{" "}
                        {formatStamp(doc.uploadedAt)})
                      </span>
                    </p>
                    {doc.remarks && <p>Your remarks: {doc.remarks}</p>}
                    {doc.reviewComment && (
                      <p>Review comment: {doc.reviewComment}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel" aria-labelledby="history-heading">
            <h2 id="history-heading">Update history</h2>
            <Timeline
              label="Job update history"
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
      </div>
    </main>
  );
}
