// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createTestDb, SEED } from "../helpers/db";
import {
  listSuppliers,
  listVerifiedSuppliers,
  setSupplierVerification,
} from "@/lib/admin/suppliers";
import {
  findSupplierByUser,
  updateCapabilities,
} from "@/lib/suppliers/profile";

describe("supplier verification", () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = createTestDb();
  });

  it("lists suppliers with a job count and filters verified ones", () => {
    const all = listSuppliers(db);
    expect(all.map((s) => [s.id, s.verificationStatus, s.jobCount])).toEqual([
      [SEED.supplier, "VERIFIED", 0],
      [SEED.pendingSupplier, "PENDING", 0],
    ]);
    expect(listVerifiedSuppliers(db).map((s) => s.id)).toEqual([SEED.supplier]);
  });

  it("verifies a pending supplier and audits it", () => {
    expect(
      setSupplierVerification(db, SEED.admin, SEED.pendingSupplier, "VERIFIED"),
    ).toEqual({
      id: SEED.pendingSupplier,
      verificationStatus: "VERIFIED",
    });
    expect(listVerifiedSuppliers(db)).toHaveLength(2);
    expect(
      db
        .prepare(
          "SELECT actor_id, action, entity_type, entity_id FROM audit_log",
        )
        .get(),
    ).toEqual({
      actor_id: SEED.admin,
      action: "SUPPLIER_VERIFIED",
      entity_type: "SUPPLIER",
      entity_id: SEED.pendingSupplier,
    });
  });

  it("rejects a supplier, removing it from the assignable list", () => {
    setSupplierVerification(db, SEED.admin, SEED.supplier, "REJECTED");
    expect(listVerifiedSuppliers(db)).toHaveLength(0);
    expect(findSupplierByUser(db, SEED.supplierUser)?.verificationStatus).toBe(
      "REJECTED",
    );
  });

  it("returns 404 for an unknown supplier", () => {
    expect(() =>
      setSupplierVerification(db, SEED.admin, "SUP-9999", "VERIFIED"),
    ).toThrowError(expect.objectContaining({ status: 404 }));
  });
});

describe("supplier profile", () => {
  it("lets a supplier edit capabilities, trimmed, with audit", () => {
    const db = createTestDb();
    const updated = updateCapabilities(
      db,
      SEED.supplierUser,
      "  CNC turning; ISO 9001  ",
    );
    expect(updated.capabilities).toBe("CNC turning; ISO 9001");
    expect(findSupplierByUser(db, SEED.supplierUser)?.capabilities).toBe(
      "CNC turning; ISO 9001",
    );
    expect(db.prepare("SELECT action FROM audit_log").get()).toEqual({
      action: "SUPPLIER_PROFILE_UPDATED",
    });
  });

  it("does not touch another supplier and rejects non-suppliers and oversize text", () => {
    const db = createTestDb();
    const before = findSupplierByUser(
      db,
      SEED.pendingSupplierUser,
    )?.capabilities;
    updateCapabilities(db, SEED.supplierUser, "Only mine");
    expect(findSupplierByUser(db, SEED.pendingSupplierUser)?.capabilities).toBe(
      before,
    );
    expect(() => updateCapabilities(db, SEED.customer, "x")).toThrowError(
      expect.objectContaining({ status: 404 }),
    );
    expect(() =>
      updateCapabilities(db, SEED.supplierUser, "x".repeat(1001)),
    ).toThrowError(/1000/);
  });
});
