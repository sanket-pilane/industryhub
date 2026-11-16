// @vitest-environment node
import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createTestDb, SEED } from "../helpers/db";
import {
  AUDIT_PAGE_SIZE,
  auditEntityTypes,
  latestAudit,
  pageAudit,
} from "@/lib/admin/audit";
import { dashboardCounts } from "@/lib/admin/dashboard";
import { recordAudit } from "@/lib/audit";

const at = "2026-01-01T00:00:00.000Z";

function request(db: DatabaseSync, id: string, status: string) {
  db.prepare(
    `INSERT INTO manufacturing_requests
      (id, customer_id, part_name, quantity, material, tolerance, process, finish, target_date,
       notes, status, revision, file_name, file_size, file_extension, file_checksum, storage_key,
       submitted_at, updated_at)
     VALUES (?, ?, 'Part', 1, 'EN8 Steel', 't', 'p', 'f', '2026-12-01', '', ?, 1, 'a.pdf', 1, 'pdf', 'c', 'k', ?, ?)`,
  ).run(id, SEED.customer, status, at, at);
}

function job(db: DatabaseSync, id: string, requestId: string, status: string) {
  const quote = `Q-${id}`;
  db.prepare(
    `INSERT INTO quotations (id, request_id, customer_id, version, status, subtotal_paise, tax_paise,
       total_paise, lead_time_days, valid_until, created_by, created_at, updated_at)
     VALUES (?, ?, ?, 1, 'ACCEPTED', 1, 0, 1, 7, '2026-12-01', ?, ?, ?)`,
  ).run(quote, requestId, SEED.customer, SEED.admin, at, at);
  db.prepare(
    `INSERT INTO jobs (id, request_id, quotation_id, supplier_id, status, target_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '2026-12-01', ?, ?)`,
  ).run(id, requestId, quote, SEED.supplier, status, at, at);
}

function order(db: DatabaseSync, id: string, status: string, payment: string) {
  db.prepare(
    `INSERT INTO orders (id, customer_id, status, payment_status, subtotal_paise, total_paise,
       shipping_address, delivery_method, created_at, updated_at)
     VALUES (?, ?, ?, ?, 100, 118, 'addr', 'STANDARD', ?, ?)`,
  ).run(id, SEED.customer, status, payment, at, at);
}

function payment(db: DatabaseSync, id: string, amount: number, status: string) {
  db.prepare(
    `INSERT INTO payments (id, customer_id, provider, provider_reference, amount_paise, status, created_at)
     VALUES (?, ?, 'test', ?, ?, ?, ?)`,
  ).run(id, SEED.customer, id, amount, status, at);
}

describe("dashboard counts", () => {
  it("is all zeros on a fresh database except the seeded pending supplier", () => {
    expect(dashboardCounts(createTestDb())).toEqual({
      requestsAwaitingReview: 0,
      quotesAwaitingCustomer: 0,
      awaitingAssignment: 0,
      jobsInProduction: 0,
      qcAwaitingReview: 0,
      ordersToFulfil: 0,
      revenuePaise: 0,
      suppliersPending: 1,
    });
  });

  it("counts a seeded scenario", () => {
    const db = createTestDb();
    request(db, "R1", "SUBMITTED");
    request(db, "R2", "UNDER_ENGINEERING_REVIEW");
    request(db, "R3", "QUOTED");
    request(db, "R4", "QUOTED");
    request(db, "R5", "QUOTED");
    request(db, "R6", "ADVANCE_PAID");
    request(db, "R7", "ADVANCE_PAID");
    request(db, "R8", "IN_PRODUCTION");
    request(db, "R9", "QC_IN_PROGRESS");
    request(db, "R10", "DELIVERED");
    job(db, "J1", "R8", "IN_PRODUCTION");
    job(db, "J2", "R9", "QC_SUBMITTED");
    job(db, "J3", "R10", "DELIVERED");

    order(db, "O1", "CONFIRMED", "PAID");
    order(db, "O2", "PACKED", "PAID");
    order(db, "O3", "CONFIRMED", "PENDING");
    order(db, "O4", "DISPATCHED", "PAID");
    order(db, "O5", "CANCELLED", "PAID");

    payment(db, "P1", 5_000_00, "PAID");
    payment(db, "P2", 1_250_50, "PAID");
    payment(db, "P3", 9_999_00, "FAILED");
    payment(db, "P4", 777_00, "PENDING");

    expect(dashboardCounts(db)).toEqual({
      requestsAwaitingReview: 2,
      quotesAwaitingCustomer: 3,
      awaitingAssignment: 2,
      jobsInProduction: 1,
      qcAwaitingReview: 1,
      ordersToFulfil: 2,
      revenuePaise: 625_050,
      suppliersPending: 1,
    });

    db.prepare(
      "UPDATE suppliers SET verification_status = 'VERIFIED' WHERE id = ?",
    ).run(SEED.pendingSupplier);
    expect(dashboardCounts(db).suppliersPending).toBe(0);
  });
});

describe("audit queries", () => {
  it("returns the latest entries with actor names", () => {
    const db = createTestDb();
    for (let i = 1; i <= 12; i += 1)
      recordAudit(db, {
        actorId: SEED.admin,
        action: `ACT_${i}`,
        entityType: "JOB",
        entityId: `J${i}`,
      });
    recordAudit(db, {
      actorId: "SYSTEM",
      action: "SWEEP",
      entityType: "SUPPLIER",
      entityId: "S1",
    });
    const latest = latestAudit(db, 10);
    expect(latest).toHaveLength(10);
    expect(latest[0]).toMatchObject({ action: "SWEEP", actorName: "SYSTEM" });
    expect(latest[1]).toMatchObject({
      action: "ACT_12",
      actorName: "Meera Iyer",
    });
  });

  it("paginates 25 per page and filters by entity type", () => {
    const db = createTestDb();
    for (let i = 1; i <= 60; i += 1)
      recordAudit(db, {
        actorId: SEED.admin,
        action: "A",
        entityType: i % 3 === 0 ? "PRODUCT" : "JOB",
        entityId: String(i),
      });
    expect(AUDIT_PAGE_SIZE).toBe(25);
    const first = pageAudit(db, { page: 1 });
    expect(first).toMatchObject({ page: 1, pages: 3, total: 60 });
    expect(first.rows).toHaveLength(25);
    expect(first.rows[0].entityId).toBe("60");
    const last = pageAudit(db, { page: 3 });
    expect(last.rows).toHaveLength(10);
    expect(pageAudit(db, { page: 99 }).page).toBe(3);
    expect(pageAudit(db, { page: -4 }).page).toBe(1);

    const products = pageAudit(db, { entityType: "PRODUCT" });
    expect(products).toMatchObject({ total: 20, pages: 1 });
    expect(products.rows.every((r) => r.entityType === "PRODUCT")).toBe(true);
    expect(auditEntityTypes(db)).toEqual(["JOB", "PRODUCT"]);
  });

  it("handles an empty log", () => {
    expect(pageAudit(createTestDb())).toMatchObject({
      rows: [],
      page: 1,
      pages: 1,
      total: 0,
    });
  });
});
