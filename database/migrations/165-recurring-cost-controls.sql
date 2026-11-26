-- Existing commitments remain active, ended or cancelled until an owner pauses one.
do $$
begin
  if to_regclass('public.asset_recurring_commitments') is not null and not exists (
    select 1 from pg_constraint where conrelid = to_regclass('public.asset_recurring_commitments')
      and conname = 'asset_recurring_commitments_status_check' and pg_get_constraintdef(oid) like '%paused%'
  ) then
    alter table public.asset_recurring_commitments drop constraint if exists asset_recurring_commitments_status_check;
    alter table public.asset_recurring_commitments add constraint asset_recurring_commitments_status_check
      check (status in ('active', 'paused', 'ended', 'cancelled'));
  end if;
end $$;
