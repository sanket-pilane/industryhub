"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { DrawingAnalysis } from "@/lib/ai/service";
import { estimatedBatchHours } from "@/lib/ai/review-schema";
import type { ApiResponse } from "../../../shared/contracts";
import "./ai.css";

/** Event the quotation form listens for to take over suggested line items. */
export const QUOTE_SUGGESTIONS_EVENT = "industrihub:quote-suggestions";
export type QuoteSuggestion = { description: string; quantity: number };

const stamp = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const SEVERITY_LABEL = {
  critical: "Critical",
  warning: "Check",
  info: "Note",
} as const;

export type ReviewAvailability =
  | { ok: true }
  | { ok: false; reason: "NOT_CONFIGURED" | "NOT_ALLOWED" | "UNSUPPORTED" };

const UNAVAILABLE: Record<
  Exclude<ReviewAvailability, { ok: true }>["reason"],
  string
> = {
  NOT_CONFIGURED:
    "The AI assistant is switched off. Add GEMINI_API_KEY to web/.env.local and restart the server to enable it.",
  NOT_ALLOWED:
    "The customer has not allowed AI-assisted review for this drawing. Review it manually, or ask the customer to allow it on their request page.",
  UNSUPPORTED:
    "The AI assistant reads PDF, PNG and JPG drawings up to 14 MB. Review this file manually.",
};

/**
 * Admin panel on the request page: runs the Gemini drawing review and shows
 * the saved result. Every suggestion is advisory.
 */
