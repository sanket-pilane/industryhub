import type { DatabaseSync } from "node:sqlite";
import type { Quotation } from "../../../shared/contracts";
import type {
  ManufacturingStatus,
  PaymentStatus,
  QuotationStatus,
} from "../../../shared/enums";
import { nextNumber, transaction } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { transitionRequest } from "@/lib/manufacturing/status";
import {
  getPaymentGateway,
  type PaymentGateway,
  type PaymentMethod,
  type TestOutcome,
} from "@/lib/payments/gateway";
import { RepositoryError, notFound } from "@/lib/repositories/errors";
import { QUOTATION_SELECT, loadQuotation } from "@/lib/repositories/sqlite";
import { formatMoney, lineTotal } from "@/lib/utils/money";
import {
  MAX_QUOTE_TOTAL_PAISE,
  advanceAmounts,
  isExpired,
  type CreateQuotationData,
} from "./rules";

/**
 * Quotation workflow. Plain functions over a DatabaseSync so they can be unit
 * tested without HTTP. Every state change runs in one transaction and records
 * request history, `quotation_actions` and (for admin and payments) audit rows.
 */

type QuoteRow = Parameters<typeof loadQuotation>[1];

const conflict = (message: string) =>
  new RepositoryError("CONFLICT", message, 409);

function requestStatus(db: DatabaseSync, requestId: string) {
  return (
    db
      .prepare("SELECT status FROM manufacturing_requests WHERE id = ?")
      .get(requestId) as { status: ManufacturingStatus } | undefined
  )?.status;
}

