import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrawingUploadForm } from "@/components/drawings/drawing-upload-form";

class FakeXHR {
  static last: FakeXHR | null = null;
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = {
    onprogress: null,
  };
  responseType = "";
  response: unknown = null;
  body: FormData | null = null;
  url = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open(_method: string, url: string) {
    this.url = url;
  }
  send(body: FormData) {
    this.body = body;
    FakeXHR.last = this;
    this.upload.onprogress?.({
      lengthComputable: true,
      loaded: 40,
      total: 100,
    } as ProgressEvent);
  }
  abort() {
    this.onabort?.();
  }
  finish(response: unknown) {
    this.response = response;
    this.onload?.();
  }
}

const pdf = () =>
  new File(["%PDF-1.7 test"], "gear-housing.pdf", { type: "application/pdf" });

function fillDetails() {
  const set = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  set("Part name", "Gear Housing");
  set("Quantity", "25");
  set("Material", "EN8 Steel");
  set("Tolerance", "ISO 2768-m (medium)");
  set("Manufacturing process", "CNC milling");
  set("Surface finish", "Zinc plated");
  set("Target delivery date", "2099-01-15");
  fireEvent.click(
    screen.getByRole("checkbox", { name: /shared with verified/ }),
  );
}

describe("drawing upload form", () => {
  beforeEach(() => {
    FakeXHR.last = null;
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
  });

  it("rejects an unsupported file type as soon as it is chosen", () => {
    render(<DrawingUploadForm />);
    fireEvent.change(screen.getByLabelText("Choose file"), {
      target: { files: [new File(["MZ"], "setup.exe")] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Upload a PDF, DWG, DXF, STEP or STP drawing.",
    );
  });

  it("requires a file and the part details before uploading", async () => {
    render(<DrawingUploadForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "Submit drawing for quotation" }),
    );
    await screen.findByText("Enter the part name.");
    expect(screen.getByText("Choose a material.")).toBeVisible();
    expect(
      screen.getByText("Confirm the confidentiality acknowledgement."),
    ).toBeVisible();
    expect(FakeXHR.last).toBeNull();
  });

  it("uploads with progress and shows the new request", async () => {
    render(<DrawingUploadForm />);
    fireEvent.change(screen.getByLabelText("Choose file"), {
      target: { files: [pdf()] },
    });
    expect(screen.getByText("gear-housing.pdf")).toBeVisible();
    fillDetails();
    fireEvent.click(
      screen.getByRole("button", { name: "Submit drawing for quotation" }),
    );
    await waitFor(() => expect(FakeXHR.last).not.toBeNull());
    expect(screen.getByText("Uploading… 40%")).toBeVisible();
    const sent = FakeXHR.last!;
    expect(sent.url).toBe("/api/drawings");
    expect(sent.body?.get("partName")).toBe("Gear Housing");
    expect(sent.body?.get("quantity")).toBe("25");
    expect((sent.body?.get("file") as File).name).toBe("gear-housing.pdf");
    // AI review is opt-in: not sent unless the customer ticks it
    expect(sent.body?.get("aiReview")).toBeNull();
    act(() =>
      sent.finish({
        success: true,
        data: {
          id: "RFQ-IH-01001",
          partName: "Gear Housing",
          quantity: 25,
          revision: 1,
          file: { name: "gear-housing.pdf", size: 13 },
        },
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Drawing submitted" }),
    ).toBeVisible();
    expect(screen.getByText("RFQ-IH-01001")).toBeVisible();
  });

  it("asks before resubmitting a duplicate and supports cancel", async () => {
    render(<DrawingUploadForm />);
    fireEvent.change(screen.getByLabelText("Choose file"), {
      target: { files: [pdf()] },
    });
    fillDetails();
    fireEvent.click(
      screen.getByRole("button", { name: "Submit drawing for quotation" }),
    );
    await waitFor(() => expect(FakeXHR.last).not.toBeNull());
    act(() =>
      FakeXHR.last!.finish({
        success: false,
        error: {
          code: "DUPLICATE_DRAWING",
          message: "This file was already submitted as RFQ-IH-01001.",
        },
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "already submitted as RFQ-IH-01001",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Submit as new request" }),
    );
    expect(FakeXHR.last!.body?.get("allowDuplicate")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Cancel upload" }));
    expect(screen.getByText(/Upload cancelled/)).toBeVisible();
  });

  it("sends the AI-assisted review opt-in only when ticked", async () => {
    render(<DrawingUploadForm />);
    fireEvent.change(screen.getByLabelText("Choose file"), {
      target: { files: [pdf()] },
    });
    fillDetails();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /AI-assisted engineering review/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Submit drawing/ }));
    await waitFor(() => expect(FakeXHR.last).not.toBeNull());
    expect(FakeXHR.last!.body?.get("aiReview")).toBe("true");
  });
});
