-- Adds separate handled/noted tracking for QR / Field Manager Notes & Problems alerts.
-- The original asset_scan_events.note history row remains unchanged.

alter table if exists public.asset_scan_events
  add column if not exists issue_noted_at timestamptz;

create index if not exists idx_asset_scan_events_open_issue_notes
  on public.asset_scan_events(asset_id, created_at desc)
  where issue_noted_at is null
    and nullif(trim(coalesce(note, '')), '') is not null
    and lower(coalesce(note, '')) like '%notes%problems:%';
