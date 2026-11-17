-- Additive: standard templates and published advert snapshots remain compatible.
alter table if exists ad_brand_kits add column if not exists custom_design jsonb;
