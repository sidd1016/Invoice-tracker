-- Invoice Profit Tracker — Supabase Postgres schema
-- Run this once in the Supabase SQL editor (or via `psql` against your Supabase connection string).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create table if not exists companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (company_id, name)
);

-- ---------------------------------------------------------------------------
-- invoices
-- One row per invoice. `version` + `is_current` support the
-- "replace vs. create new version" duplicate-handling flow.
-- ---------------------------------------------------------------------------
create table if not exists invoices (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  client_id       uuid not null references clients(id) on delete cascade,
  invoice_number  text not null,
  invoice_date    date not null,
  financial_year  text not null,              -- e.g. '2025-26', derived on insert
  purchase_total  numeric(14,2) not null default 0,
  sales_total     numeric(14,2) not null default 0,
  profit_total    numeric(14,2) not null default 0,
  gst_total       numeric(14,2) not null default 0,
  original_file_path text,                     -- Supabase Storage object path
  version         int not null default 1,
  is_current      boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Fast duplicate lookup: company + client + invoice_number
create index if not exists idx_invoices_dup_lookup
  on invoices (company_id, client_id, invoice_number)
  where is_current = true;

create index if not exists idx_invoices_company on invoices (company_id);
create index if not exists idx_invoices_client on invoices (client_id);
create index if not exists idx_invoices_date on invoices (invoice_date);
create index if not exists idx_invoices_fy on invoices (financial_year);

-- ---------------------------------------------------------------------------
-- invoice_items
-- ---------------------------------------------------------------------------
create table if not exists invoice_items (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references invoices(id) on delete cascade,
  product_name  text not null,
  hsn           text,
  quantity      numeric(14,3) not null,
  buy_price     numeric(14,2) not null,
  sell_price    numeric(14,2) not null,
  gst_percent   numeric(5,2) not null default 0,
  purchase_amount numeric(14,2) not null,      -- quantity * buy_price
  sales_amount    numeric(14,2) not null,      -- quantity * sell_price
  profit          numeric(14,2) not null,      -- sales_amount - purchase_amount
  gst_amount      numeric(14,2) not null,      -- sales_amount * gst_percent / 100
  created_at    timestamptz not null default now()
);

create index if not exists idx_items_invoice on invoice_items (invoice_id);

-- ---------------------------------------------------------------------------
-- invoice_payments
-- One row per payment received against an invoice — the first one is often
-- an advance taken before/at invoice creation; later rows are payments
-- received afterwards (partial or final).
-- ---------------------------------------------------------------------------
create table if not exists invoice_payments (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references invoices(id) on delete cascade,
  amount        numeric(14,2) not null check (amount > 0),
  payment_date  date not null,
  payment_type  text not null default 'payment' check (payment_type in ('advance', 'payment')),
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_payments_invoice on invoice_payments (invoice_id);

-- ---------------------------------------------------------------------------
-- Helper view: current (non-superseded) invoices only
-- ---------------------------------------------------------------------------
create or replace view current_invoices as
  select * from invoices where is_current = true;
