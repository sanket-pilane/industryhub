"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatMoney, lineTotal } from "@/lib/utils/money";
import {
  GST_RATES,
  MAX_LINE_ITEMS,
  advanceAmounts,
  createQuotationSchema,
  rupeesToPaise,
} from "@/lib/quotations/rules";
import {
  QUOTE_SUGGESTIONS_EVENT,
  type QuoteSuggestion,
} from "@/components/ai/drawing-review-panel";
import { postJson } from "./api";
import "./quotations.css";

type Line = {
  key: number;
  description: string;
  quantity: string;
  unitPrice: string;
  gstPercent: string;
};

let nextKey = 1;
const blankLine = (): Line => ({
  key: nextKey++,
  description: "",
  quantity: "1",
  unitPrice: "",
  gstPercent: "18",
});

/** Admin form that issues a new quotation version. Totals shown here are a preview only. */
export function QuotationForm({
  requestId,
  defaultQuantity,
  partName,
  nextVersion,
}: {
  requestId: string;
  defaultQuantity: number;
  partName: string;
  nextVersion: number;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(() => [
    {
      ...blankLine(),
      description: partName,
      quantity: String(defaultQuantity),
    },
  ]);
  const [leadTimeDays, setLeadTime] = useState("21");
  const [validUntil, setValidUntil] = useState("");
  const [advancePercent, setAdvance] = useState("50");
  const [terms, setTerms] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  // The AI drawing assistant can hand over suggested lines (descriptions and
  // quantities only); prices are always entered by the engineer.
  useEffect(() => {
    const take = (event: Event) => {
      const items = (event as CustomEvent<QuoteSuggestion[]>).detail;
      if (!Array.isArray(items) || items.length === 0) return;
      setLines(
        items.slice(0, MAX_LINE_ITEMS).map((item) => ({
          ...blankLine(),
          description: item.description,
          quantity: String(item.quantity),
        })),
      );
    };
    window.addEventListener(QUOTE_SUGGESTIONS_EVENT, take);
    return () => window.removeEventListener(QUOTE_SUGGESTIONS_EVENT, take);
  }, []);

  const update = (key: number, patch: Partial<Line>) =>
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Preview: same lineTotal() the server uses, over rupee text parsed exactly.
  let subtotal = 0;
  let tax = 0;
  let previewable = true;
  for (const l of lines) {
    const price = rupeesToPaise(l.unitPrice);
    const qty = Number(l.quantity);
    try {
      if (price === null || !Number.isInteger(qty))
        throw new RangeError("incomplete");
      const t = lineTotal(price, qty, Number(l.gstPercent));
      subtotal += t.subtotalPaise;
      tax += t.taxPaise;
    } catch {
      previewable = false;
    }
  }
  const total = subtotal + tax;
  const advancePct = Number(advancePercent);
  const advance =
    previewable &&
    Number.isInteger(advancePct) &&
    advancePct >= 0 &&
    advancePct <= 100
      ? advanceAmounts(total, advancePct).advancePaise
      : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    const parsed = createQuotationSchema.safeParse({
      items: lines.map(({ description, quantity, unitPrice, gstPercent }) => ({
        description,
        quantity,
        unitPrice,
        gstPercent,
      })),
      leadTimeDays,
      validUntil,
      advancePercent,
      terms,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await postJson(
      `/api/admin/requests/${requestId}/quotations`,
      {
        items: lines.map(
          ({ description, quantity, unitPrice, gstPercent }) => ({
            description,
            quantity,
            unitPrice,
            gstPercent,
          }),
        ),
        leadTimeDays,
        validUntil,
        advancePercent,
        terms,
      },
    );
    setBusy(false);
    if (result.ok) {
      router.refresh();
      return;
    }
    setFormError(result.message);
  };

  const err = (key: string) =>
    errors[key] ? (
      <p className="field-error" id={`qf-${key}-error`}>
        {errors[key]}
      </p>
    ) : null;

  return (
    <form className="quote-form" onSubmit={submit} noValidate aria-busy={busy}>
      <h3>New quotation (version {nextVersion})</h3>
      <fieldset disabled={busy} className="quote-lines">
        <legend>Line items</legend>
        {lines.map((line, i) => (
          <div className="quote-line" key={line.key}>
            <div className="field quote-line-desc">
              <label htmlFor={`qf-desc-${line.key}`}>
                Description (item {i + 1})
              </label>
              <input
                id={`qf-desc-${line.key}`}
                className="plain-input"
                value={line.description}
                onChange={(e) =>
                  update(line.key, { description: e.target.value })
                }
              />
              {err(`items.${i}.description`)}
            </div>
            <div className="field">
              <label htmlFor={`qf-qty-${line.key}`}>Quantity</label>
              <input
                id={`qf-qty-${line.key}`}
                className="plain-input"
                inputMode="numeric"
                value={line.quantity}
                onChange={(e) => update(line.key, { quantity: e.target.value })}
              />
              {err(`items.${i}.quantity`)}
            </div>
            <div className="field">
              <label htmlFor={`qf-price-${line.key}`}>Unit price (₹)</label>
              <input
                id={`qf-price-${line.key}`}
                className="plain-input"
                inputMode="decimal"
                placeholder="0.00"
                value={line.unitPrice}
                onChange={(e) =>
                  update(line.key, { unitPrice: e.target.value })
                }
              />
              {err(`items.${i}.unitPrice`)}
            </div>
            <div className="field">
              <label htmlFor={`qf-gst-${line.key}`}>GST %</label>
              <select
                id={`qf-gst-${line.key}`}
                className="plain-input"
                value={line.gstPercent}
                onChange={(e) =>
                  update(line.key, { gstPercent: e.target.value })
                }
              >
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </select>
            </div>
            {lines.length > 1 && (
              <button
                type="button"
                className="cart-remove quote-line-remove"
                onClick={() =>
                  setLines((all) => all.filter((l) => l.key !== line.key))
                }
              >
                Remove item {i + 1}
              </button>
            )}
          </div>
        ))}
        {err("items")}
        <Button
          type="button"
          variant="secondary"
          disabled={lines.length >= MAX_LINE_ITEMS}
          onClick={() => setLines((all) => [...all, blankLine()])}
        >
          Add line item
        </Button>
      </fieldset>

      <div className="quote-meta">
        <div className="field">
          <label htmlFor="qf-lead">Lead time (days)</label>
          <input
            id="qf-lead"
            className="plain-input"
            inputMode="numeric"
            value={leadTimeDays}
            onChange={(e) => setLeadTime(e.target.value)}
          />
          {err("leadTimeDays")}
        </div>
        <div className="field">
          <label htmlFor="qf-valid">Valid until</label>
          <input
            id="qf-valid"
            className="plain-input"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
          {err("validUntil")}
        </div>
        <div className="field">
          <label htmlFor="qf-adv">Advance (%)</label>
          <input
            id="qf-adv"
            className="plain-input"
            inputMode="numeric"
            value={advancePercent}
            onChange={(e) => setAdvance(e.target.value)}
          />
          {err("advancePercent")}
        </div>
      </div>
      <div className="field">
        <label htmlFor="qf-terms">Terms (optional)</label>
        <textarea
          id="qf-terms"
          className="plain-input"
          rows={3}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
        />
        {err("terms")}
      </div>

      <dl className="quote-preview" aria-label="Quotation preview">
        <div>
          <dt>Subtotal</dt>
          <dd>{previewable ? formatMoney(subtotal) : "—"}</dd>
        </div>
        <div>
          <dt>GST</dt>
          <dd>{previewable ? formatMoney(tax) : "—"}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{previewable ? formatMoney(total) : "—"}</dd>
        </div>
        <div>
          <dt>Advance</dt>
          <dd>{advance !== null ? formatMoney(advance) : "—"}</dd>
        </div>
      </dl>
      {formError && (
        <p className="field-error" role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Issuing…" : `Issue quotation v${nextVersion}`}
      </Button>
    </form>
  );
}
