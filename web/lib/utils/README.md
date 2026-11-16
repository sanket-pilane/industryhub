# Utilities

`money.ts` formats non-negative integer paise and computes local preview line totals with bounded integer arithmetic. Authoritative order/GST/invoice totals must be calculated on the server (Next.js route handlers), never trusted from the browser.
