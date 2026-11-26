'use client';
import { availableBudget, formatBudgetMoney as money, type TrackedBudget } from '../../lib/budget-tracking';
import BudgetRecurringCosts from './BudgetRecurringCosts';
import BudgetDetailIcon from '../../components/BudgetDetailIcon';
import styles from './page.module.css';
export default function BudgetCostDetails({ budget, onRefresh, onAddRecurring }: { budget: TrackedBudget; onRefresh: () => Promise<void>; onAddRecurring: () => void }) {
  const included = budget.includeRecurringCosts !== false;
  const available = availableBudget(budget, included);
  return <>
    <dl className={styles.metrics}>
      <div><dt><BudgetDetailIcon kind="budget" />Budget</dt><dd>{money(budget.amount)}</dd></div>
      <div><dt><BudgetDetailIcon kind="remaining" />{included ? 'Available after recurring costs' : available < 0 ? 'Over budget' : 'Remaining'}</dt>
        <dd className={available < 0 ? styles.negative : undefined}>{money(included ? available : Math.abs(available))}</dd></div>
      <div><dt><BudgetDetailIcon kind="alert" />Alert at</dt><dd>{budget.warningPercent}%</dd></div>
    </dl>
    <BudgetRecurringCosts budget={budget} onRefresh={onRefresh} onAdd={onAddRecurring} />
  </>;
}
