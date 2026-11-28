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
  const question = label.replace(/\s*\*$/, '');
  const selected = options.find(option => option.value === value);
  const display = selected?.label || placeholder || 'Choose an option';

  return <div className={className || styles.field}>
    {!hideLabel && <span>{label}</span>}
    <button type="button" className={field.trigger} aria-label={`${question} — ${display}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <span>{display}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
    </button>
    {open && <AssetChoiceDialog paginate title={question} value={value} options={options}
      onClose={() => setOpen(false)} onBack={() => setOpen(false)}
      onSelect={next => { onChange(next); setOpen(false); }} />}
  </div>;
}

export function AssetChoiceDialog<T extends string>({ title, subtitle = '', value, options, paginate = false, busy = false, onClose, onBack, onSelect }: {
  title: string;
  subtitle?: string;
  value: T | '';
  options: ModalSelectOption<T>[];
  paginate?: boolean;
  busy?: boolean;
  onClose: () => void;
  onBack: () => void;
  onSelect: (value: T, trigger: HTMLButtonElement) => void;
}) {
  const [start, setStart] = useState(() => Math.max(0, options.findIndex(option => option.value === value)));
  const compact = useSyncExternalStore(subscribeToSize, isCompact, () => false);
  const pageSize = paginate ? (compact ? 3 : 6) : Math.max(1, options.length);
  const page = Math.floor(start / pageSize);
  const pages = Math.ceil(options.length / pageSize);
  const visible = options.slice(page * pageSize, (page + 1) * pageSize);
  return createPortal(<LeadActionDialog title={title} assetTitle={subtitle} busy={busy} className={`${cards.categoryDialog} ${styles.dialog}`}
      closeLabel={`Close ${title} choices`} onClose={onClose}
      footer={<div className={styles.actions}>
        <button type="button" disabled={busy} onClick={onBack}>Back</button>
        {pages > 1 && <div className={styles.pager}>
          <button type="button" disabled={busy || page === 0} onClick={() => setStart((page - 1) * pageSize)}>Previous</button>
          <span aria-live="polite">{page + 1} of {pages}</span>
          <button type="button" disabled={busy || page + 1 === pages} onClick={() => setStart((page + 1) * pageSize)}>Next</button>
        </div>}
      </div>}>
      <div className={`${cards.cards} ${styles.grid} ${paginate ? '' : styles.allOptions}`} role="group" aria-label={title}>
        {visible.map((option, index) => <button type="button" key={option.value} className={cards.card}
          data-category={['storage', 'rental', 'insurance', 'service'][index % 4]} aria-pressed={value === option.value}
          disabled={busy} onClick={event => onSelect(option.value, event.currentTarget)}>
          <span className={cards.icon} aria-hidden="true"><AssetOptionIcon value={option.value} /></span>
          <span className={`${cards.copy} ${styles.copy}`}><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
        </button>)}
      </div>
    </LeadActionDialog>, document.body);
}
