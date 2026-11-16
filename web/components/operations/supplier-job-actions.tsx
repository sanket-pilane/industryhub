"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { QC_ACCEPT, checkQcFileMeta } from "@/lib/jobs/qc-files";
import { formatBytes } from "@/lib/drawings/rules";
import { callApi } from "./api";
import { FeedbackNote, type Feedback } from "./feedback";

export function StartProductionButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const start = async () => {
    setBusy(true);
    setFeedback(null);
    const result = await callApi(`/api/jobs/${jobId}/start`, "POST");
    setBusy(false);
    if (!result.ok) return setFeedback({ kind: "error", text: result.message });
    router.refresh();
  };
  return (
    <div>
      <Button onClick={start} disabled={busy}>
        {busy ? "Starting..." : "Start production"}
      </Button>
      <FeedbackNote feedback={feedback} />
    </div>
  );
}

export function ProgressForm({
  jobId,
  current,
}: {
  jobId: string;
  current: number;
}) {
  const router = useRouter();
  const [percent, setPercent] = useState(String(current));
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    const value = Number(percent);
    const next: Record<string, string[]> = {};
    if (
      percent.trim() === "" ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > 99
    )
      next.progressPercent = ["Enter a whole number from 0 to 99."];
    else if (value < current)
      next.progressPercent = [
        `Progress cannot go down. It is already ${current}%.`,
      ];
    if (!remarks.trim()) next.remarks = ["Add remarks for this update."];
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const result = await callApi(`/api/jobs/${jobId}/progress`, "POST", {
      progressPercent: value,
      remarks,
    });
    setBusy(false);
    if (!result.ok) {
      setErrors(result.fields);
      return setFeedback({ kind: "error", text: result.message });
    }
    setRemarks("");
    setFeedback({ kind: "success", text: "Progress update saved." });
    router.refresh();
  };

  return (
    <form onSubmit={submit} noValidate aria-busy={busy} className="op-form">
      <div className="field">
        <label htmlFor="progress-percent">Progress (%)</label>
        <input
          id="progress-percent"
          className="plain-input"
          inputMode="numeric"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          aria-invalid={!!errors.progressPercent}
          aria-describedby="progress-percent-hint"
        />
        <p className="field-hint" id="progress-percent-hint">
          0 to 99, and never lower than the current {current}%. Submit QC
          documents to reach 100%.
        </p>
        {errors.progressPercent && (
          <p className="field-error">{errors.progressPercent[0]}</p>
        )}
      </div>
      <div className="field">
        <label htmlFor="progress-remarks">Remarks</label>
        <textarea
          id="progress-remarks"
          className="plain-input op-textarea"
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          aria-invalid={!!errors.remarks}
        />
        {errors.remarks && <p className="field-error">{errors.remarks[0]}</p>}
      </div>
      <FeedbackNote feedback={feedback} />
      <Button type="submit" disabled={busy}>
        {busy ? "Saving..." : "Post progress update"}
      </Button>
    </form>
  );
}

