-- Opt-in recurring agreements; existing accounts remain manual.
create table if not exists aim4price_billing_agreements (
 user_id text primary key references "user"(id) on delete cascade,
 customer jsonb not null, lines jsonb not null,
 interval text not null check(interval in ('monthly','annual')),
 anchor_date date not null, next_invoice_date date not null,
 due_days integer not null check(due_days between 0 and 90),
 enabled boolean not null default false, version integer not null default 1,
 last_invoice_date date, last_error text, updated_at timestamptz not null default now()
);
create table if not exists aim4price_billing_agreement_events (
 id bigserial primary key, user_id text references "user"(id) on delete set null,
 actor_id text not null, action text not null, detail jsonb not null,
 created_at timestamptz not null default now()
);
