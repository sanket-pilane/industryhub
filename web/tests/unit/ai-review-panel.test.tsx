import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrawingReviewPanel } from "@/components/ai/drawing-review-panel";
import { QuotationForm } from "@/components/quotations/quotation-form";
import type { DrawingAnalysis } from "@/lib/ai/service";
import type { DrawingReview } from "@/lib/ai/review-schema";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

const review: DrawingReview = {
  summary: "Aluminium gear housing with a precision bore.",
  partType: "machined housing",
  overallDimensions: "220 × 170 × 95 mm",
  features: [{ kind: "bore", description: "Ø85 H7 through bore" }],
  tolerances: ["Ø85 H7"],
  surfaceFinish: ["Ra 1.6"],
  manufacturability: [
    {
      severity: "critical",
      issue: "No datum on the bore",
      suggestion: "Ask for a datum.",
    },
  ],
  mismatches: [
    {
      field: "process",
      customerValue: "CNC turning",
      drawingEvidence: "Prismatic housing",
      note: "Suits milling",
    },
  ],
  operations: [
    {
      operation: "Mill outline",
      machine: "3-axis VMC",
      setupMinutes: 60,
      cycleMinutesPerPart: 6,
    },
  ],
  quoteLineItems: [
    { description: "CNC machining, gear housing", quantity: 250 },
    { description: "Clear anodising", quantity: 250 },
  ],
  questionsForCustomer: ["Which face is datum A?"],
  confidence: "medium",
};

const analysis: DrawingAnalysis = {
  id: 1,
  status: "COMPLETED",
  model: "gemini-3.6-flash",
  review,
  error: "",
  inputTokens: 1000,
  outputTokens: 500,
  requestedBy: "Meera Iyer",
  createdAt: "2026-11-16T10:00:00Z",
};

describe("AI drawing assistant panel", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("explains why it is unavailable instead of offering the button", () => {
    render(
      <DrawingReviewPanel
        requestId="RFQ-1"
        quantity={250}
        availability={{ ok: false, reason: "NOT_ALLOWED" }}
        analysis={null}
        canQuote
      />,
    );
    expect(
      screen.getByText(/has not allowed AI-assisted review/),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Analyse drawing" }),
    ).toBeNull();
  });

  it("runs the analysis and shows a server error", async () => {
    const fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        success: false,
        error: { message: "The AI service could not be reached." },
      }),
    });
    vi.stubGlobal("fetch", fetch);
    render(
      <DrawingReviewPanel
        requestId="RFQ-1"
        quantity={250}
        availability={{ ok: true }}
        analysis={null}
        canQuote
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Analyse drawing" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "could not be reached",
      ),
    );
    expect(fetch).toHaveBeenCalledWith("/api/admin/requests/RFQ-1/analysis", {
      method: "POST",
    });
  });

  it("shows the review and hands line items to the quotation form", async () => {
    render(
      <>
        <DrawingReviewPanel
          requestId="RFQ-1"
          quantity={250}
          availability={{ ok: true }}
          analysis={analysis}
          canQuote
        />
        <QuotationForm
          requestId="RFQ-1"
          defaultQuantity={250}
          partName="Gear Housing"
          nextVersion={1}
        />
      </>,
    );
    expect(screen.getByText("No datum on the bore")).toBeVisible();
    expect(screen.getByText("Prismatic housing")).toBeVisible();
    // (60 setup + 6 × 250) / 60 = 26 hours
    expect(screen.getByText("26 hours")).toBeVisible();
    expect(screen.getByRole("button", { name: "Run again" })).toBeVisible();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Copy to quotation form" }),
      );
    });
    const descriptions = screen
      .getAllByLabelText(/^Description/)
      .map((el) => (el as HTMLInputElement).value);
    expect(descriptions).toEqual([
      "CNC machining, gear housing",
      "Clear anodising",
    ]);
    expect(screen.getByRole("status")).toHaveTextContent("Add unit prices");
  });
});
