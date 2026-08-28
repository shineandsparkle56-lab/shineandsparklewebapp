-- ─────────────────────────────────────────────
-- 1. Products table
-- ─────────────────────────────────────────────
create table if not exists products (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null check (category in ('rings','earrings','necklaces','bracelets')),
  price integer not null,
  original_price integer not null,
  discount integer not null default 0,
  image text not null,
  description text not null default '',
  sizes text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table products enable row level security;

create policy "anyone can read products"
  on products for select using (true);

create policy "anyone can insert products"
  on products for insert with check (true);

create policy "anyone can delete products"
  on products for delete using (true);

create policy "anyone can update products"
  on products for update using (true) with check (true);


-- ─────────────────────────────────────────────
-- 2. Storage bucket for product images
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Allow anyone to read images (public CDN)
create policy "public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Allow anyone (anon key) to upload images
create policy "anyone can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images');

-- Allow anyone (anon key) to delete images
create policy "anyone can delete product images"
  on storage.objects for delete
  using (bucket_id = 'product-images');

-- ─────────────────────────────────────────────
-- 3. Orders table
-- ─────────────────────────────────────────────
create table if not exists orders (
  id bigint generated always as identity primary key,
  items jsonb not null,           -- array of { product, quantity }
  subtotal integer not null,
  shipping_charge integer not null default 0,
  cod_charge integer not null default 0,
  grand_total integer not null,
  pincode text not null default '',
  payment_mode text not null default 'prepaid',
  customer_name text not null default '',
  customer_mobile text not null default '',
  customer_address text not null default '',
  customer_city text not null default '',
  customer_state text not null default '',
  created_at timestamptz not null default now()
);

alter table orders enable row level security;

create policy "anyone can insert orders"
  on orders for insert with check (true);

create policy "anyone can read orders"
  on orders for select using (true);

-- ─────────────────────────────────────────────
-- 4. Stock column on products table
-- Run this in Supabase SQL Editor if table already exists:
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0;
-- ─────────────────────────────────────────────
-- (Already included in the create table if you're starting fresh)

-- ─────────────────────────────────────────────
-- 5. Report data table (Charges + Investment Stocks)
--    One row per month, keyed by "YYYY-MM".
--    charges and investments are stored as JSONB arrays:
--    [ { "id": "...", "label": "...", "amount": "..." }, ... ]
-- ─────────────────────────────────────────────
create table if not exists report_data (
  month      text primary key,          -- "YYYY-MM"
  charges    jsonb not null default '[]',
  investments jsonb not null default '[]',
  updated_at  timestamptz not null default now()
);

alter table report_data enable row level security;

create policy "anyone can read report_data"
  on report_data for select using (true);

create policy "anyone can insert report_data"
  on report_data for insert with check (true);

create policy "anyone can update report_data"
  on report_data for update using (true) with check (true);

create policy "anyone can delete report_data"
  on report_data for delete using (true);

-- ─────────────────────────────────────────────
-- 6. App settings table
--    One row per key, e.g. key='cod_enabled', value='true'/'false'
-- ─────────────────────────────────────────────
create table if not exists app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

create policy "anyone can read app_settings"
  on app_settings for select using (true);

create policy "anyone can insert app_settings"
  on app_settings for insert with check (true);

create policy "anyone can update app_settings"
  on app_settings for update using (true) with check (true);

-- Seed default: COD enabled
insert into app_settings (key, value)
values ('cod_enabled', 'true')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────
-- 7. Product variants column
--    Each variant: { id, label, image, stock, price? }
--    If variants array is empty → product has no variants (existing behaviour).
-- ─────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]';

-- ─────────────────────────────────────────────
-- 8. Base variant label column
--    Human-readable name for the implicit "base" option
--    when a product has variants (e.g. "Gold", "Original").
-- ─────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS base_variant_label text;

-- ─────────────────────────────────────────────
-- 9. Subcategories — add parent_id to categories
--    NULL parent_id = top-level category (e.g. "Earrings")
--    Non-null parent_id = subcategory (e.g. "Stud Earrings" under "Earrings")
-- ─────────────────────────────────────────────
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS parent_id integer REFERENCES categories(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────
-- 10. Shipping dimensions & weight columns on orders
-- ─────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS box_length  numeric(6,1) DEFAULT 5,
  ADD COLUMN IF NOT EXISTS box_breadth numeric(6,1) DEFAULT 5,
  ADD COLUMN IF NOT EXISTS box_height  numeric(6,1) DEFAULT 3,
  ADD COLUMN IF NOT EXISTS weight_kg   numeric(6,3) DEFAULT 0.5;

-- ─────────────────────────────────────────────
-- 11. Product tags (text array for festival/collection tagging)
--     e.g. tags = '{"navratri","diwali"}'
-- ─────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- GIN index for fast @> (array contains) queries
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN (tags);

-- ─────────────────────────────────────────────
-- 12. Festivals table
--     Each row is one festival / seasonal store.
--     sections: jsonb array of { title, tag } — drives the category sections
--               on the festival store page.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS festivals (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug         text NOT NULL UNIQUE,           -- e.g. "navratri-2026"  (used in URL)
  name         text NOT NULL,                   -- e.g. "Navratri 2026"
  tagline      text NOT NULL DEFAULT '',        -- e.g. "Celebrate with colours"
  -- Hero banner
  banner_url   text NOT NULL DEFAULT '',        -- hero image URL
  banner_bg    text NOT NULL DEFAULT '#FF6B35', -- CSS colour / gradient string
  -- Sponsor strip (optional) – jsonb array of { name, logo_url }
  sponsors     jsonb NOT NULL DEFAULT '[]',
  -- Sections – jsonb array of { title, tag }
  -- tag must match a value in products.tags
  sections     jsonb NOT NULL DEFAULT '[]',
  -- Visibility window
  active_from  date,
  active_until date,
  is_active    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE festivals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read festivals"
  ON festivals FOR SELECT USING (true);

CREATE POLICY "anyone can insert festivals"
  ON festivals FOR INSERT WITH CHECK (true);

CREATE POLICY "anyone can update festivals"
  ON festivals FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "anyone can delete festivals"
  ON festivals FOR DELETE USING (true);


-- ─────────────────────────────────────────────
-- 14. Mobile banner for festivals
--     Separate image optimised for portrait/mobile viewports.
--     Falls back to banner_url when empty.
-- ─────────────────────────────────────────────
ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS banner_url_mobile text NOT NULL DEFAULT '';

-- ─────────────────────────────────────────────
-- 15. Product sizes column
--     Array of available sizes e.g. ["2.4","2.6","2.8"] for bangles.
--     Shown as small tags on product cards.
-- ─────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sizes text[] NOT NULL DEFAULT '{}';
