export const roles = ["CUSTOMER", "SUPPLIER", "ADMIN"] as const;
export type Role = (typeof roles)[number];

export const manufacturingStatuses = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_ENGINEERING_REVIEW",
  "QUOTED",
  "ACCEPTED",
  "ADVANCE_PENDING",
  "ADVANCE_PAID",
  "SUPPLIER_ASSIGNMENT",
  "IN_PRODUCTION",
  "QC_IN_PROGRESS",
  "QC_APPROVED",
  "READY_TO_DISPATCH",
  "DISPATCHED",
  "DELIVERED",
  "REVISION_REQUESTED",
  "ON_HOLD",
  "REJECTED",
  "CANCELLED",
  "QC_REJECTED",
] as const;
export type ManufacturingStatus = (typeof manufacturingStatuses)[number];
export type QuotationStatus =
  "PENDING" | "QUOTED" | "ACCEPTED" | "REVISION_REQUESTED" | "REJECTED";
