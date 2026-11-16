import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileLinks, FilePreview } from "@/components/files/file-preview";
import {
  fileResponseHeaders,
  isPreviewable,
  wantsInline,
} from "@/lib/storage/files";

describe("file response headers", () => {
  it("serves PDFs and images inline only when asked", () => {
    expect(fileResponseHeaders("Gear Housing.pdf", true)).toMatchObject({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Gear Housing.pdf"',
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "frame-ancestors 'self'",
    });
    expect(fileResponseHeaders("photo.JPG", true)["Content-Type"]).toBe(
      "image/jpeg",
    );
    expect(fileResponseHeaders("report.pdf", false)).toMatchObject({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="report.pdf"',
    });
  });

  it("always downloads CAD, data and unsafe types", () => {
    for (const name of [
      "shaft.step",
      "plate.dxf",
      "part.dwg",
      "qc.csv",
      "x.svg",
      "x.html",
    ])
      expect(fileResponseHeaders(name, true)["Content-Disposition"]).toMatch(
        /^attachment;/,
      );
    expect(isPreviewable("a.png")).toBe(true);
    expect(isPreviewable("a.stp")).toBe(false);
  });

  it("cleans the file name and reads the inline flag", () => {
    expect(
      fileResponseHeaders('bad"name\r\n.pdf', true)["Content-Disposition"],
    ).toBe('inline; filename="bad_name__.pdf"');
    expect(wantsInline(new Request("http://x/api/qc/1/file?inline=1"))).toBe(
      true,
    );
    expect(wantsInline(new Request("http://x/api/qc/1/file"))).toBe(false);
  });
});

describe("file preview", () => {
  it("embeds a PDF with view and download actions", () => {
    const { container } = render(
      <FilePreview
        url="/api/drawings/RFQ-1/file"
        fileName="housing.pdf"
        size={2048}
      />,
    );
    expect(container.querySelector("iframe")).toHaveAttribute(
      "src",
      "/api/drawings/RFQ-1/file?inline=1",
    );
    expect(
      screen.getByRole("link", { name: "Open in new tab" }),
    ).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute(
      "href",
      "/api/drawings/RFQ-1/file",
    );
  });

  it("shows images inline and explains CAD files", () => {
    const { container, unmount } = render(
      <FilePreview url="/api/qc/QC-1/file" fileName="photo.png" size={10} />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/api/qc/QC-1/file?inline=1",
    );
    unmount();
    render(
      <FilePreview
        url="/api/drawings/RFQ-2/file"
        fileName="shaft.step"
        size={10}
      />,
    );
    expect(screen.getByText(/can.t be shown in the browser/)).toBeVisible();
    expect(screen.queryByRole("link", { name: "Open in new tab" })).toBeNull();
  });

  it("offers View only for previewable files", () => {
    const { unmount } = render(
      <FileLinks url="/api/qc/QC-1/file" fileName="r.pdf" />,
    );
    expect(screen.getByRole("link", { name: "View r.pdf" })).toHaveAttribute(
      "href",
      "/api/qc/QC-1/file?inline=1",
    );
    unmount();
    render(<FileLinks url="/api/qc/QC-2/file" fileName="m.csv" />);
    expect(screen.queryByRole("link", { name: /View/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Download m.csv" })).toBeVisible();
  });
});
