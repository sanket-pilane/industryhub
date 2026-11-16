// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { findUserById } from "@/lib/auth/accounts";
import type { Database } from "@/lib/db";
import { transaction } from "@/lib/db";
import {
  createAddress,
  getOwnAddress,
  listAddresses,
} from "@/lib/orders/addresses";
import {
  getOrder,
  getOrderForCustomer,
  listAllOrders,
  listOrdersForCustomer,
} from "@/lib/orders/queries";
import type { PaymentInput, PlaceOrderInput } from "@/lib/orders/schemas";
import { payOrder, placeOrder, quoteOrder } from "@/lib/orders/service";
import { transitionOrder } from "@/lib/orders/status";
import { TestModeGateway } from "@/lib/payments/gateway";
import { TransitionError } from "@/lib/manufacturing/status";
import { RepositoryError } from "@/lib/repositories/errors";
import { SEED, addCustomer, createTestDb } from "../helpers/db";

const gateway = new TestModeGateway();
const P1 = "PRD-0001"; // 485.00, GST 18%
const P2 = "PRD-0002"; // 1,280.00, GST 18%
const SOLENOID = "PRD-0011"; // stock 0

let db: Database;
const customer = () => findUserById(db, SEED.customer)!;
const stock = (id: string) =>
  (
    db
      .prepare("SELECT stock_quantity AS s FROM products WHERE id = ?")
      .get(id) as { s: number }
  ).s;

const pay = (
  testOutcome: PaymentInput["testOutcome"] = "success",
): PaymentInput => ({
  method: "UPI",
  testOutcome,
});
const order = (over: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  items: [{ productId: P1, quantity: 2 }],
  addressId: "ADR-0001",
  deliveryMethod: "STANDARD",
  payment: pay(),
  ...over,
});

beforeEach(() => {
  db = createTestDb();
});

describe("quote", () => {
  it("prices from the database, creates nothing and merges duplicate lines", () => {
    const before = stock(P1);
    const q = quoteOrder(db, SEED.customer, {
      items: [
        { productId: P1, quantity: 1 },
        { productId: P1, quantity: 1 },
      ],
      addressId: "ADR-0001",
      deliveryMethod: "STANDARD",
    });
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0].quantity).toBe(2);
    expect(q.subtotalPaise).toBe(97_000);
    expect(q.taxPaise).toBe(17_460);
    expect(q.cgstPaise + q.sgstPaise).toBe(17_460);
    expect(q.shippingPaise).toBe(35_000);
    expect(q.totalPaise).toBe(97_000 + 17_460 + 35_000);
    expect(stock(P1)).toBe(before);
    expect(listOrdersForCustomer(db, SEED.customer)).toHaveLength(0);
  });

  it("uses IGST for an out-of-state address and refuses another customer's address", () => {
    const address = createAddress(db, SEED.customer, {
      label: "Plant 2",
      line1: "Peenya",
      line2: "",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560058",
    });
    const q = quoteOrder(db, SEED.customer, {
      items: [{ productId: P1, quantity: 1 }],
      addressId: address.id,
      deliveryMethod: "EXPRESS",
    });
    expect(q.igstPaise).toBe(q.taxPaise);
    expect(q.cgstPaise).toBe(0);
    expect(q.shippingPaise).toBe(90_000);

    const other = addCustomer(db, "other@example.in");
    expect(() =>
      quoteOrder(db, other, {
        items: [{ productId: P1, quantity: 1 }],
        addressId: address.id,
        deliveryMethod: "STANDARD",
      }),
    ).toThrow(RepositoryError);
  });
});

