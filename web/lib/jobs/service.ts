import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { UserProfile } from "../../../shared/contracts";
import type { JobStatus } from "../../../shared/enums";
import { nextNumber, now, transaction } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { transitionJob, transitionRequest } from "@/lib/manufacturing/status";
import { RepositoryError, notFound } from "@/lib/repositories/errors";
import { FileStorage } from "@/lib/storage/files";
import { checkQcFile } from "./qc-files";

/**
 * Supplier job workflow: assignment, production, QC and dispatch. Every status
 * change goes through transitionJob / transitionRequest inside a transaction.
 */
export const MAX_REMARKS_LENGTH = 1000;
export const MAX_COMMENT_LENGTH = 1000;

type OwnedJob = {
  id: string;
  request_id: string;
  supplier_id: string;
  status: JobStatus;
  progress_percent: number;
};

function invalidState(message: string) {
  return new RepositoryError("INVALID_STATE", message, 409);
}

function validation(message: string) {
  return new RepositoryError("VALIDATION_ERROR", message, 400);
}

function requiredText(value: string, label: string, max: number) {
  const text = value.trim();
  if (!text) throw validation(`${label} is required.`);
  if (text.length > max)
    throw validation(`${label} must be under ${max} characters.`);
  return text;
}

/** The job, only if it belongs to the supplier account; otherwise "not found". */
function ownedJob(
  db: DatabaseSync,
  supplierUserId: string,
  jobId: string,
): OwnedJob {
  const row = db
    .prepare(
      `SELECT j.id, j.request_id, j.supplier_id, j.status, j.progress_percent
       FROM jobs j JOIN suppliers s ON s.id = j.supplier_id
       WHERE j.id = ? AND s.user_id = ?`,
    )
    .get(jobId, supplierUserId) as OwnedJob | undefined;
  if (!row) throw notFound("Job");
  return row;
}

function existingJob(db: DatabaseSync, jobId: string): OwnedJob {
  const row = db
    .prepare(
      "SELECT id, request_id, supplier_id, status, progress_percent FROM jobs WHERE id = ?",
    )
    .get(jobId) as OwnedJob | undefined;
  if (!row) throw notFound("Job");
  return row;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------- assign */

export type AssignInput = {
  requestId: string;
  supplierId: string;
  targetDate: string;
};

/** Admin assigns a verified supplier to a request whose advance is paid. */
export function assignSupplier(
  db: DatabaseSync,
  adminId: string,
  input: AssignInput,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate) ||
    Number.isNaN(Date.parse(input.targetDate))
  )
    throw validation("Choose a valid target date.");
  if (input.targetDate < todayIso())
    throw validation("The target date cannot be in the past.");
  return transaction(db, () => {
    const request = db
      .prepare("SELECT id, status FROM manufacturing_requests WHERE id = ?")
      .get(input.requestId) as { id: string; status: string } | undefined;
    if (!request) throw notFound("Request");
    const supplier = db
      .prepare("SELECT id, verification_status FROM suppliers WHERE id = ?")
      .get(input.supplierId) as
      { id: string; verification_status: string } | undefined;
    if (!supplier) throw notFound("Supplier");

    const active = db
      .prepare("SELECT id FROM jobs WHERE request_id = ? LIMIT 1")
      .get(input.requestId) as { id: string } | undefined;
    if (active)
      throw new RepositoryError(
        "JOB_EXISTS",
        `This request already has job ${active.id}.`,
        409,
      );
    if (request.status !== "ADVANCE_PAID")
      throw invalidState(
        "Only requests with the advance paid can be assigned to a supplier.",
      );
    if (supplier.verification_status !== "VERIFIED")
      throw new RepositoryError(
        "SUPPLIER_NOT_VERIFIED",
        "Only verified suppliers can be assigned jobs.",
        409,
      );
    const quotation = db
      .prepare(
        "SELECT id FROM quotations WHERE request_id = ? AND status = 'ACCEPTED' ORDER BY version DESC LIMIT 1",
      )
      .get(input.requestId) as { id: string } | undefined;
    if (!quotation)
      throw invalidState(
        "This request has no accepted quotation to build against.",
      );

    const id = nextNumber(db, "JOB", "JOB-IH-", 1000);
    const at = now();
    db.prepare(
      `INSERT INTO jobs (id, request_id, quotation_id, supplier_id, status, progress_percent,
                         target_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ASSIGNED', 0, ?, ?, ?)`,
    ).run(
      id,
      input.requestId,
      quotation.id,
      input.supplierId,
      input.targetDate,
      at,
      at,
    );
    db.prepare(
      `INSERT INTO job_updates (job_id, status, progress_percent, remarks, changed_by, changed_at)
       VALUES (?, 'ASSIGNED', 0, 'Job assigned to supplier', ?, ?)`,
    ).run(id, adminId, at);
    transitionRequest(
      db,
      input.requestId,
      "SUPPLIER_ASSIGNMENT",
      adminId,
      `Production job ${id} assigned to a verified manufacturing partner`,
    );
    recordAudit(db, {
      actorId: adminId,
      action: "JOB_ASSIGNED",
      entityType: "JOB",
      entityId: id,
      detail: `Request ${input.requestId} assigned to ${input.supplierId}, target ${input.targetDate}`,
    });
    return { id };
  });
}

