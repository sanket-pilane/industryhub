/** File rules for QC documents, shared by the upload form (browser) and the API (server). */
export const QC_EXTENSIONS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "xlsx",
  "csv",
] as const;
export type QcExtension = (typeof QC_EXTENSIONS)[number];
export const MAX_QC_BYTES = 20 * 1024 * 1024;
export const QC_ACCEPT = QC_EXTENSIONS.map((e) => `.${e}`).join(",");

export type QcFileCheck =
  | { ok: true; extension: QcExtension }
  | {
      ok: false;
      code: "UNSUPPORTED_TYPE" | "TOO_LARGE" | "EMPTY_FILE" | "BAD_SIGNATURE";
      message: string;
    };

export function qcExtension(name: string): QcExtension | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return name.lastIndexOf(".") > 0 &&
    (QC_EXTENSIONS as readonly string[]).includes(ext)
    ? (ext as QcExtension)
    : null;
}

/** Checks name and size; usable in the browser before the file is read. */
export function checkQcFileMeta(file: {
  name: string;
  size: number;
}): QcFileCheck {
  const extension = qcExtension(file.name);
  if (!extension)
    return {
      ok: false,
      code: "UNSUPPORTED_TYPE",
      message: "Upload a PDF, PNG, JPG, XLSX or CSV file.",
    };
  if (file.size === 0)
    return { ok: false, code: "EMPTY_FILE", message: "The file is empty." };
  if (file.size > MAX_QC_BYTES)
    return {
      ok: false,
      code: "TOO_LARGE",
      message: `The file is larger than ${MAX_QC_BYTES / 1024 / 1024} MB.`,
    };
  return { ok: true, extension };
}

const startsWith = (head: Uint8Array, bytes: number[]) =>
  head.length >= bytes.length && bytes.every((b, i) => head[i] === b);

/** True when the leading bytes match what the extension claims to be. */
export function matchesQcSignature(
  extension: QcExtension,
  head: Uint8Array,
): boolean {
  switch (extension) {
    case "pdf":
      return startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    case "png":
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
    case "jpeg":
      return startsWith(head, [0xff, 0xd8, 0xff]);
    case "xlsx":
      return startsWith(head, [0x50, 0x4b, 0x03, 0x04]); // zip container
    case "csv":
      return !head.subarray(0, 1024).includes(0); // plain text has no NUL bytes
  }
}

/** Full server-side check: type, size and content signature. */
export function checkQcFile(file: {
  name: string;
  size: number;
  head: Uint8Array;
}): QcFileCheck {
  const meta = checkQcFileMeta(file);
  if (!meta.ok) return meta;
  if (!matchesQcSignature(meta.extension, file.head))
    return {
      ok: false,
      code: "BAD_SIGNATURE",
      message: `The file content does not look like a ${meta.extension.toUpperCase()} file.`,
    };
  return meta;
}
