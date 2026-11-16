import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { DrawingRequest, StatusHistory } from "../../../shared/contracts";
import type { ManufacturingStatus } from "../../../shared/enums";
import { getDb, nextNumber, transaction } from "@/lib/db";
import { FileStorage } from "@/lib/storage/files";
import type { RfqDetails } from "@/lib/validators";
import type { DrawingExtension } from "./rules";

/**
 * Manufacturing requests (uploaded drawings + RFQ details). Request rows live
 * in SQLite; the drawing bytes live in private file storage under a random
 * storage key. Server-only.
 */
export function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export type RequestRow = {
  id: string;
  customer_id: string;
  part_name: string;
  quantity: number;
  material: string;
  tolerance: string;
  process: string;
  finish: string;
  target_date: string;
  notes: string;
  status: ManufacturingStatus;
  revision: number;
  file_name: string;
  file_size: number;
  file_extension: string;
  file_checksum: string;
  storage_key: string;
  submitted_at: string;
  updated_at: string;
  ai_review_allowed: number;
};

export function requestFromRow(row: RequestRow): DrawingRequest {
  return {
    id: row.id,
    customerId: row.customer_id,
    partName: row.part_name,
    quantity: row.quantity,
    material: row.material,
    tolerance: row.tolerance,
    process: row.process,
    finish: row.finish,
    targetDate: row.target_date,
    notes: row.notes,
    status: row.status,
    revision: row.revision,
    file: {
      name: row.file_name,
      size: row.file_size,
      extension: row.file_extension,
      checksum: row.file_checksum,
    },
    aiReviewAllowed: row.ai_review_allowed === 1,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  };
}

/** Status timeline of a request, oldest first, with the actor's name. */
export function requestHistory(
  db: DatabaseSync,
  requestId: string,
): StatusHistory[] {
  const rows = db
    .prepare(
      `SELECT h.id, h.from_status, h.to_status, h.comment, h.changed_at,
              COALESCE(u.first_name || ' ' || u.last_name, h.changed_by) AS changed_by
       FROM request_status_history h LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.request_id = ? ORDER BY h.id`,
    )
    .all(requestId) as {
    id: number;
    from_status: ManufacturingStatus | null;
    to_status: ManufacturingStatus;
    comment: string;
    changed_at: string;
    changed_by: string;
  }[];
  return rows.map((h) => ({
    id: h.id,
    from: h.from_status,
    to: h.to_status,
    changedBy: h.changed_by,
    changedAt: h.changed_at,
    comment: h.comment,
  }));
}

type SaveInput = {
  customerId: string;
  details: Omit<RfqDetails, "confidential" | "aiReview">;
  /** Customer opted in to AI-assisted review of the drawing. */
  aiReviewAllowed?: boolean;
  file: { name: string; extension: DrawingExtension; bytes: Uint8Array };
  now?: Date;
};

export class DrawingStore {
  constructor(
    private readonly db: DatabaseSync = getDb(),
    private readonly files = new FileStorage(),
  ) {}

  async listForCustomer(customerId: string) {
    const rows = this.db
      .prepare(
        "SELECT * FROM manufacturing_requests WHERE customer_id = ? ORDER BY submitted_at DESC, id DESC",
      )
      .all(customerId) as RequestRow[];
    return rows.map(requestFromRow);
  }

  /** Any request by id. Admin and supplier callers must check access themselves. */
  async get(id: string) {
    const row = this.db
      .prepare("SELECT * FROM manufacturing_requests WHERE id = ?")
      .get(id) as RequestRow | undefined;
    return row ? requestFromRow(row) : null;
  }

  async getForCustomer(customerId: string, id: string) {
    const request = await this.get(id);
    return request && request.customerId === customerId ? request : null;
  }

  async findDuplicate(customerId: string, checksum: string) {
    const row = this.db
      .prepare(
        "SELECT * FROM manufacturing_requests WHERE customer_id = ? AND file_checksum = ? LIMIT 1",
      )
      .get(customerId, checksum) as RequestRow | undefined;
    return row ? requestFromRow(row) : null;
  }

  history(id: string) {
    return requestHistory(this.db, id);
  }

  /** Bytes of the stored drawing for a request, or null if there is no such request. */
  async readFile(id: string) {
    const row = this.db
      .prepare("SELECT storage_key FROM manufacturing_requests WHERE id = ?")
      .get(id) as { storage_key: string } | undefined;
    return row ? this.files.read(row.storage_key) : null;
  }

  async save({
    customerId,
    details,
    file,
    aiReviewAllowed = false,
    now = new Date(),
  }: SaveInput) {
    const storageKey = `requests/${randomUUID()}.${file.extension}`;
    await this.files.write(storageKey, file.bytes);
    const at = now.toISOString();
    try {
      const id = transaction(this.db, () => {
        const id = nextNumber(this.db, "RFQ", "RFQ-IH-", 1000);
        const { count } = this.db
          .prepare(
            "SELECT COUNT(*) AS count FROM manufacturing_requests WHERE customer_id = ? AND lower(part_name) = lower(?)",
          )
          .get(customerId, details.partName) as { count: number };
        this.db
          .prepare(
            `INSERT INTO manufacturing_requests
              (id, customer_id, part_name, quantity, material, tolerance, process, finish,
               target_date, notes, status, revision, file_name, file_size, file_extension,
               file_checksum, storage_key, submitted_at, updated_at, ai_review_allowed)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            customerId,
            details.partName,
            details.quantity,
            details.material,
            details.tolerance,
            details.process,
            details.finish,
            details.targetDate,
            details.notes ?? "",
            count + 1,
            file.name,
            file.bytes.byteLength,
            file.extension,
            sha256(file.bytes),
            storageKey,
            at,
            at,
            aiReviewAllowed ? 1 : 0,
          );
        this.db
          .prepare(
            `INSERT INTO request_status_history
              (request_id, from_status, to_status, changed_by, comment, changed_at)
             VALUES (?, NULL, 'SUBMITTED', ?, 'Drawing uploaded', ?)`,
          )
          .run(id, customerId, at);
        return id;
      });
      return (await this.get(id)) as DrawingRequest;
    } catch (error) {
      await this.files.remove(storageKey);
      throw error;
    }
  }
}

export function getDrawingStore() {
  return new DrawingStore();
}
