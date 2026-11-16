# Data model

INDUSTRIHUB stores its data in SQLite, using Node.js's built-in `node:sqlite` module.

- **Schema:** `web/lib/db/schema.ts`, applied in order by `migrate()` in `web/lib/db/index.ts`.
- **Seed data:** `web/lib/db/seed-data.ts`, loaded into an empty database on first start.
- **Connection settings:** foreign keys are enforced, and file databases use WAL journalling.
- **Transactions:** every write that touches more than one row runs inside `transaction()`, using `BEGIN IMMEDIATE`.

## Conventions

- **Money:** integer **paise** in every column, whose names end in `_paise`. GST is calculated per line with `lineTotal()`: tax = ⌊(subtotal × rate + 50) / 100⌋.
- **Readable ids:** generated from the `sequences` table by `nextNumber()`. Examples: `RFQ-IH-01001`, `QT-IH-01001`, `ORD-IH-01001`, `JOB-IH-01001`, `QC-IH-01001`, `ADV-IH-01001`.
- **Invoice numbers:** restart each Indian financial year, e.g. `INV/2026-27/00001`.
- **Timestamps:** ISO 8601 text in UTC. Customer-facing dates are shown in IST.
- **Files:** drawings and QC documents live in private storage (`DRAWING_STORAGE_DIR`) under random server-generated keys such as `requests/<uuid>.pdf` and `qc/<uuid>.pdf`. Only the key, original name, size, extension and checksum are stored in the database.

## Tables

| Group         | Table                    | Purpose                                                                                                                     |
| ------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Identity      | `users`                  | Customer, supplier and admin accounts; scrypt salt and hash; `is_active`                                                    |
|               | `addresses`              | Customer delivery addresses; the first one becomes the default                                                              |
|               | `suppliers`              | Supplier company linked to a user; verification `PENDING`, `VERIFIED` or `REJECTED`; capabilities                           |
| Catalog       | `categories`             | Nine categories in four groups                                                                                              |
|               | `products`               | SKU, price, GST rate, stock, specifications (JSON), active flag                                                             |
| Commerce      | `orders`                 | Status, payment status, subtotal, CGST/SGST/IGST, shipping, total, address snapshot, billing GSTIN, courier, invoice number |
|               | `order_items`            | Product, SKU and name snapshot, quantity, unit price, GST, tax, line total                                                  |
|               | `order_status_history`   | Every order status change, with its actor and comment                                                                       |
|               | `payments`               | Every payment attempt (order or quotation advance), with provider reference and outcome                                     |
| Manufacturing | `manufacturing_requests` | RFQ details and drawing file metadata; request status                                                                       |
|               | `request_status_history` | Every request status change, with its actor and comment                                                                     |
|               | `quotations`             | Versioned quotes per request: totals, advance %, lead time, validity, terms                                                 |
|               | `quotation_items`        | Quote line items                                                                                                            |
|               | `quotation_actions`      | Issue, accept, revision, reject and supersede events                                                                        |
|               | `jobs`                   | Production job for a supplier: status, progress %, target date, courier, tracking                                           |
|               | `job_updates`            | Every job status change and progress update                                                                                 |
|               | `qc_documents`           | Uploaded QC files with review status and comment                                                                            |
| Operations    | `audit_log`              | Admin, supplier and payment actions (`UPPER_SNAKE` action and entity type)                                                  |
|               | `sequences`              | Counters for readable ids and invoice numbers                                                                               |
|               | `schema_migrations`      | Applied schema versions                                                                                                     |

## State machines

All status changes go through `transitionRequest()`, `transitionJob()` (in `web/lib/manufacturing/status.ts`) or `transitionOrder()` (in `web/lib/orders/status.ts`). These functions reject a move the table does not allow, with HTTP 409, and write the history row in the same transaction.

- **Manufacturing request:**
  - main path: `SUBMITTED` → `UNDER_ENGINEERING_REVIEW` → `QUOTED` → `ACCEPTED` → (`ADVANCE_PENDING`) → `ADVANCE_PAID` → `SUPPLIER_ASSIGNMENT` → `IN_PRODUCTION` → `QC_IN_PROGRESS` → `QC_APPROVED` → `DISPATCHED` → `DELIVERED`;
  - revision branch: `QUOTED` → `REVISION_REQUESTED` → `QUOTED`;
  - QC rework: `QC_IN_PROGRESS` → `QC_REJECTED` → `QC_IN_PROGRESS`;
  - also possible: `REJECTED`, `CANCELLED` and `ON_HOLD`.
- **Job:** `ASSIGNED` → `IN_PRODUCTION` → `QC_SUBMITTED` → `QC_APPROVED` → `DISPATCHED` → `DELIVERED`, with `QC_REJECTED` → `QC_SUBMITTED` for rework.
- **Order:**
  - main path: `CONFIRMED` → `PACKED` → `DISPATCHED` → `DELIVERED`;
  - `CANCELLED` is possible before dispatch and restores stock;
  - an order is packed only after payment.
- **Quotation:**
  - `QUOTED` → `ACCEPTED`, `REVISION_REQUESTED` or `REJECTED`;
  - issuing a new version marks open earlier versions `SUPERSEDED`;
  - only the latest unexpired quote can be acted on.

## Access rules (enforced on the server)

- **Customers** see only their own addresses, orders, requests, quotations, payments and QC documents. Another customer's record returns 404.
- **Suppliers** see only jobs assigned to them, and the drawing for those jobs. They never see customer identity or prices.
- **Admins** see everything; every admin change is written to `audit_log`.
- **Customers never see the supplier:** request history shows "Verified manufacturing partner" instead of the supplier.

## Not modelled

Wishlists, support tickets, notifications/email, supplier bidding (RFQ offers), product images upload and HSN codes are outside this release.
