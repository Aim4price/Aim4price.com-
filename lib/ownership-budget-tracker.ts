import type { CostBudgetProgress } from './cost-budgets';
import type { MyInvoiceRecord } from './my-invoices';

export type OwnershipBudget = Pick<CostBudgetProgress, 'id' | 'assetId' | 'period' | 'periodLabel' | 'periodStart' | 'periodEnd' | 'amount' | 'warningPercent' | 'includeFuelSlipCosts'> & { effectiveFrom?: string; effectiveTo?: string | null };
export type OwnershipBudgetVersion = Omit<OwnershipBudget, 'periodLabel' | 'periodStart' | 'periodEnd'>;
export type OwnershipBudgetStep = {
  budget: OwnershipBudget; spent: number; remaining: number; overBy: number;
  percent: number; status: 'good' | 'warning' | 'reached'; excluded: boolean;
};
export const BUDGET_TRACKER_NOTE = 'Budget tracker: monthly / annual asset budgets matched to each cost date, inclusive of VAT. Each bar includes earlier costs in that period, even outside the report filter; fuel follows that budget version’s setting. Changes apply from their South African calendar date. Saved history is used where available; previously overwritten or deleted budgets cannot be reconstructed. Account-wide budgets are not shown.';

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
      // Accumulate the full period before choosing the version applicable on this date.
      if ((budget.effectiveFrom && invoice.invoiceDate < budget.effectiveFrom)
        || (budget.effectiveTo && invoice.invoiceDate >= budget.effectiveTo)) continue;
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

/** Recurring budgets get a separate running total for each calendar month/year. */
export function expandOwnershipBudgetHistory(invoices: MyInvoiceRecord[], versions: OwnershipBudgetVersion[]): OwnershipBudget[] {
  const windows = new Map<string, OwnershipBudget>();
  for (const version of versions) {
    if (!version.assetId) continue;
    for (const invoice of invoices) {
      const date = invoice.invoiceDate;
      if (invoice.assetId !== version.assetId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if ((version.effectiveFrom && date < version.effectiveFrom) || (version.effectiveTo && date >= version.effectiveTo)) continue;
      const year = Number(date.slice(0, 4));
      const month = Number(date.slice(5, 7));
      const periodStart = version.period === 'annual' ? `${year}-01-01` : `${date.slice(0, 7)}-01`;
      const periodEnd = version.period === 'annual' || month === 12
        ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const id = `${version.id}:${periodStart}`;
      windows.set(id, { ...version, id, periodStart, periodEnd,
        periodLabel: version.period === 'annual' ? String(year) : new Intl.DateTimeFormat('en-ZA', {
          month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg',
        }).format(new Date(`${periodStart}T12:00:00Z`)) });
    }
  }
  return [...windows.values()];
}
