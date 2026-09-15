import type { CostBudgetProgress } from './cost-budgets';

export type TrackedBudget = Pick<CostBudgetProgress, 'id' | 'assetId' | 'assetTitle' | 'period' | 'periodLabel' | 'periodKey' | 'amount' | 'spent' | 'remaining' | 'overBy' | 'percentUsed' | 'warningPercent' | 'includeFuelSlipCosts' | 'status'>;
export type BudgetFilters = { asset: string; period: string; status: string };
export const EMPTY_BUDGET_FILTERS: BudgetFilters = { asset: 'all', period: 'all', status: 'all' };
export function budgetStatusLabel(budget: TrackedBudget): string {
  if (budget.spent >= budget.amount) return budget.overBy > 0 ? 'Over budget' : 'Budget reached';
  return budget.status === 'warning' ? 'Approaching limit' : 'Within budget';
}
export function filterTrackedBudgets(budgets: TrackedBudget[], query: string, filters: BudgetFilters) {
  const term = query.trim().toLowerCase();
  return budgets.filter(budget =>
    (filters.asset === 'all' || (budget.assetId || 'overall') === filters.asset)
    && (filters.period === 'all' || budget.period === filters.period)
    && (filters.status === 'all' || (filters.status === 'attention' ? budget.status !== 'on_track' : budget.status === filters.status))
    && [budget.assetTitle, budget.period, budget.periodLabel, budgetStatusLabel(budget)].join(' ').toLowerCase().includes(term));
}
