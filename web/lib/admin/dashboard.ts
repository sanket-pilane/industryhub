import type { DatabaseSync } from "node:sqlite";

export type DashboardCounts = {
  requestsAwaitingReview: number;
  quotesAwaitingCustomer: number;
  awaitingAssignment: number;
  jobsInProduction: number;
  qcAwaitingReview: number;
  ordersToFulfil: number;
  revenuePaise: number;
  suppliersPending: number;
};

function count(db: DatabaseSync, sql: string) {
  return (db.prepare(sql).get() as { n: number }).n;
}

/** KPI figures for the admin dashboard, read straight from the tables. */
export function dashboardCounts(db: DatabaseSync): DashboardCounts {
  return {
    requestsAwaitingReview: count(
      db,
      "SELECT COUNT(*) AS n FROM manufacturing_requests WHERE status IN ('SUBMITTED', 'UNDER_ENGINEERING_REVIEW')",
    ),
    quotesAwaitingCustomer: count(
      db,
      "SELECT COUNT(*) AS n FROM manufacturing_requests WHERE status = 'QUOTED'",
    ),
    awaitingAssignment: count(
      db,
      "SELECT COUNT(*) AS n FROM manufacturing_requests WHERE status = 'ADVANCE_PAID'",
    ),
    jobsInProduction: count(
      db,
      "SELECT COUNT(*) AS n FROM jobs WHERE status = 'IN_PRODUCTION'",
    ),
    qcAwaitingReview: count(
      db,
      "SELECT COUNT(*) AS n FROM jobs WHERE status = 'QC_SUBMITTED'",
    ),
    ordersToFulfil: count(
      db,
      "SELECT COUNT(*) AS n FROM orders WHERE status IN ('CONFIRMED', 'PACKED') AND payment_status = 'PAID'",
    ),
    revenuePaise: count(
      db,
      "SELECT COALESCE(SUM(amount_paise), 0) AS n FROM payments WHERE status = 'PAID'",
    ),
    suppliersPending: count(
      db,
      "SELECT COUNT(*) AS n FROM suppliers WHERE verification_status = 'PENDING'",
    ),
  };
}
