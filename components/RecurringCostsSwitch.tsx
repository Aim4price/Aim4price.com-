'use client';

import { useId } from 'react';
import BudgetDetailIcon from './BudgetDetailIcon';
import styles from './RecurringCostsSwitch.module.css';

export default function RecurringCostsSwitch({ checked, hint, disabled, onChange }: {
  checked: boolean | 'mixed'; hint: string; disabled?: boolean; onChange: (included: boolean) => void;
}) {
  const label = useId();
  const detail = useId();
  return <button type="button" className={styles.control} role={checked === 'mixed' ? 'checkbox' : 'switch'}
    aria-checked={checked} aria-labelledby={label} aria-describedby={detail} disabled={disabled}
    onClick={() => onChange(checked !== true)}>
    <BudgetDetailIcon kind="recurring" />
    <span className={styles.copy}><strong id={label}>Include recurring costs</strong><small id={detail}>{hint}</small></span>
    <span className={styles.state} aria-hidden="true">{checked === 'mixed' ? 'Mixed' : checked ? 'On' : 'Off'}</span>
    <span className={styles.track} aria-hidden="true"><span /></span>
  </button>;
}
