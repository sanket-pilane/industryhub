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
