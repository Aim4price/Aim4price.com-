import type { CostBudgetProgress } from './cost-budgets';
import type { MyInvoiceRecord } from './my-invoices';

export type OwnershipBudget = Pick<CostBudgetProgress, 'id' | 'assetId' | 'period' | 'periodLabel' | 'periodStart' | 'periodEnd' | 'amount' | 'warningPercent' | 'includeFuelSlipCosts'>;
export type OwnershipBudgetStep = {
  budget: OwnershipBudget; spent: number; remaining: number; overBy: number;
  percent: number; status: 'good' | 'warning' | 'reached'; excluded: boolean;
};
export const BUDGET_TRACKER_NOTE = 'Budget tracker: current monthly / annual asset budgets, inclusive of VAT. Each bar shows period spending after that cost, oldest first. Earlier costs in the period are included even when outside the report filter; fuel follows each budget’s setting. Historical budget versions and account-wide budgets are not shown.';

export function chronologicalCosts(invoices: MyInvoiceRecord[]): MyInvoiceRecord[] {
  return [...invoices].sort((a, b) => (a.invoiceDate || '').localeCompare(b.invoiceDate || '')
    || a.createdAtIso.localeCompare(b.createdAtIso) || a.id.localeCompare(b.id));
}

/** Reconstruct period spend from approved, access-scoped costs, never from report-only totals. */
export function buildOwnershipBudgetTracker(invoices: MyInvoiceRecord[], budgets: OwnershipBudget[]): Map<string, OwnershipBudgetStep[]> {
  const result = new Map<string, OwnershipBudgetStep[]>();
  const totals = new Map<string, number>();
  for (const invoice of chronologicalCosts(invoices)) {
    const steps: OwnershipBudgetStep[] = [];
    for (const budget of budgets) {
      // Account budgets must never be presented as an individual asset's allowance.
      if (!budget.assetId || budget.assetId !== invoice.assetId || !invoice.invoiceDate
        || invoice.invoiceDate < budget.periodStart || invoice.invoiceDate >= budget.periodEnd
        || !Number.isFinite(budget.amount) || budget.amount <= 0) continue;
      const excluded = invoice.source === 'fuel_slip' && !budget.includeFuelSlipCosts;
      const cents = (totals.get(budget.id) || 0) + (excluded ? 0 : Math.round(invoice.totalIncVat * 100));
      totals.set(budget.id, cents);
      const spent = cents / 100;
      const difference = Math.round((budget.amount - spent) * 100) / 100;
      const percent = Math.round(spent / budget.amount * 1000) / 10;
      steps.push({ budget, spent, remaining: Math.max(0, difference), overBy: Math.max(0, -difference), percent,
        status: spent >= budget.amount ? 'reached' : percent >= budget.warningPercent ? 'warning' : 'good', excluded });
    }
    result.set(invoice.id, steps);
  }
  return result;
}
