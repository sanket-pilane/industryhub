import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { UserProfile } from "../../../shared/contracts";
import { recordAudit } from "@/lib/audit";
import { nextNumber, transaction } from "@/lib/db";
import {
  getPaymentGateway,
  type PaymentGateway,
  type PaymentResult,
} from "@/lib/payments/gateway";
import { RepositoryError } from "@/lib/repositories/errors";
import { getOwnAddress } from "./addresses";
import { nextInvoiceNumber } from "./invoice-number";
import { encodeProvider } from "./providers";
import { priceOrder, type OrderPricing, type PricedLineInput } from "./pricing";
import { getOrderForCustomer, loadOrderRow, type OrderDetail } from "./queries";
import type { PaymentInput, PlaceOrderInput, QuoteInput } from "./schemas";
import { addOrderHistory, cancelOrder } from "./status";

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  price_paise: number;
  gst_percent: number;
  stock_quantity: number;
  is_active: number;
};

/** Duplicate product lines are merged by summing their quantities. */
export function mergeLines(items: { productId: string; quantity: number }[]) {
  const merged = new Map<string, number>();
  for (const item of items)
    merged.set(
      item.productId,
      (merged.get(item.productId) ?? 0) + item.quantity,
    );
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

/**
 * Reads authoritative price, GST and stock from the database. Prices sent by
 * the client are never used. Throws 409 naming the product when it is
 * unavailable or stock does not cover the quantity.
 */
export function resolveLines(
  db: DatabaseSync,
  items: { productId: string; quantity: number }[],
): PricedLineInput[] {
  const lookup = db.prepare("SELECT * FROM products WHERE id = ?");
  return mergeLines(items).map(({ productId, quantity }) => {
    const product = lookup.get(productId) as ProductRow | undefined;
    if (!product)
      throw new RepositoryError(
        "PRODUCT_UNAVAILABLE",
        "A product in your cart is no longer in the catalog. Remove it and try again.",
        409,
      );
    if (!product.is_active)
      throw new RepositoryError(
        "PRODUCT_UNAVAILABLE",
        `${product.name} is no longer available. Remove it from your cart to continue.`,
        409,
      );
    if (product.stock_quantity < quantity)
      throw new RepositoryError(
        "INSUFFICIENT_STOCK",
        product.stock_quantity === 0
          ? `${product.name} is out of stock. Remove it from your cart to continue.`
          : `Only ${product.stock_quantity} unit${product.stock_quantity === 1 ? "" : "s"} of ${product.name} in stock; you asked for ${quantity}. Reduce the quantity to continue.`,
        409,
      );
    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      quantity,
      unitPricePaise: product.price_paise,
      gstPercent: product.gst_percent,
    };
  });
}

/** Server-side price quote for a cart. Creates nothing. */
export function quoteOrder(
  db: DatabaseSync,
  customerId: string,
  input: QuoteInput,
): OrderPricing {
  const address = getOwnAddress(db, customerId, input.addressId);
  return priceOrder({
    lines: resolveLines(db, input.items),
    shippingState: address.state,
    deliveryMethod: input.deliveryMethod,
  });
}

