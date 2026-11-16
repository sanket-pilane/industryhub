import { z } from "zod";

/** Server configuration. All values are optional with safe local defaults. */
const environmentSchema = z.object({
  DATABASE_PATH: z.string().min(1).optional(),
  DRAWING_STORAGE_DIR: z.string().min(1).optional(),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters.")
    .optional(),
  /** Google Gemini API key; enables the AI drawing assistant when set. */
  GEMINI_API_KEY: z.string().min(1).optional(),
  /** Gemini model for drawing reviews (default gemini-3.6-flash). */
  GEMINI_MODEL: z.string().min(1).optional(),
});

export function parseEnvironment(source: Record<string, string | undefined>) {
  const clean = Object.fromEntries(
    Object.entries(source).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  );
  return environmentSchema.parse(clean);
}

export const env = parseEnvironment({
  DATABASE_PATH: process.env.DATABASE_PATH,
  DRAWING_STORAGE_DIR: process.env.DRAWING_STORAGE_DIR,
  SESSION_SECRET: process.env.SESSION_SECRET,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
});
