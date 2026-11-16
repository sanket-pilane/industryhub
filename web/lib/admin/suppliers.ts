import type { DatabaseSync } from "node:sqlite";
import type { Supplier } from "../../../shared/contracts";
import type { SupplierVerification } from "../../../shared/enums";
import { recordAudit } from "@/lib/audit";
import { transaction } from "@/lib/db";
import { notFound } from "@/lib/repositories/errors";
import { supplierFromRow } from "@/lib/suppliers/profile";

export type SupplierListItem = Supplier & { jobCount: number };

export function listSuppliers(db: DatabaseSync): SupplierListItem[] {
  const rows = db
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM jobs j WHERE j.supplier_id = s.id) AS job_count
       FROM suppliers s ORDER BY s.created_at, s.id`,
    )
    .all() as (Parameters<typeof supplierFromRow>[0] & { job_count: number })[];
  return rows.map((row) => ({
    ...supplierFromRow(row),
    jobCount: row.job_count,
  }));
}

export function listVerifiedSuppliers(db: DatabaseSync) {
  return listSuppliers(db).filter((s) => s.verificationStatus === "VERIFIED");
}

/** Admin verifies or rejects a supplier account. */
export function setSupplierVerification(
  db: DatabaseSync,
  adminId: string,
  supplierId: string,
  status: Extract<SupplierVerification, "VERIFIED" | "REJECTED">,
) {
  return transaction(db, () => {
    const row = db
      .prepare(
        "SELECT id, company_name, verification_status FROM suppliers WHERE id = ?",
      )
      .get(supplierId) as
      | {
          id: string;
          company_name: string;
          verification_status: SupplierVerification;
        }
      | undefined;
    if (!row) throw notFound("Supplier");
    db.prepare("UPDATE suppliers SET verification_status = ? WHERE id = ?").run(
      status,
      supplierId,
    );
    recordAudit(db, {
      actorId: adminId,
      action: status === "VERIFIED" ? "SUPPLIER_VERIFIED" : "SUPPLIER_REJECTED",
      entityType: "SUPPLIER",
      entityId: supplierId,
      detail: `${row.company_name}: ${row.verification_status} to ${status}`,
    });
    return { id: supplierId, verificationStatus: status };
  });
}
