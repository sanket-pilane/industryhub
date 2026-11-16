# INDUSTRIHUB

INDUSTRIHUB is a B2B industrial commerce and custom-manufacturing platform, built as a single Next.js application.

- Product contract: [Project.md](Project.md).
- Visual source: [Figma](https://www.figma.com/design/Tqt0gIyXS1ceEhPZgRLh8U).

## What it does

Built with Next.js 16 App Router, React 19, strict TypeScript, Tailwind 4, TanStack Query, React Hook Form and Zod. Data lives in SQLite (Node.js `node:sqlite`).

**Customers**

- **Shopping:** live product search, catalog filters, a cart, and checkout with a saved address, standard or express delivery and a billing GSTIN.
- **Pricing:** done on the server, with CGST + SGST inside Maharashtra and IGST elsewhere.
- **Payment and orders:** test-mode payment with retry, order tracking, and a printable GST tax invoice.
- **Custom manufacturing:** upload a CAD drawing (PDF, DWG, DXF, STEP or STP, up to 50 MB) with RFQ details. Then follow the request timeline; accept a quotation, request a revision or reject it; pay the advance; and track production, QC and dispatch.

**Suppliers (verified)**

- See only the jobs assigned to them and download those jobs' drawings.
- Record production progress, upload QC documents, and dispatch with courier and tracking number.
- Customer identity and prices are never shown to suppliers.

**Admins**

- Dashboard of work waiting for attention.
- Engineering review queue and versioned quotations.
- Supplier assignment (verified suppliers only), QC approval or rejection, and delivery.
- Order fulfilment, catalog management, supplier verification, and an audit log of every change.

**How access is enforced**

- Passwords are stored as scrypt hashes; the session cookie is HTTP-only and HMAC-signed.
- `proxy.ts` routes each role to its own workspace. Layouts, pages and API routes check the role again.
- Requests that change data must come from the same origin.
- Another user's records return 404.

## Run locally

Requires Node.js 24 LTS (or 26+) and npm. Verified with Node.js 24.14.1 / npm 11.11.0 on Windows.

```powershell
npm ci
Copy-Item web/.env.example web/.env.local
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The database `web/.data/industrihub.db` is created and seeded on first start; to reset it, delete `web/.data/`.

Sample accounts (password `Industrihub@123`; the login page can fill them in):

| Role     | Email                           |
| -------- | ------------------------------- |
| Customer | `srushti.shinde@apexmotion.in`  |
| Supplier | `rohan.patil@precisionworks.in` |
| Admin    | `operations@industrihub.in`     |

Payments use the built-in test-mode gateway. No money moves, and the payment form chooses the outcome. Set `SESSION_SECRET` before sharing a deployment. See [local setup](docs/LOCAL_SETUP.md).

## Verify

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```

Browser automation was removed at the user's request. Review the app manually at [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Structure

- `web/app`: pages and API route handlers.
  - `(shop)`: customer pages.
  - `supplier`, `admin`: role workspaces.
  - `api`: JSON endpoints.
- `web/lib`: server logic by area.
  - `db`, `auth`, `drawings`, `quotations`, `orders`, `jobs`, `admin`, `payments`, `manufacturing` (state machines).
- `web/components`: UI by area.
- `web/tests/unit`: unit and component tests.
- `shared/`: contracts and enums; money is always integer paise.
- `postman/specs/`: OpenAPI contract (local only).
- Docs: [implementation status](docs/IMPLEMENTATION.md), [local setup](docs/LOCAL_SETUP.md), [API](docs/API.md), [data model](docs/DATA_MODEL.md), [design evidence](docs/DESIGN.md).
