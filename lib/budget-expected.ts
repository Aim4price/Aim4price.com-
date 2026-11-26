import { listRecurringCommitments, type RecurringCommitmentRecord } from './accounting-collaboration';
import type { CostBudgetProgress } from './cost-budgets';

const intervalMonths = { monthly: 1, quarterly: 3, six_monthly: 6, annual: 12 };
export type BudgetRecurringCost = {
  id: string;
  description: string;
  frequency: RecurringCommitmentRecord['frequency'];
  paused: boolean;
  shared: boolean;
  editableAmount: number | null;
  allocationNeeded: boolean;
  instalment: number;
  count: number;
  nextDue: string | null;
  expected: number;
};

export function budgetRecurringCosts(budget: CostBudgetProgress, commitments: RecurringCommitmentRecord[], registers: Map<string, string>, today: string) {
  const costs: BudgetRecurringCost[] = [];
  for (const item of commitments) {
    if (!['active', 'paused'].includes(item.status) || !item.startDate || (item.endDate && item.endDate < today)) continue;
    if (budget.categories?.length && !budget.categories.includes(item.category)) continue;
    const scoped = item.assets.filter(asset => (!budget.assetId || asset.assetId === budget.assetId)
      && (!budget.registerId || registers.get(asset.assetId) === budget.registerId));
    if (!scoped.length) continue;
    const months = intervalMonths[item.frequency];
    const entireSchedule = scoped.length === item.assets.length;
    const instalment = entireSchedule ? item.amount
      : scoped.reduce((sum, asset) => sum + (asset.annualAllocation ?? 0) * months / 12, 0);
    const start = new Date(item.startDate + 'T00:00:00Z');
    const dates: string[] = [];
    for (const month = new Date(budget.periodStart + 'T00:00:00Z'); month.toISOString().slice(0,10) < budget.periodEnd; month.setUTCMonth(month.getUTCMonth() + 1)) {
      const elapsed = (month.getUTCFullYear() - start.getUTCFullYear()) * 12 + month.getUTCMonth() - start.getUTCMonth();
      if (elapsed < 0 || elapsed % months) continue;
      const lastDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
      const due = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), Math.min(lastDay, start.getUTCDate()))).toISOString().slice(0,10);
      if (due >= today && (!item.endDate || due <= item.endDate)) dates.push(due);
    }
    costs.push({
      id: item.id, description: item.description, frequency: item.frequency, paused: item.status === 'paused',
      shared: item.assets.length > 1, editableAmount: item.assets.every(asset => registers.has(asset.assetId)) ? item.amount : null,
      allocationNeeded: !entireSchedule && scoped.some(asset => asset.annualAllocation === null || asset.annualAllocation === undefined),
      instalment, count: dates.length, nextDue: dates[0] ?? null,
      expected: item.status === 'paused' ? 0 : Math.round(instalment * dates.length * 100) / 100,
    });
  }
  return costs.sort((a,b) => (a.nextDue ?? '9999').localeCompare(b.nextDue ?? '9999') || a.description.localeCompare(b.description));
}

function forecastTotal(costs: BudgetRecurringCost[]) {
  return Math.round(costs.reduce((sum, cost) => sum + cost.expected, 0) * 100) / 100;
}

export function expectedCommitmentAmount(budget: CostBudgetProgress, commitments: RecurringCommitmentRecord[], registers: Map<string, string>, today: string) {
  return forecastTotal(budgetRecurringCosts(budget, commitments, registers, today));
}

export async function addBudgetForecasts(owner: string, budgets: CostBudgetProgress[], assets: Array<{id:string; registerId?:string | null}>) {
  if (!budgets.length) return budgets;
  const commitments = await listRecurringCommitments(owner);
  const registers = new Map(assets.map(asset => [asset.id, asset.registerId || '']));
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return budgets.map(budget => {
    const recurringCosts = budgetRecurringCosts(budget, commitments, registers, today);
    return {...budget, expected: forecastTotal(recurringCosts), recurringCosts};
  });
}
