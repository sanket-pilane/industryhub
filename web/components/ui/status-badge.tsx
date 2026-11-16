/**
 * One badge for every workflow status in the app (requests, quotations,
 * orders, payments, jobs, QC, supplier verification). Pure and client-safe.
 */
const LABELS: Record<string, string> = {
  UNDER_ENGINEERING_REVIEW: "Engineering review",
  ACCEPTED: "Accepted",
  SUPPLIER_ASSIGNMENT: "Supplier assigned",
  QC_IN_PROGRESS: "Quality check",
  QC_SUBMITTED: "QC submitted",
  QC_APPROVED: "QC approved",
  QC_REJECTED: "QC rejected",
  REVISION_REQUESTED: "Revision requested",
  ADVANCE_PENDING: "Advance pending",
  ADVANCE_PAID: "Advance paid",
};

const SUCCESS = new Set([
  "ACCEPTED",
  "ADVANCE_PAID",
  "QC_APPROVED",
  "DELIVERED",
  "PAID",
  "VERIFIED",
  "APPROVED",
]);
const DANGER = new Set(["REJECTED", "CANCELLED", "FAILED", "QC_REJECTED"]);
const PENDING = new Set([
  "SUBMITTED",
  "UNDER_ENGINEERING_REVIEW",
  "REVISION_REQUESTED",
  "ADVANCE_PENDING",
  "PENDING",
  "ON_HOLD",
  "QC_SUBMITTED",
  "QC_IN_PROGRESS",
  "ASSIGNED",
]);
const NEUTRAL = new Set(["SUPERSEDED", "DRAFT"]);

export function statusLabel(status: string) {
  if (LABELS[status]) return LABELS[status];
  const words = status.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function statusTone(status: string) {
  if (SUCCESS.has(status)) return "accepted";
  if (DANGER.has(status)) return "danger";
  if (PENDING.has(status)) return "pending";
  if (NEUTRAL.has(status)) return "neutral";
  return "info";
}

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  return (
    <span
      className={`status status-${statusTone(status)}`}
      data-status={status}
    >
      {label ?? statusLabel(status)}
    </span>
  );
}