describe("addresses", () => {
  it("makes the first address the default and lists only the owner's", () => {
    const other = addCustomer(db, "newbie@example.in");
    const input = {
      label: "Works",
      line1: "Plot 1",
      line2: "",
      city: "Nashik",
      state: "Maharashtra" as const,
      pincode: "422010",
    };
    const first = createAddress(db, other, input);
    const second = createAddress(db, other, { ...input, label: "Store" });
    expect(first.isDefault).toBe(true);
    expect(second.isDefault).toBe(false);
    expect(listAddresses(db, other).map((a) => a.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(
      listAddresses(db, SEED.customer).every((a) => a.userId === SEED.customer),
    ).toBe(true);
    expect(() => getOwnAddress(db, SEED.customer, first.id)).toThrow(
      RepositoryError,
    );
  });
});

describe("placing an order", () => {
  it("decrements stock, assigns an invoice number and records history for a paid order", async () => {
    const before = stock(P1);
    const { order: placed, payment } = await placeOrder(
      db,
      customer(),
      order(),
      gateway,
    );
    expect(payment.status).toBe("PAID");
    expect(placed.id).toBe("ORD-IH-01001");
    expect(placed.status).toBe("CONFIRMED");
    expect(placed.paymentStatus).toBe("PAID");
    expect(placed.invoiceNumber).toMatch(/^INV\/\d{4}-\d{2}\/00001$/);
    expect(placed.items).toEqual([
      expect.objectContaining({
        productId: P1,
        quantity: 2,
        name: expect.any(String),
        sku: "SKF-6205-2RS1",
      }),
    ]);
    expect(placed.shippingAddress.city).toBe("Pune");
    expect(placed.billingGstin).toBe("27ABCDE1234F1Z5"); // profile GSTIN
    expect(placed.payments).toHaveLength(1);
    expect(placed.payments[0]).toEqual(
      expect.objectContaining({
        status: "PAID",
        amountPaise: placed.totalPaise,
      }),
    );
    expect(placed.history.length).toBeGreaterThanOrEqual(2);
    expect(stock(P1)).toBe(before - 2);

    const second = await placeOrder(db, customer(), order(), gateway);
    expect(second.order.id).toBe("ORD-IH-01002");
    expect(second.order.invoiceNumber).toMatch(/00002$/);
  });

  it("uses the GSTIN given on the order and ignores prices in the request", async () => {
    const body = {
      ...order({ billingGstin: "29ABCDE1234F1Z5" }),
      items: [{ productId: P1, quantity: 1, unitPricePaise: 1 }],
    } as unknown as PlaceOrderInput;
    const { order: placed } = await placeOrder(db, customer(), body, gateway);
    expect(placed.billingGstin).toBe("29ABCDE1234F1Z5");
    expect(placed.items[0].unitPricePaise).toBe(48_500);
  });

  it("merges duplicate lines into one order item", async () => {
    const { order: placed } = await placeOrder(
      db,
      customer(),
      order({
        items: [
          { productId: P1, quantity: 1 },
          { productId: P2, quantity: 1 },
          { productId: P1, quantity: 2 },
        ],
      }),
      gateway,
    );
    expect(placed.items).toHaveLength(2);
    expect(placed.items.find((i) => i.productId === P1)?.quantity).toBe(3);
  });

  it("returns 409 naming the product and changes no stock when stock is short", async () => {
    const before = [stock(P1), stock(P2)];
    await expect(
      placeOrder(
        db,
        customer(),
        order({
          items: [
            { productId: P1, quantity: 1 },
            { productId: P2, quantity: 5000 },
          ],
        }),
        gateway,
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "INSUFFICIENT_STOCK",
      message: expect.stringContaining("Hex Bolt"),
    });
    expect([stock(P1), stock(P2)]).toEqual(before);
    expect(listOrdersForCustomer(db, SEED.customer)).toHaveLength(0);
  });

  it("rejects an out-of-stock product and an inactive product with 409", async () => {
    await expect(
      placeOrder(
        db,
        customer(),
        order({ items: [{ productId: SOLENOID, quantity: 1 }] }),
        gateway,
      ),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("Solenoid Valve"),
    });
    db.prepare("UPDATE products SET is_active = 0 WHERE id = ?").run(P1);
    await expect(
      placeOrder(db, customer(), order(), gateway),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("SKF Deep Groove Bearing"),
    });
  });

  it("refuses an address that is not the customer's", async () => {
    const other = addCustomer(db, "intruder@example.in");
    await expect(
      placeOrder(db, findUserById(db, other)!, order(), gateway),
    ).rejects.toMatchObject({ status: 404 });
    expect(stock(P1)).toBe(120);
  });
});

