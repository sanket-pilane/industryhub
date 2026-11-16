"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ApiResponse, DrawingRequest } from "../../../shared/contracts";
import {
  FINISHES,
  MATERIALS,
  PROCESSES,
  TOLERANCES,
  rfqSchema,
  type RfqDetails,
  type RfqInput,
} from "@/lib/validators";
import {
  DRAWING_ACCEPT,
  checkDrawingFile,
  formatBytes,
} from "@/lib/drawings/rules";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

type Phase =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "cancelled" }
  | { kind: "error"; message: string; details: RfqDetails }
  | { kind: "duplicate"; message: string; details: RfqDetails }
  | { kind: "done"; request: DrawingRequest };

const TEXT_KEYS = [
  "partName",
  "quantity",
  "material",
  "tolerance",
  "process",
  "finish",
  "targetDate",
  "notes",
] as const;

export function DrawingUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [progress, setProgress] = useState(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<RfqInput, unknown, RfqDetails>({
    resolver: zodResolver(rfqSchema),
    mode: "onBlur",
    defaultValues: {
      partName: "",
      quantity: "",
      material: "" as RfqInput["material"],
      tolerance: "" as RfqInput["tolerance"],
      process: "" as RfqInput["process"],
      finish: "" as RfqInput["finish"],
      targetDate: "",
      notes: "",
      confidential: false,
      aiReview: false,
    },
  });

  const pick = (next: File | undefined | null) => {
    if (!next) return;
    const check = checkDrawingFile(next);
    if (!check.ok) {
      setFile(null);
      setFileError(check.message);
      return;
    }
    setFile(next);
    setFileError("");
    setPhase({ kind: "idle" });
  };

  const send = (details: RfqDetails, allowDuplicate = false) => {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    for (const key of TEXT_KEYS) body.append(key, String(details[key]));
    body.append("confidential", "true");
    if (details.aiReview) body.append("aiReview", "true");
    if (allowDuplicate) body.append("allowDuplicate", "true");

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/drawings");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        setProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      const result = xhr.response as ApiResponse<DrawingRequest> | null;
      if (result?.success) {
        setPhase({ kind: "done", request: result.data });
        return;
      }
      const error = result?.error;
      if (error?.code === "DUPLICATE_DRAWING") {
        setPhase({ kind: "duplicate", message: error.message, details });
        return;
      }
      for (const [field, messages] of Object.entries(error?.fields ?? {}))
        setError(field as keyof RfqInput, { message: messages[0] });
      setPhase({
        kind: "error",
        message: error?.message ?? "Upload failed. Please retry.",
        details,
      });
    };
    xhr.onerror = () =>
      setPhase({
        kind: "error",
        message: "Network error. Check your connection and retry.",
        details,
      });
    xhr.onabort = () => setPhase({ kind: "cancelled" });
    setProgress(0);
    setPhase({ kind: "uploading" });
    xhr.send(body);
  };

  const submit = (details: RfqDetails) => {
    if (!file) {
      setFileError("Attach a drawing file.");
      return;
    }
    send(details);
  };

  const startOver = () => {
    reset();
    setFile(null);
    setFileError("");
    setProgress(0);
    setPhase({ kind: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  };

  if (phase.kind === "done") {
    const r = phase.request;
    return (
      <div className="upload-success" role="status">
        <span className="upload-success-icon" aria-hidden="true">
          ✓
        </span>
        <h2>Drawing submitted</h2>
        <p>
          Request <strong>{r.id}</strong> for {r.quantity} × {r.partName}{" "}
          (revision {r.revision}) is with our engineering team for review.
        </p>
        <p className="muted">
          {r.file.name} · {formatBytes(r.file.size)}
        </p>
        <div className="button-row">
          <Link className="button button-primary" href="/drawings">
            View my drawings
          </Link>
          <Button variant="secondary" onClick={startOver}>
            Upload another drawing
          </Button>
        </div>
      </div>
    );
  }

  const uploading = phase.kind === "uploading";
  const field = (
    name: keyof RfqInput,
    label: string,
    control: React.ReactNode,
  ) => (
    <div className="field">
      <label htmlFor={`rfq-${name}`}>{label}</label>
      {control}
      {errors[name] && (
        <p className="field-error" id={`rfq-${name}-error`}>
          {errors[name]?.message}
        </p>
      )}
    </div>
  );
  const describe = (name: keyof RfqInput) => ({
    id: `rfq-${name}`,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `rfq-${name}-error` : undefined,
  });
  const select = (
    name: "material" | "tolerance" | "process" | "finish",
    options: readonly string[],
    placeholder: string,
  ) => (
    <select className="plain-input" {...describe(name)} {...register(name)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );

  return (
    <form
      className="upload-form"
      onSubmit={handleSubmit(submit)}
      noValidate
      aria-busy={uploading}
    >
      <div
        className="dropzone"
        data-dragging={dragging}
        data-invalid={!!fileError}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files[0]);
        }}
      >
        <span className="dropzone-icon" aria-hidden="true">
          <Icon name="quote" />
        </span>
        <p className="dropzone-title">Drag and drop your drawing here</p>
        <p className="muted">PDF, DWG, DXF, STEP or STP · up to 50 MB</p>
        <label className="button button-secondary" htmlFor="drawing-file">
          Choose file
        </label>
        <input
          ref={inputRef}
          id="drawing-file"
          className="file-input"
          type="file"
          accept={DRAWING_ACCEPT}
          aria-describedby={fileError ? "drawing-file-error" : undefined}
          onChange={(e) => pick(e.target.files?.[0])}
          disabled={uploading}
        />
      </div>
      {fileError && (
        <p className="field-error" id="drawing-file-error" role="alert">
          {fileError}
        </p>
      )}
      {file && (
        <div className="file-card">
          <span className="file-ext">
            {file.name.split(".").pop()?.toUpperCase()}
          </span>
          <div className="file-meta">
            <strong>{file.name}</strong>
            <span>{formatBytes(file.size)}</span>
          </div>
          <button
            type="button"
            className="cart-remove"
            onClick={() => {
              setFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            disabled={uploading}
          >
            Remove
          </button>
        </div>
      )}

      <fieldset className="rfq-grid" disabled={uploading}>
        <legend>Part details</legend>
        {field(
          "partName",
          "Part name",
          <input
            className="plain-input"
            {...describe("partName")}
            {...register("partName")}
          />,
        )}
        {field(
          "quantity",
          "Quantity",
          <input
            className="plain-input"
            inputMode="numeric"
            {...describe("quantity")}
            {...register("quantity")}
          />,
        )}
        {field(
          "material",
          "Material",
          select("material", MATERIALS, "Choose material"),
        )}
        {field(
          "tolerance",
          "Tolerance",
          select("tolerance", TOLERANCES, "Choose tolerance"),
        )}
        {field(
          "process",
          "Manufacturing process",
          select("process", PROCESSES, "Choose process"),
        )}
        {field(
          "finish",
          "Surface finish",
          select("finish", FINISHES, "Choose finish"),
        )}
        {field(
          "targetDate",
          "Target delivery date",
          <input
            className="plain-input"
            type="date"
            {...describe("targetDate")}
            {...register("targetDate")}
          />,
        )}
        <div className="rfq-notes">
          {field(
            "notes",
            "Notes for the engineering team (optional)",
            <textarea
              className="plain-input"
              rows={3}
              {...describe("notes")}
              {...register("notes")}
            />,
          )}
        </div>
      </fieldset>
      <div className="field">
        <label className="remember-label">
          <input
            type="checkbox"
            aria-describedby={
              errors.confidential ? "rfq-confidential-error" : undefined
            }
            {...register("confidential")}
          />
          <span className="checkbox-mark">
            <Icon name="check" />
          </span>
          I confirm this drawing may be shared with verified INDUSTRIHUB
          manufacturing partners under confidentiality.
        </label>
        {errors.confidential && (
          <p className="field-error" id="rfq-confidential-error">
            {errors.confidential.message}
          </p>
        )}
      </div>
      <div className="field">
        <label className="remember-label">
          <input
            type="checkbox"
            aria-describedby="rfq-ai-hint"
            {...register("aiReview")}
          />
          <span className="checkbox-mark">
            <Icon name="check" />
          </span>
          Allow AI-assisted engineering review (optional)
        </label>
        <p className="field-hint" id="rfq-ai-hint">
          Our engineers can ask Google Gemini to pre-check the drawing for
          manufacturability and missing details. The drawing is sent to
          Google&apos;s API for this; an engineer reviews every suggestion. You
          can change this later on the request page.
        </p>
      </div>

      {uploading && (
        <div className="upload-progress" role="status" aria-live="polite">
          <div className="progress-track" aria-hidden="true">
            <span style={{ transform: `scaleX(${progress / 100})` }} />
          </div>
          <span>Uploading… {progress}%</span>
          <Button
            variant="secondary"
            type="button"
            onClick={() => xhrRef.current?.abort()}
          >
            Cancel upload
          </Button>
        </div>
      )}
      {phase.kind === "cancelled" && (
        <p className="info-note" role="status">
          Upload cancelled. Your details are kept; submit again when ready.
        </p>
      )}
      {phase.kind === "error" && (
        <div className="upload-alert" role="alert">
          <p>{phase.message}</p>
          <Button
            variant="secondary"
            type="button"
            onClick={() => send(phase.details)}
          >
            Retry upload
          </Button>
        </div>
      )}
      {phase.kind === "duplicate" && (
        <div className="upload-alert upload-warning" role="alert">
          <p>{phase.message} Submit it again as a new request?</p>
          <div className="button-row">
            <Button type="button" onClick={() => send(phase.details, true)}>
              Submit as new request
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setPhase({ kind: "idle" })}
            >
              Keep existing request
            </Button>
          </div>
        </div>
      )}
      {!uploading && phase.kind !== "duplicate" && (
        <Button type="submit" className="upload-submit">
          Submit drawing for quotation
        </Button>
      )}
    </form>
  );
}
