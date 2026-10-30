import type { ManufacturingStatus, QuotationStatus, Role } from "../enums";

/** Money crosses service boundaries as integer paise; never binary fractional INR. */
export type MoneyPaise = number;
export interface UserProfile {
  id: string;
  role: Role;
  firstName: string;
  lastName: string;
  initials: string;
  email: string;
  phone: string;
  companyName: string;
  gstin: string;
}
export interface Category {
  slug: string;
  name: string;
  group: "mechanical" | "electrical" | "automation" | "tools";
}
export interface Product {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  description: string;
  pricePaise: MoneyPaise;
  gstPercent: number;
  stockQuantity: number;
  specifications: Record<string, string>;
  image: string | null;
  symbol: string;
  featured: boolean;
}
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
export interface ProductQuery {
  q?: string;
  category?: string;
  group?: string;
  brand?: string;
  inStock?: boolean;
  sort?: "relevance" | "newest" | "price_asc" | "price_desc";
  page?: number;
  pageSize?: number;
}
export interface Quotation {
  id: string;
  customerId: string;
  partName: string;
  quantity: number;
  material: string;
  status: QuotationStatus;
  totalPaise: MoneyPaise;
  leadTimeDays: number;
  version: number;
  validUntil: string;
}
export interface StatusHistory {
  id: string;
  from: ManufacturingStatus | null;
  to: ManufacturingStatus;
  changedByUserId: string;
  changedAt: string;
  comment: string;
}
export interface ManufacturingRequest {
  id: string;
  customerId: string;
  partName: string;
  quantity: number;
  status: ManufacturingStatus;
  history: StatusHistory[];
}
export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
}
export interface Order {
  id: string;
  customerId: string;
  status: "CONFIRMED" | "DISPATCHED" | "DELIVERED";
  totalPaise: MoneyPaise;
  trackingNumber: string;
}
export interface SupportTicket {
  id: string;
  customerId: string;
  subject: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
}
export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
}
export type ApiResponse<T> =
  | {
      success: true;
      data: T;
      error: null;
      meta: {
        requestId: string;
        page?: number;
        pageSize?: number;
        total?: number;
      };
    }
  | { success: false; data: null; error: ApiError };