/* ------------------------------------------------------------ production */

export function startProduction(
  db: DatabaseSync,
  supplierUserId: string,
  jobId: string,
) {
  return transaction(db, () => {
    const job = ownedJob(db, supplierUserId, jobId);
    transitionJob(db, job.id, "IN_PRODUCTION", supplierUserId, {
      remarks: "Production started",
    });
    transitionRequest(
      db,
      job.request_id,
      "IN_PRODUCTION",
      supplierUserId,
      "Production started",
    );
    recordAudit(db, {
      actorId: supplierUserId,
      action: "JOB_STARTED",
      entityType: "JOB",
      entityId: job.id,
      detail: "Production started",
    });
  });
}

/**
 * Progress update while the job is in production. This is not a status
 * change, so it writes the job_updates row directly instead of using
 * transitionJob. Progress is 0 to 99 and never decreases.
 */
export function recordProgress(
  db: DatabaseSync,
  supplierUserId: string,
  jobId: string,
  input: { percent: number; remarks: string },
) {
  if (
    !Number.isInteger(input.percent) ||
    input.percent < 0 ||
    input.percent > 99
  )
    throw validation("Progress must be a whole number from 0 to 99.");
  const remarks = requiredText(input.remarks, "Remarks", MAX_REMARKS_LENGTH);
  return transaction(db, () => {
    const job = ownedJob(db, supplierUserId, jobId);
    if (job.status !== "IN_PRODUCTION")
      throw invalidState(
        "Progress can only be updated while the job is in production.",
      );
    if (input.percent < job.progress_percent)
      throw validation(
        `Progress cannot go down. It is already ${job.progress_percent}%.`,
      );
    const at = now();
    db.prepare(
      "UPDATE jobs SET progress_percent = ?, updated_at = ? WHERE id = ?",
    ).run(input.percent, at, job.id);
    db.prepare(
      `INSERT INTO job_updates (job_id, status, progress_percent, remarks, changed_by, changed_at)
       VALUES (?, 'IN_PRODUCTION', ?, ?, ?, ?)`,
    ).run(job.id, input.percent, remarks, supplierUserId, at);
    recordAudit(db, {
      actorId: supplierUserId,
      action: "JOB_PROGRESS",
      entityType: "JOB",
      entityId: job.id,
      detail: `Progress ${input.percent}%`,
    });
    return { progressPercent: input.percent };
  });
}

/* -------------------------------------------------------------------- QC */

