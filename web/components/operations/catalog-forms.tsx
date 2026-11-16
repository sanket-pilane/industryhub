"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { callApi } from "./api";
import { FeedbackNote, type Feedback } from "./feedback";

const GST_RATES = [0, 5, 12, 18, 28];

export type CategoryChoice = { slug: string; name: string };
export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  categoryName: string;
  priceRupees: string;
  priceLabel: string;
  gstPercent: number;
  stockQuantity: number;
  isActive: boolean;
};

const PRICE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

export function CreateProductForm({
  categories,
}: {
  categories: CategoryChoice[];
}) {
  const router = useRouter();
  const empty = {
    sku: "",
    name: "",
    categorySlug: "",
    brand: "",
    description: "",
    price: "",
    gstPercent: "18",
    stockQuantity: "0",
  };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const set = (key: keyof typeof empty) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    const next: Record<string, string[]> = {};
    if (!form.sku.trim()) next.sku = ["Enter a SKU."];
    if (!form.name.trim()) next.name = ["Enter a product name."];
    if (!form.categorySlug) next.categorySlug = ["Choose a category."];
    if (!form.brand.trim()) next.brand = ["Enter a brand."];
    if (!form.description.trim()) next.description = ["Enter a description."];
    if (!PRICE_PATTERN.test(form.price.trim()))
      next.price = ["Enter the price in rupees, with at most two decimals."];
    if (!/^\d+$/.test(form.stockQuantity.trim()))
      next.stockQuantity = ["Stock must be a whole number, 0 or more."];
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const result = await callApi("/api/admin/products", "POST", {
      ...form,
      price: form.price.trim(),
      gstPercent: Number(form.gstPercent),
      stockQuantity: Number(form.stockQuantity),
    });
    setBusy(false);
    if (!result.ok) {
      setErrors(result.fields);
      return setFeedback({ kind: "error", text: result.message });
    }
    setForm(empty);
    setErrors({});
    setFeedback({ kind: "success", text: "Product created." });
    router.refresh();
  };

  const field = (
    key: keyof typeof empty,
    label: string,
    control: React.ReactNode,
  ) => (
    <div className="field">
      <label htmlFor={`product-${key}`}>{label}</label>
      {control}
      {errors[key]?.[0] && <p className="field-error">{errors[key][0]}</p>}
    </div>
  );
  const props = (key: keyof typeof empty) => ({
    id: `product-${key}`,
    value: form[key],
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => set(key)(e.target.value),
    "aria-invalid": !!errors[key]?.length,
  });

  return (
    <form onSubmit={submit} noValidate aria-busy={busy} className="op-form">
      <div className="op-grid">
        {field(
          "sku",
          "SKU",
          <input className="plain-input" {...props("sku")} />,
        )}
        {field(
          "name",
          "Product name",
          <input className="plain-input" {...props("name")} />,
        )}
        {field(
          "categorySlug",
          "Category",
          <select className="plain-input" {...props("categorySlug")}>
            <option value="">Choose category</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>,
        )}
        {field(
          "brand",
          "Brand",
          <input className="plain-input" {...props("brand")} />,
        )}
        {field(
          "price",
          "Price (₹, before GST)",
          <input
            className="plain-input"
            inputMode="decimal"
            {...props("price")}
          />,
        )}
        {field(
          "gstPercent",
          "GST rate",
          <select className="plain-input" {...props("gstPercent")}>
            {GST_RATES.map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </select>,
        )}
        {field(
          "stockQuantity",
          "Stock quantity",
          <input
            className="plain-input"
            inputMode="numeric"
            {...props("stockQuantity")}
          />,
        )}
      </div>
      {field(
        "description",
        "Description",
        <textarea
          className="plain-input op-textarea"
          rows={3}
          {...props("description")}
        />,
      )}
      <FeedbackNote feedback={feedback} />
      <Button type="submit" disabled={busy}>
        {busy ? "Creating..." : "Create product"}
      </Button>
    </form>
  );
}

