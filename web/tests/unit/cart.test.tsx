import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CartProvider, useCart } from "@/components/cart/cart-store";
import { AddToCart } from "@/components/cart/add-to-cart";
import { CartView } from "@/components/cart/cart-view";
import { formatMoney, lineTotal } from "@/lib/utils/money";
import { seedProducts as products } from "@/lib/db/seed-data";

const [first, second] = products;

function Count() {
  const { count } = useCart();
  return <output aria-label="cart count">{count}</output>;
}

describe("cart store", () => {
  beforeEach(() => localStorage.clear());

  it("adds with the chosen quantity, merges repeats and persists per user", () => {
    render(
      <CartProvider userId="user-a">
        <AddToCart productId={first.id} name={first.name} />
        <Count />
      </CartProvider>,
    );
    const add = screen.getByRole("button", {
      name: `Add ${first.name} to cart`,
    });
    fireEvent.click(add);
    expect(screen.getByLabelText("cart count")).toHaveTextContent("1");
    expect(screen.getByText(/Added 1 ×/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(add);
    expect(screen.getByLabelText("cart count")).toHaveTextContent("4");
    expect(
      JSON.parse(localStorage.getItem("industrihub:cart:user-a")!),
    ).toEqual([{ productId: first.id, quantity: 4 }]);
    expect(localStorage.getItem("industrihub:cart:user-b")).toBeNull();
  });

  it("ignores corrupted storage instead of crashing", () => {
    localStorage.setItem("industrihub:cart:user-c", "{not json");
    render(
      <CartProvider userId="user-c">
        <Count />
      </CartProvider>,
    );
    expect(screen.getByLabelText("cart count")).toHaveTextContent("0");
  });
});

describe("cart view", () => {
  beforeEach(() => localStorage.clear());

  it("shows per-line GST totals, updates quantities and removes lines", () => {
    localStorage.setItem(
      "industrihub:cart:user-d",
      JSON.stringify([
        { productId: first.id, quantity: 2 },
        { productId: second.id, quantity: 1 },
        { productId: "deleted-product", quantity: 3 },
      ]),
    );
    render(
      <CartProvider userId="user-d">
        <CartView products={products} />
      </CartProvider>,
    );
    const lines = screen.getAllByRole("listitem");
    expect(lines).toHaveLength(2); // unknown products are skipped
    const a = lineTotal(first.pricePaise, 2, first.gstPercent);
    const b = lineTotal(second.pricePaise, 1, second.gstPercent);
    expect(within(lines[0]).getByText(formatMoney(a.totalPaise))).toBeVisible();
    expect(
      screen.getByText(formatMoney(a.totalPaise + b.totalPaise)),
    ).toBeVisible();

    fireEvent.click(
      within(lines[0]).getByRole("button", { name: "Increase quantity" }),
    );
    const a3 = lineTotal(first.pricePaise, 3, first.gstPercent);
    expect(
      within(lines[0]).getByText(formatMoney(a3.totalPaise)),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: `Remove ${first.name} from cart` }),
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Clear cart" }));
    expect(screen.getByText("Your cart is empty")).toBeVisible();
  });
});
