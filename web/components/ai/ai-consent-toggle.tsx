"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "../../../shared/contracts";

/** Customer allows or withdraws AI-assisted review of their drawing. */
export function AiConsentToggle({
  requestId,
  allowed,
}: {
  requestId: string;
  allowed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const change = async (next: boolean) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/drawings/${requestId}/ai-consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowed: next }),
      });
      const result: ApiResponse<{ aiReviewAllowed: boolean }> =
        await response.json();
      if (!result.success) setError(result.error.message);
      else router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ai-consent">
      <p>
        <strong>
          AI-assisted review: {allowed ? "allowed" : "not allowed"}
        </strong>
        <br />
        <span className="muted">
          {allowed
            ? "Our engineers may ask Google Gemini to pre-check this drawing. An engineer reviews every suggestion."
            : "Allow our engineers to ask Google Gemini to pre-check this drawing for manufacturability and missing details. The drawing is sent to Google's API for this."}
        </span>
      </p>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => change(!allowed)}
      >
        {busy ? "Saving…" : allowed ? "Withdraw permission" : "Allow AI review"}
      </Button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
