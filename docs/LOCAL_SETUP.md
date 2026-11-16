# Local setup

## Prerequisites

You need:

- Node.js 24 LTS (or 26+) and npm.
- Windows PowerShell or an equivalent shell.

The repository uses root npm workspaces (`web`, `shared`), and the root `package-lock.json` is authoritative. On a clean checkout, run `npm ci` from the root:

```powershell
Set-Location 'D:\Srusthti Project'
npm ci
Copy-Item web/.env.example web/.env.local
npm run dev --workspace web -- --hostname 127.0.0.1 --port 3000
```

Then open `http://127.0.0.1:3000`.

- Both the root workspace commands and `cd web; npm run dev` work.
- Copying the example file is optional, because every setting has a safe local default.
- When resuming work, do not overwrite an existing `.env.local`.

## Database

The app uses SQLite through Node.js's built-in `node:sqlite` module, so there is no database server to install.

- **First start:** the app creates `web/.data/industrihub.db`, applies the schema migrations (`web/lib/db/schema.ts`) and seeds the starting catalogue and sample accounts.
- **Reset:** stop the server and delete `web/.data/`.
- **Tests:** each test uses its own in-memory database.
- **Warning:** Node prints `ExperimentalWarning: SQLite is an experimental feature`. This is expected.

## Configuration

| Variable              | Default                    | Meaning                                                                                |
| --------------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| `DATABASE_PATH`       | `web/.data/industrihub.db` | SQLite database file (`:memory:` gives a throwaway database)                           |
| `DRAWING_STORAGE_DIR` | `web/.data/drawings`       | Private folder for uploaded drawings and QC documents                                  |
| `SESSION_SECRET`      | development key            | HMAC key for session cookies, at least 32 characters. Set it for any shared deployment |

## Sample accounts

Every sample account uses the password `Industrihub@123`. The login page lists them under **Sample accounts**; click one to fill the form.

| Role     | Email                           | Lands on    |
| -------- | ------------------------------- | ----------- |
| Customer | `srushti.shinde@apexmotion.in`  | `/`         |
| Supplier | `rohan.patil@precisionworks.in` | `/supplier` |
| Admin    | `operations@industrihub.in`     | `/admin`    |

New sign-ups are always customer accounts.

## Sessions

- **Passwords:** stored as salted scrypt hashes.
- **Cookie:** `industrihub-session` is HTTP-only and `SameSite=Lax`. It holds the user id and an expiry, signed with HMAC-SHA256.
  - With **Remember me**, it lasts 7 days.
  - Without it, it is a browser-session cookie with an 8-hour signed expiry.
- **Routing:** `proxy.ts` checks the cookie before any page renders.
  - Signed-out visitors go to `/login`.
  - A signed-in user who opens another role's page goes to their own home.
- **Defence in depth:** layouts, pages and API routes check the session and the role again.
- **Same-origin check:** sign-in, sign-up, sign-out and every other request that changes data must come from the same origin.

## Payments

Payments go through the test-mode gateway in `web/lib/payments/gateway.ts`. It returns the outcome chosen on the payment form (success, pending, failed or cancelled) and never handles card or bank details. To use a live provider, implement the same `PaymentGateway` interface with that provider's keys.

## Quality commands

From the root: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run format:check`.

- **Manual review:** the development server runs on port **3000**.
- **Production preview:** `npm run build --workspace web`, then `npm run start --workspace web -- --hostname 127.0.0.1 --port 3000`.
- **Browser automation:** do not install it or download browsers; the user asked for it to be removed.
- **Build workers:** capped at two to keep memory use bounded on Windows.
