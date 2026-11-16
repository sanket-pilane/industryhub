# INDUSTRIHUB — Codex Build Specification

> Copy this file into the root of the implementation repository and ask Codex to execute it phase by phase. This document is both the product brief and the engineering acceptance contract.

## 1. Codex Mission

Build **INDUSTRIHUB**, a production-structured, responsive industrial B2B e-commerce and custom-manufacturing platform.

The platform must:

- Match the existing Figma prototype closely on desktop and mobile.
- Be implemented with **Next.js + TypeScript**.
- Run locally with realistic seed data before a real database is connected.
- Be a single **Next.js** application: pages, API (Route Handlers), authentication, data access, file handling and email all live in this codebase.
- Support three role-aware workspaces: **Customer**, **Supplier**, and **Admin**.
- Implement real navigation, forms, search, filters, validation, data state, loading states, empty states, and error states—not static slideshow screens.
- Preserve a clean architecture so mock services can be replaced with real database/storage services without rewriting UI components.

### Source of truth

- Product name: `INDUSTRIHUB`
- Figma design: https://www.figma.com/design/Tqt0gIyXS1ceEhPZgRLh8U
- Demo logged-in customer: **Srushti Shinde**, initials `SS`
- Currency: `INR`
- Primary market assumptions: Indian industrial buyers and suppliers; support GST invoices and GSTIN fields.

Do not invent credentials, connection strings, API keys, payment credentials, or production URLs.

---

## 2. Required Working Style for Codex

1. Inspect the repository, `AGENTS.md`, and existing code before editing.
2. Keep a short implementation checklist and complete work in the phases defined below.
3. Make reasonable UI implementation decisions without repeatedly asking for minor preferences.
4. Do not overwrite unrelated user changes.
5. Use mock mode for frontend progress until the real database and services are connected.
6. Keep secrets in `.env.local` (never committed) and read them only in server-only modules.
7. Never deploy to production without explicit approval.
8. After every phase, run type-checking, linting, relevant tests, and a production build.
9. Do not claim a workflow is complete unless its buttons, states, routes, and API calls work.

---

## 3. Architecture Decision

INDUSTRIHUB is one Next.js application. There is no separate backend service.

```text
Next.js application (web/)
  ├── App Router pages and layouts (server + client components)
  ├── Route Handlers: web/app/api/* (contract in section 15)
  │     ├── Authentication and role authorization
  │     ├── Product/catalog, wishlist, cart/order/checkout
  │     ├── Drawing/RFQ/quotation endpoints
  │     ├── Supplier and admin endpoints
  │     └── Support/invoice/tracking endpoints
  ├── Repository layer: web/lib/repositories (mock adapter today, database adapter later)
  └── Server-only services: session/auth, file storage, email, payments
```

### Why this architecture

- One deployable, one language, one set of TypeScript contracts shared by UI and API.
- Authorization runs on the server (Route Handlers, server components, server-only modules); the browser is never trusted.
- The repository interface lets the mock adapter be replaced by a database adapter without UI changes.
- Binary files (drawings, QC documents, invoices) go to object storage, never into database rows.
- A separate worker service is introduced only if a future job (for example CAD processing) needs a long-running process.

### Services to choose before Phase 2

These are decisions, not yet made. Record the choice in this section before integrating:

| Concern | Requirement |
|---|---|
| Database | Relational (e.g. PostgreSQL) with migrations and a typed client |
| Authentication | Email/password with hashed passwords and server-validated sessions (library or self-managed) |
| File storage | Private object storage with short-lived signed upload/download URLs (S3-compatible or equivalent) |
| Email | Transactional email provider for notifications |
| Hosting | Any host that runs a Next.js Node.js server |

### Local-first adapter design

```env
NEXT_PUBLIC_DATA_MODE=mock
```

- `mock` is the only mode today: local fixtures and deterministic simulated API latency/errors.
- A database-backed mode is added alongside a real repository implementation in Phase 2.
- UI components must depend on typed repositories/services, not directly on fixture files or database clients.

---

## 4. Recommended Technology Stack

### Web

