# Local setup

## Prerequisites

Node.js 24 LTS (or 26+), npm, Windows PowerShell or equivalent shell. Root npm workspaces: `web`, `shared`. Root `package-lock.json` is authoritative. Run `npm ci` from the root on a clean checkout.

```powershell
Set-Location 'D:\Srusthti Project'
npm ci
Copy-Item web/.env.example web/.env.local
npm run dev --workspace web -- --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000`. Both root workspace commands and `cd web; npm run dev` work. Example copy is optional because safe local defaults select mock/Development. Do not overwrite an existing `.env.local` when resuming.

## Configuration

| Variable                     | Default                               | Meaning                                                              |
| ---------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| NEXT_PUBLIC_DATA_MODE        | mock                                  | mock or catalyst; unknown values rejected                            |
| NEXT_PUBLIC_CATALYST_API_URL | empty                                 | Catalyst mode requires an absolute HTTPS Function URL                |
| NEXT_PUBLIC_CATALYST_ENV     | development                           | development or production                                            |
| MOCK_SESSION_SECRET          | local-demo-only-change-before-sharing | Server-only demo cookie HMAC key; public default for local work only |

Mock login: `srushti.shinde@apexmotion.in` / `Industrihub@123`. This is a fixed demo account, not a user database or production authentication. Role/customer identity never comes from form input. Cookie is HTTP-only, SameSite=Lax, signed and expiring. Remember me persists for 7 days; unchecked uses a browser-session cookie with an 8-hour signed expiry. Sign out clears the cookie and query cache. Session creation/deletion rejects missing or foreign Origin headers.

Mock reads simulate deterministic 180ms latency. Unit tests can construct repositories with `latencyMs: 0` or `fail: true`. No external services, payment gateway, storage or cloud credentials are needed.

Environment variables prefixed `NEXT_PUBLIC_` are embedded during the build. Rebuild after changing modes. Catalyst mode validates the URL, then returns an explicit not-configured failure instead of falling back to demo data. Catalog API requests return 503; the application error boundary offers retry.

Build workers are capped at two to keep memory usage bounded on Windows.

## Quality commands

From root: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run format:check`.

The development server uses port **3000** for manual browser review. Production preview: `npm run start --workspace web -- --hostname 127.0.0.1 --port 3000`. Do not install browser automation or download browsers; the user requested its removal.

## Catalyst Development — pending Phase 2

Discovery found no Catalyst configuration and no `CatalystbyZoho_*` tools. No infrastructure was modified. Connect Catalyst MCP, resolve existing organization/project IDs through MCP, then use the installed CLI's non-interactive help and generate configuration. Never hand-author `.catalystrc` or `catalyst.json`. Default to Development. See Project.md sections 16 and 20 for the intended authentication/function/Slate flow.

The function local port has not been discovered because a function has not been initialized. There are no Development deployment URLs yet. Real credentials, table permissions, Authorized Domains, environment-specific ZAID, Stratus bucket and payment provider configuration remain future work.
