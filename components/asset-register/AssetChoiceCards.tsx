'use client';

import { useState } from 'react';
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
  compactLabel?: string;
};

export default function AssetChoiceCards<T extends string>({ label, value, options, onChange, placeholder, className, hideLabel, compactLabel }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [confirmedValue, setConfirmedValue] = useState<T | null>(null);
  const answered = Boolean(value && (confirmedValue === value || !['unknown', 'included', 'excluded'].includes(value)));
  const question = label.replace(/\s*\*$/, '');
  const selected = options.find(option => option.value === value);
  const display = selected?.label || placeholder || 'Choose an option';

  return <div className={className || styles.field}>
    {!hideLabel && <span>{label}</span>}
    <button type="button" className={field.trigger} data-answered={answered} aria-label={`${question} — ${display}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <span>{compactLabel ?? display}</span>
      {!compactLabel && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>}
    </button>
    {open && <AssetChoiceDialog title={question} value={value} options={options}
      onClose={() => setOpen(false)} onBack={() => setOpen(false)}
      onSelect={next => { setConfirmedValue(next); onChange(next); setOpen(false); }} />}
  </div>;
}

export function AssetChoiceDialog<T extends string>({ title, subtitle = '', value, options, busy = false, onClose, onBack, onSelect }: {
  title: string;
  subtitle?: string;
  value: T | '';
  options: ModalSelectOption<T>[];
  busy?: boolean;
  onClose: () => void;
  onBack: () => void;
  onSelect: (value: T, trigger: HTMLButtonElement) => void;
}) {
  return createPortal(<LeadActionDialog title={title} assetTitle={subtitle} busy={busy} className={`${cards.categoryDialog} ${styles.dialog}`}
      closeLabel={`Close ${title} choices`} onClose={onClose}
      footer={<button type="button" className={styles.back} disabled={busy} onClick={onBack}>Back</button>}>
      <div className={`${cards.cards} ${styles.grid}`} role="group" aria-label={title}>
        {options.map((option, index) => <button type="button" key={option.value} className={cards.card}
          data-category={['storage', 'rental', 'insurance', 'service'][index % 4]} aria-pressed={value === option.value}
          disabled={busy} onClick={event => onSelect(option.value, event.currentTarget)}>
          <span className={cards.icon} aria-hidden="true"><AssetOptionIcon value={option.value} /></span>
          <span className={`${cards.copy} ${styles.copy}`}><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
        </button>)}
      </div>
    </LeadActionDialog>, document.body);
}
