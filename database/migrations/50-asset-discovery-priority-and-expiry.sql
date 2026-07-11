-- Asset Discovery lifecycle support.
--
-- Application rules:
--   - an owner "No" hides the asset from every dealer for 90 days;
--   - approved contact access expires after three calendar months;
--   - pending and active approved enquiries are prioritised in Discovery.

create index if not exists idx_asset_discovery_active_denial
  on public.asset_discovery_enquiries(asset_register_item_id, request_again_at desc)
  where status = 'temporarily_denied';

create index if not exists idx_asset_discovery_dealer_approval_expiry
  on public.asset_discovery_enquiries(dealer_user_id, approved_at desc)
  where status = 'approved';
