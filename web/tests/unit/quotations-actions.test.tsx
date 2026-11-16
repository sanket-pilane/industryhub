import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuotationActions } from "@/components/quotations/quotation-actions";
import { PayAdvanceForm } from "@/components/quotations/pay-advance-form";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

const ok = () =>
  new Response(JSON.stringify({ success: true, data: {}, error: null }), {
    status: 200,
  });

describe("quotation decision buttons", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    refresh.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("requires a revision comment before anything is sent", async () => {
    render(<QuotationActions quotationId="QT-IH-01001" />);
    fireEvent.click(screen.getByRole("button", { name: "Request revision" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Send revision request" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tell us what should change in the quotation.",
    );
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("What should change?"), {
      target: { value: "Please cut the lead time to 14 days" },
    });
    fetchMock.mockResolvedValueOnce(ok());
    fireEvent.click(
      screen.getByRole("button", { name: "Send revision request" }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/quotations/QT-IH-01001/revision");
    expect(JSON.parse(init.body)).toEqual({
      comment: "Please cut the lead time to 14 days",
    });
  });

  it("requires a reason to reject", async () => {
    render(<QuotationActions quotationId="QT-IH-01001" />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject quotation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Add a short reason.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts in one click and shows a server conflict message", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: { code: "CONFLICT", message: "This quotation has expired." },
        }),
        { status: 409 },
      ),
    );
    render(<QuotationActions quotationId="QT-IH-01001" />);
    fireEvent.click(screen.getByRole("button", { name: "Accept quotation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This quotation has expired.",
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/quotations/QT-IH-01001/accept",
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("advance payment form", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok()));
    refresh.mockReset();
  });

  it("labels the test-mode outcome and posts only method and outcome", async () => {
    render(
      <PayAdvanceForm
        quotationId="QT-IH-01001"
        amountLabel="₹5,900"
        retry={false}
      />,
    );
    fireEvent.change(screen.getByLabelText("Test mode: payment result"), {
      target: { value: "failed" },
    });
    fireEvent.change(screen.getByLabelText("Payment method"), {
      target: { value: "CARD" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Pay ₹5,900/ }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/quotations/QT-IH-01001/pay");
    expect(JSON.parse(String(init?.body))).toEqual({
      method: "CARD",
      testOutcome: "failed",
    });
  });
});
