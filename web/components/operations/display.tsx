import { formatMoney } from "@/lib/utils/money";

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const stampFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

export function formatStamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : stampFormat.format(date);
}

export { formatMoney };

/** Horizontal progress bar with a text value, for job completion. */
export function ProgressBar({
  percent,
  label,
}: {
  percent: number;
  label?: string;
}) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="op-progress">
      <div
        className="op-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label={label ?? "Job progress"}
      >
        <span style={{ width: `${value}%` }} />
      </div>
      <span className="op-progress-value">{value}%</span>
    </div>
  );
}
