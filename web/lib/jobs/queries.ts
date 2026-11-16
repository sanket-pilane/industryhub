import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { QcDocument } from "../../../shared/contracts";
import type {
  JobStatus,
  ManufacturingStatus,
  QcReviewStatus,
} from "../../../shared/enums";

/**
 * Read-side queries for supplier jobs. Nothing here returns customer identity
 * or prices, so the same shapes are safe to show to the assigned supplier.
 */
export type JobSummary = {
  id: string;
  requestId: string;
  partName: string;
  quantity: number;
  material: string;
  targetDate: string;
  status: JobStatus;
  progressPercent: number;
  supplierId: string;
  supplierName: string;
  createdAt: string;
};

export type JobUpdateView = {
  id: number;
  status: JobStatus;
  progressPercent: number;
  remarks: string;
  changedBy: string;
  changedAt: string;
};

export type QcDocumentView = QcDocument & { reviewedAt: string | null };

export type JobDetail = {
  id: string;
  requestId: string;
  status: JobStatus;
  progressPercent: number;
  targetDate: string;
  courier: string;
  trackingNumber: string;
  createdAt: string;
  updatedAt: string;
  request: {
    partName: string;
    quantity: number;
    material: string;
    tolerance: string;
    process: string;
    finish: string;
    notes: string;
    status: ManufacturingStatus;
    fileName: string;
    fileSize: number;
  };
  supplier: { id: string; companyName: string; city: string; state: string };
  updates: JobUpdateView[];
  documents: QcDocumentView[];
};

type SummaryRow = {
  id: string;
  request_id: string;
  part_name: string;
  quantity: number;
  material: string;
  target_date: string;
  status: JobStatus;
  progress_percent: number;
  supplier_id: string;
  supplier_name: string;
  created_at: string;
};

export function listJobs(
  db: DatabaseSync,
  filter: { status?: JobStatus; supplierId?: string } = {},
): JobSummary[] {
  const where: string[] = [];
  const params: SQLInputValue[] = [];
  if (filter.status) {
    where.push("j.status = ?");
    params.push(filter.status);
  }
  if (filter.supplierId) {
    where.push("j.supplier_id = ?");
    params.push(filter.supplierId);
  }
  const rows = db
    .prepare(
      `SELECT j.id, j.request_id, r.part_name, r.quantity, r.material, j.target_date,
              j.status, j.progress_percent, j.supplier_id, s.company_name AS supplier_name,
              j.created_at
       FROM jobs j
       JOIN manufacturing_requests r ON r.id = j.request_id
       JOIN suppliers s ON s.id = j.supplier_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY j.created_at DESC, j.id DESC`,
    )
    .all(...params) as SummaryRow[];
  return rows.map((r) => ({
    id: r.id,
    requestId: r.request_id,
    partName: r.part_name,
    quantity: r.quantity,
    material: r.material,
    targetDate: r.target_date,
    status: r.status,
    progressPercent: r.progress_percent,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name,
    createdAt: r.created_at,
  }));
}

