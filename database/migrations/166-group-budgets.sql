alter table public.asset_cost_budgets add column if not exists group_asset_ids uuid[] not null default '{}';
    alter table public.asset_cost_budgets add column if not exists group_name text;
    create unique index if not exists asset_cost_budgets_scoped_categories_uidx on public.asset_cost_budgets
      (user_id, period, categories, coalesce(lower(group_name), '')) where asset_register_item_id is null and register_id is null;
    drop index if exists public.asset_cost_budgets_all_categories_uidx;
