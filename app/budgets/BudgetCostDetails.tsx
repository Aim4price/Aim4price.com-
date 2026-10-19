'use client';
import { useEffect, useState } from 'react';
import type { TrackedBudget } from '../../lib/budget-tracking';
import { allocatedBudgetCosts, budgetCostsUrl, type BudgetCost } from '../../lib/budget-cost-details';
import styles from './page.module.css';
const money = (value: number) => `R ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, ' ').replace('.', ',')}`;
const date = (value: string | null) => value ? new Date(`${value.slice(0,10)}T12:00:00Z`).toLocaleDateString('en-ZA', {day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}) : '';
type DetailIconKind = 'budget' | 'remaining' | 'alert' | 'calendar' | 'fuel' | 'receipt';
const detailPaths: Record<DetailIconKind, string> = {
  budget: 'M20 8V6a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v10H6a3 3 0 0 1-3-3V7M20 12h-5v4h5M17 14h.01',
  remaining: 'M20 12a8 8 0 1 1-8-8M16 3h5v5M21 3l-9 9M8 12l4 4',
  alert: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  calendar: 'M8 3v4M16 3v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2M7 14h3M14 14h3M7 17h3',
  fuel: 'M4 21V4h10v17M3 21h12M7 7h4v4H7ZM14 13h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V9l-4-4M19 6v4h3',
  receipt: 'M5 3l2 1 2-1 3 1 3-1 2 1 2-1v18l-2-1-2 1-3-1-3 1-2-1-2 1ZM8 8h8M8 12h8M8 16h5',
};
function DetailIcon({ kind }: { kind: DetailIconKind }) {
  return <svg className={styles.detailIcon} data-budget-icon={kind} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={detailPaths[kind]} /></svg>;
}
export default function BudgetCostDetails({ budget }: { budget: TrackedBudget }) {
  const [costs, setCosts] = useState<BudgetCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setCosts([]);
    async function load() {
      try {
        const response = await fetch(budgetCostsUrl(budget), { cache: 'no-store', credentials: 'same-origin', signal: controller.signal, headers: { 'x-aim4price-client-realm': 'website' } });
        const data = await response.json();
        if (!response.ok || !data.ok || !Array.isArray(data.invoices)) throw new Error('Costs could not be loaded. Please try again.');
        if (!controller.signal.aborted) setCosts(allocatedBudgetCosts(data.invoices, budget));
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Costs could not be loaded.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [budget.id, budget.assetId, budget.periodKey, budget.period, budget.includeFuelSlipCosts, budget.spent, attempt]);
  return <>
    <dl className={styles.metrics}>
      <div><dt><DetailIcon kind="budget" />Budget</dt><dd>{money(budget.amount)}</dd></div>
      <div><dt><DetailIcon kind="remaining" />{budget.overBy > 0 ? 'Over budget' : 'Remaining'}</dt><dd>{money(budget.overBy > 0 ? budget.overBy : budget.remaining)}</dd></div>
      <div><dt><DetailIcon kind="alert" />Alert at</dt><dd>{budget.warningPercent}%</dd></div>
    </dl>
    <div className={styles.detailsMeta}>
      <span><DetailIcon kind="calendar" />{budget.periodLabel}</span>
      <span><DetailIcon kind="fuel" />Fuel {budget.includeFuelSlipCosts ? 'included' : 'excluded'}</span>
      <span><DetailIcon kind="receipt" />Amounts incl. VAT</span>
    </div>
    {loading ? <p role="status">Loading allocated costs…</p> : error ? <div role="alert"><p>{error}</p><button className={styles.retryButton} onClick={() => setAttempt(value => value + 1)}>Try again</button></div> : costs.length ? <>
      <ul className={styles.costList} aria-label="Allocated costs">
        {costs.map(cost => <li key={cost.id} className={styles.costLine}>
          <div><strong>{cost.supplierName || 'Unknown supplier'}</strong><p>{[date(cost.invoiceDate), cost.invoiceNumber && `Ref ${cost.invoiceNumber}`, !budget.assetId && cost.assetTitle].filter(Boolean).join(' · ')}</p></div>
          <strong>{money(cost.totalIncVat)}</strong>
        </li>)}
      </ul>
      <div className={styles.costTotal}><span>{costs.length} {costs.length === 1 ? 'cost' : 'costs'}</span><strong>Total {money(costs.reduce((sum,cost) => sum + cost.totalIncVat, 0))}</strong></div>
    </> : <p className={styles.detailsNote}>No costs allocated to this budget for this period.</p>}
  </>;
}