export function DrawingReviewPanel({
  requestId,
  quantity,
  availability,
  analysis,
  canQuote,
}: {
  requestId: string;
  quantity: number;
  availability: ReviewAvailability;
  analysis: DrawingAnalysis | null;
  canQuote: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/admin/requests/${requestId}/analysis`,
        {
          method: "POST",
        },
      );
      const result: ApiResponse<DrawingAnalysis> = await response.json();
      if (!result.success) setError(result.error.message);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  };

  const review = analysis?.status === "COMPLETED" ? analysis.review : null;

  const copyToQuote = () => {
    if (!review) return;
    window.dispatchEvent(
      new CustomEvent<QuoteSuggestion[]>(QUOTE_SUGGESTIONS_EVENT, {
        detail: review.quoteLineItems,
      }),
    );
    setNotice(
      "Line items copied into the quotation form below. Add unit prices before issuing.",
    );
    document
      .getElementById("quotation-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const copyQuestions = async () => {
    if (!review) return;
    try {
      await navigator.clipboard.writeText(
        review.questionsForCustomer.map((q, i) => `${i + 1}. ${q}`).join("\n"),
      );
      setNotice("Questions copied to the clipboard.");
    } catch {
      setNotice("Copy failed. Select the questions and copy them manually.");
    }
  };

  return (
    <section className="panel ai-panel" aria-labelledby="ai-review-title">
      <div className="ai-head">
        <div>
          <h2 id="ai-review-title">
            AI drawing assistant <span className="ai-tag">Gemini</span>
          </h2>
          <p className="muted">
            Suggestions to speed up engineering review. Check them against the
            drawing before quoting.
          </p>
        </div>
        {availability.ok && (
          <Button
            onClick={run}
            disabled={busy}
            variant={review ? "secondary" : "primary"}
          >
            {busy ? "Analysing…" : analysis ? "Run again" : "Analyse drawing"}
          </Button>
        )}
      </div>

      {!availability.ok && (
        <p className="info-note">{UNAVAILABLE[availability.reason]}</p>
      )}
      {busy && (
        <p className="info-note" role="status">
          Gemini is reading the drawing. This usually takes under a minute.
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="info-note" role="status">
          {notice}
        </p>
      )}

      {analysis?.status === "FAILED" && !busy && (
        <p className="field-error">
          Last attempt failed ({stamp.format(new Date(analysis.createdAt))}):{" "}
          {analysis.error}
        </p>
      )}

      {review && (
        <div className="ai-result">
          <p className="ai-meta">
            {analysis!.model} · run by {analysis!.requestedBy} on{" "}
            {stamp.format(new Date(analysis!.createdAt))} · drawing readability:{" "}
            <strong>{review.confidence}</strong>
          </p>

          <div className="ai-summary">
            <p>{review.summary}</p>
            <dl className="profile-grid">
              <div>
                <dt>Part type</dt>
                <dd>{review.partType}</dd>
              </div>
              <div>
                <dt>Overall size</dt>
                <dd>{review.overallDimensions}</dd>
              </div>
            </dl>
          </div>

          <div className="ai-columns">
            <div>
              <h3>Features found</h3>
              {review.features.length === 0 ? (
                <p className="muted">None identified.</p>
              ) : (
                <ul className="ai-list">
                  {review.features.map((f, i) => (
                    <li key={i}>
                      <span className="ai-chip">{f.kind}</span> {f.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3>Tolerances and finish</h3>
              <ul className="ai-list">
                {[...review.tolerances, ...review.surfaceFinish].map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
                {review.tolerances.length + review.surfaceFinish.length ===
                  0 && <li className="muted">None shown on the drawing.</li>}
              </ul>
            </div>
          </div>

          <h3>Manufacturability check</h3>
          {review.manufacturability.length === 0 ? (
            <p className="muted">No issues raised.</p>
          ) : (
            <ul className="ai-findings">
              {review.manufacturability.map((m, i) => (
                <li key={i} data-severity={m.severity}>
                  <span className={`ai-severity ai-severity-${m.severity}`}>
                    {SEVERITY_LABEL[m.severity]}
                  </span>
                  <div>
                    <strong>{m.issue}</strong>
                    <p>{m.suggestion}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h3>Mismatches with the RFQ</h3>
          {review.mismatches.length === 0 ? (
            <p className="muted">
              The RFQ details match what the drawing shows.
            </p>
          ) : (
            <div
              className="table-scroll"
              role="region"
              aria-label="Mismatches"
              tabIndex={0}
            >
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Customer chose</th>
                    <th>Drawing shows</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {review.mismatches.map((m, i) => (
                    <tr key={i}>
                      <td>{m.field}</td>
                      <td>{m.customerValue}</td>
                      <td>{m.drawingEvidence}</td>
                      <td>{m.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3>Suggested routing</h3>
          {review.operations.length === 0 ? (
            <p className="muted">No routing suggested.</p>
          ) : (
            <div
              className="table-scroll"
              role="region"
              aria-label="Suggested operations"
              tabIndex={0}
            >
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Operation</th>
                    <th>Machine</th>
                    <th>Setup (min)</th>
                    <th>Cycle per part (min)</th>
                  </tr>
                </thead>
                <tbody>
                  {review.operations.map((op, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{op.operation}</td>
                      <td>{op.machine}</td>
                      <td>{op.setupMinutes}</td>
                      <td>{op.cycleMinutesPerPart}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {review.operations.length > 0 && (
            <p className="ai-estimate">
              Rough machine time for {quantity} pcs:{" "}
              <strong>
                {estimatedBatchHours(review.operations, quantity)} hours
              </strong>{" "}
              (planning estimate, not a commitment)
            </p>
          )}

          <div className="ai-columns">
            <div>
              <h3>Suggested quotation lines</h3>
              {review.quoteLineItems.length === 0 ? (
                <p className="muted">No line items suggested.</p>
              ) : (
                <>
                  <ul className="ai-list">
                    {review.quoteLineItems.map((item, i) => (
                      <li key={i}>
                        {item.description} × {item.quantity}
                      </li>
                    ))}
                  </ul>
                  {canQuote && (
                    <Button variant="secondary" onClick={copyToQuote}>
                      Copy to quotation form
                    </Button>
                  )}
                </>
              )}
            </div>
            <div>
              <h3>Questions for the customer</h3>
              {review.questionsForCustomer.length === 0 ? (
                <p className="muted">Nothing to clarify.</p>
              ) : (
                <>
                  <ol className="ai-list ai-questions">
                    {review.questionsForCustomer.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>
                  <Button variant="secondary" onClick={copyQuestions}>
                    Copy questions
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