- Next.js App Router
- TypeScript with strict mode
- Tailwind CSS
- Accessible headless UI primitives such as Radix UI or shadcn/ui, restyled to match Figma
- TanStack Query for server state and caching
- React Hook Form + Zod for forms and validation
- Zustand or a small context store for cart/UI state only
- Lucide icons or the existing INDUSTRIHUB icon set
- `next/image` for optimized product imagery

### Testing and quality

- ESLint and Prettier
- Vitest + Testing Library for units/components
- Playwright for critical user journeys
- Axe accessibility checks in key pages
- No `any` unless documented and unavoidable

### Server (inside Next.js)

- Route Handlers under `web/app/api` for the REST contract
- Node.js 24 runtime
- `server-only` modules for secrets, sessions, database and storage access
- Zod validation at every write endpoint
- Database client/ORM, auth library and storage SDK chosen per section 3

---

## 5. Repository Structure

```text
industrihub/
├── package.json                 # npm workspaces: web, shared
├── web/                         # Next.js application
│   ├── app/
│   │   ├── (auth)/              # login + signup
│   │   └── api/                 # Route Handlers
│   ├── components/
│   │   ├── ui/
│   │   ├── auth/
│   │   ├── catalog/
│   │   ├── quotations/
│   │   ├── manufacturing/
│   │   └── dashboards/
│   ├── lib/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── repositories/
│   │   ├── validators/
│   │   └── utils/
│   ├── mocks/
│   ├── public/
│   └── tests/
├── shared/
│   ├── contracts/
│   ├── enums/
│   └── schemas/
└── docs/
    ├── API.md
    ├── DATA_MODEL.md
    └── LOCAL_SETUP.md
```

---

## 6. Visual System

Match the Figma design instead of introducing a generic dashboard theme.

### Core tokens

```text
Dark navy:       #061A34
Deep navy:       #0B1F3A
Brand blue:      #0B63D0
Safety orange:   #FF6A00
Page background: #F5F8FC
Card background: #FFFFFF
Primary text:    #0F172A
Muted text:      #64748B
Border:          #DCE6F1
Success:         #0F9F62
Warning:         #F59E0B
Error:           #DC2626
Font:            Inter
```

### UI rules

- Desktop reference width: 1440 px.
- Mobile reference width: 390 px; verify 375 px as the smallest supported viewport.
- Use an 8 px spacing rhythm.
- Use 44–48 px minimum interactive targets.
- Use 150–240 ms opacity, colour, border, and elevation transitions.
- Do not animate layout position or height for ordinary hover/press effects.
- Never allow tables or quote IDs to clip at container edges.
- In the desktop quotation table, reserve a 130 px Quote ID cell with 16 px internal left padding.
- Provide visible focus rings, keyboard navigation, skeletons, empty states, error states, and reduced-motion support.
- Desktop pages may scroll; do not compress content to force everything above the fold.

---

## 7. User Roles and Authorization

### Roles

```text
CUSTOMER
SUPPLIER
ADMIN
```

Store the login identity (email, password hash, sessions) with the chosen authentication approach. Store the business profile and role in `UserProfiles`.

### Access matrix

| Capability | Customer | Supplier | Admin |
|---|---:|---:|---:|
| Browse products | Yes | Yes | Yes |
| Cart and checkout | Yes | No | Admin support only |
| Upload drawings/request quote | Yes | No | Yes |
| View own quotations/orders | Yes | No | All |
| View assigned RFQs/jobs | No | Yes | All |
| Update manufacturing progress | No | Assigned jobs | All |
| Upload QC documents | No | Assigned jobs | All |
| Manage catalog/users/suppliers | No | No | Yes |
| Manage payments/invoices/tickets | Own only | Assigned only | All |

Authorization must be enforced on the server (Route Handlers and server components), not only by hiding navigation links.

---

## 8. Required Routes and Screens

### Public/customer web routes

```text
/login
/
/catalog
/catalog/[slug]
/search
/wishlist
/cart
/checkout
/orders
/orders/[id]
/orders/[id]/confirmed
/upload-drawing
/drawings
/quotations
/quotations/[id]
/manufacturing/[id]/track
/account
/support
/support/[ticketId]
```

### Supplier routes

```text
/supplier
/supplier/profile
/supplier/rfqs
/supplier/rfqs/[id]
/supplier/jobs
/supplier/jobs/[id]
/supplier/qc
/supplier/payments
```

### Admin routes

