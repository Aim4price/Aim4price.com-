-- Remove the duplicated legacy upload payload after proving the canonical copy is safe.
--
-- The live Railway database was verified on 2026-08-19:
--   * 355 rows
--   * data = 166 MB
--   * file_bytes = 166 MB
--   * all 355 pairs were identical
--
-- This migration intentionally does not run VACUUM FULL. PostgreSQL cannot run
-- VACUUM inside this transaction, and the table lock should be scheduled manually.

begin;

-- Fail safely instead of queueing behind active uploads. SET LOCAL resets
-- automatically whether this transaction commits or rolls back.
set local lock_timeout = '5s';
set local statement_timeout = '5min';

do $migration$
declare
  unsafe_row_count bigint;
begin
  if to_regclass('public.asset_register_uploads') is null then
    raise exception 'public.asset_register_uploads does not exist';
  end if;

  lock table public.asset_register_uploads in access exclusive mode;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asset_register_uploads'
      and column_name = 'file_bytes'
  ) then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'asset_register_uploads'
        and column_name = 'file_bytes'
        and udt_name = 'bytea'
    ) then
      raise exception 'Refusing to alter file_bytes because it is not a bytea column';
    end if;

    update public.asset_register_uploads
    set data = file_bytes
    where data is null
      and file_bytes is not null;

    select count(*)
    into unsafe_row_count
    from public.asset_register_uploads
    where data is null
       or (
         file_bytes is not null
         and data is distinct from file_bytes
       );

    if unsafe_row_count > 0 then
      raise exception using
        message = format(
          'Refusing to drop file_bytes: %s upload row(s) do not have a matching canonical data copy',
          unsafe_row_count
        ),
        hint = 'Inspect and repair the mismatched rows before running migration 79 again.';
    end if;

    alter table public.asset_register_uploads
      drop column file_bytes;
  end if;

  if exists (
    select 1
    from public.asset_register_uploads
    where data is null
  ) then
    raise exception 'Refusing to continue: asset_register_uploads.data still contains null values';
  end if;

  alter table public.asset_register_uploads
    alter column data set not null;
end
$migration$;

comment on column public.asset_register_uploads.data is
  'Canonical raw upload payload. Legacy bytea columns must never receive duplicate writes.';

commit;
