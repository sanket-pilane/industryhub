import { z } from "zod";
import { orderStatuses } from "../../../shared/enums";
import { DELIVERY_METHODS } from "./pricing";

export const MAX_LINE_QUANTITY = 999;
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const gstin = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => v === "" || GSTIN_PATTERN.test(v), {
    message: "Enter a valid 15-character GSTIN, for example 27ABCDE1234F1Z5.",
  });

const lineSchema = z.object({
  productId: z.string().trim().min(1, "Choose a product."),
  quantity: z
    .number({ error: "Quantity must be a whole number." })
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(
      MAX_LINE_QUANTITY,
      `Quantity cannot exceed ${MAX_LINE_QUANTITY} per line.`,
    ),
});

const itemsSchema = z
  .array(lineSchema)
  .min(1, "Your cart is empty.")
  .max(100, "An order can have at most 100 lines.");

export const paymentSchema = z.object({
  method: z.enum(["UPI", "CARD", "NETBANKING"], {
    error: "Choose a payment method.",
  }),
  testOutcome: z
    .enum(["success", "pending", "failed", "cancelled"], {
      error: "Choose a test outcome.",
    })
    .default("success"),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const quoteSchema = z.object({
  items: itemsSchema,
  addressId: z.string().trim().min(1, "Choose a delivery address."),
  deliveryMethod: z.enum(DELIVERY_METHODS, {
    error: "Choose a delivery method.",
  }),
});
export type QuoteInput = z.infer<typeof quoteSchema>;

export const placeOrderSchema = quoteSchema.extend({
  billingGstin: gstin.optional(),
  payment: paymentSchema,
});
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export const adminOrderPatchSchema = z.object({
  status: z.enum(orderStatuses, { error: "Choose a valid order status." }),
  courier: z
    .string()
    .trim()
    .max(80, "Keep the courier name under 80 characters.")
    .optional(),
  trackingNumber: z
    .string()
    .trim()
    .max(80, "Keep the tracking number under 80 characters.")
    .optional(),
  comment: z
    .string()
    .trim()
    .max(500, "Keep the comment under 500 characters.")
    .optional(),
});
export type AdminOrderPatch = z.infer<typeof adminOrderPatchSchema>;
