"use client";
import Image from "next/image";
import type { Product } from "../../../shared/contracts";
import { LinkButton, Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { formatMoney, lineTotal } from "@/lib/utils/money";
import { useCart } from "./cart-store";
import { QuantityStepper } from "./quantity-stepper";

export function CartView({ products }: { products: Product[] }) {
  const cart = useCart();
  if (!cart.hydrated)
    return (
      <div aria-busy="true">
        <div className="skeleton h-64 w-full" />
        <p role="status" className="sr-only">
          Loading cart…
        </p>
      </div>
    );

  const byId = new Map(products.map((p) => [p.id, p]));
  const rows = cart.lines.flatMap((line) => {
    const product = byId.get(line.productId);
    return product
      ? [
          {
            product,
            quantity: line.quantity,
            ...lineTotal(product.pricePaise, line.quantity, product.gstPercent),
          },
        ]
      : [];
  });

  if (rows.length === 0)
    return (
      <div className="empty-state cart-empty">
        <span className="cart-empty-icon">
          <Icon name="cart" />
        </span>
        <h2>Your cart is empty</h2>
        <p>Browse the catalog and add bearings, pneumatics, tools and more.</p>
        <LinkButton href="/catalog">Browse catalog</LinkButton>
      </div>
    );

  const subtotal = rows.reduce((sum, r) => sum + r.subtotalPaise, 0);
  const tax = rows.reduce((sum, r) => sum + r.taxPaise, 0);
  const total = rows.reduce((sum, r) => sum + r.totalPaise, 0);
  const units = rows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div className="cart-layout">
      <ul className="cart-lines" aria-label="Cart items">
        {rows.map(({ product, quantity, totalPaise }) => (
          <li className="cart-line" key={product.id}>
            <div className="cart-thumb">
              {product.image ? (
                <Image src={product.image} alt="" width={72} height={72} />
              ) : (
                <span aria-hidden="true">{product.symbol}</span>
              )}
            </div>
            <div className="cart-line-info">
              <h2>{product.name}</h2>
              <p>
                {product.sku} · {product.brand}
              </p>
              <p>
                {formatMoney(product.pricePaise)} each · {product.gstPercent}%
                GST
              </p>
            </div>
            <QuantityStepper
              value={quantity}
              label={`Quantity for ${product.name}`}
              onChange={(next) => cart.setQuantity(product.id, next)}
            />
            <strong className="cart-line-total">
              {formatMoney(totalPaise)}
            </strong>
            <button
              type="button"
              className="cart-remove"
              onClick={() => cart.remove(product.id)}
              aria-label={`Remove ${product.name} from cart`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <aside className="cart-summary" aria-label="Order summary">
        <h2>Order summary</h2>
        <dl>
          <div>
            <dt>
              Items ({units} unit{units === 1 ? "" : "s"})
            </dt>
            <dd>{formatMoney(subtotal)}</dd>
          </div>
          <div>
            <dt>GST</dt>
            <dd>{formatMoney(tax)}</dd>
          </div>
          <div>
            <dt>Shipping</dt>
            <dd>{subtotal >= 2_500_000 ? "Free" : "Calculated at checkout"}</dd>
          </div>
          <div className="cart-total">
            <dt>Total</dt>
            <dd>{formatMoney(total)}</dd>
          </div>
        </dl>
        <p className="muted">
          GST and shipping are confirmed at checkout, where you choose a
          delivery address and method. Totals are calculated on the server.
        </p>
        <div className="cart-actions">
          <LinkButton href="/checkout">Proceed to checkout</LinkButton>
          <LinkButton href="/catalog" variant="secondary">
            Continue shopping
          </LinkButton>
          <Button variant="secondary" onClick={() => cart.clear()}>
            Clear cart
          </Button>
        </div>
      </aside>
    </div>
  );
}
