-- First-party Aim4price invoices, independent of customers' captured supplier invoices.
create sequence if not exists aim4price_invoice_number_seq;
create table if not exists aim4price_billing_plans (
 account_type text primary key, description text not null, amount_cents bigint not null check(amount_cents > 0),
 interval text not null check(interval in ('once','monthly','annual')), due_days integer not null check(due_days between 0 and 90),
 version integer not null default 1, enabled boolean not null default false, updated_at timestamptz not null default now()
);
create table if not exists aim4price_billing_profiles (
 user_id text primary key references "user"(id) on delete cascade,
 customer jsonb not null, next_billing_date date, interval text not null default 'once', amount_cents bigint not null default 0,
 updated_at timestamptz not null default now()
);
create table if not exists aim4price_billing_invoices (
 id uuid primary key, user_id text references "user"(id) on delete set null,
 number text unique, status text not null default 'draft' check(status in ('draft','issued','void')),
 customer jsonb not null, issuer jsonb not null, lines jsonb not null,
 total_cents bigint not null check(total_cents > 0), paid_cents bigint not null default 0 check(paid_cents >= 0 and paid_cents <= total_cents),
 due_date date not null, issued_at timestamptz, created_at timestamptz not null default now(), note text not null default '',
 generation_key text unique, version integer not null default 1, report_html text, pdf bytea, void_reason text,
 check((status = 'draft' and number is null) or (status <> 'draft' and number is not null))
);
create index if not exists aim4price_billing_user_idx on aim4price_billing_invoices(user_id, created_at desc);
create table if not exists aim4price_billing_work (
 work_session_id text primary key, invoice_id uuid not null references aim4price_billing_invoices(id) on delete cascade
);
create table if not exists aim4price_billing_payments (
 id uuid primary key, invoice_id uuid not null references aim4price_billing_invoices(id),
 amount_cents bigint not null check(amount_cents > 0), payment_date date not null, reference text not null,
 actor_id text not null, created_at timestamptz not null default now()
);
create table if not exists aim4price_billing_events (
 id bigserial primary key, invoice_id uuid not null references aim4price_billing_invoices(id),
 actor_id text not null, action text not null, detail text not null default '', created_at timestamptz not null default now()
);
create table if not exists aim4price_billing_mail (
 id uuid primary key, invoice_id uuid not null references aim4price_billing_invoices(id),
 status text not null default 'queued' check(status in ('queued','sending','retry','accepted','needs_review')),
 payload text, provider_id text, attempts integer not null default 0, first_attempt_at timestamptz,
 next_attempt_at timestamptz not null default now(), locked_until timestamptz, last_error text,
 created_at timestamptz not null default now(), accepted_at timestamptz
);
create index if not exists aim4price_billing_mail_pending_idx on aim4price_billing_mail(next_attempt_at) where status in ('queued','sending','retry');
create table if not exists aim4price_billing_signup_jobs (
 user_id text primary key references "user"(id) on delete cascade,
 quote jsonb not null, created_at timestamptz not null default now(), processed_at timestamptz, last_error text, next_attempt_at timestamptz not null default now()
);