```text
/admin
/admin/products
/admin/categories
/admin/brands
/admin/customers
/admin/suppliers
/admin/drawings
/admin/quotations
/admin/orders
/admin/manufacturing
/admin/qc
/admin/payments
/admin/invoices
/admin/shipping
/admin/support
/admin/audit-log
```

Use route groups and role-aware layouts. Protect customer, supplier, and admin routes.

---

## 9. Customer Features

### Authentication and account

- Email/password signup, login and logout.
- Branded login and signup screens.
- Session validation on protected layouts.
- Account profile, company name, GSTIN, addresses, phone, and notification preferences.
- Demo mock user: Srushti Shinde.

### Catalog

- Product categories: Bearings, Fasteners, Pneumatics, Electrical Components, Automation Products, Tools, Gears, Shafts, Couplings.
- Search by SKU, name, brand, specification, and category.
- Filters: category, brand, price, availability, technical attributes.
- Sort: relevance, newest, price low/high.
- Product page with gallery, price, GST indicator, stock, quantity, specifications, compatible items, and downloadable datasheet.
- Wishlist, cart, quantity updates, removal, and cart totals.

### Checkout and orders

- Address selection/creation.
- GST invoice details.
- Delivery method and summary.
- Payment adapter interface with a deterministic mock payment provider for local development.
- Never store card information.
- Order confirmation, order history, invoice download, and shipment tracking.

### Drawing upload and quotation

- Accept `PDF`, `DWG`, `DXF`, `STEP`, and `STP`.
- Configurable maximum size; default mock limit 50 MB.
- Drag/drop and file picker.
- Upload progress, cancel, retry, unsupported type, size error, duplicate warning, and success states.
- Capture part name, quantity, material, tolerance, process, finish, target date, notes, and confidentiality acknowledgement.
- Drawing history and revision history.
- Quotation list with real search, status filters, pagination, URL query parameters, loading, empty, and no-results states.
- Quote detail, line items, taxes, lead time, validity, terms, download, accept, reject, and request-revision actions.

### Support

- Ticket list, ticket detail, message thread, attachments, priority, category, and status.

---

## 10. Custom Manufacturing Workflow

Implement and validate this server-side state machine:

```text
DRAFT
  → SUBMITTED
  → UNDER_ENGINEERING_REVIEW
  → QUOTED
  → ACCEPTED
  → ADVANCE_PENDING
  → ADVANCE_PAID
  → SUPPLIER_ASSIGNMENT
  → IN_PRODUCTION
  → QC_IN_PROGRESS
  → QC_APPROVED
  → READY_TO_DISPATCH
  → DISPATCHED
  → DELIVERED
```

Supported side states:

```text
REVISION_REQUESTED
ON_HOLD
REJECTED
CANCELLED
QC_REJECTED
```

Every transition must:

- Check role and ownership.
- Validate allowed previous states.
- Append a status-history row.
- Record who changed the state and when.
- Return the updated resource.
- Trigger a notification asynchronously where applicable.

---

## 11. Supplier Features

- Supplier registration and company verification status.
- Capability profile: processes, materials, machines, tolerances, certifications, capacity, service regions, and lead time.
- RFQ inbox with accept/decline/submit-offer actions.
- Assigned manufacturing jobs.
- Production progress percentage and milestone updates.
- Upload QC reports, certificates, inspection images, and packing documents.
- Dispatch data: courier, tracking number, expected delivery, packing notes.
- Supplier payment status and remittance references.
- Supplier users must only see RFQs/jobs explicitly assigned to their supplier record.

---

## 12. Admin Features

- Dashboard metrics for orders, quotations, review queue, manufacturing, QC, dispatch, tickets, and payments.
- CRUD for products, categories, brands, images, specifications, prices, and inventory.
- Customer and supplier profile management.
- Supplier verification and capability management.
- Drawing review queue.
- Create/revise/send quotations.
- Accept/reject supplier offers and assign jobs.
- Manage order, payment, invoice, QC, and shipment states.
- Ticket management and internal notes.
- Audit log for privileged actions.
- CSV export can be a later enhancement; do not block MVP on it.

---

## 13. Data Model

Every table has a primary key `Id` plus `CreatedAt` and `UpdatedAt` timestamps (and `CreatedBy` where an actor matters).

