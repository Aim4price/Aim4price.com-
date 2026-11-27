'use client';

import { useId, useState } from 'react';
import { useDesktopControls } from '../../components/DesktopWorkspace';
import RecurringCostsSwitch from '../../components/RecurringCostsSwitch';
import type { BudgetRecurringCost } from '../../lib/budget-expected';
import { formatBudgetMoney, type TrackedBudget } from '../../lib/budget-tracking';
import styles from './page.module.css';
import ledgerStyles from '../my-invoices/page.module.css';

const frequencies = {monthly:'Monthly', quarterly:'Quarterly', six_monthly:'Every six months', annual:'Annual'};
const dateLabel = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString('en-ZA',{day:'numeric',month:'short',timeZone:'UTC'});

function CostEditor({ cost, busy, onSave, onDelete, canEdit, canDelete }: {
  canEdit: boolean; canDelete: boolean; onDelete: () => Promise<boolean>;
  cost: BudgetRecurringCost; busy: boolean; onSave: (amount: number, paused: boolean) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState('');
  const amount = Number(draft.trim().replace(/\s/g,'').replace(',','.'));
  if (cost.editableAmount === null) return null;
  if (confirmDelete) return <div className={styles.costControls} role="group" aria-label="Confirm deletion">
    <span>Delete {cost.description}{cost.shared ? ' for all linked assets' : ''}? Recorded costs are kept.</span>
    <button type="button" autoFocus disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button>
    <button className={styles.deleteCost} type="button" disabled={busy} onClick={() => void onDelete()}>Delete recurring cost</button>
  </div>;
  if (!editing) return <div className={styles.costControls}>
    {canEdit && <><button type="button" disabled={busy} onClick={() => {setDraft(String(cost.editableAmount));setEditing(true);}}>Edit amount</button>
    <button type="button" disabled={busy} onClick={() => void onSave(cost.editableAmount!, !cost.paused)}>{cost.paused ? 'Resume' : 'Pause'}</button></>}
    {canDelete && <button type="button" disabled={busy} className={styles.deleteCost} onClick={() => setConfirmDelete(true)}>Delete</button>}
  </div>;
  return <form className={styles.editCost} onSubmit={async event => {
    event.preventDefault();
    if (await onSave(amount, cost.paused)) setEditing(false);
  }}>
    <label>{cost.shared ? 'Full shared amount' : 'Amount per payment'} (R)
      <input autoFocus inputMode="decimal" required value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} />
    </label>
    <div className={styles.costControls}><button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
      <button className={styles.saveCost} disabled={busy || !Number.isFinite(amount) || amount <= 0} type="submit">Save amount</button></div>
  </form>;
}

export default function BudgetRecurringCosts({budget, onRefresh, onAdd}: {
  budget: TrackedBudget; onRefresh: () => Promise<void>; onAdd: () => void;
}) {
  const desktop = useDesktopControls();
  const [manage, setManage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listId = useId();
  const included = budget.includeRecurringCosts !== false;
  const costs = budget.recurringCosts ?? [];
  const due = costs.filter(cost => !cost.paused && cost.count > 0);
  const visible = manage ? costs : due;
  async function save(url: string, body: object, method: 'PATCH' | 'DELETE' = 'PATCH') {
    setBusy(true); setError('');
    try {
      const response = await desktop.request(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if (!response.ok) {
        if (response.status === 409) await onRefresh();
        throw new Error((await response.json()).error || 'The change could not be saved.');
      }
      try { await onRefresh(); }
      catch { setError('Change saved. Refresh to see the latest figures.'); }
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The change could not be saved.'); return false; }
    finally { setBusy(false); }
  }
  return <section className={styles.recurringPanel} aria-label="Recurring costs">
    {error && <p role="alert" className={styles.negative}>{error}</p>}
    <RecurringCostsSwitch checked={included} disabled={busy || !desktop.can('manageBudgets')}
      hint={included ? due.length ? 'Reserve scheduled payments through the end of this period.' : 'No recurring costs scheduled for ' + budget.periodLabel + '.'
        : 'Recurring costs are off for this budget.'}
      onChange={async value => {
        if (await save('/api/my-invoices/budgets/' + budget.id, {includeRecurringCosts:value}) && !value) setManage(false);
      }} />
    {included && <>
      <div className={styles.recurringBar}>
        <span>Expected this period <strong>{formatBudgetMoney(budget.expected ?? 0)}</strong></span>
        <div className={styles.recurringActions}>
          {costs.length > 0 && <button className={styles.manageCosts} type="button" aria-expanded={manage} aria-controls={listId} disabled={busy} onClick={() => setManage(!manage)}>{manage ? 'Done' : 'Manage recurring costs'}</button>}
          {!desktop.workspace && <button type="button" className={ledgerStyles.primaryButton} disabled={busy} onClick={onAdd}>Add recurring cost</button>}
        </div>
      </div>
      <div id={listId}>
        {visible.length > 0 && <ul className={styles.recurringList}>{visible.map(cost => <li key={cost.id}>
          <div><strong>{cost.description}</strong><small>{[frequencies[cost.frequency],cost.paused ? 'Paused' : cost.nextDue ? 'Due ' + dateLabel(cost.nextDue) : 'No payment due this period',cost.count > 1 && !cost.paused ? cost.count + ' payments' : '',cost.shared ? 'Shared cost' : ''].filter(Boolean).join(' · ')}</small>
            {manage && cost.shared && cost.editableAmount !== null && <small>Edits apply to all linked assets.</small>}</div>
          <strong>{cost.allocationNeeded ? 'Allocation needed' : formatBudgetMoney(manage ? cost.editableAmount ?? cost.instalment : cost.expected)}</strong>
          {manage && (desktop.can('editCosts') || desktop.can('deleteCosts')) && <CostEditor key={String(cost.editableAmount) + String(cost.paused)} cost={cost} busy={busy}
            canEdit={desktop.can('editCosts')} canDelete={desktop.can('deleteCosts')}
            onDelete={() => save('/api/recurring-commitments/' + cost.id,{previousAmount:cost.editableAmount,previousPaused:cost.paused},'DELETE')}
            onSave={(amount, paused) => save('/api/recurring-commitments/' + cost.id,{amount,paused,previousAmount:cost.editableAmount,previousPaused:cost.paused})} />}
        </li>)}</ul>}
      </div>
      {due.some(cost => cost.allocationNeeded) && <p className={styles.detailsNote}>Available funds exclude unallocated shares.</p>}
    </>}
  </section>;
}
