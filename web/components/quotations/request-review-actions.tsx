"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { postJson } from "./api";
import "./quotations.css";

/** Admin controls: start engineering review and reject a request. */
export function RequestReviewActions({
  requestId,
  canStartReview,
  canReject,
}: {
  requestId: string;
  canStartReview: boolean;
  canReject: boolean;
}) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const call = async (path: string, body: unknown) => {
    setBusy(true);
    setError("");
    const result = await postJson(
      `/api/admin/requests/${requestId}/${path}`,
      body,
    );
    setBusy(false);
    if (result.ok) {
      setRejecting(false);
      router.refresh();
      return;
    }
    setError(result.message);
  };

  const reject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < 3) {
      setError("Add a short reason for the customer.");
      return;
    }
    await call("reject", { reason: reason.trim() });
  };

  if (!canStartReview && !canReject) return null;
  return (
    <div className="admin-actions">
      {rejecting ? (
        <form onSubmit={reject} noValidate>
          <div className="field">
            <label htmlFor="reject-reason">
              Reason for rejecting this request
            </label>
            <textarea
              id="reject-reason"
              className="plain-input"
              rows={3}
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="button-row">
            <Button type="submit" disabled={busy}>
              {busy ? "Rejecting…" : "Reject request"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRejecting(false)}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="button-row">
          {canStartReview && (
            <Button onClick={() => call("start-review", {})} disabled={busy}>
              {busy ? "Starting…" : "Start engineering review"}
            </Button>
          )}
          {canReject && (
            <Button
              variant="secondary"
              onClick={() => setRejecting(true)}
              disabled={busy}
            >
              Reject request
            </Button>
          )}
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
