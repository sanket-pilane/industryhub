import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { UserProfile } from "../../../shared/contracts";
import type { SignupInput } from "@/lib/validators";

/**
 * Mock-mode account store. Lives in server memory only (resets on restart);
 * Catalyst Authentication replaces it in Phase 2. Passwords are scrypt-hashed.
 */
interface Account {
  profile: UserProfile;
  salt: string;
  hash: Buffer;
}
const globalStore = globalThis as typeof globalThis & {
  __industrihubAccounts?: Map<string, Account>;
};
const accounts = (globalStore.__industrihubAccounts ??= new Map());

const hash = (password: string, salt: string) => scryptSync(password, salt, 32);

export function registerAccount(
  input: SignupInput,
): { profile: UserProfile } | { error: "EMAIL_TAKEN" } {
  const email = input.email.toLowerCase();
  if (accounts.has(email)) return { error: "EMAIL_TAKEN" };
  const salt = randomBytes(16).toString("hex");
  const profile: UserProfile = {
    id: `mock-customer-${randomUUID()}`,
    role: "CUSTOMER",
    firstName: input.firstName,
    lastName: input.lastName,
    initials: `${input.firstName[0]}${input.lastName[0]}`.toUpperCase(),
    email,
    phone: "",
    companyName: input.companyName,
    gstin: "",
  };
  accounts.set(email, { profile, salt, hash: hash(input.password, salt) });
  return { profile };
}
export function authenticateAccount(
  email: string,
  password: string,
): UserProfile | null {
  const account = accounts.get(email.toLowerCase());
  if (!account) return null;
  return timingSafeEqual(hash(password, account.salt), account.hash)
    ? account.profile
    : null;
}
export function findRegisteredProfile(id: string): UserProfile | null {
  for (const { profile } of accounts.values())
    if (profile.id === id) return structuredClone(profile);
  return null;
}
