'use client';
import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import styles from './vat-price-input.module.css';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  valueExVat: string;
  included: boolean;
  vatRate: number;
  onValueChange: (valueExVat: string) => void;
};

function format(value: string) {
  const [whole, ...fraction] = value.replace(/,/g, '.').replace(/[^\d.]/g, '').split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return fraction.length ? `${grouped}.${fraction.join('').slice(0, 2)}` : grouped;
}
function display(value: string, included: boolean, rate: number) {
  if (!value.trim()) return '';
  const number = Number(value.replace(/\s/g, ''));
  return Number.isFinite(number) ? format(String(Number((number * (included ? 1 + rate : 1)).toFixed(2)))) : '';
}

// Keep an editable display draft while the parent always holds the VAT-exclusive basis.
export default function VatPriceInput({ valueExVat, included, vatRate, onValueChange, ...props }: Props) {
  const [draft, setDraft] = useState(() => display(valueExVat, included, vatRate));
  const last = useRef({ value: valueExVat, included, vatRate });
  useLayoutEffect(() => {
    if (valueExVat !== last.current.value || included !== last.current.included || vatRate !== last.current.vatRate) {
      setDraft(display(valueExVat, included, vatRate));
    }
    last.current = { value: valueExVat, included, vatRate };
  }, [valueExVat, included, vatRate]);
  return <span className={styles.moneyField}>
    <span className={styles.prefix} aria-hidden="true">R</span>
    <input {...props} type="text" inputMode="decimal" value={draft} onChange={event => {
      const input = event.currentTarget;
      const count = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/[^\d.,]/g, '').length;
      const next = format(input.value);
      const number = Number(next.replace(/\s/g, ''));
      const canonical = next && Number.isFinite(number) ? String(number / (included ? 1 + vatRate : 1)) : '';
      last.current = { value: canonical, included, vatRate };
      setDraft(next);
      onValueChange(canonical);
      let cursor = 0, seen = 0;
      while (cursor < next.length && seen < count) { if (/[\d.]/.test(next[cursor])) seen++; cursor++; }
      requestAnimationFrame(() => { if (document.activeElement === input) input.setSelectionRange(cursor, cursor); });
    }} />
  </span>;
}