Use `decimal` for money. Do not use JavaScript floating-point calculations for authoritative totals. Store ISO-style status strings and validate them with enums.

### Identity and organizations

| Table | Important columns |
|---|---|
| `UserProfiles` | `AuthUserId`, `Role`, `FirstName`, `LastName`, `Email`, `Phone`, `CompanyName`, `GSTIN`, `IsActive` |
| `CustomerAddresses` | `CustomerId`, `Type`, `Line1`, `Line2`, `City`, `State`, `Country`, `Pincode`, `IsDefault` |
| `Suppliers` | `AuthUserId`, `CompanyName`, `GSTIN`, `VerificationStatus`, `ContactPerson`, `Address`, `CapabilitiesText`, `IsActive` |

### Catalog and commerce

| Table | Important columns |
|---|---|
| `Categories` | `Name`, `Slug`, `Description`, `ParentCategoryId`, `IsActive` |
| `Brands` | `Name`, `Slug`, `Description`, `IsActive` |
| `Products` | `Name`, `Slug`, `SKU`, `CategoryId`, `BrandId`, `Description`, `Price`, `GSTPercent`, `StockQuantity`, `SpecificationsText`, `PrimaryImageKey`, `IsActive` |
| `Wishlists` | `CustomerId` |
| `WishlistItems` | `WishlistId`, `ProductId` |
| `Carts` | `CustomerId`, `Status` |
| `CartItems` | `CartId`, `ProductId`, `Quantity`, `UnitPriceSnapshot` |
| `Orders` | `OrderNumber`, `CustomerId`, `Status`, `Subtotal`, `TaxAmount`, `ShippingAmount`, `TotalAmount`, `ShippingAddressText`, `PaymentStatus`, `TrackingNumber` |
| `OrderItems` | `OrderId`, `ProductId`, `SKU`, `NameSnapshot`, `Quantity`, `UnitPrice`, `TaxAmount`, `TotalPrice` |
| `Payments` | `CustomerId`, `OrderId`, `QuotationId`, `Provider`, `ProviderReference`, `Amount`, `Status`, `PaidAt` |
| `Invoices` | `InvoiceNumber`, `OrderId`, `CustomerId`, `GSTIN`, `Subtotal`, `GSTAmount`, `TotalAmount`, `StorageObjectKey`, `Status` |

### Manufacturing

| Table | Important columns |
|---|---|
| `Drawings` | `CustomerId`, `FileName`, `FileType`, `StorageObjectKey`, `FileSize`, `Revision`, `Checksum`, `UploadedAt` |
| `ManufacturingRequests` | `RequestNumber`, `CustomerId`, `DrawingId`, `PartName`, `Quantity`, `Material`, `Tolerance`, `Process`, `Finish`, `TargetDate`, `RequirementsText`, `Status` |
| `RequestStatusHistory` | `RequestId`, `FromStatus`, `ToStatus`, `ChangedByUserId`, `Comment`, `ChangedAt` |
| `Quotations` | `QuotationNumber`, `RequestId`, `CustomerId`, `SupplierId`, `Subtotal`, `TaxAmount`, `TotalAmount`, `LeadTimeDays`, `ValidUntil`, `TermsText`, `Status`, `Version` |
| `QuotationItems` | `QuotationId`, `Description`, `Quantity`, `Unit`, `UnitPrice`, `TaxPercent`, `TotalPrice` |
| `QuotationActions` | `QuotationId`, `CustomerId`, `Action`, `Comment`, `ActionAt` |
| `SupplierRFQs` | `RequestId`, `SupplierId`, `Status`, `SentAt`, `ResponseDueAt` |
| `SupplierOffers` | `SupplierRFQId`, `SupplierId`, `Amount`, `LeadTimeDays`, `Notes`, `Status` |
| `ManufacturingJobs` | `JobNumber`, `RequestId`, `QuotationId`, `SupplierId`, `Status`, `ProgressPercent`, `StartDate`, `TargetDate`, `CompletedAt` |
| `JobStatusHistory` | `JobId`, `FromStatus`, `ToStatus`, `ProgressPercent`, `Remarks`, `ChangedByUserId`, `ChangedAt` |
| `QCDocuments` | `JobId`, `SupplierId`, `DocumentType`, `StorageObjectKey`, `Remarks`, `ReviewStatus`, `UploadedAt` |
| `Dispatches` | `JobId`, `CourierName`, `TrackingNumber`, `DispatchDate`, `ExpectedDeliveryDate`, `DeliveredAt`, `Status` |

