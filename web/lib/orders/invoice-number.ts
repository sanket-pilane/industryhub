import type { DatabaseSync } from "node:sqlite";
import { nextNumber } from "@/lib/db";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Indian financial year (April to March) of an instant, in IST: "2026-27". */
export function financialYearLabel(at: Date | string = new Date()) {
  const ist = new Date(new Date(at).getTime() + IST_OFFSET_MS);
  const month = ist.getUTCMonth(); // 0 = January
  const start = month >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Next invoice number of the financial year, e.g. INV/2026-27/00001. Call inside a transaction. */
export function nextInvoiceNumber(
  db: DatabaseSync,
  at: Date | string = new Date(),
) {
  const year = financialYearLabel(at);
  return nextNumber(db, `INVOICE-${year}`, `INV/${year}/`, 0, 5);
}
