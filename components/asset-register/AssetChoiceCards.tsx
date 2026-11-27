'use client';

import { useState, useSyncExternalStore } from 'react';
import { createPortal } from '../WebsitePortal';
import LeadActionDialog from '../leads/LeadActionDialog';
import type { ModalSelectOption } from '../AssetModalSelect';
import cards from '../../app/my-invoices/cost-categories.module.css';
import AssetOptionIcon from './AssetOptionIcon';
import field from '../AssetDetailChoiceField.module.css';
import styles from './AssetChoiceCards.module.css';

type Props<T extends string> = {
  label: string;
  value: T | '';
  options: ModalSelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  hideLabel?: boolean;
};

const compactQuery = '(max-width: 640px), (max-height: 520px)';
function subscribeToSize(change: () => void) {
  const media = window.matchMedia(compactQuery);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
}
const isCompact = () => window.matchMedia(compactQuery).matches;

export default function AssetChoiceCards<T extends string>({ label, value, options, onChange, placeholder, className, hideLabel }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(0);
  const compact = useSyncExternalStore(subscribeToSize, isCompact, () => false);
  const pageSize = compact ? 3 : 6;
  const page = Math.floor(start / pageSize);
  const pages = Math.ceil(options.length / pageSize);
  const visible = options.slice(page * pageSize, (page + 1) * pageSize);
  const question = label.replace(/\s*\*$/, '');
  const selected = options.find(option => option.value === value);
  const display = selected?.label || placeholder || 'Choose an option';

  return <div className={className || styles.field}>
    {!hideLabel && <span>{label}</span>}
    <button type="button" className={field.trigger} aria-label={`${question} — ${display}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setStart(Math.max(0, options.findIndex(option => option.value === value))); setOpen(true); }}>
      <span>{display}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
    </button>
    {open && createPortal(<LeadActionDialog title={question} assetTitle="" className={`${cards.categoryDialog} ${styles.dialog}`}
      closeLabel={`Close ${question} choices`} onClose={() => setOpen(false)}
      footer={<div className={styles.actions}>
        <button type="button" onClick={() => setOpen(false)}>Back</button>
        {pages > 1 && <div className={styles.pager}>
          <button type="button" disabled={page === 0} onClick={() => setStart((page - 1) * pageSize)}>Previous</button>
          <span aria-live="polite">{page + 1} of {pages}</span>
          <button type="button" disabled={page + 1 === pages} onClick={() => setStart((page + 1) * pageSize)}>Next</button>
        </div>}
      </div>}>
      <div className={`${cards.cards} ${styles.grid}`} role="group" aria-label={question}>
        {visible.map((option, index) => <button type="button" key={option.value} className={cards.card}
          data-category={['storage', 'rental', 'insurance', 'service'][index % 4]} aria-pressed={value === option.value}
          onClick={() => { onChange(option.value); setOpen(false); }}>
          <span className={cards.icon} aria-hidden="true"><AssetOptionIcon value={option.value} /></span>
          <span className={`${cards.copy} ${styles.copy}`}><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
        </button>)}
      </div>
    </LeadActionDialog>, document.body)}
  </div>;
}
