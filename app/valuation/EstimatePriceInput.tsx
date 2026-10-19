'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import modal from '../../components/estimate-modal.module.css';
import { REPLACEMENT_SLIDER_STEP, replacementSliderAmount, replacementSliderMaximum } from '../../lib/replacement-slider';

/** The caller always receives an ex-VAT amount; the input preserves editable decimals. */
export default function EstimatePriceInput({ value, onChange, vatMode, label, sliderMax, expanded = false }: {
  value: string; onChange: (value: string) => void; vatMode: 'incl' | 'excl'; label: string; sliderMax?: number; expanded?: boolean;
}) {
  const multiplier = vatMode === 'incl' ? 1.15 : 1;
  const amount = Number(value.replace(/[^0-9.-]/g, '')) || 0;
  const [draft, setDraft] = useState(() => amount > 0 ? String(Math.round(amount * multiplier * 100) / 100) : '');
  useEffect(() => {
    setDraft(amount > 0 ? String(Math.round(amount * multiplier * 100) / 100) : '');
  }, [amount, multiplier]);
  const display = draft.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const maximum = replacementSliderMaximum(Math.max(sliderMax ?? amount, amount) * multiplier);
  const adjust = (change: number) => onChange(String(Math.max(0, replacementSliderAmount(amount * multiplier) + change) / multiplier));
  return <div className={`${modal.valueControl} ${expanded ? modal.expandedPriceControl : ''}`}>
    {expanded && <div className={modal.priceReadout}><span>{label}</span><strong>{new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(amount * multiplier)}</strong><small>{vatMode === 'incl' ? 'Including VAT' : 'Excluding VAT'}</small></div>}
    {expanded && <span className={modal.priceEntryLabel}>Enter the replacement price ({vatMode === 'incl' ? 'incl.' : 'excl.'} VAT)</span>}
    <div className={modal.amountEntry}><span aria-hidden="true">R</span>
    <input aria-label={`${label} (${vatMode === 'incl' ? 'VAT included' : 'VAT excluded'})`} type="text" inputMode="decimal"
      value={display} placeholder="Enter amount"
      onChange={event => {
        const raw = event.target.value.replace(/[^0-9.]/g, '');
        if (!/^\d*(\.\d{0,2})?$/.test(raw)) return;
        setDraft(raw);
        onChange(raw && Number(raw) > 0 ? String(Number(raw) / multiplier) : '');
      }} />
    </div>
    {sliderMax != null && <div className={modal.sliderControl}>
      <div className={modal.sliderLabels}><span>Adjust in R5,000 steps</span><span>Type an exact amount {expanded ? 'below' : 'above'}</span></div>
      <input aria-label={`${label} slider (${vatMode === 'incl' ? 'VAT included' : 'VAT excluded'})`}
      type="range" min={0} max={maximum} step={REPLACEMENT_SLIDER_STEP}
      value={replacementSliderAmount(amount * multiplier)} className={modal.adjustSlider}
      style={expanded ? { '--price-progress': `${Math.min(100, amount * multiplier / maximum * 100)}%` } as CSSProperties : undefined}
      onChange={event => { onChange(String(replacementSliderAmount(Number(event.target.value)) / multiplier)); }} />
      {expanded && <div className={modal.priceFineTune}><button type="button" onClick={() => adjust(-REPLACEMENT_SLIDER_STEP)} disabled={amount <= 0}>− R 5 000</button><button type="button" onClick={() => adjust(REPLACEMENT_SLIDER_STEP)}>+ R 5 000</button></div>}
    </div>}
  </div>;
}

