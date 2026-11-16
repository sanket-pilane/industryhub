// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addressSchema } from "@/lib/orders/addresses";
import {
  financialYearLabel,
  nextInvoiceNumber,
} from "@/lib/orders/invoice-number";
import {
  EXPRESS_SHIPPING_PAISE,
  FREE_SHIPPING_THRESHOLD_PAISE,
  STANDARD_SHIPPING_PAISE,
  priceOrder,
  shippingFor,
  type PricedLineInput,
} from "@/lib/orders/pricing";
import { GSTIN_PATTERN, placeOrderSchema } from "@/lib/orders/schemas";
import { SELLER } from "@/lib/orders/seller";
import { amountInWords, numberToIndianWords } from "@/lib/orders/words";
import { createTestDb } from "../helpers/db";

const line = (over: Partial<PricedLineInput> = {}): PricedLineInput => ({
  productId: "PRD-0001",
  sku: "SKU-1",
  name: "Bearing",
  quantity: 1,
  unitPricePaise: 100_000,
  gstPercent: 18,
  ...over,
});

describe("order pricing", () => {
  it("splits tax into CGST and SGST for delivery inside Maharashtra (case-insensitive)", () => {
    const p = priceOrder({
      lines: [line({ unitPricePaise: 100_001 })], // tax 18000.18 -> 18000
      shippingState: "  maharashtra ",
      deliveryMethod: "STANDARD",
    });
    expect(p.intraState).toBe(true);
    expect(p.taxPaise).toBe(18_000);
    expect(p.cgstPaise).toBe(9_000);
    expect(p.sgstPaise).toBe(9_000);
    expect(p.igstPaise).toBe(0);
  });

  it("gives the odd paisa to SGST so CGST + SGST equals the tax", () => {
    const p = priceOrder({
      lines: [line({ unitPricePaise: 1_005 })], // 180.9 -> 181
      shippingState: "Maharashtra",
      deliveryMethod: "STANDARD",
    });
    expect(p.taxPaise).toBe(181);
    expect(p.cgstPaise).toBe(90);
    expect(p.sgstPaise).toBe(91);
    expect(p.cgstPaise + p.sgstPaise).toBe(p.taxPaise);
  });

  it("charges IGST only for delivery to another state", () => {
    const p = priceOrder({
      lines: [line()],
      shippingState: "Karnataka",
      deliveryMethod: "STANDARD",
    });
    expect(p.intraState).toBe(false);
    expect(p.igstPaise).toBe(18_000);
    expect(p.cgstPaise).toBe(0);
    expect(p.sgstPaise).toBe(0);
    expect(p.placeOfSupply).toBe("Karnataka");
  });

  it("rounds tax once per line and sums the lines", () => {
    const p = priceOrder({
      lines: [
        line({ productId: "A", unitPricePaise: 333, quantity: 1 }), // 59.94 -> 60
        line({ productId: "B", unitPricePaise: 333, quantity: 1 }), // 60
      ],
      shippingState: "Gujarat",
      deliveryMethod: "EXPRESS",
    });
    expect(p.lines.map((l) => l.taxPaise)).toEqual([60, 60]);
    expect(p.taxPaise).toBe(120);
    expect(p.subtotalPaise).toBe(666);
    expect(p.totalPaise).toBe(666 + 120 + EXPRESS_SHIPPING_PAISE);
  });

  it("makes standard shipping free at exactly the threshold and charges below it", () => {
    expect(shippingFor("STANDARD", FREE_SHIPPING_THRESHOLD_PAISE)).toBe(0);
    expect(shippingFor("STANDARD", FREE_SHIPPING_THRESHOLD_PAISE - 1)).toBe(
      STANDARD_SHIPPING_PAISE,
    );
    const above = priceOrder({
      lines: [line({ unitPricePaise: FREE_SHIPPING_THRESHOLD_PAISE })],
      shippingState: "Maharashtra",
      deliveryMethod: "STANDARD",
    });
    expect(above.shippingPaise).toBe(0);
    expect(above.totalPaise).toBe(above.subtotalPaise + above.taxPaise);
  });

  it("always charges 900 rupees for express, even above the free threshold, and does not tax shipping", () => {
    expect(EXPRESS_SHIPPING_PAISE).toBe(90_000);
    const p = priceOrder({
      lines: [line({ unitPricePaise: 5_000_000 })],
      shippingState: "Maharashtra",
      deliveryMethod: "EXPRESS",
    });
    expect(p.shippingPaise).toBe(90_000);
    expect(p.taxPaise).toBe(900_000); // 18% of goods only
    expect(p.totalPaise).toBe(5_000_000 + 900_000 + 90_000);
  });

  it("uses the seller registered in Maharashtra", () => {
    expect(SELLER.state).toBe("Maharashtra");
    expect(SELLER.gstin).toBe("27AAHCI4521K1Z8");
    expect(SELLER.gstin).toMatch(GSTIN_PATTERN);
  });
});

