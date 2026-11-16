import type { DatabaseSync } from "node:sqlite";
import type { OrderStatus } from "../../../shared/enums";
import { recordAudit } from "@/lib/audit";
import { TransitionError } from "@/lib/manufacturing/status";
import { RepositoryError, notFound } from "@/lib/repositories/errors";
import { loadOrderRow } from "./queries";

/** CONFIRMED -> PACKED -> DISPATCHED -> DELIVERED; cancellation only before dispatch. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus) {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function addOrderHistory(
  db: DatabaseSync,
  orderId: string,
  status: OrderStatus,
  changedBy: string,
  comment = "",
) {
  db.prepare(
    `INSERT INTO order_status_history (order_id, status, comment, changed_by, changed_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(orderId, status, comment, changedBy, new Date().toISOString());
}

/**
 * Cancels an order and puts its reserved stock back. An unpaid order also
 * gets payment status CANCELLED; a paid one stays PAID and the history notes
 * that a refund is due. Call inside a transaction.
 */
export function cancelOrder(
  db: DatabaseSync,
  orderId: string,
  actorId: string,
  reason = "",
) {
  const order = loadOrderRow(db, orderId);
  if (!order) throw notFound("Order");
  if (!canTransitionOrder(order.status, "CANCELLED"))
    throw new TransitionError(
      `An order that is ${ORDER_STATUS_LABELS[order.status]} cannot be cancelled.`,
    );
  const items = db
    .prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?")
    .all(orderId) as { product_id: string; quantity: number }[];
  const restock = db.prepare(
    "UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?",
  );
  for (const item of items) restock.run(item.quantity, item.product_id);
  const paid = order.payment_status === "PAID";
  const at = new Date().toISOString();
  db.prepare(
    "UPDATE orders SET status = 'CANCELLED', payment_status = ?, updated_at = ? WHERE id = ?",
  ).run(paid ? "PAID" : "CANCELLED", at, orderId);
  const comment = [
    reason,
    "Reserved stock has been released.",
    paid ? "The order was paid: a refund is due to the customer." : "",
  ]
    .filter(Boolean)
    .join(" ");
  addOrderHistory(db, orderId, "CANCELLED", actorId, comment);
  return { refundDue: paid };
}

export interface OrderTransitionOptions {
  courier?: string;
  trackingNumber?: string;
  comment?: string;
}

/**
 * Admin status change. Validates the transition, applies side effects
 * (dispatch details, cancellation and restock), writes history and an audit
 * entry. Call inside a transaction.
 */
export function transitionOrder(
  db: DatabaseSync,
  orderId: string,
  to: OrderStatus,
  actorId: string,
  options: OrderTransitionOptions = {},
) {
  const order = loadOrderRow(db, orderId);
  if (!order) throw notFound("Order");
  const from = order.status;
  if (!canTransitionOrder(from, to))
    throw new TransitionError(
      `An order that is ${ORDER_STATUS_LABELS[from]} cannot move to ${ORDER_STATUS_LABELS[to]}.`,
    );
  const comment = options.comment?.trim() ?? "";

  if (to === "CANCELLED") {
    cancelOrder(db, orderId, actorId, comment);
  } else {
    if (
      (to === "PACKED" || to === "DISPATCHED") &&
      order.payment_status !== "PAID"
    )
      throw new TransitionError(
        "Payment has not been received for this order, so it cannot be packed or dispatched yet.",
      );
    const at = new Date().toISOString();
    if (to === "DISPATCHED") {
      const courier = options.courier?.trim() ?? "";
      const trackingNumber = options.trackingNumber?.trim() ?? "";
      if (!courier || !trackingNumber)
        throw new RepositoryError(
          "VALIDATION_ERROR",
          "Enter the courier and the tracking number to dispatch this order.",
          400,
        );
      db.prepare(
        "UPDATE orders SET status = ?, courier = ?, tracking_number = ?, updated_at = ? WHERE id = ?",
      ).run(to, courier, trackingNumber, at, orderId);
      addOrderHistory(
        db,
        orderId,
        to,
        actorId,
        [`Dispatched with ${courier}, tracking ${trackingNumber}.`, comment]
          .filter(Boolean)
          .join(" "),
      );
    } else {
      db.prepare(
        "UPDATE orders SET status = ?, updated_at = ? WHERE id = ?",
      ).run(to, at, orderId);
      addOrderHistory(db, orderId, to, actorId, comment);
    }
  }
  recordAudit(db, {
    actorId,
    action: `ORDER_${to}`,
    entityType: "ORDER",
    entityId: orderId,
    detail: `${from} -> ${to}${comment ? `: ${comment}` : ""}`,
  });
  return { from, to };
}
