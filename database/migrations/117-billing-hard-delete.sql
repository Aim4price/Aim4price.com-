-- Minimal deletion receipts keep retired IDs/numbers and scheduled periods from being reused.
create table if not exists aim4price_billing_deletions (
 invoice_id uuid primary key,
 number text,
 generation_key text unique,
 actor_id text not null,
 reason text not null,
 deleted_at timestamptz not null default now()
);
