# API contract — Phase 0

Source: Project.md section 15. Implemented local routes are limited to the table below. The eventual `/api` Advanced I/O function remains Phase 2 work.

| Method/path              | Behavior                                                         | Access         |
| ------------------------ | ---------------------------------------------------------------- | -------------- |
| GET /api/health          | Service name, mode, development environment                      | Public         |
| GET /api/products        | Search name/SKU/brand/spec/category; filters, sort, pagination   | Public         |
| GET /api/products/:slug  | Product or 404                                                   | Public         |
| GET /api/categories      | Nine seeded categories                                           | Public         |
| GET /api/me              | Session-owned customer profile or 401                            | Demo session   |
| POST /api/mock/session   | Validate demo credentials, issue signed HTTP-only session cookie | Mock mode only |
| DELETE /api/mock/session | Clear demo session                                               | Mock mode only |

`postman/specs/industrihub.openapi.json` is the machine-readable Phase 0 contract. No shared workspace was created or published.

Success: `{success:true,data,error:null,meta:{requestId,page?,pageSize?,total?}}`.
Failure: `{success:false,data:null,error:{code,message,fields?}}`.
Validation errors: 400; invalid demo login/session: 401; invalid origin: 403; unknown product: 404; unimplemented Catalyst adapter: 503.

Product query: `q`, `category`, `group`, `brand`, `inStock=true|false`, `sort=relevance|newest|price_asc|price_desc`, `page` (1+), `pageSize` (1–100, default 24). Empty results return 200 with total 0. No full-data export implicit in pagination.

Demo login accepts only `srushti.shinde@apexmotion.in` / `Industrihub@123` and a boolean `remember`. Remembered sessions expire in 7 days; otherwise the session expires in 8 hours with a browser-session cookie. The role/customer identity is fixed server-side. Mock session mutation requires same-origin requests. These public demo credentials and default signing secret are intentionally local-only. This does not constitute production authentication.

Money contract: integer paise in local service DTOs; decimal amounts in eventual Catalyst Data Store. No financial write endpoints exist yet. GST computation and payment/invoice workflows remain Phase 1/2.

Remaining endpoint set and Catalyst authentication contract: Project.md sections 15–17. Catalyst mode never silently returns mock records.
