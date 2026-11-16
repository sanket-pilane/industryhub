"use client";
import { useEffect, useRef, useState } from "react";
import { useCart } from "./cart-store";
import { QuantityStepper } from "./quantity-stepper";

export function AddToCart({
  productId,
  name,
}: {
  productId: string;
  name: string;
}) {
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div className="add-to-cart">
      <QuantityStepper
        value={quantity}
        onChange={setQuantity}
        label={`Quantity for ${name}`}
      />
      <button
        type="button"
        className="button button-primary add-button"
        data-added={added}
        aria-label={`Add ${name} to cart`}
        onClick={() => {
          cart.add(productId, quantity, name);
          setQuantity(1);
          setAdded(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setAdded(false), 1400);
        }}
      >
        <span className="add-label">{added ? "Added ✓" : "Add to cart"}</span>
      </button>
    </div>
  );
}
