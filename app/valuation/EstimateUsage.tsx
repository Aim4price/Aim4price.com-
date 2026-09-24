'use client';
import { useRef, useState } from 'react';
import type { PrivateEstimateSettings } from '../../lib/private-estimate-settings';
import styles from './estimate-tools.module.css';
import modal from '../../components/estimate-modal.module.css';

export default function EstimateUsage({ unit, lifetime, settings, busy, error, onApply }: {
  unit: 'hours' | 'km'; lifetime: number; settings: PrivateEstimateSettings | null;
  busy: boolean; error: string; onApply: (settings: PrivateEstimateSettings | null) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(String(lifetime));
  const [localError, setLocalError] = useState('');
  const max = unit === 'km' ? 2000000 : 50000;
  async function apply() {
    const number = Number(draft.replace(/\s/g, ''));
    if (!Number.isInteger(number) || number < 1 || number > max) {
      setLocalError(`Enter a maximum usage between 1 and ${max.toLocaleString('en-ZA')} ${unit}.`); return;
    }
    setLocalError('');
    if (await onApply({ conditionPercent: null, popularityPercent: null, ageDepreciationPercent: null, usageDepreciationPercent: null, ...settings, lifetimeUsage: number })) dialog.current?.close();
  }
  return <section className={styles.usageSummary}>
    <div><strong>Maximum usage</strong><p>{lifetime.toLocaleString('en-ZA')} {unit}</p></div>
    <button type="button" className={modal.adjustButton} aria-haspopup="dialog" disabled={busy} onClick={() => { setDraft(String(lifetime)); setLocalError(''); dialog.current?.showModal(); }}>Check / adjust</button>
    <dialog ref={dialog} className={`${styles.dialog} ${modal.surface}`} aria-labelledby="usage-limit-title" onCancel={event => { if (busy) event.preventDefault(); }}>
      <form onSubmit={event => { event.preventDefault(); void apply(); }}>
        <header className={styles.modalHeader}><div><h2 id="usage-limit-title" data-estimate-modal-title>Maximum usage</h2><p>Set the total lifetime expected from this asset. Drag the slider or type a value.</p></div><button type="button" className={modal.close} disabled={busy} onClick={() => dialog.current?.close()} aria-label="Close maximum usage">×</button></header>
        <div className={modal.valueControl}>
          <label className={modal.valueLabel} htmlFor="maximum-usage-input">Expected lifetime ({unit})</label>
          <div className={modal.amountEntry}>
            <input id="maximum-usage-input" type="text" inputMode="numeric" value={draft.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
              onChange={event => setDraft(event.target.value.replace(/[^0-9]/g, ''))} disabled={busy} />
            <span>{unit}</span>
          </div>
          <small className={modal.valueHint}>Current maximum: {lifetime.toLocaleString('en-ZA')} {unit}. Your actual reading stays unchanged.</small>
          <div className={modal.sliderControl}>
            <div className={modal.sliderLabels}><span>Drag to adjust</span><span>Or type the exact value above</span></div>
            <input className={modal.adjustSlider} aria-label={`Maximum usage slider (${unit})`} type="range" min={1} max={max} step={1}
              value={Math.max(1, Math.min(max, Number(draft) || 1))} onChange={event => setDraft(event.target.value)} disabled={busy} />
            <div className={modal.sliderLabels}><span>1 {unit}</span><span>{max.toLocaleString('en-ZA')} {unit}</span></div>
          </div>
        </div>
        {(localError || error) && <p className={styles.error} role="alert">{localError || error}</p>}
        <footer className={modal.actions}><button type="button" disabled={busy} onClick={() => dialog.current?.close()}>Close</button><button type="submit" className={modal.primary} disabled={busy}>{busy ? 'Recalculating...' : 'Recalculate estimate'}</button></footer>
      </form>
    </dialog>
  </section>;
}
