-- Kelsworth — database schema (PostgreSQL)
-- Run automatically by `npm run seed` — you don't need to run this by hand.
-- Safe to re-run any time: every statement uses IF NOT EXISTS, so re-running
-- this after a code update will only add what's missing, never touch existing data.

CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,       -- jeans | jackets | shorts | polos | tees | half-sleeve-shirts | full-sleeve-shirts
  fit           TEXT NOT NULL,       -- slim | straight | regular | relaxed | skinny
  color         TEXT NOT NULL,
  price         INTEGER NOT NULL,    -- PKR, whole rupees
  sale_price    INTEGER,             -- null when not on sale
  sizes         JSONB NOT NULL DEFAULT '[]',
  image         TEXT NOT NULL,
  badge         TEXT,                -- "New" | "Sale" | null
  description   TEXT NOT NULL DEFAULT '',
  fabric        TEXT NOT NULL DEFAULT '',
  care          TEXT NOT NULL DEFAULT '',
  stock         INTEGER NOT NULL DEFAULT 100,   -- legacy total; stock_by_size is now the source of truth
  stock_by_size JSONB NOT NULL DEFAULT '{}',    -- e.g. {"30": 12, "32": 8}
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id             SERIAL PRIMARY KEY,
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  phone          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL PRIMARY KEY,
  order_number    TEXT UNIQUE NOT NULL,
  customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL, -- null = guest checkout
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT NOT NULL,
  address         TEXT NOT NULL,
  city            TEXT NOT NULL,
  postal_code     TEXT,
  payment_method  TEXT NOT NULL DEFAULT 'cod',
  promo_code      TEXT,
  subtotal        INTEGER NOT NULL,
  shipping        INTEGER NOT NULL DEFAULT 0,
  discount        INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | processing | shipped | delivered | cancelled
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name  TEXT NOT NULL,   -- snapshot, so renaming/deleting a product later doesn't corrupt past orders
  size          TEXT NOT NULL,
  qty           INTEGER NOT NULL,
  unit_price    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
  id             SERIAL PRIMARY KEY,
  username       TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id                SERIAL PRIMARY KEY,
  code              TEXT UNIQUE NOT NULL,       -- stored uppercase
  discount_percent  INTEGER NOT NULL,           -- e.g. 10 = 10% off
  active            BOOLEAN NOT NULL DEFAULT true,
  expires_at        TIMESTAMPTZ,                -- null = never expires
  min_subtotal      INTEGER NOT NULL DEFAULT 0, -- order must be at least this much (in PKR) to qualify
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Migrations for databases created before these columns existed ----
-- Each line is a no-op if the column/table already exists, so this whole
-- file can be re-run safely any time (that's what `npm run seed` does).
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_by_size JSONB NOT NULL DEFAULT '{}';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT;

-- ---- Phase 1: product detail page + variants ----
-- images: full gallery (falls back to the single `image` column when empty).
-- video_url: optional product video for the gallery.
-- tags: freeform merchandising tags shown as chips ("workwear", "raw denim"...).
-- sku / sku_by_size: base SKU and a per-size override, e.g. {"30":"VW101-30"}.
-- style_code: groups color variants of the same style together, e.g. all
--   colorways of "Slim Tapered Jeans" share style_code = "VW-101-STYLE" so the
--   product page can offer a color switcher across sibling rows.
-- size_type: 'standard' (S/M/L or single numeric size) or 'waist_length'
--   (renders separate waist + length pickers that combine into a "WxL" size
--   key against the existing sizes[]/stock_by_size columns).
-- low_stock_threshold: a size at or below this count shows a low-stock badge.
-- complete_the_look / frequently_bought_with: arrays of product slugs curated
--   by admins for cross-sell sections on the product page.
ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku_by_size JSONB NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS style_code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS size_type TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS complete_the_look JSONB NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS frequently_bought_with JSONB NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS estimated_delivery TEXT NOT NULL DEFAULT '3–5 working days in major cities, 5–7 elsewhere';
ALTER TABLE products ADD COLUMN IF NOT EXISTS return_policy TEXT NOT NULL DEFAULT 'Free exchange within 14 days of delivery, tags attached and unworn.';

-- ---- Phase 2: search + filtering ----
-- material: human-readable composition label used as a filter facet
--   (distinct from the longer `fabric` paragraph shown on the product page).
-- stretch: 'none' | 'low' | 'high' — filterable stretch level.
-- collection: merchandising collection/drop name, e.g. "Core", "New Arrivals".
ALTER TABLE products ADD COLUMN IF NOT EXISTS material TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stretch TEXT NOT NULL DEFAULT 'none';
ALTER TABLE products ADD COLUMN IF NOT EXISTS collection TEXT;

-- ---- Phase 3: saved addresses + checkout extras ----
CREATE TABLE IF NOT EXISTS customer_addresses (
  id           SERIAL PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label        TEXT NOT NULL DEFAULT 'Home',
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  phone        TEXT NOT NULL,
  address      TEXT NOT NULL,
  city         TEXT NOT NULL,
  postal_code  TEXT NOT NULL DEFAULT '',
  is_default   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);

-- delivery_notes: optional courier instructions (landmark, gate code...).
-- gift_message: optional message printed on a gift receipt.
-- tax: kept for order-total transparency; Kelsworth prices are tax-inclusive
--   today so this is 0 by default (see TAX_RATE in routes/orders.js) but the
--   column exists so a real rate can be turned on without a data migration.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_message TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax NUMERIC NOT NULL DEFAULT 0;

-- ---- Phase 4: customer account (wishlist, profile, notifications) ----
CREATE TABLE IF NOT EXISTS wishlist_items (
  id           SERIAL PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_wishlist_customer_id ON wishlist_items(customer_id);

-- avatar_url: a small data URL, same trade-off as review photos (see Phase 1
--   notes) — fine for a boutique store, swap for object storage at scale.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notify_order_updates BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notify_promotions BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notify_newsletter BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_style_code ON products(style_code);

-- ---- Reviews ----
CREATE TABLE IF NOT EXISTS product_reviews (
  id                 SERIAL PRIMARY KEY,
  product_id         INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id        INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name      TEXT NOT NULL,
  rating             INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title              TEXT NOT NULL DEFAULT '',
  body               TEXT NOT NULL DEFAULT '',
  images             JSONB NOT NULL DEFAULT '[]',
  video_url          TEXT,
  verified_purchase  BOOLEAN NOT NULL DEFAULT false,
  helpful_count      INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_votes (
  id          SERIAL PRIMARY KEY,
  review_id   INTEGER NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  voter_key   TEXT NOT NULL, -- logged-in customer id or an anonymous device key
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id, voter_key)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
