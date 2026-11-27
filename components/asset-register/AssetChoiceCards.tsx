'use client';

import { useState } from 'react';
import { createPortal } from '../WebsitePortal';
import LeadActionDialog from '../leads/LeadActionDialog';
import type { ModalSelectOption } from '../AssetModalSelect';
import cards from '../../app/my-invoices/cost-categories.module.css';
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

export default function AssetChoiceCards<T extends string>({ label, value, options, onChange, placeholder, className, hideLabel }: Props<T>) {
  const [open, setOpen] = useState(false);
  const question = label.replace(/\s*\*$/, '');
  const selected = options.find(option => option.value === value);
  const display = selected?.label || placeholder || 'Choose an option';

  return <div className={className || field.field}>
    {!hideLabel && <span>{label}</span>}
    <button type="button" className={field.trigger} aria-label={`${question} — ${display}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <span>{display}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></svg>
    </button>
    {open && createPortal(<LeadActionDialog title={question} assetTitle="" className={cards.categoryDialog}
      closeLabel={`Close ${question} choices`} onClose={() => setOpen(false)}
      footer={<button type="button" onClick={() => setOpen(false)}>Back</button>}>
      <div className={cards.cards} role="group" aria-label={question}>
        {options.map((option, index) => <button type="button" key={option.value} className={cards.card}
          data-category={['storage', 'rental', 'insurance', 'service'][index % 4]} aria-pressed={value === option.value}
          onClick={() => { onChange(option.value); setOpen(false); }}>
          <span className={cards.icon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="12" r="8"/>{value === option.value && <path d="m8 12 3 3 5-6"/>}
          </svg></span>
          <span className={`${cards.copy} ${styles.copy}`}><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
        </button>)}
      </div>
    </LeadActionDialog>, document.body)}
  </div>;
}
