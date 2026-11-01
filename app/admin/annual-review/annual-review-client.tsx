'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import CostDetailIcon from '../../../components/CostDetailIcon';
import chrome from '../../../components/AccountDialog.module.css';
import { percentagePrice, type AnnualReviewAsset, type AnnualReviewResult } from '../../../lib/annual-review-policy';
import styles from './page.module.css';

type Snapshot = { owner: { email: string; name: string }; year: number; assets: AnnualReviewAsset[] };
const money = (value: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value);
const stages = ['Welcome', 'Your choice', 'Percentage', 'Results', 'Confirmation'];

export default function AnnualReviewClient() {
  const [email, setEmail] = useState('kallageldenhuys@gmail.com');
  const [year, setYear] = useState(2027);
  const [data, setData] = useState<Snapshot | null>(null);
  const [open, setOpen] = useState(false), [step, setStep] = useState(0);
  const [percent, setPercent] = useState(3);
  const [results, setResults] = useState<Record<string, AnnualReviewResult>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), heading = useRef<HTMLHeadingElement>(null), body = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null), generation = useRef(0);
  const eligible = data?.assets.filter(asset => asset.eligible) || [];
  const excluded = (data?.assets.length || 0) - eligible.length;
  const successes = eligible.filter(asset => results[asset.id]?.proposedValue != null && !results[asset.id]?.error);
  const failures = eligible.filter(asset => results[asset.id]?.error);
  const complete = eligible.length > 0 && successes.length === eligible.length;
  const oldReplacement = successes.reduce((sum, asset) => sum + (asset.replacementPrice || 0), 0);
  const newReplacement = successes.reduce((sum, asset) => sum + (results[asset.id].replacementPrice || 0), 0);
  const oldValue = successes.reduce((sum, asset) => sum + results[asset.id].currentValue, 0);
  const newValue = successes.reduce((sum, asset) => sum + results[asset.id].proposedValue!, 0);
  const saleabilityCount = successes.filter(asset => asset.saleability && results[asset.id].proposedValue !== results[asset.id].currentValue).length;
  function close() { generation.current++; request.current?.abort(); setBusy(false); setOpen(false); }
  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    dialog.current?.showModal();
    const oldBody = document.body.style.overflow, oldHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden';
    return () => { document.body.style.overflow = oldBody; document.documentElement.style.overflow = oldHtml; };
  }, [open]);
  useEffect(() => { if (open) { heading.current?.focus(); body.current?.scrollTo(0, 0); } }, [step, open]);
  useEffect(() => () => request.current?.abort(), []);
  async function load() {
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    const id = ++generation.current; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/annual-review?email=${encodeURIComponent(email.trim())}&year=${year}`, { cache: 'no-store', signal: controller.signal });
      const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Unable to load owner.');
      if (id !== generation.current) return;
      setData(value); setPercent(3); setResults({}); setConfirmed(false); setProgress(0); setStep(0); setOpen(true);
    } catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : 'Unable to load preview.'); }
    finally { if (id === generation.current) setBusy(false); }
  }
  async function calculate() {
    if (!data || busy) return;
    const pending = eligible.filter(asset => !results[asset.id] || results[asset.id].error);
    const id = ++generation.current, controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setProgress(successes.length); setStep(3);
    for (let index = 0; index < pending.length; index++) {
      const asset = pending[index]; if (id !== generation.current) break;
      let result: AnnualReviewResult;
      try {
        const response = await fetch('/api/admin/annual-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ action: 'preview', email: data.owner.email, year: data.year, assetId: asset.id, revision: asset.revision, replacementPrice: percentagePrice(asset.replacementPrice!, percent) }) });
        const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Calculation failed.');
        result = value.result;
      } catch (e) { result = { id: asset.id, currentValue: asset.currentValue, proposedValue: null, replacementPrice: asset.replacementPrice, error: e instanceof Error ? e.message : 'Calculation failed.' }; }
      if (id !== generation.current) break;
      setResults(previous => ({ ...previous, [asset.id]: result })); setProgress(successes.length + index + 1);
    }
    if (id === generation.current) setBusy(false);
  }
  function changePercent(value: number) { setPercent(value); setResults({}); setConfirmed(false); setProgress(0); setError(''); }
  const title = step === 0 ? `Happy new year, ${data?.year}!` : ['','Update replacement prices?', 'Choose your yearly adjustment', 'Your annual update preview', confirmed ? 'Preview complete' : 'Are you sure?'][step];
  const totals = <div className={styles.totals}>
    <article><span className={styles.metricIcon}><CostDetailIcon kind="parts" /></span><h3>Total replacement prices</h3><small>Assets only · saved extras unchanged</small><dl><div><dt>Current</dt><dd>{money(oldReplacement)}</dd></div><div><dt>Proposed</dt><dd>{money(newReplacement)}</dd></div></dl><p className={styles.delta}>{newReplacement >= oldReplacement ? 'Increase' : 'Decrease'} of {money(Math.abs(newReplacement - oldReplacement))}</p></article>
    <article><span className={styles.metricIcon}><CostDetailIcon kind="money" /></span><h3>Total asset value</h3><small>Recalculated using Aim4price rules</small><dl><div><dt>Current</dt><dd>{money(oldValue)}</dd></div><div><dt>Proposed</dt><dd>{money(newValue)}</dd></div></dl><p className={styles.delta}>{newValue >= oldValue ? 'Increase' : 'Decrease'} of {money(Math.abs(newValue - oldValue))}</p></article>
  </div>;
  return <div className={styles.page}>
    <h1>Preview annual review</h1><p>Admin only. Explore the yearly update using existing owner data.</p>
    <div className={styles.setup}><label>Owner email<input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label><label>Simulated year<input type="number" min="2000" max="2100" value={year} onChange={e => setYear(Number(e.target.value))} disabled={busy} /></label><button onClick={load} disabled={busy || !email.trim() || !Number.isInteger(year) || year < 2000 || year > 2100}>Open preview</button>{data && <button onClick={() => { setError(''); setOpen(true); }} disabled={busy}>Resume preview</button>}</div>
    <p>Simulates 1 January. Live values and history stay unchanged. You can close and resume until you leave this page.</p>
    {!open && error && <p role="alert" className={styles.error}>{error}</p>}
    <dialog ref={dialog} className={`${styles.dialog} ${chrome.surface} ${chrome.flush}`} onCancel={e => { e.preventDefault(); close(); }} aria-labelledby="review-title">
      <header className={chrome.header}><div><span className={styles.eyebrow}>Aim4price · Annual asset review</span><h2 id="review-title" ref={heading} tabIndex={-1}>{title}</h2><p>{data?.owner.email} · 1 January {data?.year}</p></div><button data-modal-close className={chrome.close} aria-label="Close annual review" onClick={close}>×</button></header>
      <div className={styles.reviewStatus}><div className={styles.previewLabel}><CostDetailIcon kind="document" /><span>Preview — no changes saved</span></div><span className={styles.stageLabel}>{stages[step]}</span></div>
      <nav className={styles.progressTrack} aria-label="Annual review progress">{stages.map((stage, index) => <span key={stage} aria-label={stage} aria-current={step === index ? 'step' : undefined} data-complete={index <= step} />)}</nav>
      <div ref={body} className={`${chrome.body} ${styles.body}`}>
        {step === 0 && <div className={styles.welcome}><div className={styles.yearPanel}><span className={styles.heroIcon}><CostDetailIcon kind="calendar" /></span><span className={styles.year}>{data?.year}</span><span className={styles.yearCaption}>A fresh perspective.</span></div><div className={styles.welcomeCopy}><span className={styles.eyebrow}>Your yearly check-in</span><h3>A fresh year for<br />your assets.</h3><p>A simple review to keep replacement prices in step with the year ahead.</p><div className={styles.welcomeFacts}><span><CostDetailIcon kind="parts" /><strong>{eligible.length} eligible assets</strong><small>One adjustment across your register</small></span><span><CostDetailIcon kind="percent" /><strong>You choose the percentage</strong><small>See the result before confirming</small></span></div><p className={styles.muted}>Wishing you a successful year ahead.<br /><strong>The Aim4price team</strong></p></div></div>}
        {step === 1 && <><div className={styles.intro}><h3>Has the cost of buying new changed?</h3><p>Apply one percentage across all {eligible.length} eligible {eligible.length === 1 ? 'asset' : 'assets'}. You’ll see the totals before confirming.</p></div><div className={styles.options}><button onClick={() => setStep(2)} disabled={!eligible.length}><CostDetailIcon kind="percent" /><strong>Yes, review an adjustment</strong><small>Choose a percentage and preview the result.</small></button><button onClick={close}><CostDetailIcon kind="parts" /><strong>No, keep prices unchanged</strong><small>Close the review. Nothing changes.</small></button></div><p className={styles.note}>For individual changes, use your Asset Register.</p>{excluded > 0 && <p className={styles.note}>{excluded} {excluded === 1 ? 'asset is' : 'assets are'} excluded by the annual-review checks and will stay unchanged.</p>}{!eligible.length && <p role="status">No assets are eligible for this annual update.</p>}</>}
        {step === 2 && <><div className={styles.intro}><h3>One percentage. Your eligible assets.</h3><p>Suggested yearly adjustment: <strong>3%</strong>. Choose the percentage that suits your replacement costs.</p></div><div className={styles.sliderCard}><label htmlFor="annual-percent">Replacement-price adjustment</label><output htmlFor="annual-percent">{percent > 0 ? '+' : ''}{percent}%</output><input style={{ "--range-fill": `${(percent + 10) / 30 * 100}%` } as CSSProperties} id="annual-percent" aria-label="Replacement-price adjustment" type="range" min="-10" max="20" step="0.5" value={percent} onChange={e => changePercent(Number(e.target.value))} /><div className={styles.rangeLabels}><span>−10%</span><span>20%</span></div><button onClick={() => changePercent(3)}>Use suggested 3%</button><small>A suggested allowance, not a measured inflation rate.</small></div><p className={styles.note}>Applies to asset-only replacement prices. Saved extras, usage and manual valuations stay unchanged. Asset values are recalculated for {data?.year}, so age depreciation can offset an increase.</p></>}
        {step === 3 && <><div className={styles.resultIntro}><span className={styles.badge}>{percent > 0 ? '+' : ''}{percent}% replacement adjustment</span><p>{successes.length} of {eligible.length} assets calculated · all totals exclude VAT</p></div>{busy && <div className={styles.calculating} role="status"><span>Calculating {progress} of {eligible.length} assets…</span><progress value={progress} max={eligible.length} /></div>}{!busy && !complete && <div className={styles.alert} role="status"><strong>{failures.length ? `${failures.length} ${failures.length === 1 ? 'calculation needs' : 'calculations need'} another look` : 'Your preview is not complete yet'}</strong><p>Totals below include only successful calculations. Complete the preview before confirming. Successful results will be kept when you retry.</p><button onClick={calculate}>Retry / complete preview</button></div>}{successes.length > 0 && totals}{!successes.length && !busy && <p>No totals are available yet.</p>}<p className={styles.note}>The percentage changes replacement prices, not asset values directly. Values include the simulated year’s depreciation and each asset’s saved calculation rules.</p>{excluded > 0 && <p className={styles.note}>{excluded} excluded {excluded === 1 ? 'asset stays' : 'assets stay'} unchanged.</p>}</>}
        {step === 4 && <div className={styles.confirmation}><span className={styles.heroIcon}><CostDetailIcon kind={confirmed ? 'document' : 'percent'} /></span><h3>{confirmed ? 'Your yearly adjustment has been previewed.' : `Confirm a ${percent > 0 ? '+' : ''}${percent}% replacement-price adjustment?`}</h3><p>{confirmed ? 'No asset values, replacement prices or history records have been saved.' : `This would recalculate all ${eligible.length} eligible assets for ${data?.year}. Individual changes remain in the Asset Register.`}</p><div className={styles.confirmTotals}><span>Proposed replacement total<strong>{money(newReplacement)}</strong><small>Assets only · excl. VAT</small></span><span>Proposed asset value<strong>{money(newValue)}</strong><small>Excl. VAT</small></span></div>{saleabilityCount > 0 && <p className={styles.note}>{saleabilityCount} Saleability {saleabilityCount === 1 ? 'assessment would' : 'assessments would'} need recalculating after a future saved update.</p>}<p className={styles.previewReminder}>Admin preview only. Confirmation records your choice on this screen; it does not save changes.</p></div>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
      <footer className={`${chrome.footer} ${styles.footer}`}><button className={styles.closeAction} onClick={close}>Close</button>{step > 0 && !confirmed && <button disabled={busy} onClick={() => setStep(step - 1)}>Back</button>}{step === 0 && <button className={styles.primary} onClick={() => setStep(1)}>Continue</button>}{step === 2 && <button className={styles.primary} onClick={calculate} disabled={busy || !eligible.length}>Preview results</button>}{step === 3 && <button className={styles.primary} disabled={busy || !complete} onClick={() => setStep(4)}>Continue to confirmation</button>}{step === 4 && !confirmed && <button className={styles.primary} disabled={!complete} onClick={() => setConfirmed(true)}>Confirm preview</button>}{step === 4 && confirmed && <button className={styles.primary} onClick={close}>Done</button>}</footer>
    </dialog>
  </div>;
}
