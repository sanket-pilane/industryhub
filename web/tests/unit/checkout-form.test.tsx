import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../../shared/contracts";
import { CartProvider } from "@/components/cart/cart-store";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { priceOrder } from "@/lib/orders/pricing";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const address: Address = {
  id: "ADR-0001",
  userId: "user-x",
  label: "Head office",
  line1: "Plot 42, MIDC Bhosari",
  line2: "",
  city: "Pune",
  state: "Maharashtra",
  pincode: "411026",
  isDefault: true,
};

const pricing = priceOrder({
  lines: [
    {
      productId: "PRD-0001",
      sku: "SKF-6205-2RS1",
      name: "SKF Deep Groove Bearing 6205",
      quantity: 3,
      unitPricePaise: 48_500,
      gstPercent: 18,
    },
  ],
  shippingState: "Maharashtra",
  deliveryMethod: "STANDARD",
});

const json = (data: unknown, success = true) =>
  new Response(
    JSON.stringify(
      success
        ? { success: true, data, error: null }
        : { success: false, data: null, error: data },
    ),
    { status: success ? 200 : 409 },
  );

function renderCheckout() {
  return render(
    <CartProvider userId="user-x">
      <CheckoutForm addresses={[address]} profileGstin="27ABCDE1234F1Z5" />
    </CartProvider>,
  );
}

describe("checkout form", () => {
  beforeEach(() => {
    localStorage.clear();
    push.mockClear();
    vi.unstubAllGlobals();
  });

  it("shows an empty state and makes no requests when the cart is empty", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderCheckout();
    expect(
      screen.getByRole("heading", { name: "Your cart is empty" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse catalog" }),
    ).toHaveAttribute("href", "/catalog");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's totals with the GST split, and posts only product ids and quantities", async () => {
    localStorage.setItem(
      "industrihub:cart:user-x",
      JSON.stringify([{ productId: "PRD-0001", quantity: 3 }]),
    );
    const fetchMock = vi.fn<
      (url: string, init?: RequestInit) => Promise<Response>
    >((url) =>
      Promise.resolve(
        url === "/api/orders/quote"
          ? json(pricing)
          : json({ order: { id: "ORD-IH-01001" } }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderCheckout();

    expect(await screen.findByText("CGST")).toBeInTheDocument();
    expect(screen.getByText("SGST")).toBeInTheDocument();
    expect(
      screen.getByText("SKF Deep Groove Bearing 6205"),
    ).toBeInTheDocument();
    const quoteCall = fetchMock.mock.calls.find(
      ([url]) => url === "/api/orders/quote",
    )!;
    expect(JSON.parse((quoteCall[1] as RequestInit).body as string)).toEqual({
      items: [{ productId: "PRD-0001", quantity: 3 }],
      addressId: "ADR-0001",
      deliveryMethod: "STANDARD",
    });

    fireEvent.change(screen.getByLabelText("Test mode: payment outcome"), {
      target: { value: "failed" },
    });
    fireEvent.click(screen.getByLabelText(/Card/));
    const submit = await screen.findByRole("button", {
      name: /Place order and pay/,
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/orders/ORD-IH-01001"),
    );
    const orderCall = fetchMock.mock.calls.find(
      ([url]) => url === "/api/orders",
    )!;
    const body = JSON.parse((orderCall[1] as RequestInit).body as string);
    expect(body.items).toEqual([{ productId: "PRD-0001", quantity: 3 }]);
    expect(body).toEqual({
      items: [{ productId: "PRD-0001", quantity: 3 }],
      addressId: "ADR-0001",
      deliveryMethod: "STANDARD",
      billingGstin: "27ABCDE1234F1Z5",
      payment: { method: "CARD", testOutcome: "failed" },
    });
    expect(JSON.stringify(body)).not.toMatch(/pricePaise|unitPrice|totalPaise/);
    // The cart is cleared once the order exists.
    expect(
      JSON.parse(localStorage.getItem("industrihub:cart:user-x")!),
    ).toEqual([]);
  });

  it("explains a stock problem from the server and does not navigate", async () => {
    localStorage.setItem(
      "industrihub:cart:user-x",
      JSON.stringify([{ productId: "PRD-0001", quantity: 3 }]),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          json(
            {
              code: "INSUFFICIENT_STOCK",
              message: "Only 1 unit of Bearing in stock.",
            },
            false,
          ),
        ),
      ),
    );
    renderCheckout();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only 1 unit of Bearing in stock.",
    );
    expect(screen.getByRole("button", { name: "Place order" })).toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("blocks submission while the GSTIN is malformed", async () => {
    localStorage.setItem(
      "industrihub:cart:user-x",
      JSON.stringify([{ productId: "PRD-0001", quantity: 3 }]),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(json(pricing))),
    );
    renderCheckout();
    await screen.findByText("CGST");
    fireEvent.change(screen.getByLabelText(/GSTIN for the tax invoice/), {
      target: { value: "BAD" },
    });
    expect(
      screen.getByText(/Enter a valid 15-character GSTIN/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Place order and pay/ }),
    ).toBeDisabled();
  });
});