### Support and operations

| Table | Important columns |
|---|---|
| `SupportTickets` | `TicketNumber`, `CustomerId`, `SupplierId`, `Subject`, `Category`, `Priority`, `Status`, `AssignedAdminId` |
| `TicketMessages` | `TicketId`, `SenderUserId`, `MessageText`, `AttachmentObjectKey`, `IsInternal` |
| `Notifications` | `UserId`, `Type`, `Title`, `Body`, `EntityType`, `EntityId`, `ReadAt` |
| `AuditLogs` | `ActorUserId`, `Action`, `EntityType`, `EntityId`, `BeforeText`, `AfterText`, `IPAddress` |

### Data rules

- Use consistent, case-sensitive table and column names matching this section.
- Paginate every list query on the server; never return unbounded result sets.
- Store booleans as booleans and money as decimals; validate status strings against shared enums.
- Enforce row ownership (customer, supplier) in server code for every read and write.

---

## 14. File Storage Design

Use one private bucket (or equivalent) per environment, for example:

```text
industrihub-<environment>
```

Object-key conventions:

```text
product-images/{productId}/{uuid}.{ext}
drawings/{customerId}/{requestId}/{revision}/{uuid}.{ext}
qc/{supplierId}/{jobId}/{uuid}.{ext}
invoices/{customerId}/{orderId}/{invoiceNumber}.pdf
support/{ticketId}/{uuid}.{ext}
```

Drawing upload flow:

1. `POST /api/drawings/upload-intent`
2. Server validates identity, extension, declared size, and ownership.
3. Server creates a unique object key and a short-lived signed upload URL.
4. Browser uploads directly to storage and reports progress.
5. `POST /api/drawings/complete`
6. Server verifies the object exists, writes `Drawings`, and creates/updates the manufacturing request.

Never expose storage credentials to the browser. Download links for private files must be short-lived and ownership-checked.

---

## 15. API Contract

Use this response envelope:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "requestId": "...",
    "page": 1,
    "pageSize": 20,
    "total": 0
  }
}
```

Errors:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "fields": {}
  }
}
```

### Minimum endpoint set

```text
GET    /api/health
GET    /api/me
PUT    /api/me

GET    /api/categories
GET    /api/brands
GET    /api/products
GET    /api/products/:slug

GET    /api/wishlist
POST   /api/wishlist/items
DELETE /api/wishlist/items/:productId

GET    /api/cart
POST   /api/cart/items
PATCH  /api/cart/items/:itemId
DELETE /api/cart/items/:itemId

POST   /api/checkout/validate
POST   /api/orders
GET    /api/orders
GET    /api/orders/:id

POST   /api/drawings/upload-intent
POST   /api/drawings/complete
GET    /api/drawings

POST   /api/manufacturing-requests
GET    /api/manufacturing-requests
GET    /api/manufacturing-requests/:id
GET    /api/manufacturing-requests/:id/timeline

GET    /api/quotations
GET    /api/quotations/:id
POST   /api/quotations/:id/accept
POST   /api/quotations/:id/reject
POST   /api/quotations/:id/request-revision

GET    /api/support/tickets
POST   /api/support/tickets
GET    /api/support/tickets/:id
POST   /api/support/tickets/:id/messages

GET    /api/supplier/rfqs
POST   /api/supplier/rfqs/:id/respond
GET    /api/supplier/jobs
GET    /api/supplier/jobs/:id
POST   /api/supplier/jobs/:id/status
POST   /api/supplier/jobs/:id/qc-upload-intent

GET    /api/admin/dashboard
CRUD   /api/admin/products
CRUD   /api/admin/categories
CRUD   /api/admin/brands
GET    /api/admin/requests
POST   /api/admin/quotations
PATCH  /api/admin/quotations/:id
POST   /api/admin/jobs/:id/assign
PATCH  /api/admin/tickets/:id
```

Search/filter query examples:

