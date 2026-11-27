'use client';
import { availableBudget, formatBudgetMoney as money, type TrackedBudget } from '../../lib/budget-tracking';
import BudgetRecurringCosts from './BudgetRecurringCosts';
import BudgetDetailIcon from '../../components/BudgetDetailIcon';
import styles from './page.module.css';
export default function BudgetCostDetails({ budget, onRefresh, onAddRecurring }: { budget: TrackedBudget; onRefresh: () => Promise<void>; onAddRecurring: () => void }) {
  const included = budget.includeRecurringCosts !== false;
  const available = availableBudget(budget, included);
  const members = [...(budget.members ?? [])].sort((a, b) => b.spent - a.spent || a.title.localeCompare(b.title));
  return <>
    <dl className={styles.metrics}>
      <div><dt><BudgetDetailIcon kind="budget" />Budget</dt><dd>{money(budget.amount)}</dd></div>
      <div><dt><BudgetDetailIcon kind="remaining" />{included ? 'Available after recurring costs' : available < 0 ? 'Over budget' : 'Remaining'}</dt>
        <dd className={available < 0 ? styles.negative : undefined}>{money(included ? available : Math.abs(available))}</dd></div>
      <div><dt><BudgetDetailIcon kind="alert" />Alert at</dt><dd>{budget.warningPercent}%</dd></div>
    </dl>
    {members.length > 0 && <section aria-label="Spending by asset" className={styles.memberSection}>
      <details>
        <summary>View spending by asset
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <dl className={styles.memberRows}>{members.map(member =>
          <div key={member.id}><dt>{member.title}</dt><dd>{money(member.spent)}</dd></div>
        )}</dl>
      </details>
    </section>}
    <BudgetRecurringCosts budget={budget} onRefresh={onRefresh} onAdd={onAddRecurring} />
  </>;
}
