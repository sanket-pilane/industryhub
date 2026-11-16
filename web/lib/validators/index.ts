import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid work email.").max(254),
  password: z.string().min(1, "Enter your password.").max(128),
  remember: z.boolean(),
});
export type LoginInput = z.infer<typeof loginSchema>;
export const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name.").max(60),
    lastName: z.string().trim().min(1, "Enter your last name.").max(60),
    companyName: z.string().trim().min(2, "Enter your company name.").max(120),
    email: z.email("Enter a valid work email.").max(254),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(128)
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/\d/, "Include at least one number."),
    confirmPassword: z.string().max(128),
    terms: z.boolean().refine((v) => v, "Accept the terms to continue."),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
export type SignupInput = z.infer<typeof signupSchema>;

export const MATERIALS = [
  "EN8 Steel",
  "Mild Steel (IS 2062)",
  "Stainless Steel 304",
  "Stainless Steel 316",
  "Aluminium 6061",
  "Brass",
  "Cast Iron",
  "Engineering Plastic",
  "Other (see notes)",
] as const;
export const TOLERANCES = [
  "ISO 2768-m (medium)",
  "ISO 2768-f (fine)",
  "±0.1 mm",
  "±0.05 mm",
  "±0.01 mm",
  "As per drawing",
] as const;
export const PROCESSES = [
  "CNC milling",
  "CNC turning",
  "Sheet metal fabrication",
  "Laser cutting",
  "Casting",
  "Forging",
  "3D printing",
  "Welding and fabrication",
] as const;
export const FINISHES = [
  "As machined",
  "Zinc plated",
  "Powder coated",
  "Anodised",
  "Black oxide",
  "Painted",
  "Polished",
] as const;

/** Yesterday in UTC, so "today" is accepted in every Indian time zone. */
function earliestTargetDate() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const rfqSchema = z.object({
  partName: z.string().trim().min(2, "Enter the part name.").max(120),
  quantity: z
    .string()
    .trim()
    .regex(/^\d{1,6}$/, "Enter a quantity between 1 and 100,000.")
    .transform(Number)
    .refine(
      (n) => n >= 1 && n <= 100_000,
      "Enter a quantity between 1 and 100,000.",
    ),
  material: z.enum(MATERIALS, { error: "Choose a material." }),
  tolerance: z.enum(TOLERANCES, { error: "Choose a tolerance." }),
  process: z.enum(PROCESSES, { error: "Choose a manufacturing process." }),
  finish: z.enum(FINISHES, { error: "Choose a surface finish." }),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a target delivery date.")
    .refine((d) => d >= earliestTargetDate(), "Choose today or a later date."),
  notes: z
    .string()
    .trim()
    .max(1000, "Keep notes under 1,000 characters.")
    .default(""),
  confidential: z
    .boolean()
    .refine((v) => v, "Confirm the confidentiality acknowledgement."),
  /** Optional opt-in to AI-assisted engineering review of the drawing. */
  aiReview: z.boolean().default(false),
});
export type RfqInput = z.input<typeof rfqSchema>;
export type RfqDetails = z.output<typeof rfqSchema>;
export const productQuerySchema = z.object({
  q: z.string().max(200).optional(),
  category: z.string().max(80).optional(),
  group: z.enum(["mechanical", "electrical", "automation", "tools"]).optional(),
  brand: z.string().max(80).optional(),
  inStock: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  sort: z.enum(["relevance", "newest", "price_asc", "price_desc"]).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});
export function safeReturnPath(path: string | null): string {
  // Only existing pages are eligible. No open redirects or future 404s.
  return path === "/" ? path : "/";
}
