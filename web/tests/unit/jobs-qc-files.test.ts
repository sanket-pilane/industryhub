// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  MAX_QC_BYTES,
  checkQcFile,
  checkQcFileMeta,
  matchesQcSignature,
  qcExtension,
} from "@/lib/jobs/qc-files";

const bytes = (...values: number[]) => new Uint8Array(values);
const PDF = new TextEncoder().encode("%PDF-1.4 hello");
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0, 0);

describe("QC file type", () => {
  it.each(["a.pdf", "a.PNG", "a.jpg", "a.jpeg", "a.xlsx", "a.csv"])(
    "accepts %s",
    (name) => {
      expect(qcExtension(name)).not.toBeNull();
      expect(checkQcFileMeta({ name, size: 10 }).ok).toBe(true);
    },
  );

  it.each(["a.exe", "a.docx", "a.dwg", "report", "a.pdf.exe", ".pdf"])(
    "rejects %s",
    (name) => {
      const result = checkQcFileMeta({ name, size: 10 });
      expect(result).toMatchObject({ ok: false, code: "UNSUPPORTED_TYPE" });
    },
  );
});

describe("QC file size", () => {
  it("accepts exactly 20 MB", () => {
    expect(checkQcFileMeta({ name: "a.pdf", size: MAX_QC_BYTES }).ok).toBe(
      true,
    );
  });
  it("rejects anything over 20 MB", () => {
    expect(
      checkQcFileMeta({ name: "a.pdf", size: MAX_QC_BYTES + 1 }),
    ).toMatchObject({
      ok: false,
      code: "TOO_LARGE",
    });
  });
  it("rejects an empty file", () => {
    expect(checkQcFileMeta({ name: "a.pdf", size: 0 })).toMatchObject({
      ok: false,
      code: "EMPTY_FILE",
    });
  });
});

describe("QC file signature", () => {
  it("accepts matching content", () => {
    expect(checkQcFile({ name: "a.pdf", size: PDF.length, head: PDF }).ok).toBe(
      true,
    );
    expect(checkQcFile({ name: "a.png", size: 10, head: PNG }).ok).toBe(true);
    expect(checkQcFile({ name: "a.jpg", size: 10, head: JPG }).ok).toBe(true);
    expect(checkQcFile({ name: "a.jpeg", size: 10, head: JPG }).ok).toBe(true);
    expect(checkQcFile({ name: "a.xlsx", size: 10, head: ZIP }).ok).toBe(true);
    expect(
      checkQcFile({
        name: "a.csv",
        size: 10,
        head: new TextEncoder().encode("a,b\n1,2\n"),
      }).ok,
    ).toBe(true);
  });

  it("rejects content that does not match the extension", () => {
    expect(checkQcFile({ name: "a.pdf", size: 10, head: PNG })).toMatchObject({
      ok: false,
      code: "BAD_SIGNATURE",
    });
    expect(checkQcFile({ name: "a.png", size: 10, head: JPG })).toMatchObject({
      ok: false,
      code: "BAD_SIGNATURE",
    });
    expect(checkQcFile({ name: "a.jpg", size: 10, head: PDF })).toMatchObject({
      ok: false,
      code: "BAD_SIGNATURE",
    });
    expect(checkQcFile({ name: "a.xlsx", size: 10, head: PDF })).toMatchObject({
      ok: false,
      code: "BAD_SIGNATURE",
    });
    expect(matchesQcSignature("csv", bytes(0x4d, 0x5a, 0, 0))).toBe(false);
  });

  it("rejects a too-short header", () => {
    expect(matchesQcSignature("png", bytes(0x89, 0x50))).toBe(false);
    expect(matchesQcSignature("pdf", new Uint8Array())).toBe(false);
  });

  it("checks type and size before signature", () => {
    expect(checkQcFile({ name: "a.exe", size: 10, head: PDF })).toMatchObject({
      code: "UNSUPPORTED_TYPE",
    });
    expect(
      checkQcFile({ name: "a.pdf", size: MAX_QC_BYTES + 1, head: PDF }),
    ).toMatchObject({ code: "TOO_LARGE" });
  });
});
