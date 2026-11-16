import { lineTotal } from "@/lib/utils/money";
import { SELLER } from "./seller";

export const DELIVERY_METHODS = ["STANDARD", "EXPRESS"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

/** Standard delivery is free when goods come to ₹25,000 or more (in paise). */
export const FREE_SHIPPING_THRESHOLD_PAISE = 2_500_000;
export const STANDARD_SHIPPING_PAISE = 35_000;
export const EXPRESS_SHIPPING_PAISE = 90_000;

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  STANDARD: "Standard delivery",
  EXPRESS: "Express delivery",
};

export interface PricedLineInput {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPricePaise: number;
  gstPercent: number;
}
export interface PricedLine extends PricedLineInput {
  /** Taxable value of the line (unit price x quantity). */
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
}
export interface OrderPricing {
  lines: PricedLine[];
  subtotalPaise: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  shippingPaise: number;
  totalPaise: number;
  /** True when the supply is within the seller's state (CGST + SGST). */
  intraState: boolean;
  placeOfSupply: string;
}

const sameState = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** True when goods ship to the seller state (CGST + SGST apply). */
export const isIntraState = (shippingState: string) =>
  sameState(shippingState, SELLER.state);

/**
 * Shipping is charged as a separate line and, as a deliberate simplification,
 * is not taxed. A production ledger would apply GST to freight at the rate of
 * the goods; here it is shown outside the tax base.
 */
export function shippingFor(
  deliveryMethod: DeliveryMethod,
  goodsSubtotalPaise: number,
) {
  if (deliveryMethod === "EXPRESS") return EXPRESS_SHIPPING_PAISE;
  return goodsSubtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE
    ? 0
    : STANDARD_SHIPPING_PAISE;
}

/**
 * Pure order pricing from authoritative line data. Tax is rounded once per
 * line (lineTotal); the order's tax is then split CGST/SGST for a delivery
 * inside Maharashtra and charged as IGST everywhere else.
 */
export function priceOrder(input: {
  lines: PricedLineInput[];
  shippingState: string;
  deliveryMethod: DeliveryMethod;
}): OrderPricing {
  const lines = input.lines.map((line) => ({
    ...line,
    ...lineTotal(line.unitPricePaise, line.quantity, line.gstPercent),
  }));
  const subtotalPaise = lines.reduce((sum, l) => sum + l.subtotalPaise, 0);
  const taxPaise = lines.reduce((sum, l) => sum + l.taxPaise, 0);
  const intraState = isIntraState(input.shippingState);
  const cgstPaise = intraState ? Math.floor(taxPaise / 2) : 0;
  const sgstPaise = intraState ? taxPaise - cgstPaise : 0;
  const igstPaise = intraState ? 0 : taxPaise;
  const shippingPaise = shippingFor(input.deliveryMethod, subtotalPaise);
  return {
    lines,
    subtotalPaise,
    taxPaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    shippingPaise,
    totalPaise: subtotalPaise + taxPaise + shippingPaise,
    intraState,
    placeOfSupply: input.shippingState,
  };
}
