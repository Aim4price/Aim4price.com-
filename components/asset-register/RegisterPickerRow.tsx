'use client';

import type {ReactNode} from 'react';
import styles from './RegisterPickerRow.module.css';

export type RegisterPickerOption = {
  value: string;
  label: string;
  description?: string;
  currentValueInclVat?: number;
  icon?: 'folder' | 'umbrella';
  detailLabel?: string;
  detailValue?: string;
};

export default function RegisterPickerRow({ option, selected, disabled, onSelect, current, badge }: {
  option: RegisterPickerOption;
  selected: boolean;
  current?: boolean;
  badge?: ReactNode;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  return <button type="button" className={styles.row} aria-pressed={selected} aria-current={current ? 'page' : undefined} disabled={disabled} onClick={() => onSelect(option.value)}>
    <svg className={styles.folder} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{option.icon === 'umbrella' ? <path d="M3 12a9 9 0 0 1 18 0H3ZM12 3v16a2 2 0 0 0 4 0M8 12c0-5 2-9 4-9s4 4 4 9"/> : <path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v12H3Z" />}</svg>
    <span className={styles.copy}><strong className={styles.name}>{option.label}{badge}</strong><small>{option.description}</small></span>
    {option.currentValueInclVat !== undefined ? <span className={styles.value}><small>Current value · incl. VAT</small><strong>{new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(option.currentValueInclVat)}</strong></span> : option.detailValue !== undefined ? <span className={styles.value}><small>{option.detailLabel}</small><strong>{option.detailValue}</strong></span> : null}
    <span className={styles.check} aria-hidden="true">{selected ? '✓' : ''}</span>
  </button>;
}
