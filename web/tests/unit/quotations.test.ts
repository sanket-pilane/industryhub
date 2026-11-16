// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db";
import { DrawingStore } from "@/lib/drawings/store";
import { TransitionError, transitionRequest } from "@/lib/manufacturing/status";
import { TestModeGateway, type PaymentGateway } from "@/lib/payments/gateway";
import {
  advanceAmounts,
  createQuotationSchema,
  isExpired,
  payAdvanceSchema,
  revisionSchema,
  rupeesToPaise,
  todayInIst,
  type CreateQuotationData,
} from "@/lib/quotations/rules";
import {
  acceptQuotation,
  actionBlockReason,
  createQuotation,
  getQuotation,
  latestRevisionComment,
  listAdvancePayments,
  listQuotationsForCustomer,
  payAdvance,
  rejectQuotation,
  rejectRequest,
  requestQuotationRevision,
  startEngineeringReview,
} from "@/lib/quotations/service";
import {
  manufacturingProgress,
  customerRequestHistory,
  PARTNER_LABEL,
} from "@/lib/quotations/request-view";
import { RepositoryError } from "@/lib/repositories/errors";
import { FileStorage } from "@/lib/storage/files";
import { SEED, addCustomer, createTestDb } from "../helpers/db";

const PDF = new TextEncoder().encode("%PDF-1.7\n%quotation test\n");

let root: string;
let db: Database;
let store: DrawingStore;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "industrihub-quotes-"));
  db = createTestDb();
  store = new DrawingStore(db, new FileStorage(root));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function newRequest(customerId: string = SEED.customer) {
  const request = await store.save({
    customerId,
    details: {
      partName: "Gear Housing",
      quantity: 25,
      material: "EN8 Steel",
      tolerance: "ISO 2768-m (medium)",
      process: "CNC milling",
      finish: "Zinc plated",
      targetDate: "2099-01-15",
      notes: "",
    },
    file: { name: "gear.pdf", extension: "pdf", bytes: PDF },
  });
  return request.id;
}

async function reviewedRequest(customerId: string = SEED.customer) {
  const id = await newRequest(customerId);
  startEngineeringReview(db, SEED.admin, id);
  return id;
}

const FUTURE = "2099-12-31";
function quoteInput(
  overrides: Partial<CreateQuotationData> = {},
): CreateQuotationData {
  return {
    items: [
      {
        description: "Gear housing",
        quantity: 25,
        unitPrice: 123_450,
        gstPercent: 18,
      },
    ],
    leadTimeDays: 21,
    validUntil: FUTURE,
    advancePercent: 50,
    terms: "50% advance",
    ...overrides,
  };
}

async function quotedRequest(customerId: string = SEED.customer) {
  const requestId = await reviewedRequest(customerId);
  const quote = createQuotation(db, SEED.admin, requestId, quoteInput());
  return { requestId, quote };
}

const statusOf = (requestId: string) =>
  (
    db
      .prepare("SELECT status FROM manufacturing_requests WHERE id = ?")
      .get(requestId) as { status: string }
  ).status;
