"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { callApi } from "./api";
import { FeedbackNote, type Feedback } from "./feedback";

export type SupplierOption = { id: string; companyName: string; city: string };

/** One row of the "awaiting assignment" table: choose a verified supplier and a target date. */
export function AssignForm({
  requestId,
  suppliers,
  defaultDate,
}: {
  requestId: string;
  suppliers: SupplierOption[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [targetDate, setTargetDate] = useState(defaultDate);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    if (!supplierId)
      return setFeedback({
        kind: "error",
        text: "Choose a verified supplier.",
      });
    if (!targetDate)
      return setFeedback({ kind: "error", text: "Choose a target date." });
    setBusy(true);
    const result = await callApi("/api/admin/jobs", "POST", {
      requestId,
      supplierId,
      targetDate,
    });
    setBusy(false);
    if (!result.ok) return setFeedback({ kind: "error", text: result.message });
    router.refresh();
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-busy={busy}
      className="op-inline-form"
    >
      <div className="op-inline-fields">
        <div className="field">
          <label htmlFor={`assign-supplier-${requestId}`}>Supplier</label>
          <select
            id={`assign-supplier-${requestId}`}
            className="plain-input"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            disabled={suppliers.length === 0}
          >
            <option value="">
              {suppliers.length === 0
                ? "No verified suppliers"
                : "Choose supplier"}
            </option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.companyName}
                {s.city ? `, ${s.city}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`assign-date-${requestId}`}>Target date</label>
          <input
            id={`assign-date-${requestId}`}
            className="plain-input"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy || suppliers.length === 0}>
          {busy ? "Assigning..." : "Assign"}
        </Button>
      </div>
      <FeedbackNote feedback={feedback} />
    </form>
  );
}

/** QC review: approve, or reject with a required comment. */
export function QcReviewPanel({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const review = async (decision: "approve" | "reject") => {
    setFeedback(null);
    if (decision === "reject" && !comment.trim())
      return setFeedback({
        kind: "error",
        text: "Add a comment explaining what to fix.",
      });
    setBusy(true);
    const result = await callApi(
      `/api/admin/jobs/${jobId}/qc/${decision}`,
      "POST",
      { comment },
    );
    setBusy(false);
    if (!result.ok) return setFeedback({ kind: "error", text: result.message });
    setComment("");
    router.refresh();
  };

  return (
    <div className="op-form">
      <div className="field">
        <label htmlFor="qc-review-comment">Review comment</label>
        <textarea
          id="qc-review-comment"
          className="plain-input op-textarea"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <p className="field-hint">
          Required when rejecting, optional when approving.
        </p>
      </div>
      <FeedbackNote feedback={feedback} />
      <div className="button-row">
        <Button onClick={() => review("approve")} disabled={busy}>
          Approve QC
        </Button>
        <Button
          variant="secondary"
          onClick={() => review("reject")}
          disabled={busy}
        >
          Reject QC
        </Button>
      </div>
    </div>
  );
}

export function DeliverButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const deliver = async () => {
    setBusy(true);
    setFeedback(null);
    const result = await callApi(`/api/admin/jobs/${jobId}/deliver`, "POST");
    setBusy(false);
    if (!result.ok) return setFeedback({ kind: "error", text: result.message });
    router.refresh();
  };
  return (
    <div>
      <Button onClick={deliver} disabled={busy}>
        {busy ? "Saving..." : "Mark delivered"}
      </Button>
      <FeedbackNote feedback={feedback} />
    </div>
  );
}

/** Verify or reject a supplier account. */
export function SupplierVerifyButtons({
  supplierId,
  status,
}: {
  supplierId: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const set = async (verificationStatus: "VERIFIED" | "REJECTED") => {
    setBusy(true);
    setFeedback(null);
    const result = await callApi(
      `/api/admin/suppliers/${supplierId}`,
      "PATCH",
      {
        verificationStatus,
      },
    );
    setBusy(false);
    if (!result.ok) return setFeedback({ kind: "error", text: result.message });
    router.refresh();
  };
  return (
    <div>
      <div className="button-row op-compact">
        {status !== "VERIFIED" && (
          <Button onClick={() => set("VERIFIED")} disabled={busy}>
            Verify
          </Button>
        )}
        {status !== "REJECTED" && (
          <Button
            variant="secondary"
            onClick={() => set("REJECTED")}
            disabled={busy}
          >
            Reject
          </Button>
        )}
      </div>
      <FeedbackNote feedback={feedback} />
    </div>
  );
}
