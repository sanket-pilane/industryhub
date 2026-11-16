import type { DatabaseSync } from "node:sqlite";
import type { Order, OrderItem, Payment } from "../../../shared/contracts";
import type { OrderStatus, PaymentStatus } from "../../../shared/enums";
import { notFound } from "@/lib/repositories/errors";

export interface OrderHistoryEntry {
  id: number;
  status: OrderStatus;
  comment: string;
  changedBy: string;
  /** Display name of the person who made the change ("System" if unknown). */
  changedByName: string;
  changedAt: string;
}
export interface OrderCustomer {
  id: string;
  name: string;
  companyName: string;
  email: string;
  gstin: string;
}
export interface OrderDetail extends Order {
  payments: Payment[];
  history: OrderHistoryEntry[];
  customer: OrderCustomer;
  updatedAt: string;
}
export interface OrderSummaryRow {
  id: string;
  customerId: string;
  customerName: string;
  companyName: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalPaise: number;
  itemCount: number;
  createdAt: string;
}

type OrderRow = {
  id: string;
  customer_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  shipping_paise: number;
  total_paise: number;
  shipping_address: string;
  billing_gstin: string;
  delivery_method: string;
  courier: string;
  tracking_number: string;
  invoice_number: string | null;
  created_at: string;
  updated_at: string;
};

export function loadOrderRow(db: DatabaseSync, id: string) {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as
    OrderRow | undefined;
}

/** Full order with items, payments, history and customer. Throws NOT_FOUND. */
export function getOrder(db: DatabaseSync, id: string): OrderDetail {
  const row = loadOrderRow(db, id);
  if (!row) throw notFound("Order");
  const items = (
    db
      .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id")
      .all(id) as {
      product_id: string;
      sku: string;
      name: string;
      quantity: number;
      unit_price_paise: number;
      gst_percent: number;
      tax_paise: number;
      total_paise: number;
    }[]
  ).map((i): OrderItem => ({
    productId: i.product_id,
    sku: i.sku,
    name: i.name,
    quantity: i.quantity,
    unitPricePaise: i.unit_price_paise,
    gstPercent: i.gst_percent,
    taxPaise: i.tax_paise,
    totalPaise: i.total_paise,
  }));
  const payments = (
    db
      .prepare(
        "SELECT * FROM payments WHERE order_id = ? ORDER BY created_at, rowid",
      )
      .all(id) as {
      id: string;
      customer_id: string;
      order_id: string | null;
      quotation_id: string | null;
      provider: string;
      provider_reference: string;
      amount_paise: number;
      status: PaymentStatus;
      created_at: string;
    }[]
  ).map((p): Payment => ({
    id: p.id,
    customerId: p.customer_id,
    orderId: p.order_id,
    quotationId: p.quotation_id,
    provider: p.provider,
    providerReference: p.provider_reference,
    amountPaise: p.amount_paise,
    status: p.status,
    createdAt: p.created_at,
  }));
  const history = (
    db
      .prepare(
        `SELECT h.id, h.status, h.comment, h.changed_by, h.changed_at,
                u.first_name, u.last_name
           FROM order_status_history h LEFT JOIN users u ON u.id = h.changed_by
          WHERE h.order_id = ? ORDER BY h.id`,
      )
      .all(id) as {
      id: number;
      status: OrderStatus;
      comment: string;
      changed_by: string;
      changed_at: string;
      first_name: string | null;
      last_name: string | null;
    }[]
  ).map((h): OrderHistoryEntry => ({
    id: h.id,
    status: h.status,
    comment: h.comment,
    changedBy: h.changed_by,
    changedByName: h.first_name
      ? `${h.first_name} ${h.last_name ?? ""}`.trim()
      : "System",
    changedAt: h.changed_at,
  }));
  const customer = db
    .prepare(
      "SELECT id, first_name, last_name, company_name, email, gstin FROM users WHERE id = ?",
    )
    .get(row.customer_id) as {
    id: string;
    first_name: string;
    last_name: string;
    company_name: string;
    email: string;
    gstin: string;
  };
  return {
    id: row.id,
    customerId: row.customer_id,
    status: row.status,
    paymentStatus: row.payment_status,
    items,
    subtotalPaise: row.subtotal_paise,
    cgstPaise: row.cgst_paise,
    sgstPaise: row.sgst_paise,
    igstPaise: row.igst_paise,
    shippingPaise: row.shipping_paise,
    totalPaise: row.total_paise,
    shippingAddress: JSON.parse(
      row.shipping_address,
    ) as Order["shippingAddress"],
    billingGstin: row.billing_gstin,
    deliveryMethod: row.delivery_method,
    courier: row.courier,
    trackingNumber: row.tracking_number,
    invoiceNumber: row.invoice_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payments,
    history,
    customer: {
      id: customer.id,
      name: `${customer.first_name} ${customer.last_name}`.trim(),
      companyName: customer.company_name,
      email: customer.email,
      gstin: customer.gstin,
    },
  };
}

/** An order the customer owns. Another customer's order is reported as not found. */
export function getOrderForCustomer(
  db: DatabaseSync,
  id: string,
  customerId: string,
) {
  const order = getOrder(db, id);
  if (order.customerId !== customerId) throw notFound("Order");
  return order;
}

function summaries(
  db: DatabaseSync,
  where: string,
  params: string[],
): OrderSummaryRow[] {
  const rows = db
    .prepare(
      `SELECT o.id, o.customer_id, o.status, o.payment_status, o.total_paise, o.created_at,
              u.first_name, u.last_name, u.company_name,
              (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count
         FROM orders o JOIN users u ON u.id = o.customer_id
        ${where} ORDER BY o.created_at DESC, o.id DESC`,
    )
    .all(...params) as {
    id: string;
    customer_id: string;
    status: OrderStatus;
    payment_status: PaymentStatus;
    total_paise: number;
    created_at: string;
    first_name: string;
    last_name: string;
    company_name: string;
    item_count: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    customerId: r.customer_id,
    customerName: `${r.first_name} ${r.last_name}`.trim(),
    companyName: r.company_name,
    status: r.status,
    paymentStatus: r.payment_status,
    totalPaise: r.total_paise,
    itemCount: r.item_count,
    createdAt: r.created_at,
  }));
}

export function listOrdersForCustomer(db: DatabaseSync, customerId: string) {
  return summaries(db, "WHERE o.customer_id = ?", [customerId]);
}

export function listAllOrders(db: DatabaseSync, status?: OrderStatus) {
  return status
    ? summaries(db, "WHERE o.status = ?", [status])
    : summaries(db, "", []);
}
