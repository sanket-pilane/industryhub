# Implementation checklist

The product and acceptance contract is [Project.md](../Project.md).

## Phase 0 — Discovery and scaffold

- [x] Read complete specification; repository initially contained only Project.md.
- [x] Inspect parent/project instructions and Catalyst configuration (none existed).
- [x] Check connected tools: Figma available; CatalystbyZoho tools unavailable.
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
- Local Postman health request: HTTP 200; two assertions passed. No live Catalyst interaction verified.

Next phase: implement full customer workflows. Read-only catalog browsing and fixture previews are already available; cart mutations, checkout/payment, drawing submission, quote actions, tracking and support tickets are not implemented.

## Remaining phases

- [ ] Phase 1: complete customer catalog, wishlist, cart, checkout/payment, orders, drawing uploads, quotations, tracking, account and support; customer happy path.
- [ ] Phase 2: connect Catalyst MCP, resolve existing Development project, CLI-generate configuration, integrate Authentication/Functions/Data Store/Stratus; live happy path.
- [ ] Phase 3: supplier workspace and ownership checks.
- [ ] Phase 4: admin operations and audited manufacturing state machine.
- [ ] Phase 5: security, accessibility, resilience, performance and deployment hardening.

## Decisions and constraints

- Start with Phase 0 as requested in section 24; later workflows remain explicitly unfinished.
- No Catalyst infrastructure/configuration files or resource IDs are invented.
- No cloud deployment or real payment integration.
- Mock identity is demonstrative, never a replacement for Catalyst authentication.
- Figma is the visual source; product specification wins for minimum hit targets, no clipping and readable mobile text. Figma's hardcoded marketing inventory counts are replaced by actual local inventory counts.
- UI/UX search returned a generic retail palette; discarded in favor of supplied navy/blue/orange tokens.
- Postman initialized locally without creating/publishing a cloud workspace.
- User explicitly requested removal of Playwright. Do not reinstall or run it; use manual localhost review and unit/component checks.
