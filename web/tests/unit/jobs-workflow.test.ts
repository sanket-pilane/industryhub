// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addCustomer, createTestDb, SEED } from "../helpers/db";
import { nextNumber } from "@/lib/db";
import { TransitionError } from "@/lib/manufacturing/status";
import { RepositoryError } from "@/lib/repositories/errors";
import { FileStorage } from "@/lib/storage/files";
import {
  assignSupplier,
  dispatchJob,
  findReadableQcDocument,
  markDelivered,
  recordProgress,
  reviewQc,
  startProduction,
  submitQcDocument,
} from "@/lib/jobs/service";
import {
  listAwaitingAssignment,
  loadJobDetail,
  loadJobForSupplierUser,
} from "@/lib/jobs/queries";

const storageDir = mkdtempSync(path.join(tmpdir(), "ih-qc-"));
afterAll(() => rmSync(storageDir, { recursive: true, force: true }));

const PDF = new TextEncoder().encode("%PDF-1.7\n% inspection report\n");
const FUTURE = new Date(Date.now() + 30 * 86_400_000)
  .toISOString()
  .slice(0, 10);

/** Inserts a request at ADVANCE_PAID with an ACCEPTED quotation. */
function advancePaidRequest(
  db: DatabaseSync,
  customerId: string = SEED.customer,
) {
  const id = nextNumber(db, "RFQ", "RFQ-IH-", 1000);
  const at = new Date().toISOString();
  db.prepare(
    `INSERT INTO manufacturing_requests
      (id, customer_id, part_name, quantity, material, tolerance, process, finish, target_date,
       notes, status, revision, file_name, file_size, file_extension, file_checksum, storage_key,
       submitted_at, updated_at)
     VALUES (?, ?, 'Flange 120', 50, 'EN8 Steel', '±0.05 mm', 'CNC turning', 'Zinc plated', ?,
       'Deburr all edges', 'ADVANCE_PAID', 1, 'flange.pdf', 10, 'pdf', 'abc', 'requests/x.pdf', ?, ?)`,
  ).run(id, customerId, FUTURE, at, at);
  const quote = nextNumber(db, "QUO", "QUO-IH-", 1000);
  db.prepare(
    `INSERT INTO quotations
      (id, request_id, customer_id, version, status, subtotal_paise, tax_paise, total_paise,
       advance_percent, lead_time_days, valid_until, terms, created_by, created_at, updated_at)
     VALUES (?, ?, ?, 1, 'ACCEPTED', 100000, 18000, 118000, 50, 14, ?, '', ?, ?, ?)`,
  ).run(quote, id, customerId, FUTURE, SEED.admin, at, at);
  return { requestId: id, quoteId: quote };
}

const requestStatus = (db: DatabaseSync, id: string) =>
  (
    db
      .prepare("SELECT status FROM manufacturing_requests WHERE id = ?")
      .get(id) as { status: string }
  ).status;
const jobStatus = (db: DatabaseSync, id: string) =>
  (
    db.prepare("SELECT status FROM jobs WHERE id = ?").get(id) as {
      status: string;
    }
  ).status;

const files = new FileStorage(storageDir);
const upload = (
  db: DatabaseSync,
  jobId: string,
  user: string = SEED.supplierUser,
  remarks = "Report attached",
) =>
  submitQcDocument(
    db,
    user,
    jobId,
    { fileName: "report.pdf", bytes: PDF, remarks },
    files,
  );

