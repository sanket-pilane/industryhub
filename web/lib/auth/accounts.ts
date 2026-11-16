import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { UserProfile } from "../../../shared/contracts";
import type { Role } from "../../../shared/enums";
import type { SignupInput } from "@/lib/validators";
import { hashPassword, verifyPassword } from "./passwords";

type UserRow = {
  id: string;
  email: string;
  password_salt: string;
  password_hash: string;
  role: Role;
  first_name: string;
  last_name: string;
  phone: string;
  company_name: string;
  gstin: string;
  is_active: number;
};

export function profileFromRow(row: UserRow): UserProfile {
  return {
    id: row.id,
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
    initials:
      `${row.first_name[0] ?? ""}${row.last_name[0] ?? ""}`.toUpperCase(),
    email: row.email,
    phone: row.phone,
    companyName: row.company_name,
    gstin: row.gstin,
  };
}

export function findUserById(db: DatabaseSync, id: string): UserProfile | null {
  const row = db
    .prepare("SELECT * FROM users WHERE id = ? AND is_active = 1")
    .get(id) as UserRow | undefined;
  return row ? profileFromRow(row) : null;
}

/** Returns the profile when e-mail and password match an active account. */
export function authenticate(
  db: DatabaseSync,
  email: string,
  password: string,
): UserProfile | null {
  const row = db
    .prepare("SELECT * FROM users WHERE email = ? AND is_active = 1")
    .get(email.trim()) as UserRow | undefined;
  if (!row) {
    // Spend the same work as a real check so timing does not reveal unknown e-mails.
    verifyPassword(password, "0".repeat(32), "0".repeat(64));
    return null;
  }
  return verifyPassword(password, row.password_salt, row.password_hash)
    ? profileFromRow(row)
    : null;
}

export function registerCustomer(
  db: DatabaseSync,
  input: SignupInput,
): { profile: UserProfile } | { error: "EMAIL_TAKEN" } {
  const email = input.email.trim().toLowerCase();
  const exists = db.prepare("SELECT 1 FROM users WHERE email = ?").get(email);
  if (exists) return { error: "EMAIL_TAKEN" };
  const { salt, hash } = hashPassword(input.password);
  const id = `USR-${randomUUID().slice(0, 8).toUpperCase()}`;
  db.prepare(
    `INSERT INTO users (id, email, password_salt, password_hash, role, first_name, last_name,
       company_name, created_at) VALUES (?, ?, ?, ?, 'CUSTOMER', ?, ?, ?, ?)`,
  ).run(
    id,
    email,
    salt,
    hash,
    input.firstName,
    input.lastName,
    input.companyName,
    new Date().toISOString(),
  );
  return { profile: findUserById(db, id)! };
}