export function QcUploadForm({
  jobId,
  resubmit,
}: {
  jobId: string;
  resubmit: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);

  const pick = (next: File | null) => {
    if (!next) return setFile(null);
    const check = checkQcFileMeta(next);
    if (!check.ok) {
      setFile(null);
      setErrors({ file: [check.message] });
      if (input.current) input.current.value = "";
      return;
    }
    setErrors((e) => ({ ...e, file: [] }));
    setFile(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    const next: Record<string, string[]> = {};
    if (!file) next.file = ["Attach a QC document."];
    if (!remarks.trim()) next.remarks = ["Add remarks for the QC document."];
    setErrors(next);
    if (!file || Object.keys(next).length) return;
    const body = new FormData();
    body.append("file", file);
    body.append("remarks", remarks);
    setBusy(true);
    const result = await callApi(`/api/jobs/${jobId}/qc`, "POST", body);
    setBusy(false);
    if (!result.ok) {
      setErrors(result.fields);
      return setFeedback({ kind: "error", text: result.message });
    }
    setFile(null);
    setRemarks("");
    if (input.current) input.current.value = "";
    setFeedback({ kind: "success", text: "QC document submitted for review." });
    router.refresh();
  };

  return (
    <form onSubmit={submit} noValidate aria-busy={busy} className="op-form">
      <p className="muted">
        {resubmit
          ? "INDUSTRIHUB rejected the last QC submission. Upload a corrected document."
          : "Upload your inspection report to submit this job for QC review."}{" "}
        PDF, PNG, JPG, XLSX or CSV, up to 20 MB.
      </p>
      <div className="field">
        <label htmlFor="qc-file">QC document</label>
        <input
          id="qc-file"
          ref={input}
          type="file"
          accept={QC_ACCEPT}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          aria-invalid={!!errors.file?.length}
          disabled={busy}
        />
        {file && (
          <p className="field-hint">
            {file.name} ({formatBytes(file.size)})
          </p>
        )}
        {errors.file?.[0] && (
          <p className="field-error" role="alert">
            {errors.file[0]}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="qc-remarks">Remarks</label>
        <textarea
          id="qc-remarks"
          className="plain-input op-textarea"
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          aria-invalid={!!errors.remarks?.length}
        />
        {errors.remarks?.[0] && (
          <p className="field-error">{errors.remarks[0]}</p>
        )}
      </div>
      <FeedbackNote feedback={feedback} />
      <Button type="submit" disabled={busy}>
        {busy ? "Uploading..." : resubmit ? "Resubmit for QC" : "Submit for QC"}
      </Button>
    </form>
  );
}

export function DispatchForm({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    const next: Record<string, string[]> = {};
    if (!courier.trim()) next.courier = ["Enter the courier name."];
    if (!tracking.trim()) next.trackingNumber = ["Enter the tracking number."];
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const result = await callApi(`/api/jobs/${jobId}/dispatch`, "POST", {
      courier,
      trackingNumber: tracking,
    });
    setBusy(false);
    if (!result.ok) {
      setErrors(result.fields);
      return setFeedback({ kind: "error", text: result.message });
    }
    router.refresh();
  };

  return (
    <form onSubmit={submit} noValidate aria-busy={busy} className="op-form">
      <p className="muted">
        QC is approved. Enter the courier details to dispatch the goods.
      </p>
      <div className="field-row">
        <div className="field">
          <label htmlFor="dispatch-courier">Courier</label>
          <input
            id="dispatch-courier"
            className="plain-input"
            value={courier}
            onChange={(e) => setCourier(e.target.value)}
            aria-invalid={!!errors.courier?.length}
          />
          {errors.courier?.[0] && (
            <p className="field-error">{errors.courier[0]}</p>
          )}
        </div>
        <div className="field">
          <label htmlFor="dispatch-tracking">Tracking number</label>
          <input
            id="dispatch-tracking"
            className="plain-input"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            aria-invalid={!!errors.trackingNumber?.length}
          />
          {errors.trackingNumber?.[0] && (
            <p className="field-error">{errors.trackingNumber[0]}</p>
          )}
        </div>
      </div>
      <FeedbackNote feedback={feedback} />
      <Button type="submit" disabled={busy}>
        {busy ? "Dispatching..." : "Mark as dispatched"}
      </Button>
    </form>
  );
}

export function SupplierProfileForm({
  capabilities,
}: {
  capabilities: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(capabilities);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    setBusy(true);
    const result = await callApi("/api/supplier/profile", "PATCH", {
      capabilities: text,
    });
    setBusy(false);
    if (!result.ok) return setFeedback({ kind: "error", text: result.message });
    setFeedback({ kind: "success", text: "Capabilities saved." });
    router.refresh();
  };

  return (
    <form onSubmit={submit} noValidate aria-busy={busy} className="op-form">
      <div className="field">
        <label htmlFor="capabilities">Capabilities</label>
        <textarea
          id="capabilities"
          className="plain-input op-textarea"
          rows={5}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="field-hint">
          Processes, materials and certifications, for example CNC turning, EN8
          steel, ISO 9001.
        </p>
      </div>
      <FeedbackNote feedback={feedback} />
      <Button type="submit" disabled={busy}>
        {busy ? "Saving..." : "Save capabilities"}
      </Button>
    </form>
  );
}
