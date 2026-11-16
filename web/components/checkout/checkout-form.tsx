"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Address, ApiResponse } from "../../../shared/contracts";
import { useCart } from "@/components/cart/cart-store";
import { Button, LinkButton } from "@/components/ui/button";
import { OrderTotals } from "@/components/orders/order-totals";
import {
  DELIVERY_LABELS,
  DELIVERY_METHODS,
  EXPRESS_SHIPPING_PAISE,
  FREE_SHIPPING_THRESHOLD_PAISE,
  STANDARD_SHIPPING_PAISE,
  type DeliveryMethod,
  type OrderPricing,
} from "@/lib/orders/pricing";
import { GSTIN_PATTERN } from "@/lib/orders/schemas";
import { formatMoney } from "@/lib/utils/money";
import { AddressForm } from "./address-form";
import {
  PaymentFields,
  type PayMethod,
  type PayOutcome,
} from "./payment-fields";

type QuoteState =
  { key: string; pricing: OrderPricing } | { key: string; error: string };

interface PlacedOrder {
  order: { id: string };
}

const addressLine = (a: Address) =>
  [a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`]
    .filter(Boolean)
    .join(", ");

export function CheckoutForm({
  addresses: initialAddresses,
  profileGstin,
}: {
  addresses: Address[];
  profileGstin: string;
}) {
  const cart = useCart();
  const router = useRouter();
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState(
    (initialAddresses.find((a) => a.isDefault) ?? initialAddresses[0])?.id ??
      "",
  );
  const [addingAddress, setAddingAddress] = useState(
    initialAddresses.length === 0,
  );
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>("STANDARD");
  const [gstin, setGstin] = useState(profileGstin);
  const [method, setMethod] = useState<PayMethod>("UPI");
  const [outcome, setOutcome] = useState<PayOutcome>("success");
  const [quote, setQuote] = useState<QuoteState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Only product ids and quantities leave the browser; the server prices them.
  const items = useMemo(
    () =>
      cart.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    [cart.lines],
  );
  const quoteKey = JSON.stringify({ items, addressId, deliveryMethod });
  const gstinTrimmed = gstin.trim().toUpperCase();
  const gstinError =
    gstinTrimmed !== "" && !GSTIN_PATTERN.test(gstinTrimmed)
      ? "Enter a valid 15-character GSTIN, for example 27ABCDE1234F1Z5."
      : "";

  useEffect(() => {
    if (!cart.hydrated || items.length === 0 || !addressId) return;
    const controller = new AbortController();
    fetch("/api/orders/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, addressId, deliveryMethod }),
      signal: controller.signal,
    })
      .then((response) => response.json() as Promise<ApiResponse<OrderPricing>>)
      .then((result) =>
        setQuote(
          result.success
            ? { key: quoteKey, pricing: result.data }
            : {
                key: quoteKey,
                error:
                  result.error?.message ?? "Totals could not be calculated.",
              },
        ),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setQuote({
          key: quoteKey,
          error: "Network error. Check your connection and retry.",
        });
      });
    return () => controller.abort();
  }, [cart.hydrated, items, addressId, deliveryMethod, quoteKey]);

  if (!cart.hydrated)
    return (
      <div aria-busy="true">
        <div className="skeleton h-64 w-full" />
        <p role="status" className="sr-only">
          Loading checkout…
        </p>
      </div>
    );

  if (placed)
    return (
      <p className="info-note" role="status">
        Order placed. Taking you to your order…
      </p>
    );

  if (cart.lines.length === 0)
    return (
      <div className="empty-state">
        <h2>Your cart is empty</h2>
        <p>Add products to your cart before checking out.</p>
        <LinkButton href="/catalog">Browse catalog</LinkButton>
      </div>
    );

  const current = quote && quote.key === quoteKey ? quote : null;
  const pricing = current && "pricing" in current ? current.pricing : null;
  const quoteError = current && "error" in current ? current.error : "";
  const calculating = !!addressId && !current;
  const canSubmit = !!pricing && !gstinError && !submitting;

  const place = async () => {
    if (!pricing) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          addressId,
          deliveryMethod,
          ...(gstinTrimmed ? { billingGstin: gstinTrimmed } : {}),
          payment: { method, testOutcome: outcome },
        }),
      });
      const result = (await response.json()) as ApiResponse<PlacedOrder>;
      if (!result.success) {
        setSubmitError(
          result.error?.message ??
            "The order could not be placed. Please retry.",
        );
        setSubmitting(false);
        return;
      }
      setPlaced(true);
      cart.clear();
      router.push(`/orders/${result.data.order.id}`);
    } catch {
      setSubmitError("Network error. Check your connection and retry.");
      setSubmitting(false);
    }
  };

  const shippingNote = (m: DeliveryMethod) =>
    m === "EXPRESS"
      ? formatMoney(EXPRESS_SHIPPING_PAISE)
      : `${formatMoney(STANDARD_SHIPPING_PAISE)}, free from ${formatMoney(FREE_SHIPPING_THRESHOLD_PAISE)}`;

  return (
    <div className="checkout-layout">
      <div className="checkout-main">
        <section className="panel" aria-labelledby="checkout-address">
          <h2 id="checkout-address">Delivery address</h2>
          {addresses.length > 0 && (
            <fieldset className="address-choices">
              <legend className="sr-only">Choose a saved address</legend>
              {addresses.map((a) => (
                <label
                  className="address-choice"
                  key={a.id}
                  htmlFor={`address-${a.id}`}
                >
                  <input
                    id={`address-${a.id}`}
                    type="radio"
                    name="address"
                    value={a.id}
                    checked={addressId === a.id}
                    onChange={() => setAddressId(a.id)}
                  />
                  <span>
                    <strong>{a.label}</strong>
                    {a.isDefault && (
                      <em className="address-default">Default</em>
                    )}
                    <small>{addressLine(a)}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {addingAddress ? (
            <AddressForm
              onSaved={(saved) => {
                setAddresses((list) => [...list, saved]);
                setAddressId(saved.id);
                setAddingAddress(false);
              }}
              onCancel={
                addresses.length > 0 ? () => setAddingAddress(false) : undefined
              }
            />
          ) : (
            <Button
              variant="secondary"
              type="button"
              onClick={() => setAddingAddress(true)}
            >
              Add a new address
            </Button>
          )}
        </section>

        <form
          id="checkout-form"
          className="checkout-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) void place();
          }}
        >
          <section className="panel" aria-labelledby="checkout-delivery">
            <h2 id="checkout-delivery">Delivery method</h2>
            <fieldset className="pay-methods" disabled={submitting}>
              <legend className="sr-only">Delivery method</legend>
              {DELIVERY_METHODS.map((m) => (
                <label className="pay-method" key={m} htmlFor={`delivery-${m}`}>
                  <input
                    id={`delivery-${m}`}
                    type="radio"
                    name="delivery"
                    value={m}
                    checked={deliveryMethod === m}
                    onChange={() => setDeliveryMethod(m)}
                  />
                  <span>
                    <strong>{DELIVERY_LABELS[m]}</strong>
                    <small>{shippingNote(m)}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          </section>

          <section className="panel" aria-labelledby="checkout-billing">
            <h2 id="checkout-billing">Billing</h2>
            <div className="field">
              <label htmlFor="billing-gstin">
                GSTIN for the tax invoice (optional)
              </label>
              <input
                id="billing-gstin"
                className="plain-input"
                value={gstin}
                maxLength={15}
                autoComplete="off"
                aria-invalid={!!gstinError}
                aria-describedby={
                  gstinError ? "billing-gstin-error" : "billing-gstin-hint"
                }
                disabled={submitting}
                onChange={(e) => setGstin(e.target.value)}
              />
              {gstinError ? (
                <p className="field-error" id="billing-gstin-error">
                  {gstinError}
                </p>
              ) : (
                <p className="field-hint" id="billing-gstin-hint">
                  Add your GSTIN to claim input tax credit. Leave blank to use
                  the one on your profile.
                </p>
              )}
            </div>
          </section>

          <section className="panel" aria-labelledby="checkout-payment">
            <h2 id="checkout-payment">Payment</h2>
            <PaymentFields
              idPrefix="checkout"
              method={method}
              outcome={outcome}
              onMethod={setMethod}
              onOutcome={setOutcome}
              disabled={submitting}
            />
          </section>
        </form>
      </div>

      <aside
        className="cart-summary checkout-summary"
        aria-label="Order summary"
      >
        <h2>Order summary</h2>
        {!addressId ? (
          <p className="muted">Add a delivery address to see your totals.</p>
        ) : calculating ? (
          <p className="muted" role="status">
            Calculating totals…
          </p>
        ) : quoteError ? (
          <div role="alert" className="upload-alert">
            <p>{quoteError}</p>
            <Link className="table-link" href="/cart">
              Review your cart
            </Link>
          </div>
        ) : pricing ? (
          <>
            <ul className="summary-lines" aria-label="Items in this order">
              {pricing.lines.map((line) => (
                <li key={line.productId}>
                  <span>
                    {line.name}
                    <small>
                      {line.quantity} × {formatMoney(line.unitPricePaise)} ·{" "}
                      {line.gstPercent}% GST
                    </small>
                  </span>
                  <strong>{formatMoney(line.subtotalPaise)}</strong>
                </li>
              ))}
            </ul>
            <OrderTotals
              totals={pricing}
              intraState={pricing.intraState}
              className="order-totals cart-summary-totals"
            />
            <p className="muted">Place of supply: {pricing.placeOfSupply}.</p>
          </>
        ) : null}
        {submitError && (
          <p className="field-error" role="alert">
            {submitError}
          </p>
        )}
        <Button type="submit" form="checkout-form" disabled={!canSubmit}>
          {submitting
            ? "Placing order…"
            : pricing
              ? `Place order and pay ${formatMoney(pricing.totalPaise)}`
              : "Place order"}
        </Button>
        <Link className="table-link" href="/cart">
          Back to cart
        </Link>
      </aside>
    </div>
  );
}
