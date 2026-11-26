import type { CostBudgetProgress } from './cost-budgets';

export type TrackedBudget = Pick<CostBudgetProgress, 'groupAssetIds' | 'members' | 'id' | 'assetId' | 'assetTitle' | 'period' | 'periodLabel' | 'periodKey' | 'amount' | 'spent' | 'remaining' | 'overBy' | 'percentUsed' | 'warningPercent' | 'includeVat' | 'includeFuelSlipCosts' | 'status' | 'categories' | 'registerId' | 'expected' | 'includeRecurringCosts' | 'recurringCosts'>;
export type BudgetFilters = { asset: string; period: string; status: string };
export const EMPTY_BUDGET_FILTERS: BudgetFilters = { asset: 'all', period: 'all', status: 'all' };
export function budgetStatusLabel(budget: TrackedBudget): string {
  if (budget.spent >= budget.amount) return budget.overBy > 0 ? 'Over budget' : 'Budget reached';
  return budget.status === 'warning' ? 'Approaching limit' : 'Within budget';
}
export function filterTrackedBudgets(budgets: TrackedBudget[], query: string, filters: BudgetFilters) {
  const term = query.trim().toLowerCase();
  return budgets.filter(budget =>
    (filters.asset === 'all' || budget.groupAssetIds?.includes(filters.asset) || (!budget.groupAssetIds?.length && (budget.assetId || 'overall') === filters.asset))
    && (filters.period === 'all' || budget.period === filters.period)
    && (filters.status === 'all' || (filters.status === 'attention' ? budget.status !== 'on_track' : budget.status === filters.status))
    && [budget.assetTitle, ...(budget.members ?? []).map(member => member.title), budget.period, budget.periodLabel, budgetStatusLabel(budget)].join(' ').toLowerCase().includes(term));
}

export const formatBudgetMoney = (value: number) => `R ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, ' ').replace('.', ',')}`;

export function availableBudget(budget: TrackedBudget, includeRecurring: boolean) {
  return Math.round((budget.amount - budget.spent - (includeRecurring ? budget.expected ?? 0 : 0)) * 100) / 100;
}
