'use client';
import { useEffect, useState } from 'react';

/** The caller always receives an ex-VAT amount; the input preserves editable decimals. */
export default function EstimatePriceInput({ value, onChange, vatMode, label, sliderMax }: {
  value: string; onChange: (value: string) => void; vatMode: 'incl' | 'excl'; label: string; sliderMax?: number;
}) {
  const multiplier = vatMode === 'incl' ? 1.15 : 1;
  const amount = Number(value.replace(/[^0-9.-]/g, '')) || 0;
  const [draft, setDraft] = useState('');
  useEffect(() => {
    setDraft(amount > 0 ? String(Math.round(amount * multiplier * 100) / 100) : '');
  }, [amount, multiplier]);
  const display = draft.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return <div style={{ display: 'grid', gap: 14, width: '100%' }}>
    {sliderMax != null && <input aria-label={`${label} slider (${vatMode === 'incl' ? 'VAT included' : 'VAT excluded'})`}
      type="range" min={0} max={Math.max(sliderMax, amount) * multiplier} step={100}
      value={amount * multiplier} style={{ width: '100%', accentColor: '#175644' }}
      onChange={event => { onChange(String(Number(event.target.value) / multiplier)); }} />}
    <input aria-label={`${label} (${vatMode === 'incl' ? 'VAT included' : 'VAT excluded'})`} type="text" inputMode="decimal"
      value={display} placeholder="Enter amount"
      onChange={event => {
        const raw = event.target.value.replace(/[^0-9.]/g, '');
        if (!/^\d*(\.\d{0,2})?$/.test(raw)) return;
        setDraft(raw);
        onChange(raw && Number(raw) > 0 ? String(Number(raw) / multiplier) : '');
      }} />
  </div>;
}
