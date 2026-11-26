'use client';
import { availableBudget, formatBudgetMoney as money, type TrackedBudget } from '../../lib/budget-tracking';
import BudgetRecurringCosts from './BudgetRecurringCosts';
import BudgetDetailIcon from '../../components/BudgetDetailIcon';
import styles from './page.module.css';
export default function BudgetCostDetails({ budget, onRefresh, onAddRecurring }: { budget: TrackedBudget; onRefresh: () => Promise<void>; onAddRecurring: () => void }) {
  const included = budget.includeRecurringCosts !== false;
  const available = availableBudget(budget, included);
  const members = [...(budget.members ?? [])].sort((a, b) => b.spent - a.spent || a.title.localeCompare(b.title));
  const active = members.filter(member => member.spent !== 0);
  const idle = members.filter(member => member.spent === 0);
  const rows = (items: typeof members) => <dl className={styles.memberRows}>{items.map(member =>
    <div key={member.id}><dt>{member.title}</dt><dd>{money(member.spent)}</dd></div>
  )}</dl>;
  return <>
    <dl className={styles.metrics}>
      <div><dt><BudgetDetailIcon kind="budget" />Budget</dt><dd>{money(budget.amount)}</dd></div>
      <div><dt><BudgetDetailIcon kind="remaining" />{included ? 'Available after recurring costs' : available < 0 ? 'Over budget' : 'Remaining'}</dt>
        <dd className={available < 0 ? styles.negative : undefined}>{money(included ? available : Math.abs(available))}</dd></div>
      <div><dt><BudgetDetailIcon kind="alert" />Alert at</dt><dd>{budget.warningPercent}%</dd></div>
    </dl>
    {members.length > 0 && <section aria-label="Spending by asset" className={styles.memberSection}>
      <h3>Spending by asset</h3>
      {active.length > 0 && rows(active)}
      {idle.length > 0 && <details>
        <summary>{idle.length} {idle.length === 1 ? 'asset' : 'assets'} with no spending</summary>
        {rows(idle)}
      </details>}
    </section>}
    <BudgetRecurringCosts budget={budget} onRefresh={onRefresh} onAdd={onAddRecurring} />
  </>;
}
