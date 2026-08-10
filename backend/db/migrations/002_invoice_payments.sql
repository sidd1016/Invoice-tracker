-- Migration: add invoice_payments (advance + subsequent payment tracking)
-- Safe to run on a database that already has the original schema.sql applied.

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