/** A catalog table row that switches into an inline editor for price, GST, stock and active flag. */
export function ProductTableRow({ product }: { product: ProductRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(product.priceRupees);
  const [gst, setGst] = useState(String(product.gstPercent));
  const [stock, setStock] = useState(String(product.stockQuantity));
  const [active, setActive] = useState(product.isActive);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const save = async () => {
    setFeedback(null);
    if (!PRICE_PATTERN.test(price.trim()))
      return setFeedback({
        kind: "error",
        text: "Enter the price in rupees, with at most two decimals.",
      });
    if (!/^\d+$/.test(stock.trim()))
      return setFeedback({
        kind: "error",
        text: "Stock must be a whole number, 0 or more.",
      });
    setBusy(true);
    const result = await callApi(`/api/admin/products/${product.id}`, "PATCH", {
      price: price.trim(),
      gstPercent: Number(gst),
      stockQuantity: Number(stock),
      isActive: active,
    });
    setBusy(false);
    if (!result.ok) return setFeedback({ kind: "error", text: result.message });
    setEditing(false);
    router.refresh();
  };

  const toggleActive = async () => {
    setBusy(true);
    setFeedback(null);
    const result = await callApi(`/api/admin/products/${product.id}`, "PATCH", {
      isActive: !product.isActive,
    });
    setBusy(false);
    if (!result.ok) return setFeedback({ kind: "error", text: result.message });
    router.refresh();
  };

  if (!editing)
    return (
      <tr data-inactive={!product.isActive}>
        <td className="quote-id">{product.sku}</td>
        <td>
          {product.name}
          <span className="table-sub">{product.id}</span>
        </td>
        <td>{product.categoryName}</td>
        <td>{product.priceLabel}</td>
        <td>{product.gstPercent}%</td>
        <td>{product.stockQuantity}</td>
        <td>
          <span
            className={`status ${product.isActive ? "status-accepted" : "status-neutral"}`}
          >
            {product.isActive ? "Active" : "Inactive"}
          </span>
        </td>
        <td>
          <div className="op-row-actions">
            <button
              type="button"
              className="table-link op-link-button"
              onClick={() => setEditing(true)}
            >
              Edit
              <span className="sr-only"> {product.name}</span>
            </button>
            <button
              type="button"
              className="table-link op-link-button"
              onClick={toggleActive}
              disabled={busy}
            >
              {product.isActive ? "Deactivate" : "Activate"}
              <span className="sr-only"> {product.name}</span>
            </button>
          </div>
          <FeedbackNote feedback={feedback} />
        </td>
      </tr>
    );

  const id = (name: string) => `edit-${product.id}-${name}`;
  return (
    <tr className="op-editing">
      <td className="quote-id">{product.sku}</td>
      <td>{product.name}</td>
      <td>{product.categoryName}</td>
      <td>
        <label className="sr-only" htmlFor={id("price")}>
          Price in rupees for {product.name}
        </label>
        <input
          id={id("price")}
          className="plain-input op-small-input"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </td>
      <td>
        <label className="sr-only" htmlFor={id("gst")}>
          GST rate for {product.name}
        </label>
        <select
          id={id("gst")}
          className="plain-input op-small-input"
          value={gst}
          onChange={(e) => setGst(e.target.value)}
        >
          {GST_RATES.map((r) => (
            <option key={r} value={r}>
              {r}%
            </option>
          ))}
        </select>
      </td>
      <td>
        <label className="sr-only" htmlFor={id("stock")}>
          Stock for {product.name}
        </label>
        <input
          id={id("stock")}
          className="plain-input op-small-input"
          inputMode="numeric"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
      </td>
      <td>
        <label className="op-check">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active
          <span className="sr-only"> {product.name}</span>
        </label>
      </td>
      <td>
        <div className="op-row-actions">
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setEditing(false)}
            disabled={busy}
          >
            Cancel
          </Button>
        </div>
        <FeedbackNote feedback={feedback} />
      </td>
    </tr>
  );
}
