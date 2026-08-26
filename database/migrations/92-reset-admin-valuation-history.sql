-- 92-reset-admin-valuation-history.sql
-- Requested clean restart for the Admin valuation ledger.
--
-- Permanently removes valuation data recorded before 02:00 SAST on
-- 26 August 2026. The cutoff is fixed, so running this migration later cannot
-- remove any valuation completed after the restart. Existing assets, accounts
-- and depreciation snapshots are retained; only their deleted run references
-- are cleared.

begin;

do $reset_valuation_history$
declare
  reset_cutoff constant timestamptz := timestamptz '2026-08-26 02:00:00+02';
  deleted_estimate_events bigint := 0;
  deleted_saved_valuations bigint := 0;
begin
  if to_regclass('public.valuation_runs') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'asset_register_items'
        and column_name = 'valuation_run_id'
    ) then
      update public.asset_register_items asset
      set valuation_run_id = null
      where exists (
        select 1
        from public.valuation_runs valuation
        where valuation.id = asset.valuation_run_id
          and valuation.created_at < reset_cutoff
      );
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'asset_depreciation_snapshots'
        and column_name = 'valuation_run_id'
    ) then
      update public.asset_depreciation_snapshots snapshot
      set valuation_run_id = null
      where exists (
        select 1
        from public.valuation_runs valuation
        where valuation.id = snapshot.valuation_run_id
          and valuation.created_at < reset_cutoff
      );
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'dealer_asset_correction_requests'
        and column_name = 'revaluation_run_id'
    ) then
      update public.dealer_asset_correction_requests correction
      set revaluation_run_id = null
      where exists (
        select 1
        from public.valuation_runs valuation
        where valuation.id = correction.revaluation_run_id
          and valuation.created_at < reset_cutoff
      );
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'dealer_asset_correction_requests'
        and column_name = 'revaluation_previous_run_id'
    ) then
      update public.dealer_asset_correction_requests correction
      set revaluation_previous_run_id = null
      where exists (
        select 1
        from public.valuation_runs valuation
        where valuation.id = correction.revaluation_previous_run_id
          and valuation.created_at < reset_cutoff
      );
    end if;

    delete from public.valuation_runs
    where created_at < reset_cutoff;
    get diagnostics deleted_saved_valuations = row_count;
  end if;

  if to_regclass('public.admin_usage_events') is not null then
    delete from public.admin_usage_events
    where event_type = 'free_estimate_completed'
      and created_at < reset_cutoff;
    get diagnostics deleted_estimate_events = row_count;

    if deleted_estimate_events + deleted_saved_valuations > 0 then
      insert into public.admin_usage_events (
        user_id,
        event_type,
        event_source,
        metadata,
        created_at
      ) values (
        null,
        'admin_valuation_history_reset',
        'database-migration-92',
        jsonb_build_object(
          'cutoffIso', '2026-08-26T00:00:00.000Z',
          'deletedEstimateEvents', deleted_estimate_events,
          'deletedSavedValuations', deleted_saved_valuations
        ),
        now()
      );
    end if;
  end if;
end;
$reset_valuation_history$;

commit;
