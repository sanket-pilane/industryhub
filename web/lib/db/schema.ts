/**
 * Database schema, applied in order by `migrate()`. Append new migrations;
 * never edit one that has shipped. Money is stored as INTEGER paise.
 */
export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'SUPPLIER', 'ADMIN')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL,
  gstin TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  label TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX addresses_user ON addresses(user_id);

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  company_name TEXT NOT NULL,
  gstin TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  capabilities TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  created_at TEXT NOT NULL
);

CREATE TABLE categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_slug TEXT NOT NULL REFERENCES categories(slug),
  brand TEXT NOT NULL,
  description TEXT NOT NULL,
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  gst_percent INTEGER NOT NULL CHECK (gst_percent BETWEEN 0 AND 100),
  stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0),
  specifications TEXT NOT NULL DEFAULT '{}',
  image TEXT,
  symbol TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX products_category ON products(category_slug);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  subtotal_paise INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0,
  sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0,
  shipping_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL,
  shipping_address TEXT NOT NULL,
  billing_gstin TEXT NOT NULL DEFAULT '',
  delivery_method TEXT NOT NULL,
  courier TEXT NOT NULL DEFAULT '',
  tracking_number TEXT NOT NULL DEFAULT '',
  invoice_number TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX orders_customer ON orders(customer_id);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_paise INTEGER NOT NULL,
  gst_percent INTEGER NOT NULL,
  tax_paise INTEGER NOT NULL,
  total_paise INTEGER NOT NULL
);
CREATE INDEX order_items_order ON order_items(order_id);

CREATE TABLE order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id),
  status TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL
);
CREATE INDEX order_history_order ON order_status_history(order_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES users(id),
  order_id TEXT REFERENCES orders(id),
  quotation_id TEXT REFERENCES quotations(id),
  provider TEXT NOT NULL,
  provider_reference TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE manufacturing_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES users(id),
  part_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  material TEXT NOT NULL,
  tolerance TEXT NOT NULL,
  process TEXT NOT NULL,
  finish TEXT NOT NULL,
  target_date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  revision INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_extension TEXT NOT NULL,
  file_checksum TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX requests_customer ON manufacturing_requests(customer_id);
CREATE INDEX requests_status ON manufacturing_requests(status);

CREATE TABLE request_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL REFERENCES manufacturing_requests(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  changed_at TEXT NOT NULL
);
CREATE INDEX request_history_request ON request_status_history(request_id);

CREATE TABLE quotations (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES manufacturing_requests(id),
  customer_id TEXT NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  subtotal_paise INTEGER NOT NULL,
  tax_paise INTEGER NOT NULL,
  total_paise INTEGER NOT NULL,
  advance_percent INTEGER NOT NULL DEFAULT 50,
  lead_time_days INTEGER NOT NULL,
  valid_until TEXT NOT NULL,
  terms TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX quotations_request ON quotations(request_id);
CREATE INDEX quotations_customer ON quotations(customer_id);

CREATE TABLE quotation_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_id TEXT NOT NULL REFERENCES quotations(id),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0),
  gst_percent INTEGER NOT NULL,
  tax_paise INTEGER NOT NULL,
  total_paise INTEGER NOT NULL
);
CREATE INDEX quotation_items_quotation ON quotation_items(quotation_id);

CREATE TABLE quotation_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_id TEXT NOT NULL REFERENCES quotations(id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES manufacturing_requests(id),
  quotation_id TEXT NOT NULL REFERENCES quotations(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  target_date TEXT NOT NULL,
  courier TEXT NOT NULL DEFAULT '',
  tracking_number TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX jobs_supplier ON jobs(supplier_id);
CREATE INDEX jobs_request ON jobs(request_id);

CREATE TABLE job_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  status TEXT NOT NULL,
  progress_percent INTEGER NOT NULL,
  remarks TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL
);

CREATE TABLE qc_documents (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_extension TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  remarks TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  review_comment TEXT NOT NULL DEFAULT '',
  uploaded_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX audit_entity ON audit_log(entity_type, entity_id);

CREATE TABLE sequences (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
`,
  },
  {
    // AI-assisted drawing review: customer consent per request, and saved results.
    version: 2,
    sql: `
ALTER TABLE manufacturing_requests ADD COLUMN ai_review_allowed INTEGER NOT NULL DEFAULT 0;

CREATE TABLE drawing_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL REFERENCES manufacturing_requests(id),
  status TEXT NOT NULL CHECK (status IN ('COMPLETED', 'FAILED')),
  model TEXT NOT NULL,
  result TEXT,
  error TEXT NOT NULL DEFAULT '',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  requested_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX drawing_analyses_request ON drawing_analyses(request_id);
`,
  },
];
