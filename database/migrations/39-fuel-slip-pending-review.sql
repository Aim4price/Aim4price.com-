-- Aim4price Fuel Slip pending review support.
-- Allows payment-only / incomplete fuel slips to be saved without posting fuel usage.

begin;

alter table if exists public.fuel_slips
  alter column litres drop not null,
  alter column total_amount drop not null;

update public.fuel_slips
set
  litres = case when litres is null then null else greatest(0, litres) end,
  total_amount = case when total_amount is null then null else greatest(0, total_amount) end,
  review_required = case
    when extraction_status = 'needs_review' then true
    when litres is null or litres <= 0 or total_amount is null then true
    else coalesce(review_required, false)
  end,
  extraction_status = case
    when litres is null or litres <= 0 or total_amount is null then 'needs_review'
    when extraction_status in ('manual', 'extracted', 'needs_review') then extraction_status
    else 'manual'
  end,
  updated_at = coalesce(updated_at, now()),
  created_at = coalesce(created_at, now());

commit;
