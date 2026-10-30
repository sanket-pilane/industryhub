# Data model — Phase 0

The complete target schema is Project.md section 13. No cloud tables or binary storage exist yet.

## Implemented local contracts

`shared/contracts/index.ts` defines UserProfile, Category, Product, ProductQuery, Page, Quotation, ManufacturingRequest, StatusHistory, CartItem, Order, SupportTicket and the API response envelope. `shared/enums` defines all three roles and the target manufacturing statuses. Status transitions are not implemented merely by defining their enum.

Product DTOs use category slugs and integer paise. Profile IDs prefixed `demo-` and seeded order/quote/request IDs are local fixture identifiers, never Catalyst resource IDs. No table IDs, organization IDs, project IDs or ZAIDs are generated.

Local fixtures in `web/mocks/seed.ts` include Srushti Shinde, 12 products across nine categories, four Figma quote IDs, a three-unit cart, dispatched order, support ticket, submitted manufacturing request/history and supplier RFQ/job/QC metadata. Binary documents are not fabricated. The demo manufacturing card is illustrative; actual submission remains Phase 1.

Repositories return cloned records so callers cannot mutate the seed. Quotation reads filter by the session-owned customer ID. Profile lookup returns only the fixed demo customer. Browser components consume typed service/repository boundaries, never fixtures.

## Target relational groups

| Group         | Target tables                                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity      | UserProfiles, CustomerAddresses, Suppliers                                                                                                                                                      |
| Catalog       | Categories, Brands, Products                                                                                                                                                                    |
| Commerce      | Wishlists, WishlistItems, Carts, CartItems, Orders, OrderItems, Payments, Invoices                                                                                                              |
| Manufacturing | Drawings, ManufacturingRequests, RequestStatusHistory, Quotations, QuotationItems, QuotationActions, SupplierRFQs, SupplierOffers, ManufacturingJobs, JobStatusHistory, QCDocuments, Dispatches |
| Operations    | SupportTickets, TicketMessages, Notifications, AuditLogs                                                                                                                                        |

Catalyst supplies ROWID, CREATORID, CREATEDTIME, MODIFIEDTIME; do not create them. Store decimal money in Data Store; convert precisely to/from integer paise DTOs. Future authoritative totals and intra/inter-state GST belong in the backend. Current calculation helper is a local preview only.

Store binary files in private Stratus objects; only metadata/object keys in Data Store. Upload intents and completion must check identity, ownership, type, size and object existence. Follow the object-key conventions and short-lived signing rules in Project.md section 14.

Future Catalyst adapters must unwrap ZCQL table rows, paginate at <=300 rows, normalize true/'true' booleans and configure permissions explicitly. Backend roles, supplier assignment and ownership checks remain mandatory; UI visibility is not authorization.
