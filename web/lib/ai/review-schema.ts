import { z } from "zod";

/**
 * Shape of an AI drawing review. Kept free of numeric range constraints so it
 * can be used directly as a structured-output schema; values are checked again
 * by `normaliseReview()` before anything is stored or shown.
 */
export const drawingReviewSchema = z.object({
  summary: z
    .string()
    .describe("Two or three sentences: what the part is and how it is made."),
  partType: z
    .string()
    .describe("Short part category, e.g. 'machined housing', 'flange'."),
  overallDimensions: z
    .string()
    .describe(
      "Envelope size read from the drawing, e.g. '220 × 170 × 95 mm', or 'Not shown on drawing'.",
    ),
  features: z
    .array(
      z.object({
        kind: z.enum([
          "hole",
          "thread",
          "bore",
          "slot",
          "pocket",
          "keyway",
          "chamfer",
          "fillet",
          "bend",
          "other",
        ]),
        description: z
          .string()
          .describe("Feature with size and count, e.g. '4× M10-6H, depth 18'."),
      }),
    )
    .describe("Machined or formed features visible on the drawing."),
  tolerances: z
    .array(z.string())
    .describe(
      "Tolerances and fits found, e.g. 'Ø85 H7', 'ISO 2768-m general'.",
    ),
  surfaceFinish: z
    .array(z.string())
    .describe("Surface roughness, coating and treatment callouts."),
  manufacturability: z
    .array(
      z.object({
        severity: z.enum(["info", "warning", "critical"]),
        issue: z.string(),
        suggestion: z.string(),
      }),
    )
    .describe("Design-for-manufacture observations an engineer should check."),
  mismatches: z
    .array(
      z.object({
        field: z.enum([
          "material",
          "tolerance",
          "process",
          "finish",
          "quantity",
          "other",
        ]),
        customerValue: z.string().describe("What the customer entered."),
        drawingEvidence: z.string().describe("What the drawing shows instead."),
        note: z.string(),
      }),
    )
    .describe(
      "Differences between the RFQ details the customer entered and the drawing.",
    ),
  operations: z
    .array(
      z.object({
        operation: z.string().describe("e.g. 'Face and rough mill outline'."),
        machine: z.string().describe("e.g. '3-axis VMC', 'CNC lathe'."),
        setupMinutes: z.number().describe("One-time setup for the batch."),
        cycleMinutesPerPart: z.number(),
      }),
    )
    .describe("Suggested routing in order, with rough time estimates."),
  quoteLineItems: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number(),
      }),
    )
    .describe(
      "Suggested quotation lines (no prices): machining, finishing, inspection, certificates.",
    ),
  questionsForCustomer: z
    .array(z.string())
    .describe("Information missing from the drawing or RFQ needed to quote."),
  confidence: z
    .enum(["low", "medium", "high"])
    .describe("How clearly the drawing could be read."),
});

export type DrawingReview = z.infer<typeof drawingReviewSchema>;

const clampMinutes = (n: number) =>
  Number.isFinite(n)
    ? Math.min(Math.max(Math.round(n * 10) / 10, 0), 10_000)
    : 0;

/** Validates model output and keeps numbers in sane ranges. Throws on bad shape. */
export function normaliseReview(value: unknown): DrawingReview {
  const review = drawingReviewSchema.parse(value);
  return {
    ...review,
    operations: review.operations.slice(0, 20).map((op) => ({
      ...op,
      setupMinutes: clampMinutes(op.setupMinutes),
      cycleMinutesPerPart: clampMinutes(op.cycleMinutesPerPart),
    })),
    quoteLineItems: review.quoteLineItems
      .filter((item) => item.description.trim().length > 0)
      .slice(0, 20)
      .map((item) => ({
        description: item.description.trim().slice(0, 200),
        quantity: Math.min(Math.max(Math.trunc(item.quantity), 1), 100_000),
      })),
  };
}

/** Total estimated hours for a batch: setups once, cycle time per part. */
export function estimatedBatchHours(
  operations: DrawingReview["operations"],
  quantity: number,
) {
  const minutes = operations.reduce(
    (sum, op) => sum + op.setupMinutes + op.cycleMinutesPerPart * quantity,
    0,
  );
  return Math.round((minutes / 60) * 10) / 10;
}
