"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiResponse } from "../../../shared/contracts";
import type { OrderStatus, PaymentStatus } from "../../../shared/enums";
import { Button } from "@/components/ui/button";
import { ORDER_TRANSITIONS } from "@/lib/orders/status";

const LABELS: Record<OrderStatus, string> = {
  CONFIRMED: "Confirm",
  PACKED: "Mark as packed",
  DISPATCHED: "Dispatch",
  DELIVERED: "Mark as delivered",
  CANCELLED: "Cancel order",
};

/** Moves an order to its next allowed status. Dispatch needs a courier and tracking number. */
export function AdminOrderActions({
  orderId,
  status,
  paymentStatus,
}: {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}) {
  const router = useRouter();
  const [courier, setCourier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const next = ORDER_TRANSITIONS[status];
  if (next.length === 0)
    return (
      <p className="muted">
        {status === "CANCELLED"
          ? "This order was cancelled."
          : "This order is complete."}{" "}
        No further actions are available.
      </p>
    );

  const move = async (to: OrderStatus) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: to,
          ...(to === "DISPATCHED" ? { courier, trackingNumber } : {}),
          ...(comment.trim() ? { comment } : {}),
        }),
      });
      const result = (await response.json()) as ApiResponse<unknown>;
      if (!result.success) {
        setError(
          result.error?.message ??
            "The change could not be saved. Please retry.",
        );
        return;
      }
      setNotice(`Order is now ${to.toLowerCase()}.`);
      setComment("");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  };

  const forward = next.filter((s) => s !== "CANCELLED");
  const canCancel = next.includes("CANCELLED");
  const dispatching = forward.includes("DISPATCHED");
  const unpaid = paymentStatus !== "PAID";

  return (
    <div className="order-actions">
      {unpaid && forward.length > 0 && (
        <p className="info-note">
          Payment has not been received, so this order cannot be packed or
          dispatched yet.
        </p>
      )}
      {dispatching && (
        <div className="field-row">
          <div className="field">
            <label htmlFor="order-courier">Courier</label>
            <input
              id="order-courier"
              className="plain-input"
              value={courier}
              disabled={busy}
              onChange={(e) => setCourier(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="order-tracking">Tracking number</label>
            <input
              id="order-tracking"
              className="plain-input"
              value={trackingNumber}
              disabled={busy}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="order-comment">Comment (optional)</label>
        <input
          id="order-comment"
          className="plain-input"
          value={comment}
          maxLength={500}
          disabled={busy}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      <div className="button-row">
        {forward.map((to) => (
          <Button
            key={to}
            type="button"
            disabled={
              busy ||
              unpaid ||
              (to === "DISPATCHED" &&
                (!courier.trim() || !trackingNumber.trim()))
            }
            onClick={() => void move(to)}
          >
            {LABELS[to]}
          </Button>
        ))}
        {canCancel && (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void move("CANCELLED")}
          >
            {LABELS.CANCELLED}
          </Button>
        )}
      </div>
      {canCancel && (
        <p className="field-hint">
          Cancelling releases the reserved stock.
          {paymentStatus === "PAID"
            ? " The order is paid, so a refund will be due."
            : ""}
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
    </div>
  );
}
