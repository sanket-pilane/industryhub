"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { postJson } from "./api";
import "./quotations.css";

const METHODS = [
  ["UPI", "UPI"],
  ["CARD", "Credit / debit card"],
  ["NETBANKING", "Net banking"],
] as const;
const OUTCOMES = [
  ["success", "Success"],
  ["pending", "Pending"],
  ["failed", "Failed"],
  ["cancelled", "Cancelled"],
] as const;

/**
 * Advance payment. No card or bank details are collected: the gateway is in
 * test mode, so the person picks a method and which result the test gateway
 * should return.
 */
export function PayAdvanceForm({
  quotationId,
  amountLabel,
  retry,
}: {
  quotationId: string;
  amountLabel: string;
  retry: boolean;
}) {
  const router = useRouter();
  const [method, setMethod] = useState("UPI");
  const [outcome, setOutcome] = useState("success");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await postJson(`/api/quotations/${quotationId}/pay`, {
      method,
      testOutcome: outcome,
    });
    setBusy(false);
    if (result.ok) {
      router.refresh();
      return;
    }
    setError(result.message);
  };

  return (
    <form className="panel pay-advance" onSubmit={submit} aria-busy={busy}>
      <h2>{retry ? "Retry advance payment" : "Pay advance"}</h2>
      <p>
        Advance due: <strong>{amountLabel}</strong>
      </p>
      <div className="field-row">
        <div className="field">
          <label htmlFor="pay-method">Payment method</label>
          <select
            id="pay-method"
            className="plain-input"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            disabled={busy}
          >
            {METHODS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pay-outcome">Test mode: payment result</label>
          <select
            id="pay-outcome"
            className="plain-input"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            disabled={busy}
          >
            {OUTCOMES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="info-note">
        Test mode: payments run against a test gateway, so no money moves.
        Choose the result you want to simulate. We never ask for card or bank
        details.
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Processing…" : `Pay ${amountLabel}`}
      </Button>
    </form>
  );
}
