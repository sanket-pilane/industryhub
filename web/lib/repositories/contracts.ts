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

export interface AiService {
  suggestFilters(query: string): Promise<ProductQuery>;
}
