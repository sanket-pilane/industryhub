// @vitest-environment node
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_DRAWING_BYTES,
  checkDrawingFile,
  drawingExtension,
  matchesSignature,
} from "@/lib/drawings/rules";
import type { Database } from "@/lib/db";
import { DrawingStore } from "@/lib/drawings/store";
import { FileStorage } from "@/lib/storage/files";
import { processDrawingUpload } from "@/lib/drawings/upload";
import { rfqSchema } from "@/lib/validators";
import { SEED, addCustomer, createTestDb } from "../helpers/db";

const PDF = new TextEncoder().encode("%PDF-1.7\n%drawing body\n");
const STEP = new TextEncoder().encode("ISO-10303-21;\nHEADER;\n");
const details = {
  partName: "Gear Housing",
  quantity: "25",
  material: "EN8 Steel",
  tolerance: "ISO 2768-m (medium)",
  process: "CNC milling",
  finish: "Zinc plated",
  targetDate: "2099-01-15",
  notes: "Bore H7",
  confidential: true,
};

function form(file: File | null, overrides: Record<string, string> = {}) {
  const data = new FormData();
  if (file) data.append("file", file);
  for (const [k, v] of Object.entries({
    ...details,
    confidential: "true",
    ...overrides,
  }))
    data.append(k, String(v));
  return data;
}

describe("drawing file rules", () => {
  it("accepts the five CAD formats in any letter case", () => {
    for (const name of ["a.pdf", "b.DWG", "c.dxf", "d.Step", "e.STP"])
      expect(drawingExtension(name)).not.toBeNull();
    for (const name of ["setup.exe", "photo.png", "pdf", "archive.pdf.zip"])
      expect(drawingExtension(name)).toBeNull();
  });
  it("rejects unsupported, empty and oversized files", () => {
    expect(checkDrawingFile({ name: "x.exe", size: 10 })).toMatchObject({
      code: "UNSUPPORTED_TYPE",
    });
    expect(checkDrawingFile({ name: "x.pdf", size: 0 })).toMatchObject({
      code: "EMPTY_FILE",
    });
    expect(
      checkDrawingFile({ name: "x.pdf", size: MAX_DRAWING_BYTES + 1 }),
    ).toMatchObject({ code: "TOO_LARGE" });
    expect(
      checkDrawingFile({ name: "x.pdf", size: MAX_DRAWING_BYTES }),
    ).toMatchObject({ ok: true, extension: "pdf" });
  });
  it("checks that file content matches the extension", () => {
    const enc = (s: string) => new TextEncoder().encode(s);
    expect(matchesSignature("pdf", PDF)).toBe(true);
    expect(matchesSignature("dwg", enc("AC1032\0\0"))).toBe(true);
    expect(matchesSignature("stp", STEP)).toBe(true);
    expect(matchesSignature("dxf", enc("  0\nSECTION\n  2\nHEADER"))).toBe(
      true,
    );
    expect(matchesSignature("pdf", enc("\x89PNG\r\n"))).toBe(false);
    expect(matchesSignature("step", enc("MZ executable"))).toBe(false);
  });
});

describe("RFQ details validation", () => {
  it("accepts complete details and converts the quantity to a number", () => {
    const parsed = rfqSchema.parse(details);
    expect(parsed.quantity).toBe(25);
  });
  it("rejects bad quantity, past date, missing choices and no confidentiality", () => {
    for (const patch of [
      { quantity: "0" },
      { quantity: "abc" },
      { quantity: "100001" },
      { targetDate: "2020-01-01" },
      { material: "" },
      { process: "Magic" },
      { confidential: false },
      { notes: "x".repeat(1001) },
      { partName: "A" },
    ])
      expect(rfqSchema.safeParse({ ...details, ...patch }).success).toBe(false);
  });
});

