# INDUSTRIHUB

Industrial B2B commerce and custom manufacturing. Product contract: [Project.md](Project.md). Visual source: [Figma](https://www.figma.com/design/Tqt0gIyXS1ceEhPZgRLh8U).

## Current milestone: Phase 0

Next.js 16 App Router, React 19, strict TypeScript, Tailwind 4, Inter, TanStack Query, React Hook Form and Zod. Desktop/mobile home and login use downloaded Figma assets. Includes a signed local demo session, protected customer overview, 12-product searchable catalog, URL filters, pagination, loading/error/empty states and four quotation fixtures.

Cart, drawing and support destinations explicitly describe their Phase 1 scope; they do not submit orders, payments, files or tickets. Supplier/admin workspaces and live Catalyst services remain unimplemented. This is a foundation, not the completed platform.

## Run locally

Node.js 24 LTS (or 26+) and npm. Verified with Node.js 24.14.1 / npm 11.11.0 on Windows.

```powershell
npm ci
Copy-Item web/.env.example web/.env.local
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

Demo email: `srushti.shinde@apexmotion.in`  
Demo password: `Industrihub@123`

These credentials and the default signing secret are intentionally public local-demo values. Do not use mock authentication for production or private business data.

## Verify

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```

Browser automation was removed at the user's request. Review the application manually at [http://127.0.0.1:3000](http://127.0.0.1:3000); unit/component checks remain available through `npm test`.

## Structure and handoff

- `web/`: application, typed repository interfaces, mock adapter, fixtures, tests.
- `shared/`: contracts, enums, runtime response schemas; integer paise for money DTOs.
- `postman/specs/`: local OpenAPI contract; no cloud workspace published.
- `functions/`: reserved for the future Catalyst Advanced I/O backend.
- [Implementation checklist](docs/IMPLEMENTATION.md), [local setup](docs/LOCAL_SETUP.md), [API](docs/API.md), [data model](docs/DATA_MODEL.md), [design evidence](docs/DESIGN.md).

Catalyst MCP tools were unavailable during discovery. No Catalyst resources, identity/configuration files or deployment URLs were created. Phase 2 must resolve the existing Development organization/project through MCP and generate `.catalystrc`/`catalyst.json` using the CLI. `NEXT_PUBLIC_DATA_MODE=catalyst` fails closed until that adapter exists.

Framework setup follows the [official Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation).
