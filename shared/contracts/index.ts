import type {
  JobStatus,
  ManufacturingStatus,
  OrderStatus,
  PaymentStatus,
  QcReviewStatus,
  QuotationStatus,
  Role,
  SupplierVerification,
} from "../enums";

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
export interface Address {
  id: string;
  userId: string;
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}
export interface Supplier {
  id: string;
  userId: string;
  companyName: string;
  gstin: string;
  city: string;
  state: string;
  capabilities: string;
  verificationStatus: SupplierVerification;
  createdAt: string;
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

/** A customer's drawing upload and the RFQ details submitted with it. */
export interface DrawingRequest {
  id: string;
  customerId: string;
  partName: string;
  quantity: number;
  material: string;
  tolerance: string;
  process: string;
  finish: string;
  targetDate: string;
  notes: string;
  status: ManufacturingStatus;
  revision: number;
  file: { name: string; size: number; extension: string; checksum: string };
  /** The customer allows the drawing to be analysed by the AI review assistant. */
  aiReviewAllowed: boolean;
  submittedAt: string;
  updatedAt: string;
}
export interface StatusHistory {
  id: number;
  from: ManufacturingStatus | null;
  to: ManufacturingStatus;
  changedBy: string;
  changedAt: string;
  comment: string;
}

export interface QuotationItem {
  description: string;
  quantity: number;
  unitPricePaise: MoneyPaise;
  gstPercent: number;
  taxPaise: MoneyPaise;
  totalPaise: MoneyPaise;
}
export interface Quotation {
  id: string;
  requestId: string;
  customerId: string;
  partName: string;
  version: number;
  status: QuotationStatus;
  items: QuotationItem[];
  subtotalPaise: MoneyPaise;
  taxPaise: MoneyPaise;
  totalPaise: MoneyPaise;
  advancePercent: number;
  leadTimeDays: number;
  validUntil: string;
  terms: string;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPricePaise: MoneyPaise;
  gstPercent: number;
  taxPaise: MoneyPaise;
  totalPaise: MoneyPaise;
}
export interface Order {
  id: string;
  customerId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  items: OrderItem[];
  subtotalPaise: MoneyPaise;
  cgstPaise: MoneyPaise;
  sgstPaise: MoneyPaise;
  igstPaise: MoneyPaise;
  shippingPaise: MoneyPaise;
  totalPaise: MoneyPaise;
  shippingAddress: Omit<Address, "id" | "userId" | "isDefault">;
  billingGstin: string;
  deliveryMethod: string;
  courier: string;
  trackingNumber: string;
  invoiceNumber: string | null;
  createdAt: string;
}
export interface Payment {
  id: string;
  customerId: string;
  orderId: string | null;
  quotationId: string | null;
  provider: string;
  providerReference: string;
  amountPaise: MoneyPaise;
  status: PaymentStatus;
  createdAt: string;
}

export interface Job {
  id: string;
  requestId: string;
  quotationId: string;
  supplierId: string;
  status: JobStatus;
  progressPercent: number;
  targetDate: string;
  courier: string;
  trackingNumber: string;
  createdAt: string;
  updatedAt: string;
}
export interface QcDocument {
  id: string;
  jobId: string;
  supplierId: string;
  fileName: string;
  fileSize: number;
  fileExtension: string;
  remarks: string;
  reviewStatus: QcReviewStatus;
  reviewComment: string;
  uploadedAt: string;
}
export interface AuditEntry {
  id: number;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
  createdAt: string;
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
