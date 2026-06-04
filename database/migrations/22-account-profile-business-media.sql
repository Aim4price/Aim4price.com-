-- Adds business profile media fields for dealer, auctioneer, finance and insurance accounts.

alter table public.account_profiles
  add column if not exists website_url text,
  add column if not exists extra_photo_urls jsonb not null default '[]'::jsonb;

update public.account_profiles
set extra_photo_urls = '[]'::jsonb
where extra_photo_urls is null;

alter table public.account_profiles
  alter column extra_photo_urls set default '[]'::jsonb,
  alter column extra_photo_urls set not null;