/** Job detail, or null when there is no such job. The caller checks access. */
export function loadJobDetail(
  db: DatabaseSync,
  jobId: string,
): JobDetail | null {
  const row = db
    .prepare(
      `SELECT j.id, j.request_id, j.supplier_id, j.status, j.progress_percent, j.target_date,
              j.courier, j.tracking_number, j.created_at, j.updated_at,
              r.part_name, r.quantity, r.material, r.tolerance, r.process, r.finish,
              r.notes, r.status AS request_status, r.file_name, r.file_size,
              s.company_name, s.city, s.state
       FROM jobs j
       JOIN manufacturing_requests r ON r.id = j.request_id
       JOIN suppliers s ON s.id = j.supplier_id
       WHERE j.id = ?`,
    )
    .get(jobId) as
    | {
        id: string;
        request_id: string;
        supplier_id: string;
        status: JobStatus;
        progress_percent: number;
        target_date: string;
        courier: string;
        tracking_number: string;
        created_at: string;
        updated_at: string;
        part_name: string;
        quantity: number;
        material: string;
        tolerance: string;
        process: string;
        finish: string;
        notes: string;
        request_status: ManufacturingStatus;
        file_name: string;
        file_size: number;
        company_name: string;
        city: string;
        state: string;
      }
    | undefined;
  if (!row) return null;

  const updates = (
    db
      .prepare(
        `SELECT u.id, u.status, u.progress_percent, u.remarks, u.changed_at,
                COALESCE(us.first_name || ' ' || us.last_name, u.changed_by) AS changed_by
         FROM job_updates u LEFT JOIN users us ON us.id = u.changed_by
         WHERE u.job_id = ? ORDER BY u.id`,
      )
      .all(jobId) as {
      id: number;
      status: JobStatus;
      progress_percent: number;
      remarks: string;
      changed_at: string;
      changed_by: string;
    }[]
  ).map((u): JobUpdateView => ({
    id: u.id,
    status: u.status,
    progressPercent: u.progress_percent,
    remarks: u.remarks,
    changedBy: u.changed_by,
    changedAt: u.changed_at,
  }));

  const documents = (
    db
      .prepare(
        "SELECT * FROM qc_documents WHERE job_id = ? ORDER BY uploaded_at, id",
      )
      .all(jobId) as {
      id: string;
      job_id: string;
      supplier_id: string;
      file_name: string;
      file_size: number;
      file_extension: string;
      remarks: string;
      review_status: QcReviewStatus;
      review_comment: string;
      uploaded_at: string;
      reviewed_at: string | null;
    }[]
  ).map((d): QcDocumentView => ({
    id: d.id,
    jobId: d.job_id,
    supplierId: d.supplier_id,
    fileName: d.file_name,
    fileSize: d.file_size,
    fileExtension: d.file_extension,
    remarks: d.remarks,
    reviewStatus: d.review_status,
    reviewComment: d.review_comment,
    uploadedAt: d.uploaded_at,
    reviewedAt: d.reviewed_at,
  }));

  return {
    id: row.id,
    requestId: row.request_id,
    status: row.status,
    progressPercent: row.progress_percent,
    targetDate: row.target_date,
    courier: row.courier,
    trackingNumber: row.tracking_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    request: {
      partName: row.part_name,
      quantity: row.quantity,
      material: row.material,
      tolerance: row.tolerance,
      process: row.process,
      finish: row.finish,
      notes: row.notes,
      status: row.request_status,
      fileName: row.file_name,
      fileSize: row.file_size,
    },
    supplier: {
      id: row.supplier_id,
      companyName: row.company_name,
      city: row.city,
      state: row.state,
    },
    updates,
    documents,
  };
}

/** The job's detail only when it belongs to the supplier account `userId`. */
export function loadJobForSupplierUser(
  db: DatabaseSync,
  userId: string,
  jobId: string,
): JobDetail | null {
  const owned = db
    .prepare(
      `SELECT 1 FROM jobs j JOIN suppliers s ON s.id = j.supplier_id
       WHERE j.id = ? AND s.user_id = ?`,
    )
    .get(jobId, userId);
  return owned ? loadJobDetail(db, jobId) : null;
}

export type AwaitingRequest = {
  id: string;
  partName: string;
  quantity: number;
  material: string;
  targetDate: string;
  customerCompany: string;
  updatedAt: string;
};

/** Requests whose advance is paid and which still need a supplier. */
export function listAwaitingAssignment(db: DatabaseSync): AwaitingRequest[] {
  const rows = db
    .prepare(
      `SELECT r.id, r.part_name, r.quantity, r.material, r.target_date, r.updated_at,
              u.company_name
       FROM manufacturing_requests r JOIN users u ON u.id = r.customer_id
       WHERE r.status = 'ADVANCE_PAID'
       ORDER BY r.updated_at, r.id`,
    )
    .all() as {
    id: string;
    part_name: string;
    quantity: number;
    material: string;
    target_date: string;
    updated_at: string;
    company_name: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    partName: r.part_name,
    quantity: r.quantity,
    material: r.material,
    targetDate: r.target_date,
    customerCompany: r.company_name,
    updatedAt: r.updated_at,
  }));
}

/** QC documents for every job on a request, oldest first (customer request page). */
export function listQcDocumentsForRequest(
  db: DatabaseSync,
  requestId: string,
): Pick<
  QcDocumentView,
  | "id"
  | "fileName"
  | "fileSize"
  | "reviewStatus"
  | "reviewComment"
  | "uploadedAt"
>[] {
  const rows = db
    .prepare(
      `SELECT d.id, d.file_name, d.file_size, d.review_status, d.review_comment, d.uploaded_at
       FROM qc_documents d JOIN jobs j ON j.id = d.job_id
       WHERE j.request_id = ? ORDER BY d.uploaded_at, d.id`,
    )
    .all(requestId) as {
    id: string;
    file_name: string;
    file_size: number;
    review_status: QcReviewStatus;
    review_comment: string;
    uploaded_at: string;
  }[];
  return rows.map((d) => ({
    id: d.id,
    fileName: d.file_name,
    fileSize: d.file_size,
    reviewStatus: d.review_status,
    reviewComment: d.review_comment,
    uploadedAt: d.uploaded_at,
  }));
}
