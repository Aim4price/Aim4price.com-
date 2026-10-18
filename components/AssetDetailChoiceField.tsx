'use client';

import { useId, useState } from 'react';
import { createPortal } from './WebsitePortal';
import LeadActionDialog from './leads/LeadActionDialog';
import type { ModalSelectOption } from './AssetModalSelect';
import fieldStyles from '../app/asset-register/page.module.css';
import styles from './AssetDetailChoiceField.module.css';

export default function AssetDetailChoiceField<T extends string>({
  label, value, options, onChange, className = '', assetDetailEditTarget,
}: {
  label: string;
  value: T | '';
  options: Array<ModalSelectOption<T>>;
  onChange: (value: T) => void;
  className?: string;
  assetDetailEditTarget?: string;
}) {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const selected = options.find(option => option.value === value);
  const isCondition = assetDetailEditTarget === 'condition';
  return <div className={`${fieldStyles.field} ${styles.field} ${className}`} data-asset-detail-edit-target={assetDetailEditTarget}>
    <span id={labelId}>{label}</span>
    <button type="button" className={styles.trigger} aria-labelledby={labelId}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <span>{selected?.label || `Choose ${label.toLowerCase()}`}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16M8 4v6m8 4v6" /></svg>
    </button>
    {open && createPortal(<LeadActionDialog title={`Choose ${label.toLowerCase()}`}
      assetTitle={isCondition ? 'Select the condition that best describes this asset.' : 'Choose how usage is measured for this asset.'}
      className={styles.dialog} closeLabel={`Close ${label.toLowerCase()} choices`} onClose={() => setOpen(false)}>
      <div className={styles.choices} role="group" aria-label={label}>
        {options.map(option => <button type="button" key={option.value}
          className={`${styles.choice} ${option.value === value ? styles.selected : ''}`}
          aria-pressed={option.value === value}
          onClick={() => { onChange(option.value); setOpen(false); }}>
          <span className={styles.icon} data-tone={isCondition ? 'blue' : 'green'} aria-hidden="true">
            {isCondition ? <svg viewBox="0 0 24 24"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/></svg>
              : <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>}
          </span>
          <span className={styles.copy}><strong>{option.label === '%' ? 'Percentage' : option.label}</strong>{option.description && <small>{option.description}</small>}</span>
          <span className={styles.check} aria-hidden="true">{option.value === value ? '✓' : ''}</span>
        </button>)}
      </div>
    </LeadActionDialog>, document.body)}
  </div>;
}
