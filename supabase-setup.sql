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