const count = (table: string, where = "1=1") =>
  (
    db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE ${where}`).get() as {
      c: number;
    }
  ).c;

describe("rupees to paise conversion", () => {
  it("converts exactly with up to two decimals", () => {
    expect(rupeesToPaise("0")).toBe(0);
    expect(rupeesToPaise("1250")).toBe(125_000);
    expect(rupeesToPaise("1250.5")).toBe(125_050);
    expect(rupeesToPaise("19.99")).toBe(1999);
    expect(rupeesToPaise("0.07")).toBe(7);
    expect(rupeesToPaise("1,23,456.78")).toBe(12_345_678);
    expect(rupeesToPaise("₹ 99.10")).toBe(9910);
    expect(rupeesToPaise(1.15)).toBe(115);
    expect(rupeesToPaise(8.2)).toBe(820);
  });
  it("rejects negatives, extra decimals and non-numbers", () => {
    for (const bad of ["-1", "1.234", "", "abc", "1e3", "1..2", ".5", "NaN"])
      expect(rupeesToPaise(bad)).toBeNull();
  });
});

describe("advance amount rounding", () => {
  it("rounds half-up to the nearest paise and keeps total = advance + balance", () => {
    expect(advanceAmounts(100_000, 50)).toEqual({
      advancePaise: 50_000,
      balancePaise: 50_000,
    });
    // 1001 * 50 / 100 = 500.5 -> 501 (half up)
    expect(advanceAmounts(1001, 50)).toEqual({
      advancePaise: 501,
      balancePaise: 500,
    });
    // 333 * 10 / 100 = 33.3 -> 33
    expect(advanceAmounts(333, 10).advancePaise).toBe(33);
    // 335 * 10 / 100 = 33.5 -> 34
    expect(advanceAmounts(335, 10).advancePaise).toBe(34);
    expect(advanceAmounts(12_345, 100)).toEqual({
      advancePaise: 12_345,
      balancePaise: 0,
    });
  });
  it("stays exact for totals whose product exceeds 2^53", () => {
    const total = 1_000_000_000_000; // 1e12 paise
    expect(advanceAmounts(total, 99).advancePaise).toBe(990_000_000_000);
    const odd = 9_007_199_254_740_991; // Number.MAX_SAFE_INTEGER
    const { advancePaise, balancePaise } = advanceAmounts(odd, 55);
    expect(advancePaise + balancePaise).toBe(odd);
    expect(BigInt(advancePaise)).toBe(
      (BigInt(odd) * BigInt(55) + BigInt(50)) / BigInt(100),
    );
  });
  it("rejects invalid input", () => {
    expect(() => advanceAmounts(-1, 50)).toThrow(RangeError);
    expect(() => advanceAmounts(100, 101)).toThrow(RangeError);
  });
});

describe("quotation validation schema", () => {
  const base = {
    items: [
      {
        description: "Part",
        quantity: "5",
        unitPrice: "19.99",
        gstPercent: "18",
      },
    ],
    leadTimeDays: "30",
    validUntil: FUTURE,
    advancePercent: "50",
    terms: "",
  };
  it("parses rupee strings into paise", () => {
    const parsed = createQuotationSchema.parse(base);
    expect(parsed.items[0]).toMatchObject({
      quantity: 5,
      unitPrice: 1999,
      gstPercent: 18,
    });
  });
  it("enforces line, lead time, advance, GST and date limits", () => {
    const fails = (patch: object) =>
      expect(
        createQuotationSchema.safeParse({ ...base, ...patch }).success,
      ).toBe(false);
    fails({ items: [] });
    fails({ items: Array.from({ length: 21 }, () => base.items[0]) });
    fails({ items: [{ ...base.items[0], unitPrice: "1.999" }] });
    fails({ items: [{ ...base.items[0], gstPercent: "7" }] });
    fails({ items: [{ ...base.items[0], quantity: "0" }] });
    fails({ leadTimeDays: "0" });
    fails({ leadTimeDays: "366" });
    fails({ advancePercent: "9" });
    fails({ advancePercent: "101" });
    fails({ validUntil: "2000-01-01" });
    fails({ validUntil: todayInIst() });
    expect(
      createQuotationSchema.safeParse({
        ...base,
        items: Array.from({ length: 20 }, () => base.items[0]),
        leadTimeDays: 365,
        advancePercent: 10,
      }).success,
    ).toBe(true);
  });
  it("requires a revision comment and a pay method", () => {
    expect(revisionSchema.safeParse({ comment: "  " }).success).toBe(false);
    expect(payAdvanceSchema.safeParse({}).success).toBe(false);
    expect(payAdvanceSchema.parse({ method: "UPI" }).testOutcome).toBe(
      "success",
    );
  });
  it("works out expiry in IST", () => {
    // 2026-05-01 20:00 UTC is already 2 May in India.
    const at = new Date("2026-05-01T20:00:00Z");
    expect(todayInIst(at)).toBe("2026-05-02");
    expect(isExpired("2026-05-02", at)).toBe(false);
    expect(isExpired("2026-05-01", at)).toBe(true);
  });
});

describe("admin review and quotation creation", () => {
  it("computes totals on the server with lineTotal and issues QT-IH-01001", async () => {
    const requestId = await reviewedRequest();
    const quote = createQuotation(
      db,
      SEED.admin,
      requestId,
      quoteInput({
        items: [
          {
            description: "Machining",
            quantity: 3,
            unitPrice: 33_333,
            gstPercent: 18,
          },
          {
            description: "Plating",
            quantity: 1,
            unitPrice: 10_001,
            gstPercent: 5,
          },
        ],
      }),
    );
    // 99,999 * 18% = 17,999.82 -> 18,000 ; 10,001 * 5% = 500.05 -> 500
    expect(quote.id).toBe("QT-IH-01001");
    expect(quote.items.map((i) => i.taxPaise)).toEqual([18_000, 500]);
    expect(quote.subtotalPaise).toBe(110_000);
    expect(quote.taxPaise).toBe(18_500);
    expect(quote.totalPaise).toBe(128_500);
    expect(quote.version).toBe(1);
    expect(quote.status).toBe("QUOTED");
    expect(statusOf(requestId)).toBe("QUOTED");
    expect(count("quotation_actions", `quotation_id = '${quote.id}'`)).toBe(1);
    expect(count("audit_log", "action = 'QUOTATION_CREATED'")).toBe(1);
  });

  it("supersedes earlier versions and numbers the next one", async () => {
    const { requestId, quote: v1 } = await quotedRequest();
    requestQuotationRevision(
      db,
      SEED.customer,
      v1.id,
      "Please reduce lead time",
    );
    expect(statusOf(requestId)).toBe("REVISION_REQUESTED");
    const v2 = createQuotation(
      db,
      SEED.admin,
      requestId,
      quoteInput({ leadTimeDays: 14 }),
    );
    expect(v2.version).toBe(2);
    expect(v2.id).toBe("QT-IH-01002");
    expect(getQuotation(db, v1.id)?.status).toBe("SUPERSEDED");
    expect(getQuotation(db, v2.id)?.status).toBe("QUOTED");
    expect(statusOf(requestId)).toBe("QUOTED");
    expect(latestRevisionComment(db, requestId)?.comment).toBe(
      "Please reduce lead time",
    );
    expect(
      count(
        "quotation_actions",
        `quotation_id = '${v1.id}' AND action = 'SUPERSEDED'`,
      ),
    ).toBe(1);
  });

  it("refuses to quote a request in the wrong state (409)", async () => {
    const submitted = await newRequest();
    expect(() =>
      createQuotation(db, SEED.admin, submitted, quoteInput()),
    ).toThrowError(expect.objectContaining({ status: 409 }));
    const { requestId, quote } = await quotedRequest();
    // already QUOTED: another quote must wait for a revision request
    expect(() =>
      createQuotation(db, SEED.admin, requestId, quoteInput()),
    ).toThrow(RepositoryError);
    acceptQuotation(db, SEED.customer, quote.id);
    expect(() =>
      createQuotation(db, SEED.admin, requestId, quoteInput()),
    ).toThrowError(expect.objectContaining({ status: 409 }));
    expect(count("quotations", `request_id = '${requestId}'`)).toBe(1);
    expect(() =>
      createQuotation(db, SEED.admin, "RFQ-IH-99999", quoteInput()),
    ).toThrowError(expect.objectContaining({ status: 404 }));
  });

  it("starts review once and records history and audit", async () => {
    const id = await newRequest();
    startEngineeringReview(db, SEED.admin, id);
    expect(statusOf(id)).toBe("UNDER_ENGINEERING_REVIEW");
    expect(() => startEngineeringReview(db, SEED.admin, id)).toThrow(
      TransitionError,
    );
    expect(count("audit_log", "action = 'REQUEST_REVIEW_STARTED'")).toBe(1);
  });

  it("rejects a request with a reason and closes open quotes", async () => {
    const { requestId, quote } = await quotedRequest();
    requestQuotationRevision(
      db,
      SEED.customer,
      quote.id,
      "Need cheaper option",
    );
    rejectRequest(db, SEED.admin, requestId, "Cannot machine this alloy");
    expect(statusOf(requestId)).toBe("REJECTED");
    expect(getQuotation(db, quote.id)?.status).toBe("SUPERSEDED");
    const history = customerRequestHistory(db, requestId);
    expect(history.at(-1)).toMatchObject({
      status: "REJECTED",
      comment: "Cannot machine this alloy",
    });
    expect(count("audit_log", "action = 'REQUEST_REJECTED'")).toBe(1);
  });
});

describe("customer decisions", () => {
  it("accepts: quotation and request become ACCEPTED", async () => {
    const { requestId, quote } = await quotedRequest();
    const result = acceptQuotation(db, SEED.customer, quote.id);
    expect(result.status).toBe("ACCEPTED");
    expect(statusOf(requestId)).toBe("ACCEPTED");
    expect(
      count(
        "quotation_actions",
        `quotation_id = '${quote.id}' AND action = 'ACCEPTED'`,
      ),
    ).toBe(1);
    expect(() => acceptQuotation(db, SEED.customer, quote.id)).toThrowError(
      expect.objectContaining({ status: 409 }),
    );
  });

  it("requests a revision with a comment: both statuses move", async () => {
    const { requestId, quote } = await quotedRequest();
    const result = requestQuotationRevision(
      db,
      SEED.customer,
      quote.id,
      "Lower unit price?",
    );
    expect(result.status).toBe("REVISION_REQUESTED");
    expect(statusOf(requestId)).toBe("REVISION_REQUESTED");
    expect(customerRequestHistory(db, requestId).at(-1)).toMatchObject({
      status: "REVISION_REQUESTED",
      comment: "Lower unit price?",
    });
  });

  it("rejects with a reason: both statuses move", async () => {
    const { requestId, quote } = await quotedRequest();
    const result = rejectQuotation(db, SEED.customer, quote.id, "Over budget");
    expect(result.status).toBe("REJECTED");
    expect(statusOf(requestId)).toBe("REJECTED");
    expect(() =>
      requestQuotationRevision(db, SEED.customer, quote.id, "second thoughts"),
    ).toThrowError(expect.objectContaining({ status: 409 }));
  });

  it("hides another customer's quotation as not found and changes nothing", async () => {
    const { requestId, quote } = await quotedRequest();
    const other = addCustomer(db, "other@test.in");
    for (const act of [
      () => acceptQuotation(db, other, quote.id),
      () => requestQuotationRevision(db, other, quote.id, "not mine"),
      () => rejectQuotation(db, other, quote.id, "not mine"),
    ])
      expect(act).toThrowError(expect.objectContaining({ status: 404 }));
    expect(listQuotationsForCustomer(db, other)).toEqual([]);
    expect(getQuotation(db, quote.id)?.status).toBe("QUOTED");
    expect(statusOf(requestId)).toBe("QUOTED");
  });

  it("refuses an expired quotation (409) and explains why", async () => {
    const requestId = await reviewedRequest();
    const quote = createQuotation(
      db,
      SEED.admin,
      requestId,
      quoteInput({ validUntil: "2030-06-15" }),
    );
    const lastDay = new Date("2030-06-15T10:00:00Z");
    const nextDay = new Date("2030-06-15T19:00:00Z"); // 16 June in IST
    expect(actionBlockReason(db, quote, lastDay)).toBeNull();
    expect(actionBlockReason(db, quote, nextDay)).toMatch(/expired/i);
    expect(() =>
      acceptQuotation(db, SEED.customer, quote.id, nextDay),
    ).toThrowError(
      expect.objectContaining({
        status: 409,
        message: expect.stringMatching(/expired/i),
      }),
    );
    expect(() =>
      rejectQuotation(db, SEED.customer, quote.id, "too late", nextDay),
    ).toThrow(RepositoryError);
    expect(statusOf(requestId)).toBe("QUOTED");
    expect(acceptQuotation(db, SEED.customer, quote.id, lastDay).status).toBe(
      "ACCEPTED",
    );
  });

  it("refuses a superseded quotation (409)", async () => {
    const { requestId, quote: v1 } = await quotedRequest();
    requestQuotationRevision(db, SEED.customer, v1.id, "Revise please");
    createQuotation(db, SEED.admin, requestId, quoteInput());
    expect(() => acceptQuotation(db, SEED.customer, v1.id)).toThrowError(
      expect.objectContaining({
        status: 409,
        message: expect.stringMatching(/superseded/i),
      }),
    );
    expect(statusOf(requestId)).toBe("QUOTED");
  });

  it("refuses a QUOTED version that is no longer the latest", async () => {
    const { requestId, quote: v1 } = await quotedRequest();
    // Force an inconsistent older QUOTED row to prove the latest-version rule.
    db.prepare("UPDATE quotations SET status = 'QUOTED' WHERE id = ?").run(
      v1.id,
    );
    requestQuotationRevision(db, SEED.customer, v1.id, "again");
    const v2 = createQuotation(db, SEED.admin, requestId, quoteInput());
    db.prepare("UPDATE quotations SET status = 'QUOTED' WHERE id = ?").run(
      v1.id,
    );
    expect(() => acceptQuotation(db, SEED.customer, v1.id)).toThrowError(
      expect.objectContaining({
        status: 409,
        message: expect.stringMatching(/latest/i),
      }),
    );
    expect(getQuotation(db, v2.id)?.status).toBe("QUOTED");
  });
});

describe("advance payment", () => {
  const accepted = async () => {
    const ctx = await quotedRequest();
    acceptQuotation(db, SEED.customer, ctx.quote.id);
    return ctx;
  };

  it("pays the advance: PAID row, request ADVANCE_PAID, audited", async () => {
    const { requestId, quote } = await accepted();
    const expected = advanceAmounts(
      quote.totalPaise,
      quote.advancePercent,
    ).advancePaise;
    const result = await payAdvance(db, SEED.customer, quote.id, {
      method: "UPI",
    });
    expect(result).toMatchObject({
      status: "PAID",
      amountPaise: expected,
      requestStatus: "ADVANCE_PAID",
    });
    expect(statusOf(requestId)).toBe("ADVANCE_PAID");
    const [payment] = listAdvancePayments(db, quote.id);
    expect(payment).toMatchObject({
      status: "PAID",
      amountPaise: expected,
      provider: "test-mode",
    });
    expect(
      db
        .prepare("SELECT quotation_id, customer_id, order_id FROM payments")
        .get() as Record<string, unknown>,
    ).toEqual({
      quotation_id: quote.id,
      customer_id: SEED.customer,
      order_id: null,
    });
    expect(count("audit_log", "action = 'ADVANCE_PAYMENT_PAID'")).toBe(1);
  });

  it("records a failed attempt, moves to ADVANCE_PENDING, then allows a retry", async () => {
    const { requestId, quote } = await accepted();
    const failed = await payAdvance(db, SEED.customer, quote.id, {
      method: "CARD",
      testOutcome: "failed",
    });
    expect(failed.status).toBe("FAILED");
    expect(statusOf(requestId)).toBe("ADVANCE_PENDING");
    const cancelled = await payAdvance(db, SEED.customer, quote.id, {
      method: "CARD",
      testOutcome: "cancelled",
    });
    expect(cancelled.status).toBe("CANCELLED");
    const pending = await payAdvance(db, SEED.customer, quote.id, {
      method: "NETBANKING",
      testOutcome: "pending",
    });
    expect(pending.status).toBe("PENDING");
    expect(statusOf(requestId)).toBe("ADVANCE_PENDING");
    const paid = await payAdvance(db, SEED.customer, quote.id, {
      method: "UPI",
    });
    expect(paid.requestStatus).toBe("ADVANCE_PAID");
    expect(
      listAdvancePayments(db, quote.id)
        .map((p) => p.status)
        .sort(),
    ).toEqual(["CANCELLED", "FAILED", "PAID", "PENDING"]);
  });

  it("refuses a second payment once PAID (409)", async () => {
    const { quote } = await accepted();
    await payAdvance(db, SEED.customer, quote.id, { method: "UPI" });
    await expect(
      payAdvance(db, SEED.customer, quote.id, { method: "UPI" }),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/already been paid/),
    });
    expect(count("payments", `quotation_id = '${quote.id}'`)).toBe(1);
  });

  it("does not record two PAID results when two payments race", async () => {
    const { quote } = await accepted();
    const results = await Promise.allSettled([
      payAdvance(db, SEED.customer, quote.id, { method: "UPI" }),
      payAdvance(db, SEED.customer, quote.id, { method: "CARD" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      count("payments", `quotation_id = '${quote.id}' AND status = 'PAID'`),
    ).toBe(1);
  });

  it("is not available before acceptance or to other customers", async () => {
    const { quote } = await quotedRequest();
    await expect(
      payAdvance(db, SEED.customer, quote.id, { method: "UPI" }),
    ).rejects.toMatchObject({ status: 409 });
    acceptQuotation(db, SEED.customer, quote.id);
    const other = addCustomer(db, "other@test.in");
    await expect(
      payAdvance(db, other, quote.id, { method: "UPI" }),
    ).rejects.toMatchObject({ status: 404 });
    expect(count("payments")).toBe(0);
  });

  it("charges the rounded advance amount to the gateway", async () => {
    const requestId = await reviewedRequest();
    const quote = createQuotation(
      db,
      SEED.admin,
      requestId,
      quoteInput({
        items: [
          { description: "Odd", quantity: 1, unitPrice: 1000, gstPercent: 18 },
        ],
        advancePercent: 33,
      }),
    );
    expect(quote.totalPaise).toBe(1180);
    acceptQuotation(db, SEED.customer, quote.id);
    const seen: number[] = [];
    const gateway: PaymentGateway = {
      name: "spy",
      pay: (request) => {
        seen.push(request.amountPaise);
        return new TestModeGateway().pay(request);
      },
    };
    await payAdvance(db, SEED.customer, quote.id, { method: "UPI" }, gateway);
    // 1180 * 33% = 389.4 -> 389
    expect(seen).toEqual([389]);
  });
});

describe("customer request progress view", () => {
  it("has no progress until a job exists, then hides the supplier", async () => {
    const { requestId, quote } = await quotedRequest();
    expect(manufacturingProgress(db, requestId)).toBeNull();
    acceptQuotation(db, SEED.customer, quote.id);
    await payAdvance(db, SEED.customer, quote.id, { method: "UPI" });
    db.prepare(
      `INSERT INTO jobs (id, request_id, quotation_id, supplier_id, status, progress_percent, target_date, courier, tracking_number, created_at, updated_at)
       VALUES ('JOB-T1', ?, ?, ?, 'DISPATCHED', 90, '2099-01-01', 'BlueDart', 'BD123', 'x', 'x')`,
    ).run(requestId, quote.id, SEED.supplier);
    db.prepare(
      `INSERT INTO job_updates (job_id, status, progress_percent, remarks, changed_by, changed_at)
       VALUES ('JOB-T1', 'DISPATCHED', 90, 'Packed and shipped', ?, '2026-01-02T00:00:00Z')`,
    ).run(SEED.supplierUser);
    transitionRequest(
      db,
      requestId,
      "SUPPLIER_ASSIGNMENT",
      SEED.admin,
      "assigned",
    );
    transitionRequest(
      db,
      requestId,
      "IN_PRODUCTION",
      SEED.supplierUser,
      "started",
    );
    const progress = manufacturingProgress(db, requestId);
    expect(progress).toMatchObject({
      progressPercent: 90,
      courier: "BlueDart",
      trackingNumber: "BD123",
    });
    expect(progress?.updates[0].remarks).toBe("Packed and shipped");
    expect(JSON.stringify(progress)).not.toMatch(/Precision|SUP-0001|Rohan/);
    const history = customerRequestHistory(db, requestId);
    expect(history.at(-1)?.by).toBe(PARTNER_LABEL);
    expect(JSON.stringify(history)).not.toMatch(/Rohan/);
  });
});