```text
/api/products?q=bearing&category=bearings&brand=skf&inStock=true&sort=price_asc&page=1&pageSize=24
/api/quotations?q=QT-55019&status=QUOTED&page=1&pageSize=20
/api/supplier/jobs?status=IN_PRODUCTION&page=1&pageSize=20
```

---

## 16. Authentication and API Security

- Passwords are hashed with a slow, salted algorithm (scrypt, bcrypt or argon2); never stored or logged in plain text.
- Sessions use signed, HTTP-only, `SameSite=Lax` cookies (`Secure` over HTTPS) with server-side expiry checks.
- Validate the session on protected layouts and in every Route Handler that reads/writes customer, supplier, payment, drawing, or admin data.
- Reject cross-origin state-changing requests (check `Origin`); the UI and API share one origin, so no CORS is needed.
- Do not trust a role, customer ID, supplier ID, price, tax, or total supplied by the browser.
- Recalculate cart and quotation totals on the server.
- Keep secrets in environment variables read only by server-only modules; never commit them.
- Never grant admin roles to ordinary users.

---

## 17. Payments, GST, and Invoices

For the MVP:

- Implement a `PaymentGateway` interface.
- Provide a mock adapter with success, pending, cancelled, and failed outcomes.
- Leave a documented adapter boundary for Razorpay, Cashfree, or another approved provider.
- Do not integrate a real gateway without credentials and explicit approval.
- Store provider references, not card data.

GST requirements:

- Customer/company GSTIN.
- Product HSN/SAC field can be added before production.
- Support CGST + SGST for intra-state and IGST for inter-state transactions.
- Authoritative tax and invoice totals are calculated in the backend.
- Generated invoice files are stored in object storage and referenced from `Invoices`.

---

## 18. Search and Filtering Logic

Search must be functional, not a link to a static screen.

- Debounce catalog and quotation queries by approximately 250 ms.
- Keep filters in URL search parameters.
- Reset page to 1 when filters change.
- Show applied-filter chips with individual removal and Reset All.
- Show skeletons while loading.
- Show a useful no-results state with suggestions and Clear Filters.
- Filter and paginate on the server (Route Handlers / repositories).
- Users may only search records they are authorized to view.
- Desktop and mobile must share the same filter state and API contract.

---

## 19. AI Feature Roadmap

Keep AI integrations behind an `AiService` interface. Do not block the core MVP on them.

### Phase A: safe, useful assistance

- Natural-language product search translated into catalog filters.
- Drawing filename/type classification and basic document metadata extraction.
- OCR for notes in supported PDFs/images using an OCR service chosen at implementation time.
- Missing-information checks for quantity, material, tolerance, finish, and delivery date.
- Supplier suggestions based on configured process/material/capability rules.
- Support assistant grounded only in products, orders, quotations, and help content the user may access.

### Phase B: advanced assistance

- Quote-price suggestions based on historical approved data.
- Lead-time and delivery-risk prediction.
- QC anomaly detection and supplier-performance scoring.

Do not claim that generic OCR can understand DWG/STEP geometry. True CAD feature extraction may require a specialized parser or a separate worker service.

---

## 20. Local Development

### Mock mode (current)

```bash
npm ci
copy web\.env.example web\.env.local
npm run dev
```

Example `web/.env.example`:

```env
NEXT_PUBLIC_DATA_MODE=mock
MOCK_SESSION_SECRET=local-demo-only-change-before-sharing
```

Seed realistic records for:

- Srushti Shinde customer profile.
- At least 12 products across multiple categories.
- Four quotations matching the Figma IDs/statuses.
- Cart, checkout, confirmed order, tracking timeline, support ticket, supplier RFQ, manufacturing job, and QC document.

### Database mode (Phase 2)

1. Record the chosen database, auth approach, storage and email providers in section 3.
2. Add connection settings to `.env.example` as empty placeholders; real values live only in `.env.local` or the host's secret store.
3. Add migrations and an idempotent seed script for the records above.
4. Implement database repositories behind the existing repository interfaces.

### Deployment

```bash
npm run build
npm run start --workspace web
```

Deploy to any host that runs a Next.js Node.js server. Do not deploy to production without explicit approval.

---

## 21. Implementation Phases

### Phase 0 — Discovery and scaffold

