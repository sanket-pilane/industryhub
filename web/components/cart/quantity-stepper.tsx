"use client";
import { MAX_QUANTITY } from "./cart-store";

export function QuantityStepper({
  value,
  onChange,
  label,
  max = MAX_QUANTITY,
}: {
  value: number;
  onChange(next: number): void;
  label: string;
  max?: number;
}) {
  const set = (next: number) =>
    onChange(Math.min(max, Math.max(1, Math.floor(next) || 1)));
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={value <= 1}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={value}
        aria-label="Quantity"
        onChange={(e) => set(Number(e.target.value))}
      />
      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