export type QcUploadInput = {
  fileName: string;
  bytes: Uint8Array;
  remarks: string;
};

function safeFileName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f]/g, "").trim();
  return clean.slice(-200) || "qc-document";
}

/**
 * Stores a QC document and submits the job for review. The file is written
 * first and removed again if the database write fails.
 */
export async function submitQcDocument(
  db: DatabaseSync,
  supplierUserId: string,
  jobId: string,
  input: QcUploadInput,
  files: FileStorage = new FileStorage(),
) {
  const remarks = requiredText(input.remarks, "Remarks", MAX_REMARKS_LENGTH);
  const fileName = safeFileName(input.fileName);
  const check = checkQcFile({
    name: fileName,
    size: input.bytes.byteLength,
    head: input.bytes.subarray(0, 1024),
  });
  if (!check.ok)
    throw new RepositoryError(
      check.code,
      check.message,
      check.code === "TOO_LARGE" ? 413 : 400,
    );
  const job = ownedJob(db, supplierUserId, jobId);
  if (job.status !== "IN_PRODUCTION" && job.status !== "QC_REJECTED")
    throw invalidState(
      "QC documents can be uploaded while the job is in production or after a QC rejection.",
    );

  const storageKey = `qc/${randomUUID()}.${check.extension}`;
  await files.write(storageKey, input.bytes);
  try {
    return transaction(db, () => {
      const id = nextNumber(db, "QC", "QC-IH-", 1000);
      const at = now();
      db.prepare(
        `INSERT INTO qc_documents (id, job_id, supplier_id, file_name, file_size, file_extension,
                                   storage_key, remarks, review_status, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      ).run(
        id,
        job.id,
        job.supplier_id,
        fileName,
        input.bytes.byteLength,
        check.extension,
        storageKey,
        remarks,
        at,
      );
      transitionJob(db, job.id, "QC_SUBMITTED", supplierUserId, {
        progressPercent: 100,
        remarks: `QC document ${fileName} submitted. ${remarks}`,
      });
      transitionRequest(
        db,
        job.request_id,
        "QC_IN_PROGRESS",
        supplierUserId,
        "QC submitted",
      );
      recordAudit(db, {
        actorId: supplierUserId,
        action: "QC_UPLOADED",
        entityType: "QC_DOCUMENT",
        entityId: id,
        detail: `${fileName} for job ${job.id}`,
      });
      return { id };
    });
  } catch (error) {
    await files.remove(storageKey).catch(() => undefined);
    throw error;
  }
}

export function reviewQc(
  db: DatabaseSync,
  adminId: string,
  jobId: string,
  decision:
    { approve: true; comment?: string } | { approve: false; comment: string },
) {
  const comment = decision.approve
    ? (decision.comment ?? "").trim()
    : requiredText(decision.comment, "A comment", MAX_COMMENT_LENGTH);
  if (comment.length > MAX_COMMENT_LENGTH)
    throw validation(`Comment must be under ${MAX_COMMENT_LENGTH} characters.`);
  return transaction(db, () => {
    const job = existingJob(db, jobId);
    if (job.status !== "QC_SUBMITTED")
      throw invalidState("This job has no QC submission waiting for review.");
    const pending = db
      .prepare(
        "SELECT id FROM qc_documents WHERE job_id = ? AND review_status = 'PENDING'",
      )
      .all(job.id) as { id: string }[];
    if (pending.length === 0)
      throw invalidState("There is no pending QC document to review.");

    const at = now();
    const status = decision.approve ? "APPROVED" : "REJECTED";
    db.prepare(
      `UPDATE qc_documents SET review_status = ?, review_comment = ?, reviewed_at = ?
       WHERE job_id = ? AND review_status = 'PENDING'`,
    ).run(status, comment, at, job.id);
    const jobTarget = decision.approve ? "QC_APPROVED" : "QC_REJECTED";
    const remarks = decision.approve
      ? comment || "QC approved"
      : `QC rejected: ${comment}`;
    transitionJob(db, job.id, jobTarget, adminId, { remarks });
    transitionRequest(db, job.request_id, jobTarget, adminId, remarks);
    for (const doc of pending)
      recordAudit(db, {
        actorId: adminId,
        action: decision.approve ? "QC_APPROVED" : "QC_REJECTED",
        entityType: "QC_DOCUMENT",
        entityId: doc.id,
        detail: comment ? `Job ${job.id}: ${comment}` : `Job ${job.id}`,
      });
    return { status: jobTarget };
  });
}

/* -------------------------------------------------------------- dispatch */

export function dispatchJob(
  db: DatabaseSync,
  supplierUserId: string,
  jobId: string,
  input: { courier: string; trackingNumber: string },
) {
  const courier = requiredText(input.courier, "Courier", 80);
  const trackingNumber = requiredText(
    input.trackingNumber,
    "Tracking number",
    80,
  );
  return transaction(db, () => {
    const job = ownedJob(db, supplierUserId, jobId);
    if (job.status !== "QC_APPROVED")
      throw invalidState(
        "A job can be dispatched only after INDUSTRIHUB approves its QC.",
      );
    transitionJob(db, job.id, "DISPATCHED", supplierUserId, {
      remarks: `Dispatched via ${courier}, tracking ${trackingNumber}`,
    });
    db.prepare(
      "UPDATE jobs SET courier = ?, tracking_number = ? WHERE id = ?",
    ).run(courier, trackingNumber, job.id);
    transitionRequest(
      db,
      job.request_id,
      "DISPATCHED",
      supplierUserId,
      `Dispatched via ${courier}, tracking ${trackingNumber}`,
    );
    recordAudit(db, {
      actorId: supplierUserId,
      action: "JOB_DISPATCHED",
      entityType: "JOB",
      entityId: job.id,
      detail: `${courier}, tracking ${trackingNumber}`,
    });
  });
}

export function markDelivered(
  db: DatabaseSync,
  adminId: string,
  jobId: string,
) {
  return transaction(db, () => {
    const job = existingJob(db, jobId);
    if (job.status !== "DISPATCHED")
      throw invalidState("Only a dispatched job can be marked as delivered.");
    transitionJob(db, job.id, "DELIVERED", adminId, { remarks: "Delivered" });
    transitionRequest(db, job.request_id, "DELIVERED", adminId, "Delivered");
    recordAudit(db, {
      actorId: adminId,
      action: "JOB_DELIVERED",
      entityType: "JOB",
      entityId: job.id,
      detail: "Marked delivered",
    });
  });
}

/* ------------------------------------------------------------- downloads */

/**
 * Storage details of a QC document when this user may read it: any admin, the
 * supplier who uploaded it, or the customer who owns the request.
 */
export function findReadableQcDocument(
  db: DatabaseSync,
  user: Pick<UserProfile, "id" | "role">,
  documentId: string,
) {
  const row = db
    .prepare(
      `SELECT d.id, d.file_name, d.storage_key, s.user_id AS supplier_user_id,
              r.customer_id
       FROM qc_documents d
       JOIN suppliers s ON s.id = d.supplier_id
       JOIN jobs j ON j.id = d.job_id
       JOIN manufacturing_requests r ON r.id = j.request_id
       WHERE d.id = ?`,
    )
    .get(documentId) as
    | {
        id: string;
        file_name: string;
        storage_key: string;
        supplier_user_id: string;
        customer_id: string;
      }
    | undefined;
  if (!row) return null;
  const allowed =
    user.role === "ADMIN" ||
    (user.role === "SUPPLIER" && row.supplier_user_id === user.id) ||
    (user.role === "CUSTOMER" && row.customer_id === user.id);
  return allowed
    ? { fileName: row.file_name, storageKey: row.storage_key }
    : null;
}
