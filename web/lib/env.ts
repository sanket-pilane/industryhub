import { z } from "zod";

const environmentSchema = z
  .object({
    NEXT_PUBLIC_DATA_MODE: z.enum(["mock", "catalyst"]).default("mock"),
    NEXT_PUBLIC_CATALYST_API_URL: z.string().default(""),
    NEXT_PUBLIC_CATALYST_ENV: z
      .enum(["development", "production"])
      .default("development"),
  })
  .superRefine((value, context) => {
    if (value.NEXT_PUBLIC_DATA_MODE === "catalyst") {
      const parsed = z
        .url({ protocol: /^https$/ })
        .safeParse(value.NEXT_PUBLIC_CATALYST_API_URL);
      if (!parsed.success)
        context.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_CATALYST_API_URL"],
          message: "Catalyst mode requires an absolute HTTPS Function URL.",
        });
    }
  });

export function parseEnvironment(source: Record<string, string | undefined>) {
  return environmentSchema.parse(source);
}

export const env = parseEnvironment({
  NEXT_PUBLIC_DATA_MODE: process.env.NEXT_PUBLIC_DATA_MODE,
  NEXT_PUBLIC_CATALYST_API_URL: process.env.NEXT_PUBLIC_CATALYST_API_URL,
  NEXT_PUBLIC_CATALYST_ENV: process.env.NEXT_PUBLIC_CATALYST_ENV,
});
