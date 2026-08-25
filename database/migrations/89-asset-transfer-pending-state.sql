-- Allows a sold asset to leave the active register while its one-time
-- ownership transfer is waiting to be claimed. Safe to run more than once.

alter table if exists public.asset_register_items
  drop constraint if exists asset_register_items_lifecycle_state_check;

alter table if exists public.asset_register_items
  add constraint asset_register_items_lifecycle_state_check
    check (lifecycle_state in ('active', 'disposed', 'archived', 'transfer_pending'));
