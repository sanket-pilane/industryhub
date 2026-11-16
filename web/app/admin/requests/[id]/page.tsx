import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DrawingReviewPanel,
  type ReviewAvailability,
} from "@/components/ai/drawing-review-panel";
import { FilePreview } from "@/components/files/file-preview";
import { QuotationForm } from "@/components/quotations/quotation-form";
import { RequestReviewActions } from "@/components/quotations/request-review-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { Timeline } from "@/components/ui/timeline";
import { requireUser } from "@/lib/auth/session";
import {
  MAX_AI_FILE_BYTES,
  aiSupportsFile,
  latestAnalysis,
} from "@/lib/ai/service";
import { getDb } from "@/lib/db";
import { formatBytes } from "@/lib/drawings/rules";
import { getDrawingStore } from "@/lib/drawings/store";
import { formatDate } from "@/lib/quotations/format";
import { requestCustomer } from "@/lib/quotations/request-view";
import {
  latestRevisionComment,
  latestVersion,
  listQuotationsForRequest,
} from "@/lib/quotations/service";
import { formatMoney } from "@/lib/utils/money";
import "@/components/quotations/quotations.css";

export const metadata = { title: "Review request" };

const CLOSED = new Set(["REJECTED", "CANCELLED", "DELIVERED"]);

export default async function AdminRequestDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser(["ADMIN"]);
  const { id } = await params;
  const db = getDb();
  const store = getDrawingStore();
  const request = await store.get(id);
  if (!request) notFound();

  const customer = requestCustomer(db, request.customerId);
  const quotes = listQuotationsForRequest(db, request.id);
  const history = store.history(request.id).map((h) => ({
    id: h.id,
    status: h.to,
    at: h.changedAt,
    by: h.changedBy,
    comment: h.comment,
  }));
  const revision = latestRevisionComment(db, request.id);
  const canQuote =
    request.status === "UNDER_ENGINEERING_REVIEW" ||
    request.status === "REVISION_REQUESTED";
  const aiAvailability: ReviewAvailability = !process.env.GEMINI_API_KEY
    ? { ok: false, reason: "NOT_CONFIGURED" }
    : !request.aiReviewAllowed
      ? { ok: false, reason: "NOT_ALLOWED" }
      : !aiSupportsFile(request.file.name) ||
          request.file.size > MAX_AI_FILE_BYTES
        ? { ok: false, reason: "UNSUPPORTED" }
        : { ok: true };
  const canReject =
    request.status === "SUBMITTED" ||
    request.status === "UNDER_ENGINEERING_REVIEW" ||
    request.status === "REVISION_REQUESTED";

  const details = [
    ["Part", request.partName],
    ["Quantity", String(request.quantity)],
    ["Material", request.material],
    ["Tolerance", request.tolerance],
    ["Process", request.process],
    ["Surface finish", request.finish],
    ["Target date", formatDate(request.targetDate)],
    ["Submitted", formatDate(request.submittedAt)],
    ["Drawing revision", String(request.revision)],
  ];

  return (
    <main id="main">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">
            <Link href="/admin/requests">Requests</Link>
          </p>
          <h1>
            {request.id} <StatusBadge status={request.status} />
          </h1>
          <p>
            {request.partName} · {request.quantity} pcs
          </p>
        </div>
      </div>

      <div className="admin-grid">
        <section className="panel">
          <h2>RFQ details</h2>
          <dl className="profile-grid">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            <div>
              <dt>Drawing</dt>
              <dd>
                {request.file.name} ({formatBytes(request.file.size)})
              </dd>
            </div>
            {request.notes && (
              <div>
                <dt>Customer notes</dt>
                <dd>{request.notes}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="panel">
          <h2>Customer</h2>
          {customer ? (
            <dl className="profile-grid">
              <div>
                <dt>Name</dt>
                <dd>
                  {customer.firstName} {customer.lastName}
                </dd>
              </div>
              <div>
                <dt>Company</dt>
                <dd>{customer.companyName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{customer.email}</dd>
              </div>
              <div>
                <dt>GSTIN</dt>
                <dd>{customer.gstin || "Not added"}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">Customer record not found.</p>
          )}
          <RequestReviewActions
            requestId={request.id}
            canStartReview={request.status === "SUBMITTED"}
            canReject={canReject}
          />
        </section>
      </div>

      <section className="panel" aria-labelledby="drawing-title">
        <h2 id="drawing-title">Customer drawing</h2>
        <FilePreview
          url={`/api/drawings/${request.id}/file`}
          fileName={request.file.name}
          size={request.file.size}
          title="Drawing"
        />
      </section>

      <section className="panel">
        <h2>Quotations</h2>
        {quotes.length === 0 ? (
          <p className="muted">No quotation has been issued yet.</p>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Quotation versions"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th className="quote-id">Quotation</th>
                  <th>Version</th>
                  <th className="num">Total</th>
                  <th>Advance</th>
                  <th>Lead time</th>
                  <th>Valid until</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td className="quote-id">
                      {q.id}
                      <span className="table-sub">
                        {q.items.length} line item
                        {q.items.length === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td>v{q.version}</td>
                    <td className="num">{formatMoney(q.totalPaise)}</td>
                    <td>{q.advancePercent}%</td>
                    <td>{q.leadTimeDays} days</td>
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

      <DrawingReviewPanel
        requestId={request.id}
        quantity={request.quantity}
        availability={aiAvailability}
        analysis={latestAnalysis(db, request.id)}
        canQuote={canQuote}
      />

      {canQuote ? (
        <section className="panel" id="quotation-form">
          {revision && (
            <div className="revision-note" role="note">
              <strong>
                Customer revision request (on version {revision.version},{" "}
                {formatDate(revision.createdAt)})
              </strong>
              <p>{revision.comment}</p>
            </div>
          )}
          <QuotationForm
            requestId={request.id}
            partName={request.partName}
            defaultQuantity={request.quantity}
            nextVersion={latestVersion(db, request.id) + 1}
          />
        </section>
      ) : (
        !CLOSED.has(request.status) && (
          <p className="info-note">
            {request.status === "SUBMITTED"
              ? "Start the engineering review to create a quotation."
              : "A quotation can be created while the request is under engineering review or after the customer asks for a revision."}
          </p>
        )
      )}

      <section className="panel">
        <h2>Status timeline</h2>
        <Timeline entries={history} />
      </section>
    </main>
  );
}
