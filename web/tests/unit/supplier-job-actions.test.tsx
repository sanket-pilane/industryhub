import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DispatchForm,
  ProgressForm,
  QcUploadForm,
} from "@/components/operations/supplier-job-actions";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

const fetchMock = vi.fn();
const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const ok = (data: unknown = {}) => ({
  success: true,
  data,
  error: null,
  meta: {},
});

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("progress form", () => {
  it("blocks a decrease and an out-of-range value without calling the API", () => {
    render(<ProgressForm jobId="JOB-IH-01001" current={40} />);
    fireEvent.change(screen.getByLabelText("Progress (%)"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("Remarks"), {
      target: { value: "x" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Post progress update" }),
    );
    expect(screen.getByText(/cannot go down/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Progress (%)"), {
      target: { value: "100" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Post progress update" }),
    );
    expect(
      screen.getByText("Enter a whole number from 0 to 99."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a valid update and refreshes the page", async () => {
    fetchMock.mockReturnValue(reply(ok({ progressPercent: 55 })));
    render(<ProgressForm jobId="JOB-IH-01001" current={40} />);
    fireEvent.change(screen.getByLabelText("Progress (%)"), {
      target: { value: "55" },
    });
    fireEvent.change(screen.getByLabelText("Remarks"), {
      target: { value: "Milling done" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Post progress update" }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/jobs/JOB-IH-01001/progress");
    expect(JSON.parse(String(init.body))).toEqual({
      progressPercent: 55,
      remarks: "Milling done",
    });
  });

  it("shows the server error", async () => {
    fetchMock.mockReturnValue(
      reply(
        {
          success: false,
          data: null,
          error: {
            code: "INVALID_STATE",
            message: "Job is not in production.",
          },
        },
        409,
      ),
    );
    render(<ProgressForm jobId="JOB-IH-01001" current={0} />);
    fireEvent.change(screen.getByLabelText("Remarks"), {
      target: { value: "x" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Post progress update" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Job is not in production.",
    );
  });
});

describe("QC upload form", () => {
  it("rejects an unsupported file as soon as it is chosen", () => {
    render(<QcUploadForm jobId="JOB-IH-01001" resubmit={false} />);
    fireEvent.change(screen.getByLabelText("QC document"), {
      target: { files: [new File(["MZ"], "setup.exe")] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Upload a PDF, PNG, JPG, XLSX or CSV file.",
    );
  });

  it("requires a file and remarks", () => {
    render(<QcUploadForm jobId="JOB-IH-01001" resubmit={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit for QC" }));
    expect(screen.getByText("Attach a QC document.")).toBeInTheDocument();
    expect(
      screen.getByText("Add remarks for the QC document."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends multipart form data", async () => {
    fetchMock.mockReturnValue(reply(ok({ id: "QC-IH-01001" })));
    render(<QcUploadForm jobId="JOB-IH-01001" resubmit />);
    fireEvent.change(screen.getByLabelText("QC document"), {
      target: {
        files: [
          new File(["%PDF-1.7"], "report.pdf", { type: "application/pdf" }),
        ],
      },
    });
    fireEvent.change(screen.getByLabelText("Remarks"), {
      target: { value: "Measured" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resubmit for QC" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/jobs/JOB-IH-01001/qc");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("remarks")).toBe("Measured");
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
  });
});

describe("dispatch form", () => {
  it("requires courier and tracking number", () => {
    render(<DispatchForm jobId="JOB-IH-01001" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark as dispatched" }));
    expect(screen.getByText("Enter the courier name.")).toBeInTheDocument();
    expect(screen.getByText("Enter the tracking number.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
