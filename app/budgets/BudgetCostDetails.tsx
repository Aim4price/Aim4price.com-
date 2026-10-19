'use client';
import { useEffect, useState } from 'react';
import type { TrackedBudget } from '../../lib/budget-tracking';
import { allocatedBudgetCosts, budgetCostsUrl, type BudgetCost } from '../../lib/budget-cost-details';
import BudgetDetailIcon from '../../components/BudgetDetailIcon';
import styles from './page.module.css';
const money = (value: number) => `R ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, ' ').replace('.', ',')}`;
const date = (value: string | null) => value ? new Date(`${value.slice(0,10)}T12:00:00Z`).toLocaleDateString('en-ZA', {day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}) : '';
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
      <div><dt><BudgetDetailIcon kind="budget" />Budget</dt><dd>{money(budget.amount)}</dd></div>
      <div><dt><BudgetDetailIcon kind="remaining" />{budget.overBy > 0 ? 'Over budget' : 'Remaining'}</dt><dd>{money(budget.overBy > 0 ? budget.overBy : budget.remaining)}</dd></div>
      <div><dt><BudgetDetailIcon kind="alert" />Alert at</dt><dd>{budget.warningPercent}%</dd></div>
    </dl>
    <div className={styles.detailsMeta}>
      <span><BudgetDetailIcon kind="calendar" />{budget.periodLabel}</span>
      <span><BudgetDetailIcon kind="fuel" />Fuel {budget.includeFuelSlipCosts ? 'included' : 'excluded'}</span>
      <span><BudgetDetailIcon kind="receipt" />Amounts incl. VAT</span>
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
