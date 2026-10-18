'use client';

import { useId, useState } from 'react';
import { createPortal } from './WebsitePortal';
import LeadActionDialog from './leads/LeadActionDialog';
import type { ModalSelectOption } from './AssetModalSelect';
import fieldStyles from '../app/asset-register/page.module.css';
import styles from './AssetDetailChoiceField.module.css';

const conditionAppearance: Record<string, { description: string; tone: string; path: string }> = {
  excellent: { description: 'Very little wear.', tone: 'green', path: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z' },
  good: { description: 'Well maintained, with light wear.', tone: 'teal', path: 'm5 12 4 4L19 6' },
  fair: { description: 'Visible wear from regular use.', tone: 'amber', path: 'M5 8h14M5 12h14M5 16h9' },
  used: { description: 'Previously used equipment.', tone: 'blue', path: 'M4 7h16v13H4ZM8 7V4h8v3M8 12h8' },
  serious: { description: 'Needs inspection or repairs.', tone: 'red', path: 'm12 3 10 18H2ZM12 9v5M12 17v1' },
  '': { description: 'No condition recorded.', tone: 'grey', path: 'M5 12h14' },
};

export default function AssetDetailChoiceField<T extends string>({
  label, value, options, onChange, className = '', assetDetailEditTarget, onRequestOpen,
}: {
  label: string;
  value: T | '';
  options: Array<ModalSelectOption<T>>;
  onChange: (value: T) => void;
  className?: string;
  assetDetailEditTarget?: string;
  onRequestOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const selected = options.find(option => option.value === value);
  const isCondition = assetDetailEditTarget === 'condition';
  const displayOptions = isCondition ? [...options.filter(option => option.value !== ''), ...options.filter(option => option.value === '')] : options;
  return <div className={`${fieldStyles.field} ${styles.field} ${className}`} data-asset-detail-edit-target={assetDetailEditTarget}>
    <span id={labelId}>{label}</span>
    <button type="button" className={styles.trigger} aria-labelledby={labelId}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => onRequestOpen ? onRequestOpen() : setOpen(true)}>
      <span>{selected?.label || `Choose ${label.toLowerCase()}`}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={isCondition ? 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6' : 'M4 7h16M4 17h16M8 4v6m8 4v6'} /></svg>
    </button>
    {open && createPortal(<LeadActionDialog title={`Choose ${label.toLowerCase()}`}
      assetTitle={isCondition ? 'Select the condition that best describes this asset.' : 'Choose how usage is measured for this asset.'}
      className={`${styles.dialog} ${isCondition ? styles.conditionDialog : ''}`} closeLabel={`Close ${label.toLowerCase()} choices`} onClose={() => setOpen(false)}>
      <div className={`${styles.choices} ${isCondition ? styles.conditionChoices : ''}`} role="group" aria-label={label}>
        {displayOptions.map(option => <button type="button" key={option.value}
          className={`${styles.choice} ${option.value === value ? styles.selected : ''}`}
          aria-pressed={option.value === value}
          onClick={() => { onChange(option.value); setOpen(false); }}>
          <span className={styles.icon} data-tone={isCondition ? conditionAppearance[option.value]?.tone || 'grey' : 'green'} aria-hidden="true">
            {isCondition ? <svg viewBox="0 0 24 24"><path d={conditionAppearance[option.value]?.path || 'M5 12h14'} /></svg>
              : <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>}
          </span>
          <span className={styles.copy}><strong>{isCondition && option.value === '' ? 'Not specified' : option.label === '%' ? 'Percentage' : option.label}</strong>{(isCondition ? conditionAppearance[option.value]?.description : option.description) && <small>{isCondition ? conditionAppearance[option.value]?.description : option.description}</small>}</span>
          <span className={styles.check} aria-hidden="true">{option.value === value ? '✓' : ''}</span>
        </button>)}
      </div>
    </LeadActionDialog>, document.body)}
  </div>;
}