describe("supplier assignment", () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = createTestDb();
  });

  it("creates an ASSIGNED job and moves the request to SUPPLIER_ASSIGNMENT", () => {
    const { requestId, quoteId } = advancePaidRequest(db);
    expect(listAwaitingAssignment(db).map((r) => r.id)).toEqual([requestId]);
    const { id } = assignSupplier(db, SEED.admin, {
      requestId,
      supplierId: SEED.supplier,
      targetDate: FUTURE,
    });
    expect(id).toBe("JOB-IH-01001");
    const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Record<
      string,
      unknown
    >;
    expect(job).toMatchObject({
      status: "ASSIGNED",
      supplier_id: SEED.supplier,
      quotation_id: quoteId,
      target_date: FUTURE,
      progress_percent: 0,
    });
    expect(requestStatus(db, requestId)).toBe("SUPPLIER_ASSIGNMENT");
    expect(listAwaitingAssignment(db)).toHaveLength(0);
    const audit = db
      .prepare("SELECT action FROM audit_log WHERE entity_id = ?")
      .get(id) as { action: string };
    expect(audit.action).toBe("JOB_ASSIGNED");
  });

  it("rejects a supplier that is not verified", () => {
    const { requestId } = advancePaidRequest(db);
    expect(() =>
      assignSupplier(db, SEED.admin, {
        requestId,
        supplierId: SEED.pendingSupplier,
        targetDate: FUTURE,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "SUPPLIER_NOT_VERIFIED", status: 409 }),
    );
    expect(requestStatus(db, requestId)).toBe("ADVANCE_PAID");
    expect(db.prepare("SELECT COUNT(*) AS n FROM jobs").get()).toEqual({
      n: 0,
    });
  });

  it("rejects a request that is not in ADVANCE_PAID", () => {
    const { requestId } = advancePaidRequest(db);
    db.prepare(
      "UPDATE manufacturing_requests SET status = 'QUOTED' WHERE id = ?",
    ).run(requestId);
    expect(() =>
      assignSupplier(db, SEED.admin, {
        requestId,
        supplierId: SEED.supplier,
        targetDate: FUTURE,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "INVALID_STATE", status: 409 }),
    );
  });

  it("rejects a second job for the same request", () => {
    const { requestId } = advancePaidRequest(db);
    assignSupplier(db, SEED.admin, {
      requestId,
      supplierId: SEED.supplier,
      targetDate: FUTURE,
    });
    expect(() =>
      assignSupplier(db, SEED.admin, {
        requestId,
        supplierId: SEED.supplier,
        targetDate: FUTURE,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "JOB_EXISTS", status: 409 }),
    );
    expect(db.prepare("SELECT COUNT(*) AS n FROM jobs").get()).toEqual({
      n: 1,
    });
  });

  it("rejects an unknown request, a past date and a malformed date", () => {
    const { requestId } = advancePaidRequest(db);
    expect(() =>
      assignSupplier(db, SEED.admin, {
        requestId: "RFQ-NOPE",
        supplierId: SEED.supplier,
        targetDate: FUTURE,
      }),
    ).toThrowError(expect.objectContaining({ status: 404 }));
    expect(() =>
      assignSupplier(db, SEED.admin, {
        requestId,
        supplierId: SEED.supplier,
        targetDate: "2020-01-01",
      }),
    ).toThrowError(RepositoryError);
    expect(() =>
      assignSupplier(db, SEED.admin, {
        requestId,
        supplierId: SEED.supplier,
        targetDate: "soon",
      }),
    ).toThrowError(RepositoryError);
  });
});