- Inspect the repository.
- Create Next.js TypeScript app if absent.
- Configure Tailwind, linting, formatting, testing, and environment validation.
- Add typed domain contracts and mock repository interfaces.
- Add design tokens and base components.

**Exit criteria:** `npm run build`, lint, and tests pass; home/login shell renders.

### Phase 1 — Customer experience in mock mode

- Login shell and protected customer layout.
- Home, catalog, product detail, search/filter, wishlist.
- Cart, checkout, payment simulation, order confirmation, tracking.
- Drawing upload simulation, quotation list/detail, status tracking.
- Account and support screens.
- Full responsive mobile behavior.

**Exit criteria:** Playwright customer happy path passes entirely with mock data.

### Phase 2 — Backend integration (inside Next.js)

- Choose and record database, authentication, storage and email services (section 3).
- Database schema, migrations, and idempotent seed data.
- Real signup/login/logout with hashed passwords and server-validated sessions.
- Route Handlers for the section 15 contract with role and ownership checks.
- File upload/download flow (section 14).

**Exit criteria:** customer happy path passes against the real database locally.

### Phase 3 — Supplier workspace

- Supplier profile, RFQs, jobs, production updates, QC upload, dispatch, payments.
- Supplier ownership authorization.

**Exit criteria:** supplier can complete an assigned job workflow without accessing another supplier's data.

### Phase 4 — Admin workspace

- Dashboard, catalog CRUD, supplier verification, drawing review, quotation creation, job assignment, QC, orders, payments, tickets, audit log.

**Exit criteria:** admin can move a request from review to delivered with every transition recorded.

### Phase 5 — Hardening

- Accessibility audit.
- Error/empty/loading/offline states.
- Security and authorization tests.
- Rate limits and input/file validation.
- Performance review and image optimization.
- Deployment documentation.

---

## 22. Critical End-to-End Tests

1. Customer signs in and sees Srushti Shinde's dashboard.
2. Customer searches and filters products, adds an item to cart, checks out, and sees confirmation/tracking.
3. Customer uploads a supported drawing, enters requirements, and submits a quote request.
4. Customer searches quotations and filters by Pending, Quoted, and Accepted without clipped table content.
5. Admin reviews the drawing and issues a versioned quotation.
6. Customer requests a revision, then accepts the updated quotation.
7. Payment simulation succeeds and creates a manufacturing job.
8. Admin assigns a supplier.
9. Supplier updates production milestones and uploads a QC document.
10. Admin approves QC and dispatches the job.
11. Customer sees the complete manufacturing timeline and delivery details.
12. Unauthorized customer/supplier/admin API access returns the correct 401/403 response.
13. Invalid file types, oversized files, malformed IDs, invalid state transitions, and duplicate submissions are rejected cleanly.

---

## 23. Definition of Done

The project is complete only when:

- Desktop and mobile closely match the Figma design.
- All visible navigation and primary buttons work.
- Search, filtering, cart, checkout, quotation actions, and status tracking use real application state.
- Customer, supplier, and admin roles are enforced server-side.
- Local mock mode works without any external services.
- Database-backed mode works with real authentication, persistence, and file storage.
- No secrets or credentials are committed.
- All money/tax calculations are verified server-side.
- Loading, empty, validation, error, no-results, and success states exist.
- No desktop or mobile content is clipped or horizontally overflowing.
- Lint, type-check, unit tests, end-to-end critical flows, and production build pass.
- `README.md`, `docs/LOCAL_SETUP.md`, `docs/API.md`, and `docs/DATA_MODEL.md` are accurate.
- The final handoff includes deployment URLs, test commands, known limitations, and remaining production configuration.

---

## 24. First Prompt to Give Codex

```text
Read INDUSTRIHUB_CODEX_BUILD_SPEC.md completely and treat it as the product and engineering contract.

Start with Phase 0. Inspect the current repository and report what already exists. Create a concise implementation checklist, then scaffold only what is missing. Build local mock mode first so the application is demonstrable without cloud credentials.

INDUSTRIHUB is a single Next.js application; do not add a separate backend service. Do not invent credentials or resource IDs.

Use the linked Figma file as the visual source of truth. Implement real responsive application screens, not static slideshow frames. After each phase, run lint, type-check, tests, and the production build, fix failures, and summarize the completed functionality and next phase.
```

