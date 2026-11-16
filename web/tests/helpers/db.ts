import { openDatabase, type Database } from "@/lib/db";
import { registerCustomer } from "@/lib/auth/accounts";

/** Fresh migrated + seeded in-memory database for one test. */
export function createTestDb(): Database {
  return openDatabase(":memory:");
}

/** Seeded account ids (see lib/db/seed-data.ts). */
export const SEED = {
  customer: "USR-0001",
  supplierUser: "USR-0002",
  admin: "USR-0003",
  pendingSupplierUser: "USR-0004",
  supplier: "SUP-0001",
  pendingSupplier: "SUP-0002",
} as const;

/** Registers an extra customer and returns its id. */
export function addCustomer(db: Database, email: string) {
  const result = registerCustomer(db, {
    firstName: "Test",
    lastName: "Customer",
    companyName: "Test Industries",
    email,
    password: "Strong#2026",
    confirmPassword: "Strong#2026",
    terms: true,
  });
  if ("error" in result) throw new Error(result.error);
  return result.profile.id;
}
