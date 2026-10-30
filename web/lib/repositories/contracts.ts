import type {
  Category,
  Page,
  Product,
  ProductQuery,
  Quotation,
  UserProfile,
} from "../../../shared/contracts";

export interface CatalogRepository {
  list(query?: ProductQuery): Promise<Page<Product>>;
  findBySlug(slug: string): Promise<Product | null>;
  categories(): Promise<Category[]>;
}
export interface ProfileRepository {
  getById(id: string): Promise<UserProfile | null>;
}
export interface QuotationRepository {
  listForCustomer(customerId: string): Promise<Quotation[]>;
}
export interface Repositories {
  catalog: CatalogRepository;
  profiles: ProfileRepository;
  quotations: QuotationRepository;
}

/** Future payment implementations return provider references; never accept card data. */
export interface PaymentGateway {
  pay(input: {
    orderId: string;
    amountPaise: number;
    outcome?: "success" | "pending" | "cancelled" | "failed";
  }): Promise<{
    status: "success" | "pending" | "cancelled" | "failed";
    providerReference: string;
  }>;
}
export interface AiService {
  suggestFilters(query: string): Promise<ProductQuery>;
}
