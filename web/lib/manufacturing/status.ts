import type { DatabaseSync } from "node:sqlite";
import type { JobStatus, ManufacturingStatus } from "../../../shared/enums";

/**
 * Server-side state machines for manufacturing requests and supplier jobs.
 * Every change goes through transitionRequest / transitionJob, which check the
 * allowed previous state and append a history row.
 */
export const REQUEST_TRANSITIONS: Record<
  ManufacturingStatus,
  ManufacturingStatus[]
> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["UNDER_ENGINEERING_REVIEW", "REJECTED", "CANCELLED", "ON_HOLD"],
  UNDER_ENGINEERING_REVIEW: ["QUOTED", "REJECTED", "ON_HOLD", "CANCELLED"],
  QUOTED: ["ACCEPTED", "REVISION_REQUESTED", "REJECTED", "CANCELLED"],
  REVISION_REQUESTED: ["QUOTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["ADVANCE_PENDING", "ADVANCE_PAID", "CANCELLED"],
  ADVANCE_PENDING: ["ADVANCE_PAID", "CANCELLED"],
  ADVANCE_PAID: ["SUPPLIER_ASSIGNMENT"],
  SUPPLIER_ASSIGNMENT: ["IN_PRODUCTION", "ON_HOLD"],
  IN_PRODUCTION: ["QC_IN_PROGRESS", "ON_HOLD"],
  QC_IN_PROGRESS: ["QC_APPROVED", "QC_REJECTED"],
  QC_REJECTED: ["QC_IN_PROGRESS", "IN_PRODUCTION"],
  QC_APPROVED: ["READY_TO_DISPATCH", "DISPATCHED"],
  READY_TO_DISPATCH: ["DISPATCHED"],
  DISPATCHED: ["DELIVERED"],
  DELIVERED: [],
  ON_HOLD: [
    "UNDER_ENGINEERING_REVIEW",
    "SUPPLIER_ASSIGNMENT",
    "IN_PRODUCTION",
    "CANCELLED",
  ],
  REJECTED: [],
  CANCELLED: [],
};

export const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  ASSIGNED: ["IN_PRODUCTION"],
  IN_PRODUCTION: ["QC_SUBMITTED"],
  QC_SUBMITTED: ["QC_APPROVED", "QC_REJECTED"],
  QC_REJECTED: ["QC_SUBMITTED"],
  QC_APPROVED: ["DISPATCHED"],
  DISPATCHED: ["DELIVERED"],
  DELIVERED: [],
};

export const REQUEST_STATUS_LABELS: Record<ManufacturingStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_ENGINEERING_REVIEW: "Engineering review",
  QUOTED: "Quoted",
  ACCEPTED: "Quote accepted",
  ADVANCE_PENDING: "Advance pending",
  ADVANCE_PAID: "Advance paid",
  SUPPLIER_ASSIGNMENT: "Supplier assigned",
  IN_PRODUCTION: "In production",
  QC_IN_PROGRESS: "Quality check",
  QC_APPROVED: "QC approved",
  READY_TO_DISPATCH: "Ready to dispatch",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  REVISION_REQUESTED: "Revision requested",
  ON_HOLD: "On hold",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  QC_REJECTED: "QC rejected",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  ASSIGNED: "Assigned",
  IN_PRODUCTION: "In production",
  QC_SUBMITTED: "QC submitted",
  QC_APPROVED: "QC approved",
  QC_REJECTED: "QC rejected",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
};

export class TransitionError extends Error {
  readonly code = "INVALID_TRANSITION";
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

export function canTransitionRequest(
  from: ManufacturingStatus,
  to: ManufacturingStatus,
) {
  return REQUEST_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionJob(from: JobStatus, to: JobStatus) {
  return JOB_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Moves a request to `to`, recording who did it. Call inside a transaction. */
export function transitionRequest(
  db: DatabaseSync,
  requestId: string,
  to: ManufacturingStatus,
  actorId: string,
  comment = "",
) {
  const row = db
    .prepare("SELECT status FROM manufacturing_requests WHERE id = ?")
    .get(requestId) as { status: ManufacturingStatus } | undefined;
  if (!row) throw new TransitionError(`Request ${requestId} not found.`);
  if (!canTransitionRequest(row.status, to))
    throw new TransitionError(
      `A request that is ${REQUEST_STATUS_LABELS[row.status]} cannot move to ${REQUEST_STATUS_LABELS[to]}.`,
    );
  const at = new Date().toISOString();
  db.prepare(
    "UPDATE manufacturing_requests SET status = ?, updated_at = ? WHERE id = ?",
  ).run(to, at, requestId);
  db.prepare(
    `INSERT INTO request_status_history (request_id, from_status, to_status, changed_by, comment, changed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(requestId, row.status, to, actorId, comment, at);
  return { from: row.status, to };
}

/** Moves a job to `to`, recording progress and remarks. Call inside a transaction. */
export function transitionJob(
  db: DatabaseSync,
  jobId: string,
  to: JobStatus,
  actorId: string,
  options: { progressPercent?: number; remarks?: string } = {},
) {
  const row = db
    .prepare("SELECT status, progress_percent FROM jobs WHERE id = ?")
    .get(jobId) as { status: JobStatus; progress_percent: number } | undefined;
  if (!row) throw new TransitionError(`Job ${jobId} not found.`);
  if (!canTransitionJob(row.status, to))
    throw new TransitionError(
      `A job that is ${JOB_STATUS_LABELS[row.status]} cannot move to ${JOB_STATUS_LABELS[to]}.`,
    );
  const progress = options.progressPercent ?? row.progress_percent;
  const at = new Date().toISOString();
  db.prepare(
    "UPDATE jobs SET status = ?, progress_percent = ?, updated_at = ? WHERE id = ?",
  ).run(to, progress, at, jobId);
  db.prepare(
    `INSERT INTO job_updates (job_id, status, progress_percent, remarks, changed_by, changed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(jobId, to, progress, options.remarks ?? "", actorId, at);
  return { from: row.status, to };
}
