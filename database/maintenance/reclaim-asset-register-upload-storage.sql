-- Run manually in DBeaver only after migration 79 has completed and uploads
-- have been tested in the deployed application.
--
-- VACUUM FULL takes an exclusive table lock. The short lock timeout makes this
-- script fail safely when the application is actively using the upload table.
-- Re-run it during a quiet window if that happens.

select
  pg_size_pretty(pg_database_size(current_database())) as database_before,
  pg_size_pretty(pg_total_relation_size('public.asset_register_uploads')) as uploads_before;

do $safety$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asset_register_uploads'
      and column_name = 'file_bytes'
  ) then
    raise exception 'Migration 79 has not removed file_bytes; VACUUM was not started.';
  end if;
end
$safety$;

set lock_timeout = '5s';

vacuum (full, analyze) public.asset_register_uploads;

reset lock_timeout;

select
  pg_size_pretty(pg_database_size(current_database())) as database_after,
  pg_size_pretty(pg_total_relation_size('public.asset_register_uploads')) as uploads_after;

