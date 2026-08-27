-- Keep Cost Ledger usage metrics aligned with the asset register and manual-entry UI.
-- Safe to run more than once.

alter table public.asset_invoices
  drop constraint if exists asset_invoices_usage_metric_check;

alter table public.asset_invoices
  add constraint asset_invoices_usage_metric_check
  check (usage_metric is null or usage_metric in ('none', 'hours', 'km', 'percentage'));
