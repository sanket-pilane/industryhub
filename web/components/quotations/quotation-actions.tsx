"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { postJson } from "./api";
import "./quotations.css";

type Mode = "none" | "revision" | "reject";

const COPY = {
  revision: {
    label: "What should change?",
    submit: "Send revision request",
    path: "revision",
    field: "comment",
    hint: "Tell us what to adjust: price, lead time, quantity or terms.",
    required: "Tell us what should change in the quotation.",
  },
  reject: {
    label: "Why are you rejecting this quotation?",
    submit: "Reject quotation",
    path: "reject",
    field: "reason",
    hint: "Your reason helps our engineers improve future quotes.",
    required: "Add a short reason.",
  },
} as const;

/** Accept / request revision / reject controls for a quotation awaiting a decision. */
export function QuotationActions({ quotationId }: { quotationId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("none");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (path: string, body: unknown) => {
    setBusy(true);
    setError("");
    const result = await postJson(
      `/api/quotations/${quotationId}/${path}`,
      body,
    );
    setBusy(false);
    if (result.ok) {
      router.refresh();
      return;
    }
    setError(result.message);
  };

  const submitText = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "none") return;
    const copy = COPY[mode];
    if (text.trim().length < 3) {
      setError(copy.required);
      return;
    }
    await run(copy.path, { [copy.field]: text.trim() });
  };

  const choose = (next: Mode) => {
    setMode(next);
    setText("");
    setError("");
  };

  return (
    <section className="panel quote-decision" aria-labelledby="decision-title">
      <h2 id="decision-title">Your decision</h2>
      <p className="muted">
        Accept to move on to the advance payment, ask for a revised quotation,
        or reject it.
      </p>
      {mode === "none" ? (
        <div className="button-row">
          <Button onClick={() => run("accept", {})} disabled={busy}>
            {busy ? "Working…" : "Accept quotation"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => choose("revision")}
            disabled={busy}
          >
            Request revision
          </Button>
          <Button
            variant="secondary"
            onClick={() => choose("reject")}
            disabled={busy}
          >
            Reject
          </Button>
        </div>
      ) : (
        <form className="quote-reason" onSubmit={submitText} noValidate>
          <div className="field">
            <label htmlFor="quote-reason">{COPY[mode].label}</label>
            <textarea
              id="quote-reason"
              className="plain-input"
              rows={3}
              value={text}
              maxLength={1000}
              onChange={(e) => setText(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby="quote-reason-hint"
              disabled={busy}
            />
            <p className="field-hint" id="quote-reason-hint">
              {COPY[mode].hint}
            </p>
          </div>
          <div className="button-row">
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : COPY[mode].submit}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => choose("none")}
              disabled={busy}
            >
              Back
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
