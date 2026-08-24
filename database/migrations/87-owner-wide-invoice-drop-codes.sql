-- Add owner-wide Invoice Drop contribution codes without exposing an owner's
-- Asset Register. A null asset target means the code routes into the owner's
-- inbox; the public sender must still search for or describe the asset.

begin;

alter table public.asset_invoice_drop_codes
  alter column asset_register_item_id drop not null;

drop index if exists public.idx_asset_invoice_drop_codes_one_active_asset;

create unique index if not exists idx_asset_invoice_drop_codes_one_active_asset
  on public.asset_invoice_drop_codes (asset_register_item_id)
  where is_active = true and asset_register_item_id is not null;

create unique index if not exists idx_asset_invoice_drop_codes_one_active_owner
  on public.asset_invoice_drop_codes (owner_user_id)
  where is_active = true and asset_register_item_id is null;

comment on column public.asset_invoice_drop_codes.asset_register_item_id is
  'One asset for an asset-scoped code; null for an owner-wide contribution code that still requires asset identification.';

commit;
