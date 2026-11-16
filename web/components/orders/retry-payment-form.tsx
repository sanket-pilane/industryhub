"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiResponse } from "../../../shared/contracts";
import {
  PaymentFields,
  type PayMethod,
  type PayOutcome,
} from "@/components/checkout/payment-fields";
import { Button } from "@/components/ui/button";

/** Pays or retries paying an order that is not yet paid. */
export function RetryPaymentForm({
  orderId,
  amountLabel,
}: {
  orderId: string;
  amountLabel: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PayMethod>("UPI");
  const [outcome, setOutcome] = useState<PayOutcome>("success");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${orderId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, testOutcome: outcome }),
      });
      const result = (await response.json()) as ApiResponse<unknown>;
      if (!result.success)
        setError(
          result.error?.message ??
            "Payment could not be started. Please retry.",
        );
      router.refresh();
    } catch {
      setError("Network error. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="retry-payment"
      aria-label="Retry payment"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <PaymentFields
        idPrefix="retry"
        method={method}
        outcome={outcome}
        onMethod={setMethod}
        onOutcome={setOutcome}
        disabled={busy}
      />
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Processing payment…" : `Pay ${amountLabel}`}
      </Button>
    </form>
  );
}
