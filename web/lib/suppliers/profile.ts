import type { DatabaseSync } from "node:sqlite";
import type { Supplier } from "../../../shared/contracts";
import type { SupplierVerification } from "../../../shared/enums";
import { recordAudit } from "@/lib/audit";
import { RepositoryError, notFound } from "@/lib/repositories/errors";

type SupplierRow = {
  id: string;
  user_id: string;
  company_name: string;
  gstin: string;
  city: string;
  state: string;
  capabilities: string;
  verification_status: SupplierVerification;
  created_at: string;
};

export function supplierFromRow(row: SupplierRow): Supplier {
  return {
    id: row.id,
    userId: row.user_id,
    companyName: row.company_name,
    gstin: row.gstin,
    city: row.city,
    state: row.state,
    capabilities: row.capabilities,
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
  };
}

export function findSupplierByUser(
  db: DatabaseSync,
  userId: string,
): Supplier | null {
  const row = db
    .prepare("SELECT * FROM suppliers WHERE user_id = ?")
    .get(userId) as SupplierRow | undefined;
  return row ? supplierFromRow(row) : null;
}

export const MAX_CAPABILITIES_LENGTH = 1000;

/** Lets a supplier edit the capabilities text of their own company profile. */
export function updateCapabilities(
  db: DatabaseSync,
  userId: string,
  capabilities: string,
): Supplier {
  const supplier = findSupplierByUser(db, userId);
  if (!supplier) throw notFound("Supplier profile");
  const text = capabilities.trim();
  if (text.length > MAX_CAPABILITIES_LENGTH)
    throw new RepositoryError(
      "VALIDATION_ERROR",
      `Keep capabilities under ${MAX_CAPABILITIES_LENGTH} characters.`,
      400,
    );
  db.prepare("UPDATE suppliers SET capabilities = ? WHERE id = ?").run(
    text,
    supplier.id,
  );
  recordAudit(db, {
    actorId: userId,
    action: "SUPPLIER_PROFILE_UPDATED",
    entityType: "SUPPLIER",
    entityId: supplier.id,
    detail: "Capabilities updated",
  });
  return { ...supplier, capabilities: text };
}
