# Implementation checklist

The product and acceptance contract is [Project.md](../Project.md).

## Phase 0 — Discovery and scaffold

- [x] Read complete specification; repository initially contained only Project.md.
- [x] Inspect parent/project instructions.
- [x] Check connected tools: Figma available.
- [x] Retrieve desktop/mobile home and login Figma context, screenshots, and assets.
- [x] Scaffold Next.js App Router, strict TypeScript, Tailwind, linting, formatting.
- [x] Add typed contracts, repository interfaces, deterministic seed data, environment validation.
- [x] Implement responsive home/login shells and local demo session.
- [x] Configure and run unit/component checks and production build; browser automation subsequently removed per user request.
- [x] Document local setup, API boundary, data model and remaining work.

## Phase 0 verification — 29 October 2026

- Clean root `npm ci`: successful; audit reported zero vulnerabilities.
- `npm run lint`, `npm run typecheck`, `npm run format:check`: passed.
- `npm test`: 14 tests passed across three files (repository queries/ownership, token integrity, origins, validation, money and login form).
- `npm run build`: passed with two build workers.
- Historical browser check: 14 tests passed against the local production build before browser automation was removed at the user's request. The test command, configuration, browser tests and generated artifacts have been removed.
- Axe WCAG 2 A/AA and 2.1 AA scans: no violations in tested home/login/catalog/customer overview states. This is scoped automation, not a complete platform accessibility certification.
- Reviewed generated desktop/mobile home and login screenshots against Figma references; adapted inaccessible contrast, clipped summary rows and mobile table keyboard scrolling.
- `postman spec lint postman/specs/industrihub.openapi.json --issueType syntax --no-report-events --output json`: zero syntax violations. Governance lint requires Postman login and was not run.
- Local Postman health request: HTTP 200; two assertions passed.

This section is the historical Phase 0 record; the workflows it lists as missing were delivered in the release below.

## Release — 16 November 2026

Implemented in this release:

- [x] **SQLite database.** `node:sqlite` with migrations, seed data, transactions and readable id sequences.
- [x] **Accounts and sessions.**
  - Real accounts with scrypt password hashes and HMAC-signed session cookies.
  - Customer, supplier and admin roles, routed by `proxy.ts` and checked again in every layout, page and API route.
- [x] **Drawing upload (RFQ).** The file is checked for type, size and content signature, then stored in private storage; the request record is kept in the database with its full status history.
- [x] **Quotation workflow.**
  - Admin side: engineering review queue and versioned quotations.
  - Customer side: accept, request revision or reject.
  - Advance payment through the test-mode gateway, with retry.
- [x] **Checkout and orders.**
  - Saved addresses, standard or express delivery, and server-side pricing with a CGST/SGST or IGST split.
  - Payment, retry and stock reservation.
  - GST tax invoice with per-financial-year numbering.
  - Order tracking, and admin handling: pack, dispatch, deliver, cancel with restock.
- [x] **Supplier workspace.**
  - Assigned jobs and the drawing download.
  - Production progress, QC document upload and dispatch with tracking.
  - Profile and verification status.
- [x] **Admin workspace.**
  - Dashboard and review queue.
  - Supplier assignment (verified suppliers only) and QC approve or reject.
  - Delivery, orders, catalog management, supplier verification and audit log.

### Verification — 16 November 2026

- `npm run lint`, `npm run typecheck` and `npm run format:check`: passed.
- `npm test`: 215 tests passed in 20 files.
- `npm run build`: passed. It produced 28 pages, 38 API route files and the proxy.
- **End-to-end HTTP walkthrough** against the production build with a fresh database: **83 of 83 checks passed**. It covered:
  - sign-in for all roles, plus role and ownership refusals;
  - drawing upload, quotation v1, revision, v2, acceptance, a failed and then a successful advance payment, and assignment (an unverified supplier was refused);
  - production, QC rejection and resubmission, QC approval, dispatch and delivery;
  - GST quotes inside and outside Maharashtra, an order with a failed payment then a retry, the invoice, and admin pack, dispatch and deliver;
  - catalog product creation, supplier verification and the audit log;
  - every page for every role.
- Screenshots of every customer, supplier and admin screen were reviewed at desktop and mobile widths.

## Not in this release

- [ ] Live payment provider. The `PaymentGateway` interface is ready; set the provider's keys to switch from test mode.
- [ ] Email and SMS notifications; password reset by email (users currently contact the administrator).
- [ ] Wishlist, support tickets, supplier bidding on RFQs, product image upload, HSN codes on invoices.
- [ ] Hosted deployment with object storage for files and a managed database.

## Decisions and constraints

- Start with Phase 0 as requested in section 24; later workflows remain explicitly unfinished.
- 30 October 2026: Catalyst removed from the plan at the user's request; INDUSTRIHUB is a single Next.js application. The pre-removal state is commit `3198269`.
- No credentials, connection strings or resource IDs are invented.
- No cloud deployment or live payment integration.
- 16 November 2026: database, accounts and the remaining workflows implemented; payments stay in test mode until a provider account is configured.
- Figma is the visual source; product specification wins for minimum hit targets, no clipping and readable mobile text. Figma's hardcoded marketing inventory counts are replaced by actual local inventory counts.
- UI/UX search returned a generic retail palette; discarded in favor of supplied navy/blue/orange tokens.
- Postman initialized locally without creating/publishing a cloud workspace.
- User explicitly requested removal of Playwright. Do not reinstall or run it; use manual localhost review and unit/component checks.
