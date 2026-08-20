import { getAssetRegisterItemById } from './asset-register-db';
import { getDb } from './db';
import { ensureMyInvoiceTables } from './my-invoices';

export type CostBudgetPeriod = 'monthly' | 'annual';
export type CostBudgetStatusName = 'on_track' | 'warning' | 'over_budget';
export type CostBudgetAlertKind = 'warning' | 'over_budget';

export type CostBudgetProgress = {
  id: string;
  userId: string;
  assetId: string | null;
  assetTitle: string;
  period: CostBudgetPeriod;
  amount: number;
  warningPercent: number;
  warningAmount: number;
  includeFuelSlipCosts: boolean;
  revision: number;
  periodKey: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  spent: number;
  remaining: number;
  overBy: number;
  percentUsed: number;
  status: CostBudgetStatusName;
  lastCostAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type CostBudgetInput = {
  assetId?: unknown;
  period?: unknown;
  amount?: unknown;
  warningPercent?: unknown;
  includeFuelSlipCosts?: unknown;
};

export type CostBudgetAlertEvent = {
  id: string;
  budgetId: string;
  budgetRevision: number;
  assetId: string | null;
  assetTitle: string;
  period: CostBudgetPeriod;
  periodKey: string;
  alertKind: CostBudgetAlertKind;
  spent: number;
  amount: number;
  warningPercent: number;
  triggeredAtIso: string;
};

type CostBudgetRow = {
  id: string;
  user_id: string;
  asset_register_item_id: string | null;
  asset_title: string | null;
  period: string;
  amount: string | number;
  warning_percent: string | number;
  include_fuel_slip_costs: boolean;
  revision: string | number;
  spent: string | number | null;
  last_cost_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type CostBudgetAlertRow = {
  id: string;
  budget_id: string;
  budget_revision: string | number;
  asset_register_item_id: string | null;
  asset_title: string | null;
  period: string;
  period_key: string;
  alert_kind: string;
  spent_amount: string | number;
  budget_amount: string | number;
  threshold_percent: string | number;
  created_at: string | Date;
};

type PeriodWindow = {
  key: string;
  label: string;
  start: string;
  end: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BUDGET_AMOUNT = 999_999_999_999.99;
const MIN_WARNING_PERCENT = 1;
const MAX_WARNING_PERCENT = 99;

let ensureCostBudgetTablesPromise: Promise<void> | null = null;

function asText(value: unknown): string {
  return String(value ?? '').trim();
}

function toIsoString(value: string | Date | null): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function asMoney(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }

  let normalized = asText(value)
    .replace(/zar/gi, '')
    .replace(/rand/gi, '')
    .replace(/^r\s*/i, '')
    .replace(/\s+/g, '');
  if (!normalized) return null;

  const comma = normalized.lastIndexOf(',');
  const dot = normalized.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (comma >= 0) {
    const decimals = normalized.length - comma - 1;
    normalized = decimals > 0 && decimals <= 2
      ? normalized.replace(',', '.')
      : normalized.replace(/,/g, '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = asText(value).toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizePeriod(value: unknown): CostBudgetPeriod {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'monthly' || normalized === 'annual') return normalized;
  throw new Error('COST_BUDGET_PERIOD_INVALID');
}

function normalizeBudgetId(value: unknown): string {
  const id = asText(value);
  if (!UUID_PATTERN.test(id)) throw new Error('COST_BUDGET_ID_INVALID');
  return id;
}

function normalizeInput(input: CostBudgetInput) {
  const assetIdText = asText(input.assetId);
  const assetId = !assetIdText || assetIdText === 'all' ? null : assetIdText;
  if (assetId && !UUID_PATTERN.test(assetId)) throw new Error('COST_BUDGET_ASSET_INVALID');

  const amount = asMoney(input.amount);
  if (amount === null || amount < 1 || amount > MAX_BUDGET_AMOUNT) {
    throw new Error('COST_BUDGET_AMOUNT_INVALID');
  }

  const warningPercent = Number(input.warningPercent);
  if (!Number.isInteger(warningPercent) || warningPercent < MIN_WARNING_PERCENT || warningPercent > MAX_WARNING_PERCENT) {
    throw new Error('COST_BUDGET_WARNING_INVALID');
  }

  return {
    assetId,
    period: normalizePeriod(input.period),
    amount,
    warningPercent,
    includeFuelSlipCosts: asBoolean(input.includeFuelSlipCosts, true),
  };
}

function johannesburgDateParts(value = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(value);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return { year, month };
}

function dateOnly(year: number, month: number, day = 1): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function currentCostBudgetPeriodWindow(period: CostBudgetPeriod, value = new Date()): PeriodWindow {
  const { year, month } = johannesburgDateParts(value);

  if (period === 'annual') {
    return {
      key: String(year),
      label: String(year),
      start: dateOnly(year, 1),
      end: dateOnly(year + 1, 1),
    };
  }

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const label = new Intl.DateTimeFormat('en-ZA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  }).format(new Date(`${dateOnly(year, month)}T12:00:00+02:00`));

  return {
    key: `${year}-${String(month).padStart(2, '0')}`,
    label,
    start: dateOnly(year, month),
    end: dateOnly(nextYear, nextMonth),
  };
}

async function ensureCostBudgetTablesOnce(): Promise<void> {
  await ensureMyInvoiceTables();
  const db = getDb();
  await db.query(`
    create table if not exists public.asset_cost_budgets (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      asset_register_item_id uuid references public.asset_register_items(id) on delete cascade,
      period text not null,
      amount numeric(14,2) not null,
      warning_percent smallint not null default 80,
      include_fuel_slip_costs boolean not null default true,
      revision integer not null default 1,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint asset_cost_budgets_id_user_unique unique (id, user_id),
      constraint asset_cost_budgets_period_check check (period in ('monthly', 'annual')),
      constraint asset_cost_budgets_amount_check check (amount > 0),
      constraint asset_cost_budgets_warning_check check (warning_percent between 1 and 99),
      constraint asset_cost_budgets_revision_check check (revision > 0)
    )
  `);
  await db.query(`
    create unique index if not exists asset_cost_budgets_all_assets_period_uidx
      on public.asset_cost_budgets (user_id, period)
      where asset_register_item_id is null
  `);
  await db.query(`
    create unique index if not exists asset_cost_budgets_asset_period_uidx
      on public.asset_cost_budgets (user_id, asset_register_item_id, period)
      where asset_register_item_id is not null
  `);
  await db.query(`
    create index if not exists asset_cost_budgets_user_idx
      on public.asset_cost_budgets (user_id, updated_at desc)
  `);
  await db.query(`
    create table if not exists public.asset_cost_budget_alerts (
      id uuid primary key default gen_random_uuid(),
      budget_id uuid not null,
      user_id text not null,
      budget_revision integer not null,
      period_key text not null,
      alert_kind text not null,
      spent_amount numeric(14,2) not null,
      budget_amount numeric(14,2) not null,
      threshold_percent smallint not null,
      created_at timestamptz not null default now(),
      constraint asset_cost_budget_alerts_budget_fk
        foreign key (budget_id, user_id)
        references public.asset_cost_budgets(id, user_id)
        on delete cascade,
      constraint asset_cost_budget_alerts_kind_check
        check (alert_kind in ('warning', 'over_budget')),
      constraint asset_cost_budget_alerts_revision_check check (budget_revision > 0),
      constraint asset_cost_budget_alerts_period_key_check check (btrim(period_key) <> ''),
      constraint asset_cost_budget_alerts_threshold_check check (threshold_percent between 1 and 100),
      constraint asset_cost_budget_alerts_amount_check check (spent_amount >= 0 and budget_amount > 0),
      constraint asset_cost_budget_alerts_event_unique
        unique (budget_id, budget_revision, period_key, alert_kind)
    )
  `);
  await db.query(`
    create index if not exists asset_cost_budget_alerts_user_idx
      on public.asset_cost_budget_alerts (user_id, created_at desc)
  `);
  await db.query(`
    create index if not exists asset_invoices_budget_lookup_idx
      on public.asset_invoices (user_id, asset_register_item_id, invoice_date)
  `);
}

export async function ensureCostBudgetTables(): Promise<void> {
  if (!ensureCostBudgetTablesPromise) {
    ensureCostBudgetTablesPromise = ensureCostBudgetTablesOnce().catch((error) => {
      ensureCostBudgetTablesPromise = null;
      throw error;
    });
  }
  await ensureCostBudgetTablesPromise;
}

async function verifyBudgetAsset(userId: string, assetId: string | null): Promise<void> {
  if (!assetId) return;
  const asset = await getAssetRegisterItemById(userId, assetId);
  if (!asset) throw new Error('COST_BUDGET_ASSET_NOT_FOUND');
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === '23505');
}

async function recordCrossedBudgetAlerts(budgets: CostBudgetProgress[]): Promise<void> {
  const crossed = budgets
    .filter((budget) => budget.status !== 'on_track')
    .map((budget) => ({
      budget_id: budget.id,
      user_id: budget.userId,
      budget_revision: budget.revision,
      period_key: budget.periodKey,
      alert_kind: budget.status,
      spent_amount: budget.spent,
      budget_amount: budget.amount,
      threshold_percent: budget.status === 'over_budget' ? 100 : budget.warningPercent,
    }));
  if (!crossed.length) return;

  await getDb().query(
    `
      insert into public.asset_cost_budget_alerts (
        budget_id,
        user_id,
        budget_revision,
        period_key,
        alert_kind,
        spent_amount,
        budget_amount,
        threshold_percent,
        created_at
      )
      select
        event.budget_id::uuid,
        event.user_id,
        event.budget_revision,
        event.period_key,
        event.alert_kind,
        event.spent_amount,
        event.budget_amount,
        event.threshold_percent,
        now()
      from jsonb_to_recordset($1::jsonb) as event(
        budget_id text,
        user_id text,
        budget_revision integer,
        period_key text,
        alert_kind text,
        spent_amount numeric,
        budget_amount numeric,
        threshold_percent smallint
      )
      on conflict (budget_id, budget_revision, period_key, alert_kind) do nothing
    `,
    [JSON.stringify(crossed)],
  );
}

export async function listCostBudgetsWithProgress(userId: string): Promise<CostBudgetProgress[]> {
  await ensureCostBudgetTables();
  const monthly = currentCostBudgetPeriodWindow('monthly');
  const annual = currentCostBudgetPeriodWindow('annual');
  const result = await getDb().query<CostBudgetRow>(
    `
      select
        budget.id::text,
        budget.user_id,
        budget.asset_register_item_id::text,
        coalesce(nullif(trim(asset.title), ''), 'Saved asset') as asset_title,
        budget.period,
        budget.amount,
        budget.warning_percent,
        budget.include_fuel_slip_costs,
        budget.revision,
        coalesce(spend.spent, 0) as spent,
        spend.last_cost_at,
        budget.created_at,
        budget.updated_at
      from public.asset_cost_budgets budget
      left join public.asset_register_items asset
        on asset.id = budget.asset_register_item_id
       and asset.user_id = budget.user_id
      left join lateral (
        select
          coalesce(sum(invoice.total_inc_vat), 0) as spent,
          max(coalesce(invoice.updated_at, invoice.created_at)) as last_cost_at
        from public.asset_invoices invoice
        where invoice.user_id = budget.user_id
          and invoice.invoice_date is not null
          and (
            budget.asset_register_item_id is null
            or invoice.asset_register_item_id = budget.asset_register_item_id
          )
          and invoice.invoice_date >= case when budget.period = 'monthly' then $2::date else $4::date end
          and invoice.invoice_date < case when budget.period = 'monthly' then $3::date else $5::date end
          and (
            budget.include_fuel_slip_costs
            or coalesce(invoice.source, 'manual') <> 'fuel_slip'
          )
          and (
            invoice.created_by_dealer_user_id is null
            or invoice.owner_storage_status in ('owner', 'approved')
          )
      ) spend on true
      where budget.user_id = $1
      order by
        case when budget.asset_register_item_id is null then 0 else 1 end,
        lower(coalesce(asset.title, '')),
        budget.period,
        budget.created_at
    `,
    [userId, monthly.start, monthly.end, annual.start, annual.end],
  );

  const budgets = result.rows.map((row) => {
    const period: CostBudgetPeriod = row.period === 'annual' ? 'annual' : 'monthly';
    const window = period === 'annual' ? annual : monthly;
    const amount = Math.max(0, Number(row.amount) || 0);
    const warningPercent = Math.max(MIN_WARNING_PERCENT, Math.min(MAX_WARNING_PERCENT, Number(row.warning_percent) || 80));
    const spent = Math.max(0, Math.round((Number(row.spent) || 0) * 100) / 100);
    const remaining = Math.max(0, Math.round((amount - spent) * 100) / 100);
    const overBy = Math.max(0, Math.round((spent - amount) * 100) / 100);
    const percentUsed = amount > 0 ? Math.round((spent / amount) * 1000) / 10 : 0;
    const status: CostBudgetStatusName = spent >= amount
      ? 'over_budget'
      : percentUsed >= warningPercent
        ? 'warning'
        : 'on_track';

    return {
      id: row.id,
      userId: row.user_id,
      assetId: row.asset_register_item_id,
      assetTitle: row.asset_register_item_id ? asText(row.asset_title) || 'Saved asset' : 'All saved assets',
      period,
      amount,
      warningPercent,
      warningAmount: Math.round(amount * warningPercent) / 100,
      includeFuelSlipCosts: Boolean(row.include_fuel_slip_costs),
      revision: Math.max(1, Number(row.revision) || 1),
      periodKey: window.key,
      periodLabel: window.label,
      periodStart: window.start,
      periodEnd: window.end,
      spent,
      remaining,
      overBy,
      percentUsed,
      status,
      lastCostAtIso: toIsoString(row.last_cost_at),
      createdAtIso: toIsoString(row.created_at) || new Date(0).toISOString(),
      updatedAtIso: toIsoString(row.updated_at) || new Date(0).toISOString(),
    } satisfies CostBudgetProgress;
  });

  await recordCrossedBudgetAlerts(budgets);
  return budgets;
}

export async function listCurrentCostBudgetAlertEvents(userId: string): Promise<CostBudgetAlertEvent[]> {
  const budgets = await listCostBudgetsWithProgress(userId);
  const activeBudgets = new Map(
    budgets
      .filter((budget) => budget.status !== 'on_track')
      .map((budget) => [budget.id, budget]),
  );
  if (!activeBudgets.size) return [];

  const result = await getDb().query<CostBudgetAlertRow>(
    `
      select
        alert.id::text,
        alert.budget_id::text,
        alert.budget_revision,
        budget.asset_register_item_id::text,
        coalesce(nullif(trim(asset.title), ''), 'Saved asset') as asset_title,
        budget.period,
        alert.period_key,
        alert.alert_kind,
        alert.spent_amount,
        alert.budget_amount,
        alert.threshold_percent,
        alert.created_at
      from public.asset_cost_budget_alerts alert
      join public.asset_cost_budgets budget
        on budget.id = alert.budget_id
       and budget.user_id = alert.user_id
       and budget.revision = alert.budget_revision
      left join public.asset_register_items asset
        on asset.id = budget.asset_register_item_id
       and asset.user_id = budget.user_id
      where alert.user_id = $1
      order by alert.created_at desc, alert.id desc
    `,
    [userId],
  );

  return result.rows.flatMap((row) => {
    const budget = activeBudgets.get(row.budget_id);
    const alertKind: CostBudgetAlertKind = row.alert_kind === 'over_budget' ? 'over_budget' : 'warning';
    if (!budget || row.period_key !== budget.periodKey || alertKind !== budget.status) return [];

    return [{
      id: row.id,
      budgetId: row.budget_id,
      budgetRevision: Math.max(1, Number(row.budget_revision) || 1),
      assetId: row.asset_register_item_id,
      assetTitle: row.asset_register_item_id ? asText(row.asset_title) || 'Saved asset' : 'All saved assets',
      period: row.period === 'annual' ? 'annual' : 'monthly',
      periodKey: row.period_key,
      alertKind,
      spent: Math.max(0, Number(row.spent_amount) || 0),
      amount: Math.max(0, Number(row.budget_amount) || 0),
      warningPercent: Math.max(1, Math.min(100, Number(row.threshold_percent) || 1)),
      triggeredAtIso: toIsoString(row.created_at) || new Date(0).toISOString(),
    } satisfies CostBudgetAlertEvent];
  });
}

export async function createCostBudget(userId: string, input: CostBudgetInput): Promise<CostBudgetProgress> {
  await ensureCostBudgetTables();
  const budget = normalizeInput(input);
  await verifyBudgetAsset(userId, budget.assetId);

  try {
    const result = await getDb().query<{ id: string }>(
      `
        insert into public.asset_cost_budgets (
          user_id,
          asset_register_item_id,
          period,
          amount,
          warning_percent,
          include_fuel_slip_costs,
          revision,
          created_at,
          updated_at
        ) values ($1, $2::uuid, $3, $4, $5, $6, 1, now(), now())
        returning id::text
      `,
      [userId, budget.assetId, budget.period, budget.amount, budget.warningPercent, budget.includeFuelSlipCosts],
    );
    const id = result.rows[0]?.id;
    const created = (await listCostBudgetsWithProgress(userId)).find((entry) => entry.id === id);
    if (!created) throw new Error('COST_BUDGET_CREATE_FAILED');
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error('COST_BUDGET_DUPLICATE');
    throw error;
  }
}

export async function updateCostBudget(
  userId: string,
  budgetIdInput: unknown,
  input: CostBudgetInput,
): Promise<CostBudgetProgress> {
  await ensureCostBudgetTables();
  const budgetId = normalizeBudgetId(budgetIdInput);
  const budget = normalizeInput(input);
  await verifyBudgetAsset(userId, budget.assetId);

  try {
    const result = await getDb().query<{ id: string }>(
      `
        update public.asset_cost_budgets
        set
          asset_register_item_id = $3::uuid,
          period = $4,
          amount = $5,
          warning_percent = $6,
          include_fuel_slip_costs = $7,
          revision = revision + 1,
          updated_at = now()
        where id = $1::uuid
          and user_id = $2
        returning id::text
      `,
      [
        budgetId,
        userId,
        budget.assetId,
        budget.period,
        budget.amount,
        budget.warningPercent,
        budget.includeFuelSlipCosts,
      ],
    );
    if (!result.rows[0]?.id) throw new Error('COST_BUDGET_NOT_FOUND');
    const updated = (await listCostBudgetsWithProgress(userId)).find((entry) => entry.id === budgetId);
    if (!updated) throw new Error('COST_BUDGET_NOT_FOUND');
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error('COST_BUDGET_DUPLICATE');
    throw error;
  }
}

export async function deleteCostBudget(userId: string, budgetIdInput: unknown): Promise<boolean> {
  await ensureCostBudgetTables();
  const budgetId = normalizeBudgetId(budgetIdInput);
  const result = await getDb().query<{ id: string }>(
    `
      delete from public.asset_cost_budgets
      where id = $1::uuid
        and user_id = $2
      returning id::text
    `,
    [budgetId, userId],
  );
  return Boolean(result.rows[0]?.id);
}
