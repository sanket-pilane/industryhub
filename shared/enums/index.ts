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

export const quotationStatuses = [
  "QUOTED",
  "ACCEPTED",
  "REVISION_REQUESTED",
  "REJECTED",
  "SUPERSEDED",
] as const;
export type QuotationStatus = (typeof quotationStatuses)[number];

export const orderStatuses = [
  "CONFIRMED",
  "PACKED",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const paymentStatuses = [
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELLED",
] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const jobStatuses = [
  "ASSIGNED",
  "IN_PRODUCTION",
  "QC_SUBMITTED",
  "QC_APPROVED",
  "QC_REJECTED",
  "DISPATCHED",
  "DELIVERED",
] as const;
export type JobStatus = (typeof jobStatuses)[number];

export const supplierVerifications = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
] as const;
export type SupplierVerification = (typeof supplierVerifications)[number];

export const qcReviewStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
export type QcReviewStatus = (typeof qcReviewStatuses)[number];
