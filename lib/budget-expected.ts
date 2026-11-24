import { listRecurringCommitments, type RecurringCommitmentRecord } from './accounting-collaboration';
import type { CostBudgetProgress } from './cost-budgets';

const intervalMonths = { monthly: 1, quarterly: 3, six_monthly: 6, annual: 12 };

export function expectedCommitmentAmount(budget: CostBudgetProgress, commitments: RecurringCommitmentRecord[], registers: Map<string, string>, today: string) {
  let total = 0;
  for (const item of commitments) {
    if (item.status !== 'active' || !item.startDate || (budget.categories?.length && !budget.categories.includes(item.category))) continue;
    const scoped = item.assets.filter(asset => (!budget.assetId || asset.assetId === budget.assetId)
      && (!budget.registerId || registers.get(asset.assetId) === budget.registerId));
    if (!scoped.length) continue;
    const months = intervalMonths[item.frequency];
    const amount = scoped.length === item.assets.length ? item.amount
      : scoped.reduce((sum, asset) => sum + (asset.annualAllocation ?? 0) * months / 12, 0);
    const start = new Date(item.startDate + 'T00:00:00Z');
    // Walk the budget period only. Clamp instalments anchored on the 29th–31st to month end.
    for (const month = new Date(budget.periodStart + 'T00:00:00Z'); month.toISOString().slice(0,10) < budget.periodEnd; month.setUTCMonth(month.getUTCMonth() + 1)) {
      const elapsed = (month.getUTCFullYear() - start.getUTCFullYear()) * 12 + month.getUTCMonth() - start.getUTCMonth();
      if (elapsed < 0 || elapsed % months) continue;
      const lastDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
      const due = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), Math.min(lastDay, start.getUTCDate()))).toISOString().slice(0,10);
      if (due >= today && (!item.endDate || due <= item.endDate)) total += amount;
    }
  }
  return Math.round(total * 100) / 100;
}

export async function addBudgetForecasts(owner: string, budgets: CostBudgetProgress[], assets: Array<{id:string; registerId?:string | null}>) {
  if (!budgets.length) return budgets;
  const commitments = await listRecurringCommitments(owner);
  const registers = new Map(assets.map(asset => [asset.id, asset.registerId || '']));
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return budgets.map(budget => ({...budget, expected: expectedCommitmentAmount(budget, commitments, registers, today)}));
}
