alter table ad_brand_kits
  add column if not exists logo_background boolean not null default true;
