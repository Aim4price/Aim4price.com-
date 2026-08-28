alter table if exists ad_brand_kits
  drop constraint if exists ad_brand_kits_template_check;

alter table if exists ad_brand_kits
  add constraint ad_brand_kits_template_check check (
    template_id in (
      'showcase',
      'price-focus',
      'photo-first',
      'classic',
      'minimal',
      'duo-split',
      'gallery-three',
      'catalogue-grid'
    )
  );
