"use client";
import { LinkButton } from "@/components/ui/button";
import { useCart } from "./cart-store";

export function CartSummaryCard() {
  const { count, lines, hydrated } = useCart();
  return (
    <section className="panel cart-summary-card">
      <h2>Cart</h2>
      {!hydrated ? (
        <div className="skeleton h-12 w-full" />
      ) : count === 0 ? (
        <p className="muted">Your cart is empty.</p>
      ) : (
        <p>
          <strong>{count}</strong> unit{count === 1 ? "" : "s"} across{" "}
          <strong>{lines.length}</strong> product
          {lines.length === 1 ? "" : "s"}.
        </p>
      )}
      <div className="button-row">
        <LinkButton href="/cart">View cart</LinkButton>
        <LinkButton href="/catalog" variant="secondary">
          Browse catalog
        </LinkButton>
      </div>
    </section>
  );
}
