import type { DatabaseSync } from "node:sqlite";
import type { ManufacturingStatus } from "../../../shared/enums";
import { requestHistory } from "@/lib/drawings/store";

/**
 * Read-only views used by the request detail pages. Server-only.
 */
export const PARTNER_LABEL = "Verified manufacturing partner";

export type ProgressView = {
  jobStatus: string;
  progressPercent: number;
  courier: string;
  trackingNumber: string;
  updates: {
    id: number;
    status: string;
    remarks: string;
    at: string;
    progressPercent: number;
  }[];
} | null;

/**
 * Manufacturing progress for a request, read from `jobs` / `job_updates`.
 * The supplier's identity is deliberately not selected.
 */
export function manufacturingProgress(
  db: DatabaseSync,
  requestId: string,
): ProgressView {
  const job = db
    .prepare(
      `SELECT id, status, progress_percent, courier, tracking_number
       FROM jobs WHERE request_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`,
    )
    .get(requestId) as
    | {
        id: string;
        status: string;
        progress_percent: number;
        courier: string;
        tracking_number: string;
      }
    | undefined;
  if (!job) return null;
  const updates = db
    .prepare(
      `SELECT id, status, remarks, changed_at, progress_percent
       FROM job_updates WHERE job_id = ? ORDER BY id DESC LIMIT 8`,
    )
    .all(job.id) as {
    id: number;
    status: string;
    remarks: string;
    changed_at: string;
    progress_percent: number;
  }[];
  return {
    jobStatus: job.status,
    progressPercent: job.progress_percent,
    courier: job.courier,
    trackingNumber: job.tracking_number,
    updates: updates.map((u) => ({
      id: u.id,
      status: u.status,
      remarks: u.remarks,
      at: u.changed_at,
      progressPercent: u.progress_percent,
    })),
  };
}

/**
 * Request timeline for a customer: entries made by a supplier user are
 * attributed to the "Verified manufacturing partner" instead of a name.
 */
export function customerRequestHistory(db: DatabaseSync, requestId: string) {
  const supplierActors = new Set(
    (
      db
        .prepare(
          `SELECT DISTINCT u.first_name || ' ' || u.last_name AS name
           FROM request_status_history h JOIN users u ON u.id = h.changed_by
           WHERE h.request_id = ? AND u.role = 'SUPPLIER'`,
        )
        .all(requestId) as { name: string }[]
    ).map((r) => r.name),
  );
  return requestHistory(db, requestId).map((h) => ({
    id: h.id,
    status: h.to as ManufacturingStatus,
    at: h.changedAt,
    by: supplierActors.has(h.changedBy) ? PARTNER_LABEL : h.changedBy,
    comment: h.comment,
  }));
}

export type RequestCustomer = {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  gstin: string;
};

export function requestCustomer(db: DatabaseSync, customerId: string) {
  return (
    (db
      .prepare(
        `SELECT first_name AS firstName, last_name AS lastName, company_name AS companyName,
                email, gstin FROM users WHERE id = ?`,
      )
      .get(customerId) as RequestCustomer | undefined) ?? null
  );
}

/** Admin queue rows, filtered by status (undefined means the open-work default). */
export function listRequestsForAdmin(
  db: DatabaseSync,
  statuses: readonly string[] | null,
) {
  const where = statuses
    ? `WHERE r.status IN (${statuses.map(() => "?").join(", ")})`
    : "";
  return db
    .prepare(
      `SELECT r.id, r.part_name AS partName, r.quantity, r.material, r.status,
              r.submitted_at AS submittedAt, u.company_name AS companyName
       FROM manufacturing_requests r JOIN users u ON u.id = r.customer_id
       ${where} ORDER BY r.submitted_at DESC, r.id DESC`,
    )
    .all(...(statuses ?? [])) as {
    id: string;
    partName: string;
    quantity: number;
    material: string;
    status: ManufacturingStatus;
    submittedAt: string;
    companyName: string;
  }[];
}
