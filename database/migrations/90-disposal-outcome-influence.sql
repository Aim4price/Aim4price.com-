-- Tracks whether Aim4price helped with a sold, traded-in or scrapped outcome.
-- The sale-specific column remains populated for sold events so older reports
-- and deployed clients continue to work during rollout.

begin;

alter table public.asset_lifecycle_events
  add column if not exists aim4price_outcome_influence text,
  add column if not exists original_owner_user_id text;

update public.asset_lifecycle_events
set aim4price_outcome_influence = aim4price_sale_influence
where aim4price_outcome_influence is null
  and aim4price_sale_influence in ('yes', 'no', 'unsure');

update public.asset_lifecycle_events
set original_owner_user_id = owner_user_id
where original_owner_user_id is null
  and event_type in ('disposed', 'deleted_duplicate');

alter table public.asset_lifecycle_events
  drop constraint if exists asset_lifecycle_events_outcome_influence_check;

alter table public.asset_lifecycle_events
  add constraint asset_lifecycle_events_outcome_influence_check
    check (
      aim4price_outcome_influence is null
      or aim4price_outcome_influence in ('yes', 'no', 'unsure')
    );

comment on column public.asset_lifecycle_events.aim4price_outcome_influence is
  'Owner answer: yes, no or unsure when asked whether Aim4price helped with a sale, trade-in or scrapping outcome.';

comment on column public.asset_lifecycle_events.original_owner_user_id is
  'Account that recorded the disposal. Retained when an administrator allocates the portable asset record to another owner.';

commit;
