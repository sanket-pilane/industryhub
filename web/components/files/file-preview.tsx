/* eslint-disable @next/next/no-img-element -- private files are served by our own route, not next/image */
import { formatBytes } from "@/lib/drawings/rules";
import { fileExtensionOf, isPreviewable } from "@/lib/storage/files";

const CAD_HINT: Record<string, string> = {
  dwg: "AutoCAD or a DWG viewer",
  dxf: "any CAD program or DXF viewer",
  step: "a 3D CAD program (SolidWorks, Fusion 360, FreeCAD)",
  stp: "a 3D CAD program (SolidWorks, Fusion 360, FreeCAD)",
  csv: "Excel or any spreadsheet program",
  xlsx: "Excel or any spreadsheet program",
};

/** "View" (opens PDFs and images in a new tab) and "Download" links. */
export function FileLinks({
  url,
  fileName,
}: {
  url: string;
  fileName: string;
}) {
  return (
    <span className="file-links">
      {isPreviewable(fileName) && (
        <a
          className="table-link"
          href={`${url}?inline=1`}
          target="_blank"
          rel="noopener"
          aria-label={`View ${fileName}`}
        >
          View
        </a>
      )}
      <a
        className="table-link"
        href={url}
        download={fileName}
        aria-label={`Download ${fileName}`}
      >
        Download
      </a>
    </span>
  );
}

/**
 * Shows an uploaded file on the page: PDFs in an embedded viewer, images
 * inline, and CAD or data files as a card that explains how to open them.
 */
export function FilePreview({
  url,
  fileName,
  size,
  title = "File preview",
  open = true,
}: {
  url: string;
  fileName: string;
  size: number;
  title?: string;
  open?: boolean;
}) {
  const ext = fileExtensionOf(fileName);
  const inlineUrl = `${url}?inline=1`;
  return (
    <details className="file-preview" open={open}>
      <summary>
        <span className="file-preview-ext" aria-hidden="true">
          {ext.toUpperCase()}
        </span>
        <span className="file-preview-name">
          <strong>{fileName}</strong>
          <small>{formatBytes(size)}</small>
        </span>
        <span className="file-preview-toggle">{title}</span>
      </summary>
      <div className="file-preview-body">
        {ext === "pdf" ? (
          <iframe
            src={inlineUrl}
            title={`${title}: ${fileName}`}
            loading="lazy"
          />
        ) : isPreviewable(fileName) ? (
          <img src={inlineUrl} alt={`${title}: ${fileName}`} loading="lazy" />
        ) : (
          <p className="file-preview-note">
            {ext.toUpperCase()} files can&apos;t be shown in the browser.
            Download the file and open it in{" "}
            {CAD_HINT[ext] ?? "a suitable program"}.
          </p>
        )}
        <div className="file-preview-actions">
          {isPreviewable(fileName) && (
            <a
              className="button button-secondary"
              href={inlineUrl}
              target="_blank"
              rel="noopener"
            >
              Open in new tab
            </a>
          )}
          <a className="button button-secondary" href={url} download={fileName}>
            Download
          </a>
        </div>
      </div>
    </details>
  );
}
