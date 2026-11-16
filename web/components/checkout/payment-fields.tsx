"use client";

export type PayMethod = "UPI" | "CARD" | "NETBANKING";
export type PayOutcome = "success" | "pending" | "failed" | "cancelled";

const METHODS: { value: PayMethod; label: string; hint: string }[] = [
  { value: "UPI", label: "UPI", hint: "Pay from any UPI app" },
  { value: "CARD", label: "Card", hint: "Credit or debit card" },
  { value: "NETBANKING", label: "Netbanking", hint: "Pay through your bank" },
];

const OUTCOMES: { value: PayOutcome; label: string }[] = [
  { value: "success", label: "Success" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

/** Payment method plus the test-mode outcome control. No card or bank details are collected. */
export function PaymentFields({
  idPrefix,
  method,
  outcome,
  onMethod,
  onOutcome,
  disabled = false,
}: {
  idPrefix: string;
  method: PayMethod;
  outcome: PayOutcome;
  onMethod: (value: PayMethod) => void;
  onOutcome: (value: PayOutcome) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <fieldset className="pay-methods" disabled={disabled}>
        <legend>Payment method</legend>
        {METHODS.map((m) => (
          <label
            className="pay-method"
            key={m.value}
            htmlFor={`${idPrefix}-${m.value}`}
          >
            <input
              id={`${idPrefix}-${m.value}`}
              type="radio"
              name={`${idPrefix}-method`}
              value={m.value}
              checked={method === m.value}
              onChange={() => onMethod(m.value)}
            />
            <span>
              <strong>{m.label}</strong>
              <small>{m.hint}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="field test-mode">
        <label htmlFor={`${idPrefix}-outcome`}>
          Test mode: payment outcome
        </label>
        <select
          id={`${idPrefix}-outcome`}
          className="plain-input"
          value={outcome}
          disabled={disabled}
          aria-describedby={`${idPrefix}-outcome-hint`}
          onChange={(e) => onOutcome(e.target.value as PayOutcome)}
        >
          {OUTCOMES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="field-hint" id={`${idPrefix}-outcome-hint`}>
          Payments run in test mode and no money moves. Choose the result the
          test gateway should return.
        </p>
      </div>
    </>
  );
}