function createOrder(
  db: DatabaseSync,
  customer: UserProfile,
  input: PlaceOrderInput,
): { orderId: string; totalPaise: number } {
  return transaction(db, () => {
    const address = getOwnAddress(db, customer.id, input.addressId);
    const pricing = priceOrder({
      lines: resolveLines(db, input.items),
      shippingState: address.state,
      deliveryMethod: input.deliveryMethod,
    });
    const orderId = nextNumber(db, "ORDER", "ORD-IH-", 1000);
    const at = new Date().toISOString();
    const billingGstin = input.billingGstin || customer.gstin;
    const snapshot = {
      label: address.label,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
    };
    db.prepare(
      `INSERT INTO orders (id, customer_id, status, payment_status, subtotal_paise, cgst_paise,
         sgst_paise, igst_paise, shipping_paise, total_paise, shipping_address, billing_gstin,
         delivery_method, created_at, updated_at)
       VALUES (?, ?, 'CONFIRMED', 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      orderId,
      customer.id,
      pricing.subtotalPaise,
      pricing.cgstPaise,
      pricing.sgstPaise,
      pricing.igstPaise,
      pricing.shippingPaise,
      pricing.totalPaise,
      JSON.stringify(snapshot),
      billingGstin,
      input.deliveryMethod,
      at,
      at,
    );
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, sku, name, quantity, unit_price_paise,
         gst_percent, tax_paise, total_paise) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const reserve = db.prepare(
      "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?",
    );
    for (const line of pricing.lines) {
      insertItem.run(
        orderId,
        line.productId,
        line.sku,
        line.name,
        line.quantity,
        line.unitPricePaise,
        line.gstPercent,
        line.taxPaise,
        line.totalPaise,
      );
      const result = reserve.run(line.quantity, line.productId, line.quantity);
      if (Number(result.changes) !== 1)
        throw new RepositoryError(
          "INSUFFICIENT_STOCK",
          `${line.name} no longer has enough stock. Reduce the quantity to continue.`,
          409,
        );
    }
    addOrderHistory(
      db,
      orderId,
      "CONFIRMED",
      customer.id,
      "Order placed. Awaiting payment.",
    );
    return { orderId, totalPaise: pricing.totalPaise };
  });
}

async function runGateway(
  gateway: PaymentGateway,
  order: { id: string; totalPaise: number },
  payment: PaymentInput,
): Promise<PaymentResult> {
  try {
    return await gateway.pay({
      amountPaise: order.totalPaise,
      reference: order.id,
      method: payment.method,
      testOutcome: payment.testOutcome,
    });
  } catch (error) {
    console.error("Payment gateway error", error);
    return { status: "FAILED", provider: gateway.name, providerReference: "" };
  }
}

/** Stores the attempt and applies its result to the order, in one transaction. */
function recordPaymentResult(
  db: DatabaseSync,
  customerId: string,
  order: { id: string; totalPaise: number },
  payment: PaymentInput,
  result: PaymentResult,
) {
  transaction(db, () => {
    const row = loadOrderRow(db, order.id);
    if (!row) return;
    const at = new Date().toISOString();
    db.prepare(
      `INSERT INTO payments (id, customer_id, order_id, quotation_id, provider, provider_reference,
         amount_paise, status, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
    ).run(
      `PAY-${randomUUID().slice(0, 8).toUpperCase()}`,
      customerId,
      order.id,
      encodeProvider(result.provider, payment.method),
      result.providerReference,
      order.totalPaise,
      result.status,
      at,
    );
    const alreadyPaid = row.payment_status === "PAID";
    const closed = row.status === "CANCELLED";

    if (result.status === "PAID") {
      if (alreadyPaid || closed) {
        addOrderHistory(
          db,
          order.id,
          row.status,
          customerId,
          `A further payment (${result.providerReference}) was captured on an order that does not need it: a refund is due.`,
        );
      } else {
        const invoiceNumber = nextInvoiceNumber(db, at);
        db.prepare(
          "UPDATE orders SET payment_status = 'PAID', invoice_number = ?, updated_at = ? WHERE id = ?",
        ).run(invoiceNumber, at, order.id);
        addOrderHistory(
          db,
          order.id,
          row.status,
          customerId,
          `Payment received (${result.providerReference}). Invoice ${invoiceNumber} issued.`,
        );
      }
    } else if (result.status === "CANCELLED") {
      if (!alreadyPaid && !closed)
        cancelOrder(
          db,
          order.id,
          customerId,
          "Payment was cancelled, so the order was cancelled.",
        );
    } else if (!alreadyPaid && !closed) {
      db.prepare(
        "UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?",
      ).run(result.status, at, order.id);
      addOrderHistory(
        db,
        order.id,
        row.status,
        customerId,
        result.status === "FAILED"
          ? "Payment failed. Stock is held for you; retry the payment from this page."
          : "Payment is pending confirmation. You can retry from this page.",
      );
    }
    recordAudit(db, {
      actorId: customerId,
      action: "ORDER_PAYMENT",
      entityType: "ORDER",
      entityId: order.id,
      detail:
        `${payment.method} ${result.status} ${result.providerReference}`.trim(),
    });
  });
}

export interface OrderPaymentOutcome {
  order: OrderDetail;
  payment: { status: PaymentResult["status"]; providerReference: string };
}

/**
 * Places an order for a customer. The order, its items, stock reservation and
 * history are committed first; the gateway is then called and its result is
 * recorded in a second transaction. An unpaid order is never marked paid.
 */
export async function placeOrder(
  db: DatabaseSync,
  customer: UserProfile,
  input: PlaceOrderInput,
  gateway: PaymentGateway = getPaymentGateway(),
): Promise<OrderPaymentOutcome> {
  const created = createOrder(db, customer, input);
  const order = { id: created.orderId, totalPaise: created.totalPaise };
  const result = await runGateway(gateway, order, input.payment);
  recordPaymentResult(db, customer.id, order, input.payment, result);
  return {
    order: getOrderForCustomer(db, created.orderId, customer.id),
    payment: {
      status: result.status,
      providerReference: result.providerReference,
    },
  };
}

/** Pays (or retries paying) an order the customer owns. Paid or cancelled orders return 409. */
export async function payOrder(
  db: DatabaseSync,
  customer: UserProfile,
  orderId: string,
  payment: PaymentInput,
  gateway: PaymentGateway = getPaymentGateway(),
): Promise<OrderPaymentOutcome> {
  const order = getOrderForCustomer(db, orderId, customer.id);
  if (order.paymentStatus === "PAID")
    throw new RepositoryError(
      "ALREADY_PAID",
      "This order has already been paid.",
      409,
    );
  if (order.status === "CANCELLED")
    throw new RepositoryError(
      "ORDER_CANCELLED",
      "This order was cancelled and cannot be paid.",
      409,
    );
  const result = await runGateway(gateway, order, payment);
  recordPaymentResult(db, customer.id, order, payment, result);
  return {
    order: getOrderForCustomer(db, orderId, customer.id),
    payment: {
      status: result.status,
      providerReference: result.providerReference,
    },
  };
}