describe("supplier ownership", () => {
  let db: DatabaseSync;
  let jobId: string;
  beforeEach(() => {
    db = createTestDb();
    // A second verified supplier who owns no job.
    db.prepare(
      "UPDATE suppliers SET verification_status = 'VERIFIED' WHERE id = ?",
    ).run(SEED.pendingSupplier);
    const { requestId } = advancePaidRequest(db);
    jobId = assignSupplier(db, SEED.admin, {
      requestId,
      supplierId: SEED.supplier,
      targetDate: FUTURE,
    }).id;
  });

  it("hides the job from another supplier", () => {
    expect(
      loadJobForSupplierUser(db, SEED.pendingSupplierUser, jobId),
    ).toBeNull();
    expect(loadJobForSupplierUser(db, SEED.supplierUser, jobId)?.id).toBe(
      jobId,
    );
  });

  it("blocks another supplier from every action with 404", async () => {
    const other = SEED.pendingSupplierUser;
    const notFound = expect.objectContaining({ status: 404 });
    expect(() => startProduction(db, other, jobId)).toThrowError(notFound);
    startProduction(db, SEED.supplierUser, jobId);
    expect(() =>
      recordProgress(db, other, jobId, { percent: 10, remarks: "x" }),
    ).toThrowError(notFound);
    await expect(upload(db, jobId, other)).rejects.toMatchObject({
      status: 404,
    });
    expect(() =>
      dispatchJob(db, other, jobId, { courier: "DTDC", trackingNumber: "1" }),
    ).toThrowError(notFound);
    expect(jobStatus(db, jobId)).toBe("IN_PRODUCTION");
  });

  it("does not expose customer identity or prices in the job detail", () => {
    const detail = JSON.stringify(loadJobDetail(db, jobId));
    expect(detail).not.toMatch(/Apex Motion|srushti|118000|100000|USR-0001/i);
  });
});

