import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { Address } from "../../../shared/contracts";
import { RepositoryError } from "@/lib/repositories/errors";
import type { AddressInput } from "./address-schema";

export {
  addressSchema,
  PINCODE_PATTERN,
  type AddressInput,
} from "./address-schema";

type AddressRow = {
  id: string;
  user_id: string;
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  is_default: number;
};

export function addressFromRow(row: AddressRow): Address {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    isDefault: row.is_default === 1,
  };
}

/** A customer's own addresses, default first. */
export function listAddresses(db: DatabaseSync, userId: string): Address[] {
  const rows = db
    .prepare(
      "SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at, id",
    )
    .all(userId) as AddressRow[];
  return rows.map(addressFromRow);
}

/** Saves an address; the customer's first one becomes the default. */
export function createAddress(
  db: DatabaseSync,
  userId: string,
  input: AddressInput,
): Address {
  const { count } = db
    .prepare("SELECT COUNT(*) AS count FROM addresses WHERE user_id = ?")
    .get(userId) as { count: number };
  const id = `ADR-${randomUUID().slice(0, 8).toUpperCase()}`;
  db.prepare(
    `INSERT INTO addresses (id, user_id, label, line1, line2, city, state, pincode, is_default, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    input.label,
    input.line1,
    input.line2,
    input.city,
    input.state,
    input.pincode,
    count === 0 ? 1 : 0,
    new Date().toISOString(),
  );
  const row = db
    .prepare("SELECT * FROM addresses WHERE id = ?")
    .get(id) as AddressRow;
  return addressFromRow(row);
}

/** An address by id, only when it belongs to the customer. */
export function getOwnAddress(
  db: DatabaseSync,
  userId: string,
  addressId: string,
): Address {
  const row = db
    .prepare("SELECT * FROM addresses WHERE id = ? AND user_id = ?")
    .get(addressId, userId) as AddressRow | undefined;
  if (!row)
    throw new RepositoryError(
      "NOT_FOUND",
      "That delivery address was not found. Choose or add an address.",
      404,
    );
  return addressFromRow(row);
}
