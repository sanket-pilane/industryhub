import Link from "next/link";
import { notFound } from "next/navigation";
import { AiConsentToggle } from "@/components/ai/ai-consent-toggle";
import "@/components/ai/ai.css";
import { FileLinks, FilePreview } from "@/components/files/file-preview";
import { LinkButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Timeline } from "@/components/ui/timeline";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatBytes } from "@/lib/drawings/rules";
import { getDrawingStore } from "@/lib/drawings/store";
import { listQcDocumentsForRequest } from "@/lib/jobs/queries";
import { formatDate } from "@/lib/quotations/format";
import {
  PARTNER_LABEL,
  customerRequestHistory,
  manufacturingProgress,
} from "@/lib/quotations/request-view";
import {
  actionBlockReason,
  listQuotationsForRequest,
} from "@/lib/quotations/service";
import { formatMoney } from "@/lib/utils/money";
import "@/components/quotations/quotations.css";

export const metadata = { title: "Drawing request" };

export default async function DrawingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser(["CUSTOMER"]);
  const { id } = await params;
  const db = getDb();
  const request = await getDrawingStore().getForCustomer(user.id, id);
  if (!request) notFound();

  const quotes = listQuotationsForRequest(db, request.id);
  const awaiting = quotes.find(
    (q) => q.status === "QUOTED" && actionBlockReason(db, q) === null,
  );
  const history = customerRequestHistory(db, request.id);
  const progress = manufacturingProgress(db, request.id);
  const qcDocuments = listQcDocumentsForRequest(db, request.id);

  const details = [
    ["Part", request.partName],
    ["Quantity", String(request.quantity)],
    ["Material", request.material],
    ["Tolerance", request.tolerance],
    ["Process", request.process],
    ["Surface finish", request.finish],
    ["Target date", formatDate(request.targetDate)],
    ["Submitted", formatDate(request.submittedAt)],
  ];

  return (
    <main id="main" className="container workspace-page">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Custom manufacturing</p>
          <h1>
            {request.id} <StatusBadge status={request.status} />
          </h1>
          <p>
            {request.partName} · revision {request.revision}
          </p>
        </div>
        <LinkButton href="/drawings" variant="secondary">
          All drawings
        </LinkButton>
      </div>

      {awaiting && (
        <div className="quote-cta" role="status">
          <p>
            Quotation {awaiting.id} (version {awaiting.version}) for{" "}
            {formatMoney(awaiting.totalPaise)} is waiting for your decision.
          </p>
          <LinkButton href={`/quotations/${awaiting.id}`} variant="rfq">
            Review quotation
          </LinkButton>
        </div>
      )}

      <div className="quote-layout">
        <div>
          <section className="panel">
            <h2>Request details</h2>
            <dl className="profile-grid">
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              <div>
                <dt>Drawing file</dt>
                <dd>
                  {request.file.name} ({formatBytes(request.file.size)})
                </dd>
              </div>
              {request.notes && (
                <div>
                  <dt>Notes</dt>
                  <dd>{request.notes}</dd>
                </div>
              )}
            </dl>
            <FilePreview
              url={`/api/drawings/${request.id}/file`}
              fileName={request.file.name}
              size={request.file.size}
              title="Your drawing"
            />
            <AiConsentToggle
              requestId={request.id}
              allowed={request.aiReviewAllowed}
            />
          </section>

          {qcDocuments.length > 0 && (
            <section className="panel" aria-labelledby="qc-docs-title">
              <h2 id="qc-docs-title">Quality inspection documents</h2>
              <p className="muted">
                Inspection reports uploaded by the manufacturing partner and
                reviewed by INDUSTRIHUB.
              </p>
              <ul className="version-list">
                {qcDocuments.map((doc) => (
                  <li key={doc.id}>
                    <span>
                      <strong>{doc.fileName}</strong>{" "}
                      <span className="muted">
                        ({formatBytes(doc.fileSize)},{" "}
                        {formatDate(doc.uploadedAt)})
                      </span>
                      {doc.reviewComment && (
                        <span className="table-sub">
                          Review: {doc.reviewComment}
                        </span>
                      )}
                      <FileLinks
                        url={`/api/qc/${doc.id}/file`}
                        fileName={doc.fileName}
                      />
                    </span>
                    <StatusBadge status={doc.reviewStatus} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panel">
            <h2>Quotations</h2>
            {quotes.length === 0 ? (
              <p className="muted">
                No quotation yet. Our engineers are reviewing your drawing.
              </p>
            ) : (
              <ul className="version-list">
                {quotes.map((q) => (
                  <li key={q.id}>
                    <span>
                      <Link className="table-link" href={`/quotations/${q.id}`}>
                        {q.id}
                      </Link>{" "}
                      · version {q.version} · {formatMoney(q.totalPaise)}
                      <span className="table-sub">
                        Valid until {formatDate(q.validUntil)}
                      </span>
                    </span>
                    <StatusBadge status={q.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {progress && (
            <section className="panel" aria-labelledby="progress-title">
              <h2 id="progress-title">Manufacturing progress</h2>
              <p className="muted">
                Handled by a {PARTNER_LABEL.toLowerCase()} ·{" "}
                <StatusBadge status={progress.jobStatus} />
              </p>
              <div
                className="job-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.progressPercent}
                aria-label="Manufacturing progress"
              >
                <span style={{ width: `${progress.progressPercent}%` }} />
              </div>
              <p>
                <strong>{progress.progressPercent}%</strong> complete
              </p>
              {progress.trackingNumber && (
                <p>
                  Dispatched via{" "}
                  <strong>{progress.courier || "courier"}</strong>, tracking
                  number <strong>{progress.trackingNumber}</strong>.
                </p>
              )}
              {progress.updates.length > 0 && (
                <ul className="version-list">
                  {progress.updates.map((u) => (
                    <li key={u.id}>
                      <span>
                        <StatusBadge status={u.status} /> {u.progressPercent}%
                        {u.remarks && (
                          <span className="table-sub">{u.remarks}</span>
                        )}
                      </span>
                      <time dateTime={u.at}>{formatDate(u.at)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <section className="panel">
          <h2>Status timeline</h2>
          <Timeline entries={history} />
        </section>
      </div>
    </main>
  );
}
