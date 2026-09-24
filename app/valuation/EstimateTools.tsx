'use client';

import { useEffect, useRef, useState } from 'react';
import type { EstimateBreakdown } from '../../lib/estimate-breakdown';
import { ANNUAL_DEPRECIATION_FIELDS, PRIVATE_ESTIMATE_FIELDS, type PrivateEstimateSettings } from '../../lib/private-estimate-settings';
import styles from './estimate-tools.module.css';

const money = (value: number) => `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EstimateTools({ report, busy, error, onApply }: {
  report: EstimateBreakdown; busy: boolean; error: string;
  onApply: (settings: PrivateEstimateSettings | null) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [localError, setLocalError] = useState('');
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  function openSettings() {
    setDraft(Object.fromEntries(PRIVATE_ESTIMATE_FIELDS.map(({ key }) => [key, String(report.settings?.[key] ?? (key === 'ageWeightPercent' ? 50 : ANNUAL_DEPRECIATION_FIELDS.find(field => field.key === key)?.defaultValue) ?? '')])));
    setLocalError('');
    setOpen(true);
  }

  async function apply(reset = false) {
    const settings = {} as PrivateEstimateSettings;
    for (const field of PRIVATE_ESTIMATE_FIELDS) {
      const raw = draft[field.key]?.trim();
      settings[field.key] = raw ? Number(raw) : null;
      if (!reset && raw && (!Number.isFinite(settings[field.key]) || Number(raw) < field.min || Number(raw) > field.max)) {
        setLocalError(`${field.label}: enter a value between ${field.min} and ${field.max}, or leave it blank.`);
        return;
      }
    }
    setLocalError('');
    if (await onApply(reset ? null : settings)) setOpen(false);
  }

  return <section className={styles.tools} aria-label="Estimate calculation tools">
    <div className={styles.heading}>
      <button type="button" onClick={openSettings} disabled={busy}>Estimate settings</button>
    </div>
    <details className={styles.breakdown}>
      <summary>Breakdown</summary>
      {report.settings ? <p className={styles.customNote}>Manually adjusted estimate. Your settings apply to this estimate only.</p> : null}
      <div className={styles.tableScroll}>
        <table><caption>All amounts exclude VAT. Each percentage applies to the preceding balance.</caption>
          <thead><tr><th>Adjustment</th><th>% change</th><th>Rand change</th><th>Balance</th></tr></thead>
          <tbody>{report.rows.map((row, index) => <tr key={index}>
            <th scope="row">{row.label}</th>
            <td>{row.percent === null ? 'N/A' : `${row.percent > 0 ? '+' : ''}${Number(row.percent.toFixed(4))}%`}</td>
            <td>{index === 0 ? 'N/A' : `${row.change < 0 ? '−' : '+'}${money(Math.abs(row.change))}`}</td>
            <td>{money(row.value)}</td>
          </tr>)}</tbody>
          <tfoot><tr><th colSpan={3}>Final estimate (excl. VAT)</th><td>{money(report.total)}</td></tr></tfoot>
        </table>
      </div>
      <ul className={styles.notes}>{report.notes.map((note, i) => <li key={i}>{note}</li>)}</ul>
    </details>
    <dialog ref={dialog} className={styles.dialog} onCancel={(event) => { event.preventDefault(); if (!busy) setOpen(false); }}
      onClick={(event) => { const box = dialog.current?.getBoundingClientRect(); if (!busy && box && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) setOpen(false); }}
      aria-labelledby="estimate-settings-title">
      <form onSubmit={(event) => { event.preventDefault(); void apply(); }}>
        <header className={styles.modalHeader}><div><h2 id="estimate-settings-title">Estimate settings</h2>
          <p>Tweak this estimate, then apply your changes to recalculate.</p></div>
          <button type="button" className={styles.close} onClick={() => setOpen(false)} disabled={busy} aria-label="Close estimate settings">×</button>
        </header>
        <fieldset className={styles.settingGroup} disabled={busy}>
          <legend>Depreciation per year</legend>
          <p>Each rate deducts a percentage of the starting replacement price. Rates add up, capped at 100%. Year 6 onward repeats each year.</p>
          <div className={styles.yearFields}>
            {ANNUAL_DEPRECIATION_FIELDS.map(field => <label key={field.key}>
              <span>{field.label} (%)</span>
              <input type="number" min={0} max={100} step={0.01} value={draft[field.key] ?? ''}
                placeholder={String(field.defaultValue)}
                onChange={event => setDraft({ ...draft, [field.key]: event.target.value })} />
            </label>)}
          </div>
          {report.defaults?.ageDepreciationPercent == null && <small>Age is unknown for this asset. Annual rates apply when a year model is supplied.</small>}
        </fieldset>
        <fieldset className={styles.settingGroup} disabled={busy || report.defaults?.ageDepreciationPercent == null || report.defaults?.usageDepreciationPercent == null}>
          <legend>Age and usage weight</legend>
          <label className={styles.weight}>
            <span><strong>Age {draft.ageWeightPercent || 50}%</strong><strong>Usage {100 - Number(draft.ageWeightPercent || 50)}%</strong></span>
            <input aria-label="Age weight" type="range" min={0} max={100} step={1} value={draft.ageWeightPercent || '50'}
              aria-valuetext={`Age ${draft.ageWeightPercent || 50}%, usage ${100 - Number(draft.ageWeightPercent || 50)}%`}
              onChange={event => setDraft({ ...draft, ageWeightPercent: event.target.value })} />
          </label>
          <p>Move right to give age more weight; left to give usage more weight. When only one is available, that measure determines depreciation.</p>
        </fieldset>
        <div className={styles.fields}>
          {PRIVATE_ESTIMATE_FIELDS.filter(field => field.key === 'conditionPercent' || field.key === 'popularityPercent').map(field => <label key={field.key}>
            <span>{field.label}</span>
            <input type="number" min={field.min} max={field.max} step={0.01} value={draft[field.key] ?? ''} disabled={busy}
              placeholder={`Automatic${report.defaults?.[field.key] == null ? '' : ` (${Number(report.defaults[field.key]!.toFixed(2))}%)`}`}
              onChange={event => setDraft({ ...draft, [field.key]: event.target.value })} />
            <small>{field.key === 'conditionPercent' ? 'Overrides the Basic condition or Advanced detailed assessment. Leave blank to use the assessment.' : '100% leaves the value unchanged; 115% adds 15%. Leave blank to use the popularity rating.'}</small>
          </label>)}
        </div>
        <p className={styles.notice}>Custom estimates are labelled in the result and PDF. Salvage floors still apply. Platform defaults are never changed.</p>
        {(localError || error) && <p role="alert" className={styles.error}>{localError || error}</p>}
        <footer className={styles.actions}>
          <button type="button" disabled={busy} onClick={() => void apply(true)}>Reset to Aim4price defaults</button>
          <button type="submit" disabled={busy}>{busy ? 'Recalculating...' : 'Apply and recalculate'}</button>
        </footer>
      </form>
    </dialog>
  </section>;
}
