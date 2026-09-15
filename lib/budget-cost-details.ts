import type { TrackedBudget } from './budget-tracking';
export type BudgetCost = {
  id: string; assetId: string; assetTitle: string; supplierName: string;
  invoiceNumber: string; invoiceDate: string | null; totalIncVat: number; source: string;
};
export function budgetCostsUrl(budget: TrackedBudget): string {
  const params = new URLSearchParams({ year: budget.periodKey.slice(0, 4) });
  if (budget.assetId) params.set('assetId', budget.assetId);
  if (budget.period === 'monthly') params.set('month', String(Number(budget.periodKey.slice(5, 7))));
  return `/api/my-invoices?${params}`;
}
export function allocatedBudgetCosts(costs: BudgetCost[], budget: TrackedBudget): BudgetCost[] {
  return costs.filter(cost => {
    if (!cost.invoiceDate) return false;
    if (budget.assetId && cost.assetId !== budget.assetId) return false;
    if (!budget.includeFuelSlipCosts && cost.source === 'fuel_slip') return false;
    return cost.invoiceDate.slice(0, budget.period === 'monthly' ? 7 : 4) === budget.periodKey;
  }).sort((a,b) => (b.invoiceDate || '').localeCompare(a.invoiceDate || '') || a.id.localeCompare(b.id));
}