function logAction(
  db: DatabaseSync,
  quotationId: string,
  actorId: string,
  action: string,
  comment = "",
) {
  db.prepare(
    `INSERT INTO quotation_actions (quotation_id, actor_id, action, comment, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(quotationId, actorId, action, comment, new Date().toISOString());
}

function setQuotationStatus(
  db: DatabaseSync,
  quotationId: string,
  status: QuotationStatus,
) {
  db.prepare(
    "UPDATE quotations SET status = ?, updated_at = ? WHERE id = ?",
  ).run(status, new Date().toISOString(), quotationId);
}

/* ---------------------------------------------------------------- admin */

/** SUBMITTED to UNDER_ENGINEERING_REVIEW. */
export function startEngineeringReview(
  db: DatabaseSync,
  adminId: string,
  requestId: string,
) {
  return transaction(db, () => {
    if (requestStatus(db, requestId) === undefined) throw notFound("Request");
    const result = transitionRequest(
      db,
      requestId,
      "UNDER_ENGINEERING_REVIEW",
      adminId,
      "Engineering review started",
    );
    recordAudit(db, {
      actorId: adminId,
      action: "REQUEST_REVIEW_STARTED",
      entityType: "REQUEST",
      entityId: requestId,
    });
    return result;
  });
}

/** Rejects a request that has not been accepted yet; open quotes are closed. */
export function rejectRequest(
  db: DatabaseSync,
  adminId: string,
  requestId: string,
  reason: string,
) {
  return transaction(db, () => {
    if (requestStatus(db, requestId) === undefined) throw notFound("Request");
    const result = transitionRequest(
      db,
      requestId,
      "REJECTED",
      adminId,
      reason,
    );
    const open = db
      .prepare(
        "SELECT id FROM quotations WHERE request_id = ? AND status IN ('QUOTED', 'REVISION_REQUESTED')",
      )
      .all(requestId) as { id: string }[];
    for (const { id } of open) {
      setQuotationStatus(db, id, "SUPERSEDED");
      logAction(
        db,
        id,
        adminId,
        "SUPERSEDED",
        "Request rejected by engineering",
      );
    }
    recordAudit(db, {
      actorId: adminId,
      action: "REQUEST_REJECTED",
      entityType: "REQUEST",
      entityId: requestId,
      detail: reason,
    });
    return result;
  });
}

/**
 * Creates the next quotation version for a request and moves the request to
 * QUOTED. Totals are always computed here with lineTotal(); the client never
 * supplies them. Earlier QUOTED / REVISION_REQUESTED versions become SUPERSEDED.
 */
export function createQuotation(
  db: DatabaseSync,
  adminId: string,
  requestId: string,
  input: CreateQuotationData,
): Quotation {
  return transaction(db, () => {
    const request = db
      .prepare(
        "SELECT customer_id, status FROM manufacturing_requests WHERE id = ?",
      )
      .get(requestId) as
      { customer_id: string; status: ManufacturingStatus } | undefined;
    if (!request) throw notFound("Request");
    if (
      request.status !== "UNDER_ENGINEERING_REVIEW" &&
      request.status !== "REVISION_REQUESTED"
    )
      throw conflict(
        request.status === "SUBMITTED"
          ? "Start the engineering review before creating a quotation."
          : "A quotation can only be created while the request is under engineering review or has a revision requested.",
      );

    let subtotal = 0;
    let tax = 0;
    let lines: ReturnType<typeof lineTotal>[];
    try {
      lines = input.items.map((item) =>
        lineTotal(item.unitPrice, item.quantity, item.gstPercent),
      );
      for (const line of lines) {
        subtotal += line.subtotalPaise;
        tax += line.taxPaise;
      }
    } catch {
      throw new RepositoryError(
        "VALIDATION_ERROR",
        "A line total is too large. Reduce the quantity or unit price.",
        400,
      );
    }
    const total = subtotal + tax;
    if (
      !Number.isSafeInteger(total) ||
      total <= 0 ||
      total > MAX_QUOTE_TOTAL_PAISE
    )
      throw new RepositoryError(
        "VALIDATION_ERROR",
        "The quotation total must be between ₹1 and ₹10,000 crore.",
        400,
      );

    const version = latestVersion(db, requestId) + 1;
    const id = nextNumber(db, "QUOTE", "QT-IH-", 1000);
    const at = new Date().toISOString();

    const open = db
      .prepare(
        "SELECT id FROM quotations WHERE request_id = ? AND status IN ('QUOTED', 'REVISION_REQUESTED')",
      )
      .all(requestId) as { id: string }[];
    for (const { id: oldId } of open) {
      setQuotationStatus(db, oldId, "SUPERSEDED");
      logAction(
        db,
        oldId,
        adminId,
        "SUPERSEDED",
        `Replaced by ${id} (version ${version})`,
      );
    }

    db.prepare(
      `INSERT INTO quotations
        (id, request_id, customer_id, version, status, subtotal_paise, tax_paise, total_paise,
         advance_percent, lead_time_days, valid_until, terms, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'QUOTED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      requestId,
      request.customer_id,
      version,
      subtotal,
      tax,
      total,
      input.advancePercent,
      input.leadTimeDays,
      input.validUntil,
      input.terms,
      adminId,
      at,
      at,
    );
    const insertItem = db.prepare(
      `INSERT INTO quotation_items
        (quotation_id, description, quantity, unit_price_paise, gst_percent, tax_paise, total_paise)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    input.items.forEach((item, i) =>
      insertItem.run(
        id,
        item.description,
        item.quantity,
        item.unitPrice,
        item.gstPercent,
        lines[i].taxPaise,
        lines[i].totalPaise,
      ),
    );
    logAction(db, id, adminId, "CREATED", `Version ${version}`);
    transitionRequest(
      db,
      requestId,
      "QUOTED",
      adminId,
      `Quotation ${id} (version ${version}) issued`,
    );
    recordAudit(db, {
      actorId: adminId,
      action: "QUOTATION_CREATED",
      entityType: "QUOTATION",
      entityId: id,
      detail: `Request ${requestId}, version ${version}, total ${formatMoney(total)}`,
    });
    return getQuotation(db, id) as Quotation;
  });
}

/* ------------------------------------------------------------- queries */

export function getQuotation(db: DatabaseSync, id: string): Quotation | null {
  const row = db.prepare(`${QUOTATION_SELECT} WHERE q.id = ?`).get(id) as
    QuoteRow | undefined;
  return row ? loadQuotation(db, row) : null;
}

/** Quotation visible to its owning customer, or null (never reveals others'). */
export function getQuotationForCustomer(
  db: DatabaseSync,
  customerId: string,
  id: string,
) {
  const quote = getQuotation(db, id);
  return quote && quote.customerId === customerId ? quote : null;
}

export function listQuotationsForCustomer(
  db: DatabaseSync,
  customerId: string,
) {
  const rows = db
    .prepare(
      `${QUOTATION_SELECT} WHERE q.customer_id = ? ORDER BY q.created_at DESC, q.id DESC`,
    )
    .all(customerId) as QuoteRow[];
  return rows.map((r) => loadQuotation(db, r));
}

export function listQuotationsForRequest(db: DatabaseSync, requestId: string) {
  const rows = db
    .prepare(
      `${QUOTATION_SELECT} WHERE q.request_id = ? ORDER BY q.version DESC`,
    )
    .all(requestId) as QuoteRow[];
  return rows.map((r) => loadQuotation(db, r));
}

export function latestVersion(db: DatabaseSync, requestId: string) {
  return (
    db
      .prepare(
        "SELECT COALESCE(MAX(version), 0) AS v FROM quotations WHERE request_id = ?",
      )
      .get(requestId) as { v: number }
  ).v;
}

/** Why a customer cannot act on a quotation right now, or null if they can. */
export function actionBlockReason(
  db: DatabaseSync,
  quote: Quotation,
  at: Date = new Date(),
): string | null {
  if (quote.status === "SUPERSEDED")
    return "This quotation was superseded by a newer version.";
  if (quote.status !== "QUOTED")
    return `This quotation has already been actioned (${quote.status.replace("_", " ").toLowerCase()}).`;
  if (quote.version !== latestVersion(db, quote.requestId))
    return "This quotation is not the latest version.";
  if (isExpired(quote.validUntil, at))
    return "This quotation has expired. Ask us to issue a fresh one.";
  return null;
}

export type PaymentAttempt = {
  id: string;
  provider: string;
  providerReference: string;
  amountPaise: number;
  status: PaymentStatus;
  createdAt: string;
};

export function listAdvancePayments(
  db: DatabaseSync,
  quotationId: string,
): PaymentAttempt[] {
  const rows = db
    .prepare(
      `SELECT id, provider, provider_reference, amount_paise, status, created_at
       FROM payments WHERE quotation_id = ? ORDER BY created_at DESC, rowid DESC`,
    )
    .all(quotationId) as {
    id: string;
    provider: string;
    provider_reference: string;
    amount_paise: number;
    status: PaymentStatus;
    created_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    providerReference: r.provider_reference,
    amountPaise: r.amount_paise,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/** The customer's most recent revision comment on any version of a request. */
export function latestRevisionComment(db: DatabaseSync, requestId: string) {
  return (
    (db
      .prepare(
        `SELECT a.comment, a.created_at AS createdAt, q.version FROM quotation_actions a
         JOIN quotations q ON q.id = a.quotation_id
         WHERE q.request_id = ? AND a.action = 'REVISION_REQUESTED'
         ORDER BY a.id DESC LIMIT 1`,
      )
      .get(requestId) as
      { comment: string; createdAt: string; version: number } | undefined) ??
    null
  );
}

/* ------------------------------------------------------------ customer */

function ownedQuotation(db: DatabaseSync, customerId: string, id: string) {
  const quote = getQuotationForCustomer(db, customerId, id);
  if (!quote) throw notFound("Quotation");
  return quote;
}

function guardActionable(db: DatabaseSync, quote: Quotation, at?: Date) {
  const reason = actionBlockReason(db, quote, at);
  if (reason) throw conflict(reason);
}

export function acceptQuotation(
  db: DatabaseSync,
  customerId: string,
  id: string,
  at?: Date,
) {
  return transaction(db, () => {
    const quote = ownedQuotation(db, customerId, id);
    guardActionable(db, quote, at);
    transitionRequest(
      db,
      quote.requestId,
      "ACCEPTED",
      customerId,
      `Accepted ${id} (version ${quote.version})`,
    );
    setQuotationStatus(db, id, "ACCEPTED");
    logAction(db, id, customerId, "ACCEPTED");
    return getQuotation(db, id) as Quotation;
  });
}

export function requestQuotationRevision(
  db: DatabaseSync,
  customerId: string,
  id: string,
  comment: string,
  at?: Date,
) {
  return transaction(db, () => {
    const quote = ownedQuotation(db, customerId, id);
    guardActionable(db, quote, at);
    transitionRequest(
      db,
      quote.requestId,
      "REVISION_REQUESTED",
      customerId,
      comment,
    );
    setQuotationStatus(db, id, "REVISION_REQUESTED");
    logAction(db, id, customerId, "REVISION_REQUESTED", comment);
    return getQuotation(db, id) as Quotation;
  });
}

export function rejectQuotation(
  db: DatabaseSync,
  customerId: string,
  id: string,
  reason: string,
  at?: Date,
) {
  return transaction(db, () => {
    const quote = ownedQuotation(db, customerId, id);
    guardActionable(db, quote, at);
    transitionRequest(db, quote.requestId, "REJECTED", customerId, reason);
    setQuotationStatus(db, id, "REJECTED");
    logAction(db, id, customerId, "REJECTED", reason);
    return getQuotation(db, id) as Quotation;
  });
}

/** Checks that an advance can be paid now; returns the amount due. */
function advanceDue(db: DatabaseSync, customerId: string, id: string) {
  const quote = ownedQuotation(db, customerId, id);
  if (quote.status !== "ACCEPTED")
    throw conflict("The advance can only be paid on an accepted quotation.");
  const paid = db
    .prepare(
      "SELECT 1 FROM payments WHERE quotation_id = ? AND status = 'PAID'",
    )
    .get(id);
  if (paid)
    throw conflict("The advance for this quotation has already been paid.");
  const status = requestStatus(db, quote.requestId);
  if (status !== "ACCEPTED" && status !== "ADVANCE_PENDING")
    throw conflict("The advance can no longer be paid for this request.");
  const { advancePaise } = advanceAmounts(
    quote.totalPaise,
    quote.advancePercent,
  );
  if (advancePaise <= 0)
    throw conflict("There is no advance due on this quotation.");
  return { quote, advancePaise };
}

/**
 * Pays the advance through the payment gateway (test mode). The gateway call is
 * async, so the checks run once before it and again, with the write, inside one
 * transaction afterwards: two racing PAID results cannot both be recorded.
 * Every attempt is stored; only PAID moves the request to ADVANCE_PAID.
 */
export async function payAdvance(
  db: DatabaseSync,
  customerId: string,
  id: string,
  input: { method: PaymentMethod; testOutcome?: TestOutcome },
  gateway: PaymentGateway = getPaymentGateway(),
) {
  const { advancePaise } = advanceDue(db, customerId, id);
  const result = await gateway.pay({
    amountPaise: advancePaise,
    reference: id,
    method: input.method,
    testOutcome: input.testOutcome,
  });
  return transaction(db, () => {
    const { quote } = advanceDue(db, customerId, id);
    const paymentId = nextNumber(db, "ADVANCE_PAYMENT", "ADV-IH-", 1000);
    db.prepare(
      `INSERT INTO payments
        (id, customer_id, order_id, quotation_id, provider, provider_reference, amount_paise, status, created_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
    ).run(
      paymentId,
      customerId,
      id,
      result.provider,
      result.providerReference,
      advancePaise,
      result.status,
      new Date().toISOString(),
    );
    const current = requestStatus(db, quote.requestId);
    if (result.status === "PAID") {
      transitionRequest(
        db,
        quote.requestId,
        "ADVANCE_PAID",
        customerId,
        `Advance paid (${paymentId})`,
      );
    } else if (current === "ACCEPTED") {
      transitionRequest(
        db,
        quote.requestId,
        "ADVANCE_PENDING",
        customerId,
        `Advance payment ${result.status.toLowerCase()} (${paymentId})`,
      );
    }
    logAction(db, id, customerId, `ADVANCE_${result.status}`, paymentId);
    recordAudit(db, {
      actorId: customerId,
      action: `ADVANCE_PAYMENT_${result.status}`,
      entityType: "QUOTATION",
      entityId: id,
      detail: `${paymentId}, ${formatMoney(advancePaise)}, ${input.method}, ref ${result.providerReference}`,
    });
    return {
      paymentId,
      status: result.status,
      amountPaise: advancePaise,
      providerReference: result.providerReference,
      requestStatus: requestStatus(db, quote.requestId) as ManufacturingStatus,
    };
  });
}