describe("drawing store and upload", () => {
  let root: string;
  let db: Database;
  let store: DrawingStore;
  let other: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "industrihub-drawings-"));
    db = createTestDb();
    store = new DrawingStore(db, new FileStorage(root));
    other = addCustomer(db, "second@test.in");
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("saves the file and request, numbering revisions per part", async () => {
    const first = await processDrawingUpload(
      form(new File([PDF], "housing-revA.pdf")),
      SEED.customer,
      store,
    );
    const second = await processDrawingUpload(
      form(new File([STEP], "housing-revB.step"), { partName: "gear housing" }),
      SEED.customer,
      store,
    );
    if (!first.ok || !second.ok) throw new Error("upload failed");
    expect(first.request).toMatchObject({
      id: "RFQ-IH-01001",
      revision: 1,
      quantity: 25,
      status: "SUBMITTED",
    });
    expect(second.request).toMatchObject({ id: "RFQ-IH-01002", revision: 2 });
    expect(await store.readFile(first.request.id)).toEqual(PDF);
    expect(await store.readFile(second.request.id)).toEqual(STEP);
    // stored under a random key, not the customer's file name
    const stored = await readdir(path.join(root, "requests"));
    expect(stored).toHaveLength(2);
    expect(stored.join()).not.toContain("housing");
    const columns = (
      db.prepare("PRAGMA table_info(manufacturing_requests)").all() as {
        name: string;
      }[]
    ).map((c) => c.name);
    expect(columns).not.toContain("confidential");
    expect(store.history(first.request.id)).toMatchObject([
      { from: null, to: "SUBMITTED", changedBy: "Srushti Shinde" },
    ]);
  });

  it("lists and returns drawings only to their owner", async () => {
    await processDrawingUpload(
      form(new File([PDF], "a.pdf")),
      SEED.customer,
      store,
    );
    const theirs = await processDrawingUpload(
      form(new File([STEP], "b.stp")),
      other,
      store,
    );
    if (!theirs.ok) throw new Error("upload failed");
    expect(await store.listForCustomer(SEED.customer)).toHaveLength(1);
    expect(
      await store.getForCustomer(SEED.customer, theirs.request.id),
    ).toBeNull();
    expect(await store.getForCustomer(other, theirs.request.id)).not.toBeNull();
  });

  it("rejects missing, unsupported, disguised and incomplete uploads", async () => {
    expect(
      await processDrawingUpload(form(null), SEED.customer, store),
    ).toMatchObject({
      status: 400,
      code: "FILE_REQUIRED",
    });
    expect(
      await processDrawingUpload(
        form(new File(["MZ"], "tool.exe")),
        SEED.customer,
        store,
      ),
    ).toMatchObject({ code: "UNSUPPORTED_TYPE" });
    expect(
      await processDrawingUpload(
        form(new File([PDF], "part.step")),
        SEED.customer,
        store,
      ),
    ).toMatchObject({ code: "INVALID_FILE" });
    const invalid = await processDrawingUpload(
      form(new File([PDF], "a.pdf"), { quantity: "0", confidential: "false" }),
      SEED.customer,
      store,
    );
    expect(invalid).toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    if (invalid.ok) throw new Error("expected failure");
    expect(Object.keys(invalid.fields ?? {})).toEqual(
      expect.arrayContaining(["quantity", "confidential"]),
    );
    expect(await store.listForCustomer(SEED.customer)).toEqual([]);
    expect(await readdir(root)).toEqual([]);
  });

  it("warns about an identical file unless the customer confirms", async () => {
    await processDrawingUpload(
      form(new File([PDF], "a.pdf")),
      SEED.customer,
      store,
    );
    const again = await processDrawingUpload(
      form(new File([PDF], "copy.pdf")),
      SEED.customer,
      store,
    );
    expect(again).toMatchObject({ status: 409, code: "DUPLICATE_DRAWING" });
    const confirmed = await processDrawingUpload(
      form(new File([PDF], "copy.pdf"), { allowDuplicate: "true" }),
      SEED.customer,
      store,
    );
    expect(confirmed).toMatchObject({ ok: true });
    // another customer uploading the same bytes is not a duplicate
    expect(
      await processDrawingUpload(form(new File([PDF], "a.pdf")), other, store),
    ).toMatchObject({ ok: true });
  });

  it("numbers requests uniquely when uploads run at the same time", async () => {
    const results = await Promise.all(
      [1, 2, 3, 4].map((n) =>
        processDrawingUpload(
          form(
            new File(
              [new TextEncoder().encode(`%PDF-1.7 part ${n}`)],
              `p${n}.pdf`,
            ),
          ),
          SEED.customer,
          store,
        ),
      ),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    const ids = (await store.listForCustomer(SEED.customer))
      .map((r) => r.id)
      .sort();
    expect(ids).toEqual([
      "RFQ-IH-01001",
      "RFQ-IH-01002",
      "RFQ-IH-01003",
      "RFQ-IH-01004",
    ]);
  });

  it("removes the stored file when the database write fails", async () => {
    const outcome = processDrawingUpload(
      form(new File([PDF], "a.pdf")),
      "USR-does-not-exist",
      store,
    );
    await expect(outcome).rejects.toThrow();
    expect(await readdir(path.join(root, "requests"))).toEqual([]);
  });
});
