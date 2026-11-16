import { z } from "zod";
import { INDIAN_STATES } from "./states";

/** Client-safe: shared by the checkout form and the addresses API. */
export const PINCODE_PATTERN = /^[1-9]\d{5}$/;

export const addressSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Give the address a label, for example Head office.")
    .max(60, "Keep the label under 60 characters."),
  line1: z
    .string()
    .trim()
    .min(1, "Enter the street address.")
    .max(200, "Keep the address under 200 characters."),
  line2: z
    .string()
    .trim()
    .max(200, "Keep the address under 200 characters.")
    .default(""),
  city: z
    .string()
    .trim()
    .min(1, "Enter the city.")
    .max(80, "Keep the city under 80 characters."),
  state: z.enum(INDIAN_STATES, { error: "Choose a state or union territory." }),
  pincode: z
    .string()
    .trim()
    .regex(PINCODE_PATTERN, "Enter a valid 6-digit pincode."),
});
export type AddressInput = z.infer<typeof addressSchema>;