describe("payment outcomes", () => {
  it("keeps a failed-payment order confirmed with stock reserved, then retry succeeds", async () => {
    const { order: placed, payment } = await placeOrder(
      db,
      customer(),
      order({ payment: pay("failed") }),
      gateway,
    );
    expect(payment.status).toBe("FAILED");
    expect(placed.status).toBe("CONFIRMED");
    expect(placed.paymentStatus).toBe("FAILED");
    expect(placed.invoiceNumber).toBeNull();
    expect(stock(P1)).toBe(118);

    const retried = await payOrder(
      db,
      customer(),
      placed.id,
      pay("success"),
      gateway,
    );
    expect(retried.order.paymentStatus).toBe("PAID");
    expect(retried.order.invoiceNumber).toMatch(/00001$/);
    expect(retried.order.payments.map((p) => p.status)).toEqual([
      "FAILED",
      "PAID",
    ]);
    expect(stock(P1)).toBe(118);
  });

  it("keeps a pending-payment order unpaid and allows another attempt", async () => {
    const { order: placed } = await placeOrder(
      db,
      customer(),
      order({ payment: pay("pending") }),
      gateway,
    );
    expect(placed.paymentStatus).toBe("PENDING");
    expect(placed.invoiceNumber).toBeNull();
    const again = await payOrder(
      db,
      customer(),
      placed.id,
      pay("pending"),
      gateway,
    );
    expect(again.order.paymentStatus).toBe("PENDING");
    expect(again.order.payments).toHaveLength(2);
  });

  it("cancels the order and restores stock when the payment is cancelled", async () => {
    const { order: placed, payment } = await placeOrder(
      db,
      customer(),
      order({ payment: pay("cancelled") }),
      gateway,
    );
    expect(payment.status).toBe("CANCELLED");
    expect(placed.status).toBe("CANCELLED");
    expect(placed.paymentStatus).toBe("CANCELLED");
    expect(stock(P1)).toBe(120);
    expect(placed.history.at(-1)?.status).toBe("CANCELLED");
    await expect(
      payOrder(db, customer(), placed.id, pay(), gateway),
    ).rejects.toMatchObject({
      status: 409,
      code: "ORDER_CANCELLED",
    });
  });

  it("refuses to pay a paid order again", async () => {
    const { order: placed } = await placeOrder(
      db,
      customer(),
      order(),
      gateway,
    );
    await expect(
      payOrder(db, customer(), placed.id, pay(), gateway),
    ).rejects.toMatchObject({
      status: 409,
      code: "ALREADY_PAID",
    });
    expect(getOrder(db, placed.id).payments).toHaveLength(1);
  });

  it("records a failed attempt when the gateway throws", async () => {
    const broken = {
      name: "broken",
      pay: () => Promise.reject(new Error("gateway down")),
    };
    const { order: placed, payment } = await placeOrder(
      db,
      customer(),
      order(),
      broken,
    );
    expect(payment.status).toBe("FAILED");
    expect(placed.paymentStatus).toBe("FAILED");
    expect(placed.invoiceNumber).toBeNull();
  });
});

describe("ownership", () => {
  it("hides one customer's order from another for read and pay", async () => {
    const { order: placed } = await placeOrder(
      db,
      customer(),
      order({ payment: pay("failed") }),
      gateway,
    );
    const otherId = addCustomer(db, "second@example.in");
    const other = findUserById(db, otherId)!;
    expect(() => getOrderForCustomer(db, placed.id, otherId)).toThrow(
      RepositoryError,
    );
    await expect(
      payOrder(db, other, placed.id, pay(), gateway),
    ).rejects.toMatchObject({ status: 404 });
    expect(getOrder(db, placed.id).paymentStatus).toBe("FAILED");
    expect(listOrdersForCustomer(db, otherId)).toHaveLength(0);
    expect(listOrdersForCustomer(db, SEED.customer)).toHaveLength(1);
  });
});

