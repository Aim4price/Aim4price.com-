'use client';
import { useState } from 'react';
import GroupedCurrencyInput, { parseCurrencyInput } from './GroupedCurrencyInput';
import styles from './MarketplacePriceInput.module.css';

export default function MarketplacePriceInput({ value, onChange, disabled = false }: {
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const [included, setIncluded] = useState(false);
  const [entry, setEntry] = useState<{ canonical: string; text: string; included: boolean } | null>(null);
  const amount = parseCurrencyInput(value);
  const displayed = entry?.canonical === value && entry.included === included ? entry.text
    : amount === null ? '' : String(Math.round(amount * (included ? 1.15 : 1) * 100) / 100);
  return <div className={styles.field}>
    <div className={styles.heading}><strong>Asking price</strong><div className={styles.toggle} role="group" aria-label="Price VAT basis">
      <button type="button" disabled={disabled} aria-pressed={!included} onClick={() => { setIncluded(false); setEntry(null); }}>Excl. VAT</button>
      <button type="button" disabled={disabled} aria-pressed={included} onClick={() => { setIncluded(true); setEntry(null); }}>Incl. VAT</button>
    </div></div>
    <label className={styles.input}><span aria-hidden="true">R</span><GroupedCurrencyInput value={displayed} disabled={disabled} aria-label={`Asking price ${included ? 'including' : 'excluding'} VAT`} placeholder="0" onValueChange={text => {
      const parsed = parseCurrencyInput(text);
      const canonical = parsed === null ? '' : String(Math.round(parsed / (included ? 1.15 : 1) * 100) / 100);
      setEntry({ canonical, text, included }); onChange(canonical);
    }} /></label>
    <p>{included ? 'Includes 15% VAT. The excluding-VAT price is calculated automatically.' : 'Excludes VAT. Buyers can also view the price including 15% VAT.'}</p>
  </div>;
}