describe("full job lifecycle", () => {
  it("moves a request from ADVANCE_PAID to DELIVERED with the right statuses at each step", async () => {
    const db = createTestDb();
    const { requestId } = advancePaidRequest(db);
    const { id: jobId } = assignSupplier(db, SEED.admin, {
      requestId,
      supplierId: SEED.supplier,
      targetDate: FUTURE,
    });
    expect([jobStatus(db, jobId), requestStatus(db, requestId)]).toEqual([
      "ASSIGNED",
      "SUPPLIER_ASSIGNMENT",
    ]);

    startProduction(db, SEED.supplierUser, jobId);
    expect([jobStatus(db, jobId), requestStatus(db, requestId)]).toEqual([
      "IN_PRODUCTION",
      "IN_PRODUCTION",
    ]);

    recordProgress(db, SEED.supplierUser, jobId, {
      percent: 40,
      remarks: "Roughing done",
    });
    expect(loadJobDetail(db, jobId)?.progressPercent).toBe(40);

    const { id: qcId } = await upload(db, jobId);
    expect(qcId).toBe("QC-IH-01001");
    expect([jobStatus(db, jobId), requestStatus(db, requestId)]).toEqual([
      "QC_SUBMITTED",
      "QC_IN_PROGRESS",
    ]);
    expect(loadJobDetail(db, jobId)?.progressPercent).toBe(100);

    reviewQc(db, SEED.admin, jobId, { approve: true });
    expect([jobStatus(db, jobId), requestStatus(db, requestId)]).toEqual([
      "QC_APPROVED",
      "QC_APPROVED",
    ]);
    const doc = db
      .prepare(
        "SELECT review_status, reviewed_at FROM qc_documents WHERE id = ?",
      )
      .get(qcId) as {
      review_status: string;
      reviewed_at: string | null;
    };
    expect(doc.review_status).toBe("APPROVED");
    expect(doc.reviewed_at).not.toBeNull();

    dispatchJob(db, SEED.supplierUser, jobId, {
      courier: "Blue Dart",
      trackingNumber: "BD123456",
    });
    expect([jobStatus(db, jobId), requestStatus(db, requestId)]).toEqual([
      "DISPATCHED",
      "DISPATCHED",
    ]);
    const dispatched = loadJobDetail(db, jobId);
    expect(dispatched).toMatchObject({
      courier: "Blue Dart",
      trackingNumber: "BD123456",
    });

    markDelivered(db, SEED.admin, jobId);
    expect([jobStatus(db, jobId), requestStatus(db, requestId)]).toEqual([
      "DELIVERED",
      "DELIVERED",
    ]);

    const history = db
      .prepare(
        "SELECT to_status FROM request_status_history WHERE request_id = ? ORDER BY id",
      )
      .all(requestId) as { to_status: string }[];
    expect(history.map((h) => h.to_status)).toEqual([
      "SUPPLIER_ASSIGNMENT",
      "IN_PRODUCTION",
      "QC_IN_PROGRESS",
      "QC_APPROVED",
      "DISPATCHED",
      "DELIVERED",
    ]);
    const actions = db
      .prepare("SELECT action FROM audit_log ORDER BY id")
      .all() as { action: string }[];
    expect(actions.map((a) => a.action)).toEqual([
      "JOB_ASSIGNED",
      "JOB_STARTED",
      "JOB_PROGRESS",
      "QC_UPLOADED",
      "QC_APPROVED",
      "JOB_DISPATCHED",
      "JOB_DELIVERED",
    ]);
    expect(loadJobDetail(db, jobId)?.updates.length).toBeGreaterThanOrEqual(6);
  });

  it("rejects out-of-order actions", async () => {
    const db = createTestDb();
    const { requestId } = advancePaidRequest(db);
    const { id: jobId } = assignSupplier(db, SEED.admin, {
      requestId,
      supplierId: SEED.supplier,
      targetDate: FUTURE,
    });
    expect(() =>
      recordProgress(db, SEED.supplierUser, jobId, {
        percent: 10,
        remarks: "x",
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_STATE" }));
    await expect(upload(db, jobId)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(() =>
      reviewQc(db, SEED.admin, jobId, { approve: true }),
    ).toThrowError(RepositoryError);
    expect(() => markDelivered(db, SEED.admin, jobId)).toThrowError(
      RepositoryError,
    );
    startProduction(db, SEED.supplierUser, jobId);
    expect(() => startProduction(db, SEED.supplierUser, jobId)).toThrowError(
      TransitionError,
    );
  });
});

describe("progress updates", () => {
  let db: DatabaseSync;
  let jobId: string;
  beforeEach(() => {
    db = createTestDb();
    const { requestId } = advancePaidRequest(db);
    jobId = assignSupplier(db, SEED.admin, {
      requestId,
      supplierId: SEED.supplier,
      targetDate: FUTURE,
    }).id;
    startProduction(db, SEED.supplierUser, jobId);
  });

  it("stores a job_updates row with the same status", () => {
    recordProgress(db, SEED.supplierUser, jobId, {
      percent: 25,
      remarks: "Material cut",
    });
    const last = db
      .prepare(
        "SELECT status, progress_percent, remarks FROM job_updates WHERE job_id = ? ORDER BY id DESC LIMIT 1",
      )
      .get(jobId);
    expect(last).toMatchObject({
      status: "IN_PRODUCTION",
      progress_percent: 25,
      remarks: "Material cut",
    });
  });

  it("accepts 0 and 99 and an unchanged value", () => {
    recordProgress(db, SEED.supplierUser, jobId, {
      percent: 0,
      remarks: "Set up",
    });
    recordProgress(db, SEED.supplierUser, jobId, {
      percent: 99,
      remarks: "Almost done",
    });
    recordProgress(db, SEED.supplierUser, jobId, {
      percent: 99,
      remarks: "Final checks",
    });
    expect(loadJobDetail(db, jobId)?.progressPercent).toBe(99);
  });

  it.each([-1, 100, 150, 12.5, Number.NaN])("rejects %s", (percent) => {
    expect(() =>
      recordProgress(db, SEED.supplierUser, jobId, { percent, remarks: "x" }),
    ).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });

  it("never lets progress decrease", () => {
    recordProgress(db, SEED.supplierUser, jobId, {
      percent: 60,
      remarks: "Half way plus",
    });
    expect(() =>
      recordProgress(db, SEED.supplierUser, jobId, {
        percent: 59,
        remarks: "Oops",
      }),
    ).toThrowError(/cannot go down/);
    expect(loadJobDetail(db, jobId)?.progressPercent).toBe(60);
  });

  it("requires remarks", () => {
    expect(() =>
      recordProgress(db, SEED.supplierUser, jobId, {
        percent: 10,
        remarks: "   ",
      }),
    ).toThrowError(/Remarks is required/);
  });
});

describe("QC review, rejection and resubmission", () => {
  let db: DatabaseSync;
  let jobId: string;
  let requestId: string;
  beforeEach(async () => {
    db = createTestDb();
    requestId = advancePaidRequest(db).requestId;
    jobId = assignSupplier(db, SEED.admin, {
      requestId,
      supplierId: SEED.supplier,
      targetDate: FUTURE,
    }).id;
    startProduction(db, SEED.supplierUser, jobId);
    await upload(db, jobId);
  });

  it("requires a comment to reject", () => {
    expect(() =>
      reviewQc(db, SEED.admin, jobId, { approve: false, comment: "  " }),
    ).toThrowError(/comment is required/i);
    expect(jobStatus(db, jobId)).toBe("QC_SUBMITTED");
  });

  it("rejects QC, then accepts a resubmission that can be approved", async () => {
    reviewQc(db, SEED.admin, jobId, {
      approve: false,
      comment: "Bore diameter out of tolerance",
    });
    expect([jobStatus(db, jobId), requestStatus(db, requestId)]).toEqual([
      "QC_REJECTED",
      "QC_REJECTED",
    ]);
    const rejected = loadJobDetail(db, jobId)?.documents[0];
    expect(rejected).toMatchObject({
      reviewStatus: "REJECTED",
      reviewComment: "Bore diameter out of tolerance",
    });

    // The supplier cannot dispatch after a rejection.
    expect(() =>
      dispatchJob(db, SEED.supplierUser, jobId, {
        courier: "DTDC",
        trackingNumber: "9",
      }),
    ).toThrowError(RepositoryError);

    const { id } = await upload(
      db,
      jobId,
      SEED.supplierUser,
      "Re-machined and re-measured",
    );
    expect(id).toBe("QC-IH-01002");
    expect([jobStatus(db, jobId), requestStatus(db, requestId)]).toEqual([
      "QC_SUBMITTED",
      "QC_IN_PROGRESS",
    ]);

    reviewQc(db, SEED.admin, jobId, {
      approve: true,
      comment: "Within tolerance now",
    });
    expect([jobStatus(db, jobId), requestStatus(db, requestId)]).toEqual([
      "QC_APPROVED",
      "QC_APPROVED",
    ]);
    const docs = loadJobDetail(db, jobId)?.documents.map((d) => d.reviewStatus);
    expect(docs).toEqual(["REJECTED", "APPROVED"]);
  });
});

describe("QC uploads and downloads", () => {
  let db: DatabaseSync;
  let jobId: string;
  beforeEach(() => {
    db = createTestDb();
    const { requestId } = advancePaidRequest(db);
    jobId = assignSupplier(db, SEED.admin, {
      requestId,
      supplierId: SEED.supplier,
      targetDate: FUTURE,
    }).id;
    startProduction(db, SEED.supplierUser, jobId);
  });

  it("requires remarks and stores nothing when they are missing", async () => {
    await expect(
      upload(db, jobId, SEED.supplierUser, "  "),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(db.prepare("SELECT COUNT(*) AS n FROM qc_documents").get()).toEqual({
      n: 0,
    });
    expect(jobStatus(db, jobId)).toBe("IN_PRODUCTION");
  });

  it("rejects a file whose content does not match its extension", async () => {
    await expect(
      submitQcDocument(
        db,
        SEED.supplierUser,
        jobId,
        {
          fileName: "report.pdf",
          bytes: new TextEncoder().encode("MZ not a pdf"),
          remarks: "r",
        },
        files,
      ),
    ).rejects.toMatchObject({ code: "BAD_SIGNATURE" });
    expect(jobStatus(db, jobId)).toBe("IN_PRODUCTION");
  });

  it("removes the stored file when the database write fails", async () => {
    const removed: string[] = [];
    const written: string[] = [];
    const spy = {
      write: async (key: string) => void written.push(key),
      remove: async (key: string) => void removed.push(key),
      read: async () => new Uint8Array(),
    } as unknown as FileStorage;
    // Make the QC row insert fail by pointing the document at a missing supplier.
    db.exec("DROP TABLE qc_documents");
    await expect(
      submitQcDocument(
        db,
        SEED.supplierUser,
        jobId,
        { fileName: "r.pdf", bytes: PDF, remarks: "ok" },
        spy,
      ),
    ).rejects.toThrow();
    expect(written).toHaveLength(1);
    expect(removed).toEqual(written);
    expect(written[0]).toMatch(/^qc\/[0-9a-f-]{36}\.pdf$/);
    expect(jobStatus(db, jobId)).toBe("IN_PRODUCTION");
  });

  it("stores the file under qc/<uuid>.<ext> and allows admin, owner supplier and owner customer only", async () => {
    const { id } = await upload(db, jobId);
    const row = db
      .prepare("SELECT storage_key FROM qc_documents WHERE id = ?")
      .get(id) as { storage_key: string };
    expect(row.storage_key).toMatch(/^qc\/[0-9a-f-]{36}\.pdf$/);
    expect(Array.from(await files.read(row.storage_key))).toEqual(
      Array.from(PDF),
    );

    const other = addCustomer(db, "other.customer@example.com");
    const readable = (user: {
      id: string;
      role: "CUSTOMER" | "SUPPLIER" | "ADMIN";
    }) => findReadableQcDocument(db, user, id);
    expect(readable({ id: SEED.admin, role: "ADMIN" })).toMatchObject({
      fileName: "report.pdf",
    });
    expect(
      readable({ id: SEED.supplierUser, role: "SUPPLIER" }),
    ).not.toBeNull();
    expect(readable({ id: SEED.customer, role: "CUSTOMER" })).not.toBeNull();
    expect(readable({ id: other, role: "CUSTOMER" })).toBeNull();
    expect(
      readable({ id: SEED.pendingSupplierUser, role: "SUPPLIER" }),
    ).toBeNull();
    expect(
      findReadableQcDocument(
        db,
        { id: SEED.admin, role: "ADMIN" },
        "QC-IH-09999",
      ),
    ).toBeNull();
  });
});

describe("dispatch", () => {
  it("requires courier and tracking number and a QC-approved job", async () => {
    const db = createTestDb();
    const { requestId } = advancePaidRequest(db);
    const { id: jobId } = assignSupplier(db, SEED.admin, {
      requestId,
      supplierId: SEED.supplier,
      targetDate: FUTURE,
    });
    startProduction(db, SEED.supplierUser, jobId);
    await upload(db, jobId);
    expect(() =>
      dispatchJob(db, SEED.supplierUser, jobId, {
        courier: "DTDC",
        trackingNumber: "T1",
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_STATE" }));
    reviewQc(db, SEED.admin, jobId, { approve: true });
    expect(() =>
      dispatchJob(db, SEED.supplierUser, jobId, {
        courier: "DTDC",
        trackingNumber: "  ",
      }),
    ).toThrowError(/Tracking number is required/);
    expect(() =>
      dispatchJob(db, SEED.supplierUser, jobId, {
        courier: "",
        trackingNumber: "T1",
      }),
    ).toThrowError(/Courier is required/);
    expect(jobStatus(db, jobId)).toBe("QC_APPROVED");
    expect(requestStatus(db, requestId)).toBe("QC_APPROVED");
    dispatchJob(db, SEED.supplierUser, jobId, {
      courier: "DTDC",
      trackingNumber: "T1",
    });
    expect(jobStatus(db, jobId)).toBe("DISPATCHED");
  });
});