describe("amount in words", () => {
  it("uses Indian grouping", () => {
    expect(numberToIndianWords(0)).toBe("Zero");
    expect(numberToIndianWords(100_000)).toBe("One Lakh");
    expect(numberToIndianWords(12_345_678)).toBe(
      "One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight",
    );
    expect(amountInWords(2_535_000)).toBe(
      "Rupees Twenty-Five Thousand Three Hundred Fifty Only",
    );
    expect(amountInWords(10_050)).toBe(
      "Rupees One Hundred and Fifty Paise Only",
    );
    expect(amountInWords(1_000_000_000)).toBe("Rupees One Crore Only");
  });
});

describe("invoice numbering", () => {
  it("follows the April to March financial year in IST", () => {
    expect(financialYearLabel("2026-04-01T00:00:00+05:30")).toBe("2026-27");
    expect(financialYearLabel("2026-03-31T23:59:00+05:30")).toBe("2025-26");
    // 20:00 UTC on 31 March is already 1 April in India.
    expect(financialYearLabel("2026-03-31T20:00:00Z")).toBe("2026-27");
    expect(financialYearLabel("2027-01-15T10:00:00Z")).toBe("2026-27");
  });

  it("counts per financial year and restarts in a new one", () => {
    const db = createTestDb();
    expect(nextInvoiceNumber(db, "2026-11-16T10:00:00Z")).toBe(
      "INV/2026-27/00001",
    );
    expect(nextInvoiceNumber(db, "2027-02-01T10:00:00Z")).toBe(
      "INV/2026-27/00002",
    );
    expect(nextInvoiceNumber(db, "2027-04-02T10:00:00Z")).toBe(
      "INV/2027-28/00001",
    );
    expect(nextInvoiceNumber(db, "2027-04-03T10:00:00Z")).toBe(
      "INV/2027-28/00002",
    );
  });
});

describe("address validator", () => {
  const valid = {
    label: "Head office",
    line1: "Plot 42, MIDC Bhosari",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411026",
  };

  it("accepts a valid address and defaults line2", () => {
    const parsed = addressSchema.parse(valid);
    expect(parsed.line2).toBe("");
  });

  it("rejects bad pincodes, unknown states and missing fields", () => {
    for (const pincode of ["011026", "41102", "4110261", "41102A"])
      expect(addressSchema.safeParse({ ...valid, pincode }).success).toBe(
        false,
      );
    expect(
      addressSchema.safeParse({ ...valid, state: "Atlantis" }).success,
    ).toBe(false);
    expect(addressSchema.safeParse({ ...valid, line1: "   " }).success).toBe(
      false,
    );
    expect(addressSchema.safeParse({ ...valid, label: "" }).success).toBe(
      false,
    );
    expect(addressSchema.safeParse({ ...valid, city: "" }).success).toBe(false);
  });

  it("accepts union territories", () => {
    expect(addressSchema.safeParse({ ...valid, state: "Delhi" }).success).toBe(
      true,
    );
    expect(addressSchema.safeParse({ ...valid, state: "Ladakh" }).success).toBe(
      true,
    );
  });
});

describe("place-order body", () => {
  const body = {
    items: [{ productId: "PRD-0001", quantity: 2 }],
    addressId: "ADR-0001",
    deliveryMethod: "STANDARD",
    payment: { method: "UPI", testOutcome: "success" },
  };

  it("validates the optional GSTIN and normalises case", () => {
    expect(
      placeOrderSchema.parse({ ...body, billingGstin: "27abcde1234f1z5" })
        .billingGstin,
    ).toBe("27ABCDE1234F1Z5");
    expect(
      placeOrderSchema.parse({ ...body, billingGstin: "" }).billingGstin,
    ).toBe("");
    expect(
      placeOrderSchema.safeParse({ ...body, billingGstin: "NOT-A-GSTIN" })
        .success,
    ).toBe(false);
    expect(placeOrderSchema.safeParse(body).success).toBe(true);
  });

  it("rejects empty carts, bad quantities and unknown payment methods", () => {
    expect(placeOrderSchema.safeParse({ ...body, items: [] }).success).toBe(
      false,
    );
    expect(
      placeOrderSchema.safeParse({
        ...body,
        items: [{ productId: "PRD-0001", quantity: 0 }],
      }).success,
    ).toBe(false);
    expect(
      placeOrderSchema.safeParse({
        ...body,
        items: [{ productId: "PRD-0001", quantity: 1.5 }],
      }).success,
    ).toBe(false);
    expect(
      placeOrderSchema.safeParse({
        ...body,
        payment: { method: "CASH", testOutcome: "success" },
      }).success,
    ).toBe(false);
  });
});
