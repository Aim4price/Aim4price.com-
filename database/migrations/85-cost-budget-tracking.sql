-- Owner-configured total-spend budgets for the Cost Ledger.
--
-- Budgets use the current South African calendar month or year. Alert rows
-- record the first observed threshold crossing for each budget revision and
-- period so notification polling is idempotent.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '5min';

do $preflight$
begin
  if to_regclass('public.asset_register_items') is null
     or to_regclass('public.asset_invoices') is null then
    raise exception 'Refusing cost-budget migration: Asset Register and Cost Ledger tables are required';
  end if;
end
$preflight$;

create table if not exists public.asset_cost_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  asset_register_item_id uuid references public.asset_register_items(id) on delete cascade,
  period text not null,
  amount numeric(14,2) not null,
  warning_percent smallint not null default 80,
  include_fuel_slip_costs boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint asset_cost_budgets_id_user_unique unique (id, user_id),
  constraint asset_cost_budgets_period_check check (period in ('monthly', 'annual')),
  constraint asset_cost_budgets_amount_check check (amount > 0),
  constraint asset_cost_budgets_warning_check check (warning_percent between 1 and 99),
  constraint asset_cost_budgets_revision_check check (revision > 0)
);

create unique index if not exists asset_cost_budgets_all_assets_period_uidx
  on public.asset_cost_budgets (user_id, period)
  where asset_register_item_id is null;

create unique index if not exists asset_cost_budgets_asset_period_uidx
  on public.asset_cost_budgets (user_id, asset_register_item_id, period)
  where asset_register_item_id is not null;

create index if not exists asset_cost_budgets_user_idx
  on public.asset_cost_budgets (user_id, updated_at desc);

create table if not exists public.asset_cost_budget_alerts (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null,
  user_id text not null,
  budget_revision integer not null,
  period_key text not null,
  alert_kind text not null,
  spent_amount numeric(14,2) not null,
  budget_amount numeric(14,2) not null,
  threshold_percent smallint not null,
  created_at timestamptz not null default now(),

  constraint asset_cost_budget_alerts_budget_fk
    foreign key (budget_id, user_id)
    references public.asset_cost_budgets(id, user_id)
    on delete cascade,
  constraint asset_cost_budget_alerts_kind_check
    check (alert_kind in ('warning', 'over_budget')),
  constraint asset_cost_budget_alerts_revision_check check (budget_revision > 0),
  constraint asset_cost_budget_alerts_period_key_check check (btrim(period_key) <> ''),
  constraint asset_cost_budget_alerts_threshold_check check (threshold_percent between 1 and 100),
  constraint asset_cost_budget_alerts_amount_check check (spent_amount >= 0 and budget_amount > 0),
  constraint asset_cost_budget_alerts_event_unique
    unique (budget_id, budget_revision, period_key, alert_kind)
);

create index if not exists asset_cost_budget_alerts_user_idx
  on public.asset_cost_budget_alerts (user_id, created_at desc);

create index if not exists asset_invoices_budget_lookup_idx
  on public.asset_invoices (user_id, asset_register_item_id, invoice_date);

commit;