describe("admin transitions", () => {
  const move = (
    id: string,
    to: Parameters<typeof transitionOrder>[2],
    opts = {},
  ) => transaction(db, () => transitionOrder(db, id, to, SEED.admin, opts));

  it("moves a paid order through packed, dispatched and delivered with history and audit", async () => {
    const { order: placed } = await placeOrder(
      db,
      customer(),
      order(),
      gateway,
    );
    move(placed.id, "PACKED");
    expect(() => move(placed.id, "DISPATCHED")).toThrow(RepositoryError); // courier required
    expect(() =>
      move(placed.id, "DISPATCHED", { courier: "Blue Dart" }),
    ).toThrow(RepositoryError);
    move(placed.id, "DISPATCHED", {
      courier: "Blue Dart",
      trackingNumber: "BD123",
    });
    const dispatched = getOrder(db, placed.id);
    expect(dispatched.status).toBe("DISPATCHED");
    expect(dispatched.courier).toBe("Blue Dart");
    expect(dispatched.trackingNumber).toBe("BD123");
    move(placed.id, "DELIVERED");
    const done = getOrder(db, placed.id);
    expect(done.status).toBe("DELIVERED");
    expect(done.history.map((h) => h.status)).toEqual([
      "CONFIRMED",
      "CONFIRMED",
      "PACKED",
      "DISPATCHED",
      "DELIVERED",
    ]);
    const audits = db
      .prepare(
        "SELECT action FROM audit_log WHERE entity_id = ? AND actor_id = ? ORDER BY id",
      )
      .all(placed.id, SEED.admin) as { action: string }[];
    expect(audits.map((a) => a.action)).toEqual([
      "ORDER_PACKED",
      "ORDER_DISPATCHED",
      "ORDER_DELIVERED",
    ]);
    expect(listAllOrders(db, "DELIVERED")).toHaveLength(1);
    expect(listAllOrders(db, "PACKED")).toHaveLength(0);
  });

  it("rejects invalid transitions", async () => {
    const { order: placed } = await placeOrder(
      db,
      customer(),
      order(),
      gateway,
    );
    expect(() =>
      move(placed.id, "DISPATCHED", { courier: "X", trackingNumber: "1" }),
    ).toThrow(TransitionError);
    expect(() => move(placed.id, "DELIVERED")).toThrow(TransitionError);
    expect(() => move(placed.id, "CONFIRMED")).toThrow(TransitionError);
    move(placed.id, "PACKED");
    move(placed.id, "DISPATCHED", { courier: "DTDC", trackingNumber: "9" });
    expect(() => move(placed.id, "CANCELLED")).toThrow(TransitionError);
    move(placed.id, "DELIVERED");
    expect(() => move(placed.id, "PACKED")).toThrow(TransitionError);
    expect(() => move("ORD-IH-99999", "PACKED")).toThrow(RepositoryError);
  });

  it("will not pack or dispatch an unpaid order", async () => {
    const { order: placed } = await placeOrder(
      db,
      customer(),
      order({ payment: pay("failed") }),
      gateway,
    );
    expect(() => move(placed.id, "PACKED")).toThrow(TransitionError);
    expect(getOrder(db, placed.id).status).toBe("CONFIRMED");
  });

  it("cancels an unpaid order, restores stock and sets payment to cancelled", async () => {
    const { order: placed } = await placeOrder(
      db,
      customer(),
      order({ payment: pay("failed") }),
      gateway,
    );
    expect(stock(P1)).toBe(118);
    move(placed.id, "CANCELLED", { comment: "Customer asked to cancel" });
    const after = getOrder(db, placed.id);
    expect(after.status).toBe("CANCELLED");
    expect(after.paymentStatus).toBe("CANCELLED");
    expect(stock(P1)).toBe(120);
    expect(after.history.at(-1)?.comment).toContain("Customer asked to cancel");
  });

  it("cancels a paid order keeping PAID and noting that a refund is due", async () => {
    const { order: placed } = await placeOrder(
      db,
      customer(),
      order(),
      gateway,
    );
    move(placed.id, "PACKED");
    move(placed.id, "CANCELLED");
    const after = getOrder(db, placed.id);
    expect(after.status).toBe("CANCELLED");
    expect(after.paymentStatus).toBe("PAID");
    expect(after.invoiceNumber).not.toBeNull();
    expect(after.history.at(-1)?.comment).toMatch(/refund is due/);
    expect(stock(P1)).toBe(120);
  });
});
