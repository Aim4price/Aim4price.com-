import { getDb } from './db';
import type { OwnershipBudgetVersion } from './ownership-budget-tracker';

/** Install and seed atomically so budget writes cannot slip between setup and capture. */
export async function ensureCostBudgetHistory(): Promise<void> {
  const client = await getDb().connect();
  try {
    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtext('aim4price.cost-budget-history'))");
    await client.query(`
      lock table public.asset_cost_budgets in share row exclusive mode;
      create table if not exists public.asset_cost_budget_history (
        budget_id uuid not null,
        revision integer not null,
        user_id text not null,
        asset_register_item_id uuid,
        period text not null,
        amount numeric(14,2) not null,
        warning_percent smallint not null,
        include_fuel_slip_costs boolean not null,
        valid_from timestamptz not null,
        valid_to timestamptz,
        primary key (budget_id, revision)
      );
      create index if not exists asset_cost_budget_history_owner_idx
        on public.asset_cost_budget_history(user_id, asset_register_item_id);
      create or replace function public.capture_asset_cost_budget_history() returns trigger
      language plpgsql as $history$
      begin
        if TG_OP <> 'INSERT' then
          update public.asset_cost_budget_history set valid_to = now()
            where budget_id = OLD.id and revision = OLD.revision and valid_to is null;
        end if;
        if TG_OP <> 'DELETE' then
          insert into public.asset_cost_budget_history
            (budget_id, revision, user_id, asset_register_item_id, period, amount,
             warning_percent, include_fuel_slip_costs, valid_from)
          values (NEW.id, NEW.revision, NEW.user_id, NEW.asset_register_item_id, NEW.period,
            NEW.amount, NEW.warning_percent, NEW.include_fuel_slip_costs, now());
          return NEW;
        end if;
        return OLD;
      end;
      $history$;
      drop trigger if exists capture_asset_cost_budget_history on public.asset_cost_budgets;
      create trigger capture_asset_cost_budget_history
        after insert or update or delete on public.asset_cost_budgets
        for each row execute function public.capture_asset_cost_budget_history();
      insert into public.asset_cost_budget_history
        (budget_id, revision, user_id, asset_register_item_id, period, amount,
         warning_percent, include_fuel_slip_costs, valid_from)
      select id, revision, user_id, asset_register_item_id, period, amount,
        warning_percent, include_fuel_slip_costs,
        case when revision = 1 then created_at else updated_at end
      from public.asset_cost_budgets
      on conflict (budget_id, revision) do nothing;
    `);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** Caller ensures budget tables; history survives budget deletion but remains owner-scoped. */
export async function readCostBudgetHistory(userId: string): Promise<OwnershipBudgetVersion[]> {
  const result = await getDb().query<{
    id: string; asset_id: string | null; period: 'monthly' | 'annual'; amount: string;
    warning_percent: number; include_fuel_slip_costs: boolean; effective_from: string; effective_to: string | null;
  }>(`
    select budget_id::text || ':' || revision::text as id, asset_register_item_id::text as asset_id,
      period, amount, warning_percent, include_fuel_slip_costs,
      (valid_from at time zone 'Africa/Johannesburg')::date::text as effective_from,
      (valid_to at time zone 'Africa/Johannesburg')::date::text as effective_to
    from public.asset_cost_budget_history where user_id = $1
    order by valid_from, revision
  `, [userId]);
  return result.rows.map(row => ({ id: row.id, assetId: row.asset_id, period: row.period,
    amount: Number(row.amount), warningPercent: Number(row.warning_percent),
    includeFuelSlipCosts: row.include_fuel_slip_costs,
    effectiveFrom: row.effective_from, effectiveTo: row.effective_to }));
}
