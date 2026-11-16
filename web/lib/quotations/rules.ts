import { z } from "zod";

/**
 * Pure quotation rules shared by the server and the browser forms: money
 * conversion, advance arithmetic, date helpers and request-body schemas.
 * No server-only imports here.
 */
export const GST_RATES = [0, 5, 12, 18, 28] as const;
export const MAX_LINE_ITEMS = 20;
export const MAX_QUOTE_TOTAL_PAISE = 1_000_000_000_000; // ₹10,000 crore
export const MAX_UNIT_PRICE_PAISE = 100_000_000_000; // ₹100 crore

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Calendar date (YYYY-MM-DD) in India Standard Time for the given instant. */
export function todayInIst(at: Date = new Date()) {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** A quotation is valid through the whole of its valid-until date (IST). */
export function isExpired(validUntil: string, at: Date = new Date()) {
  return validUntil < todayInIst(at);
}

const RUPEES = /^(\d{1,11})(?:\.(\d{1,2}))?$/;

/**
 * Converts a rupee amount typed by a person ("1250", "1,250.5", "99.99") into
 * integer paise using string arithmetic only, so there is no float rounding
 * (19.99 * 100 is 1998.9999999999998 in binary floating point). Returns null
 * for anything that is not a non-negative amount with at most 2 decimals.
 */
export function rupeesToPaise(input: string | number): number | null {
  const text = (typeof input === "number" ? String(input) : input)
    .trim()
    .replace(/^₹\s*/, "")
    .replace(/,/g, "");
  const match = RUPEES.exec(text);
  if (!match) return null;
  const paise =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? paise : null;
}

/**
 * Advance and balance for a quotation total.
 *
 * Rounding: advance = round-half-up(total * percent / 100) to the nearest
 * paise, computed with BigInt so the product can never lose precision. The
 * balance is total - advance, so the two always add back to the total.
 */
export function advanceAmounts(totalPaise: number, advancePercent: number) {
  if (
    !Number.isSafeInteger(totalPaise) ||
    totalPaise < 0 ||
    !Number.isInteger(advancePercent) ||
    advancePercent < 0 ||
    advancePercent > 100
  )
    throw new RangeError("Invalid total or advance percentage.");
  const advancePaise = Number(
    (BigInt(totalPaise) * BigInt(advancePercent) + BigInt(50)) / BigInt(100),
  );
  return { advancePaise, balancePaise: totalPaise - advancePaise };
}

const rupeeField = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const paise = rupeesToPaise(v);
  if (paise === null || paise <= 0 || paise > MAX_UNIT_PRICE_PAISE) {
    ctx.addIssue({
      code: "custom",
      message:
        "Enter a unit price in rupees, with up to 2 decimals (for example 1250.50).",
    });
    return z.NEVER;
  }
  return paise;
});

export const quotationLineSchema = z.object({
  description: z
    .string()
    .trim()
    .min(2, "Describe the line item.")
    .max(200, "Keep the description under 200 characters."),
  quantity: z.coerce
    .number({ error: "Enter a quantity." })
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(1_000_000, "Quantity is too large."),
  unitPrice: rupeeField,
  gstPercent: z.coerce
    .number()
    .refine((v) => (GST_RATES as readonly number[]).includes(v), {
      message: "GST must be 0, 5, 12, 18 or 28 percent.",
    }),
});

export const createQuotationSchema = z.object({
  items: z
    .array(quotationLineSchema)
    .min(1, "Add at least one line item.")
    .max(
      MAX_LINE_ITEMS,
      `A quotation can have at most ${MAX_LINE_ITEMS} line items.`,
    ),
  leadTimeDays: z.coerce
    .number({ error: "Enter the lead time in days." })
    .int("Lead time must be a whole number of days.")
    .min(1, "Lead time must be at least 1 day.")
    .max(365, "Lead time cannot exceed 365 days."),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid-until date.")
    .refine(
      (v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)),
      "Choose a valid-until date.",
    )
    .refine((v) => v > todayInIst(), "Valid-until must be a future date."),
  advancePercent: z.coerce
    .number({ error: "Enter the advance percentage." })
    .int("Advance must be a whole percentage.")
    .min(10, "Advance must be at least 10%.")
    .max(100, "Advance cannot exceed 100%."),
  terms: z
    .string()
    .trim()
    .max(2000, "Keep the terms under 2000 characters.")
    .default(""),
});
export type CreateQuotationInput = z.input<typeof createQuotationSchema>;
export type CreateQuotationData = z.output<typeof createQuotationSchema>;

export const reasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Add a short reason.")
    .max(1000, "Keep the reason under 1000 characters."),
});
export const revisionSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(3, "Tell us what should change in the quotation.")
    .max(1000, "Keep the comment under 1000 characters."),
});
export const payAdvanceSchema = z.object({
  method: z.enum(["UPI", "CARD", "NETBANKING"], {
    error: "Choose a payment method.",
  }),
  testOutcome: z
    .enum(["success", "pending", "failed", "cancelled"])
    .default("success"),
});
export type PayAdvanceInput = z.input<typeof payAdvanceSchema>;
export const ADMIN_FILTER_STATUSES = [
  "SUBMITTED",
  "UNDER_ENGINEERING_REVIEW",
  "REVISION_REQUESTED",
  "QUOTED",
  "ACCEPTED",
  "ADVANCE_PENDING",
  "ADVANCE_PAID",
  "REJECTED",
] as const;
export const OPEN_REVIEW_STATUSES = [
  "SUBMITTED",
  "UNDER_ENGINEERING_REVIEW",
  "REVISION_REQUESTED",
] as const;
