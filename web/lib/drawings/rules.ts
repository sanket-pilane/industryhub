/** File rules shared by the upload form (browser) and the upload API (server). */
export const DRAWING_EXTENSIONS = ["pdf", "dwg", "dxf", "step", "stp"] as const;
export type DrawingExtension = (typeof DRAWING_EXTENSIONS)[number];
export const MAX_DRAWING_BYTES = 50 * 1024 * 1024;
export const DRAWING_ACCEPT = DRAWING_EXTENSIONS.map((e) => `.${e}`).join(",");

export type FileCheck =
  | { ok: true; extension: DrawingExtension }
  | {
      ok: false;
      code: "UNSUPPORTED_TYPE" | "TOO_LARGE" | "EMPTY_FILE";
      message: string;
    };

export function drawingExtension(name: string): DrawingExtension | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return name.includes(".") &&
    (DRAWING_EXTENSIONS as readonly string[]).includes(ext)
    ? (ext as DrawingExtension)
    : null;
}

export function checkDrawingFile(file: {
  name: string;
  size: number;
}): FileCheck {
  const extension = drawingExtension(file.name);
  if (!extension)
    return {
      ok: false,
      code: "UNSUPPORTED_TYPE",
      message: "Upload a PDF, DWG, DXF, STEP or STP drawing.",
    };
  if (file.size === 0)
    return { ok: false, code: "EMPTY_FILE", message: "The file is empty." };
  if (file.size > MAX_DRAWING_BYTES)
    return {
      ok: false,
      code: "TOO_LARGE",
      message: `The file is larger than ${MAX_DRAWING_BYTES / 1024 / 1024} MB.`,
    };
  return { ok: true, extension };
}

/**
 * Checks that the file content matches its extension, so a renamed
 * executable or image cannot be stored as a drawing.
 */
export function matchesSignature(
  extension: DrawingExtension,
  head: Uint8Array,
): boolean {
  const text = new TextDecoder("latin1").decode(head.subarray(0, 1024));
  switch (extension) {
    case "pdf":
      return text.startsWith("%PDF-");
    case "dwg":
      return /^AC10\d\d/.test(text);
    case "step":
    case "stp":
      return text.trimStart().startsWith("ISO-10303-21");
    case "dxf":
      return /^\s*0\s*\r?\n\s*SECTION/.test(text) || /^\s*999/.test(text);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
