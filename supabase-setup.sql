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
