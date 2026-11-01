'use client';
import { useEffect, useRef, useState } from 'react';
import CostDetailIcon from '../../../components/CostDetailIcon';
import chrome from '../../../components/AccountDialog.module.css';
import { percentagePrice, priceExVat, type AnnualReviewAsset, type AnnualReviewResult } from '../../../lib/annual-review-policy';
import styles from './page.module.css';

type Snapshot = { owner: { email: string; name: string }; year: number; assets: AnnualReviewAsset[] };
const money = (value: number | null) => value === null ? 'Unavailable' : new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value);
const titles = ['Welcome', 'Yearly depreciation', 'Replacement prices', 'Summary'];

export default function AnnualReviewClient() {
  const [email, setEmail] = useState('kallageldenhuys@gmail.com');
  const [year, setYear] = useState(2027);
  const [data, setData] = useState<Snapshot | null>(null);
  const [query, setQuery] = useState(''), [listPage, setListPage] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [depreciation, setDepreciation] = useState<Record<string, AnnualReviewResult>>({});
  const [replacement, setReplacement] = useState<Record<string, AnnualReviewResult>>({});
  const [includeDepreciation, setIncludeDepreciation] = useState(false);
  const [mode, setMode] = useState<'keep' | 'edit' | 'percent'>('keep');
  const [percent, setPercent] = useState(''), [inclusive, setInclusive] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [replacementSelection, setReplacementSelection] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  function close() { generation.current++; request.current?.abort(); setBusy(false); setProgress(''); setOpen(false); }
  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    dialog.current?.showModal();
    const body = document.body.style.overflow, html = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden';
    return () => { document.body.style.overflow = body; document.documentElement.style.overflow = html; };
  }, [open]);
  useEffect(() => { if (open) { heading.current?.focus(); bodyRef.current?.scrollTo(0, 0); } setQuery(''); setListPage(0); }, [open, step]);
  useEffect(() => () => request.current?.abort(), []);
  const eligible = data?.assets.filter(asset => asset.eligible) || [];
  const chosen = eligible.filter(asset => selected.includes(asset.id));
  const replacements = eligible.filter(asset => replacementSelection.includes(asset.id));
  function resetCalculations() { setDepreciation({}); setReplacement({}); setIncludeDepreciation(false); }
  async function load() {
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    const id = ++generation.current;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/annual-review?email=${encodeURIComponent(email.trim())}&year=${year}`, { cache: 'no-store', signal: controller.signal });
      const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Unable to load owner.');
      if (id !== generation.current) return;
      setData(value); const ids = value.assets.filter((asset: AnnualReviewAsset) => asset.eligible).map((asset: AnnualReviewAsset) => asset.id);
      setSelected(ids); setReplacementSelection(ids); setPrices({}); setPercent(''); setMode('keep'); setInclusive(false);
      resetCalculations(); setStep(0); setOpen(true);
    } catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : 'Unable to load preview.'); }
    finally { if (id === generation.current) setBusy(false); }
  }
  function proposedReplacement(asset: AnnualReviewAsset) {
    if (mode === 'percent') {
      if (!percent.trim()) throw new Error('Enter the percentage change first.');
      return percentagePrice(asset.replacementPrice!, Number(percent));
    }
    if (!prices[asset.id]?.trim()) throw new Error(`Enter a replacement price for ${asset.title}.`);
    return priceExVat(Number(prices[asset.id]), inclusive);
  }
  async function calculate(phase: 'age' | 'replacement', retry = false) {
    if (!data || busy) return;
    const existing = phase === 'age' ? depreciation : replacement;
    const assets = (phase === 'age' ? chosen : replacements).filter(asset => !retry || !existing[asset.id] || !!existing[asset.id].error);
    const inputs: Record<string, number> = {};
    setError('');
    try { if (phase === 'replacement') assets.forEach(asset => { inputs[asset.id] = proposedReplacement(asset); }); }
    catch (e) { setError((e as Error).message); return; }
    const id = ++generation.current, controller = new AbortController(); request.current = controller;
    setBusy(true);
    for (let index = 0; index < assets.length; index++) {
      const asset = assets[index];
      if (id !== generation.current) break;
      setProgress(`Calculating ${index + 1} of ${assets.length}: ${asset.title}`);
      let result: AnnualReviewResult;
      try {
        const response = await fetch('/api/admin/annual-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ action: 'preview', email: data.owner.email, year: data.year, assetId: asset.id, revision: asset.revision, ...(phase === 'replacement' ? { replacementPrice: inputs[asset.id] } : {}) }) });
        const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Calculation failed.');
        result = value.result;
      } catch (e) { result = { id: asset.id, currentValue: asset.currentValue, proposedValue: null, replacementPrice: asset.replacementPrice, error: e instanceof Error ? e.message : 'Calculation failed.' }; }
      if (id !== generation.current) break;
      (phase === 'age' ? setDepreciation : setReplacement)(previous => ({ ...previous, [asset.id]: result }));
    }
    if (id === generation.current) { setBusy(false); setProgress(''); }
  }
  function changeMode(value: typeof mode) { setMode(value); setReplacement({}); setError(''); }
  const ageComplete = chosen.length > 0 && chosen.every(asset => depreciation[asset.id]);
  const replacementComplete = mode === 'keep' || replacements.length > 0 && replacements.every(asset => replacement[asset.id]);
  const totalChange = chosen.reduce((total, asset) => { const r = depreciation[asset.id]; return total + (r?.proposedValue != null ? r.proposedValue - r.currentValue : 0); }, 0);
  const finalResults = new Map<string, AnnualReviewResult>();
  if (includeDepreciation) chosen.forEach(asset => { if (depreciation[asset.id]) finalResults.set(asset.id, depreciation[asset.id]); });
  if (mode !== 'keep') replacements.forEach(asset => { if (replacement[asset.id]) finalResults.set(asset.id, replacement[asset.id]); });
  const successful = [...finalResults.values()].filter(result => result.proposedValue != null && !result.error);
  const failed = [...finalResults.values()].filter(result => result.error);
  const changed = successful.filter(result => result.proposedValue !== result.currentValue);
  const saleability = changed.filter(result => data?.assets.find(asset => asset.id === result.id)?.saleability);
  const toggle = (id: string, values: string[]) => values.includes(id) ? values.filter(value => value !== id) : [...values, id];
  const pageSize = 6;
  function filtered(assets: AnnualReviewAsset[]) { return assets.filter(asset => asset.title.toLowerCase().includes(query.trim().toLowerCase())); }
  function visible(assets: AnnualReviewAsset[]) { const rows = filtered(assets); const page = Math.min(listPage, Math.max(0, Math.ceil(rows.length / pageSize) - 1)); return rows.slice(page * pageSize, (page + 1) * pageSize); }
  function listTools(assets: AnnualReviewAsset[]) {
    const count = filtered(assets).length, pages = Math.max(1, Math.ceil(count / pageSize)), page = Math.min(listPage, pages - 1);
    return <div className={styles.listTools}><label className={styles.search}>Find an asset<input type="search" placeholder="Search by year, make or model" value={query} onChange={e => { setQuery(e.target.value); setListPage(0); }} /></label><span>{count} asset{count === 1 ? '' : 's'}</span>{pages > 1 && <div className={styles.pagination}><button aria-label="Previous assets" disabled={page === 0} onClick={() => setListPage(page - 1)}>‹</button><span>{page + 1} / {pages}</span><button aria-label="Next assets" disabled={page === pages - 1} onClick={() => setListPage(page + 1)}>›</button></div>}</div>;
  }
  const results = (assets: AnnualReviewAsset[], values: Record<string, AnnualReviewResult>, paginate = true) => <>{paginate && listTools(assets)}<div className={styles.cards}>{(paginate ? visible(assets) : assets).map(asset => {
    const result = values[asset.id];
    const change = result?.proposedValue != null && !result.error ? result.proposedValue - result.currentValue : null;
    return <article key={asset.id} className={styles.card}><div className={styles.assetName}><CostDetailIcon kind="asset" /><strong>{asset.title}</strong></div>
      <div className={styles.values}><span>Current value<b>{money(asset.currentValue)}</b></span><span aria-hidden="true" className={styles.arrow}>→</span><span>Proposed value<b>{result?.error ? 'Needs review' : result ? money(result.proposedValue) : 'Awaiting preview'}</b></span><span className={styles.change}>{change === null ? '—' : `${change > 0 ? '+' : ''}${money(change)}`}</span></div>
      {result?.error && <p role="status" className={styles.error}>{result.error}</p>}{result?.warning && <p>{result.warning}</p>}
      {values === replacement && result && <p>Replacement: {money(asset.replacementPrice)} → {money(result.replacementPrice)} excl. VAT</p>}
    </article>;
  })}{filtered(assets).length === 0 && <p className={styles.empty}>No matching assets. Try a different search.</p>}</div></>;
  return <div className={styles.page}>
    <h1>Preview annual review</h1><p>Admin only. Explore the proposed owner flow using existing asset data.</p>
    <div className={styles.setup}><label>Owner email<input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>
      <label>Simulated year<input type="number" min="2000" max="2100" value={year} onChange={e => setYear(Number(e.target.value))} disabled={busy} /></label>
      <button onClick={load} disabled={busy || !email.trim() || year < 2000 || year > 2100}>Open preview</button>
      {data && <button onClick={() => { setError(''); setOpen(true); }} disabled={busy}>Resume preview</button>}</div>
    <p>The simulation uses 1 January of the selected year. Live dates, values and history are unchanged. Closing keeps this preview available until you leave this page.</p>
    {!open && error && <p role="alert" className={styles.error}>{error}</p>}
    <dialog ref={dialog} className={`${styles.dialog} ${chrome.surface} ${chrome.flush}`} onCancel={e => { e.preventDefault(); close(); }} aria-labelledby="review-title">
      <header className={chrome.header}><div><h2 id="review-title" ref={heading} tabIndex={-1}>{step === 0 ? `Welcome to ${data?.year}` : titles[step]}</h2><p>{data?.owner.email} · 1 January {data?.year}</p></div><button data-modal-close className={chrome.close} aria-label="Close annual review" onClick={close}>×</button></header>
      <div className={styles.previewLabel}><CostDetailIcon kind="document" /> Preview — no changes saved<span>Step {step + 1} of 4</span></div>
      <nav className={styles.steps} aria-label="Review stages">{titles.map((title, index) => <span key={title} aria-label={title} aria-current={index === step ? 'step' : undefined} data-complete={index < step}><b>{index < step ? '✓' : index + 1}</b><span>{title}</span></span>)}</nav>
      <div ref={bodyRef} className={`${chrome.body} ${styles.body}`}>
        {step === 0 && <><h3><CostDetailIcon kind="calendar" /> Keep values aligned with another year of age</h3><p>Preview Aim4price’s rules for each asset. Usage, manual valuations and replacement prices stay unchanged.</p>
          <div className={styles.actions}><button onClick={() => { setSelected(eligible.map(a => a.id)); resetCalculations(); }} disabled={busy}>All eligible assets ({eligible.length})</button><button onClick={() => { setSelected([]); resetCalculations(); }} disabled={busy}>Select assets</button></div>
          <div className={styles.selectionHeading}><strong>{selected.length} selected</strong><span>Only age-based valuations are eligible.</span></div>
          {listTools(eligible)}<div className={`${styles.cards} ${styles.selectionGrid}`}>{visible(eligible).map(asset => <label key={asset.id} className={styles.choice}><input type="checkbox" checked={selected.includes(asset.id)} disabled={!asset.eligible || busy} onChange={() => { setSelected(toggle(asset.id, selected)); resetCalculations(); }} /><span><strong>{asset.title}</strong><small>{asset.reason || `${money(asset.currentValue)} · Eligible`}</small></span></label>)}</div>
          {filtered(eligible).length === 0 && <p className={styles.empty}>No eligible assets match this selection.</p>}
          {!!data?.assets.some(asset => !asset.eligible) && <details className={styles.exclusions}><summary>{data.assets.filter(asset => !asset.eligible).length} {data.assets.filter(asset => !asset.eligible).length === 1 ? 'asset' : 'assets'} kept unchanged <span>View reasons</span></summary>{data.assets.filter(asset => !asset.eligible).map(asset => <label key={asset.id} className={styles.choice}><input type="checkbox" disabled checked={false} readOnly /><span><strong>{asset.title}</strong><small>{asset.reason}</small></span></label>)}</details>}
          {!data?.assets.length && <p>No active assets were found for this owner.</p>}</>}
        {step === 1 && <><h3><CostDetailIcon kind="money" /> Preview yearly depreciation</h3><p>Calculated for {data?.year} using each asset’s saved inputs and current Aim4price rules. All values exclude VAT.</p>
          <div className={styles.actions}><button onClick={() => calculate('age', true)} disabled={busy || !chosen.length}>{Object.keys(depreciation).length ? 'Calculate missing / retry failed' : 'Calculate preview'}</button><div className={styles.total}><span>Combined calculated change</span><strong>{Object.values(depreciation).some(r => r.proposedValue != null && !r.error) ? money(totalChange) : 'Awaiting preview'}</strong><small>{chosen.filter(a => depreciation[a.id]?.proposedValue != null && !depreciation[a.id]?.error).length} of {chosen.length} calculated · excl. VAT</small></div></div>
          {results(chosen, depreciation)}{!chosen.length && <p>No assets selected. Go back to choose assets, or skip this step.</p>}
          <p>“Include in preview” simulates the owner’s confirmation. It does not save depreciation.</p></>}
        {step === 2 && <><h3><CostDetailIcon kind="parts" /> Has the cost of buying new changed?</h3><p>Choose an option, then preview it. Replacement prices never increase automatically.</p>
          <div className={styles.optionGrid}>{([['keep', 'Keep unchanged', 'parts', 'Continue with the replacement prices already saved.'], ['edit', 'Edit specific assets', 'document', 'Enter a new price for individual assets.'], ['percent', 'Adjust by percentage', 'percent', 'Preview an increase or decrease across your selection.']] as const).map(([value, label, icon, detail]) => <button key={value} aria-label={label} aria-pressed={mode === value} disabled={busy} onClick={() => changeMode(value)}><CostDetailIcon kind={icon} /><strong>{label}</strong><small>{detail}</small></button>)}</div>
          {mode !== 'keep' && <><p>These values are recalculated for {data?.year}, including that year’s age. Saved extras remain separate and are counted once.</p>
            <div className={styles.actions}><button disabled={busy} onClick={() => { setReplacementSelection(eligible.map(a => a.id)); setReplacement({}); }}>All eligible assets</button><button disabled={busy} onClick={() => { setReplacementSelection(selected); setReplacement({}); }}>Use selected assets</button></div>
            {mode === 'percent' ? <label className={styles.field}>Percentage change (use minus for a decrease)<input type="number" step="0.1" value={percent} disabled={busy} onChange={e => { setPercent(e.target.value); setReplacement({}); }} placeholder="e.g. 5 or -5" /></label> : <div className={styles.actions}><button disabled={busy} aria-pressed={!inclusive} onClick={() => { if (inclusive) setPrices(Object.fromEntries(Object.entries(prices).map(([id, p]) => [id, p.trim() && Number.isFinite(Number(p)) ? String(Math.round(Number(p) / 1.15 * 100) / 100) : p]))); setInclusive(false); setReplacement({}); }}>Excl. VAT</button><button disabled={busy} aria-pressed={inclusive} onClick={() => { if (!inclusive) setPrices(Object.fromEntries(Object.entries(prices).map(([id, p]) => [id, p.trim() && Number.isFinite(Number(p)) ? String(Math.round(Number(p) * 1.15 * 100) / 100) : p]))); setInclusive(true); setReplacement({}); }}>Incl. VAT (15%)</button></div>}
            {listTools(eligible)}<div className={styles.cards}>{visible(eligible).map(asset => <div key={asset.id} className={styles.card}><label className={styles.choice}><input type="checkbox" checked={replacementSelection.includes(asset.id)} disabled={busy} onChange={() => { setReplacementSelection(toggle(asset.id, replacementSelection)); setReplacement({}); }} /><span><strong>{asset.title}</strong><small>Current replacement: {money(asset.replacementPrice)} excl. VAT</small></span></label><p>{asset.extrasNote}</p>
              {mode === 'edit' && replacementSelection.includes(asset.id) && <label>New asset-only replacement price ({inclusive ? 'incl.' : 'excl.'} VAT)<input type="number" min="0.01" step="0.01" value={prices[asset.id] || ''} disabled={busy} onChange={e => { setPrices({ ...prices, [asset.id]: e.target.value }); setReplacement({}); }} /></label>}</div>)}</div>
            <button disabled={busy || !replacements.length} onClick={() => calculate('replacement', true)}>Preview replacement changes / retry failed</button>
            {Object.keys(replacement).length > 0 && results(visible(eligible).filter(a => replacementSelection.includes(a.id)), replacement, false)}</>}
          </>}
        {step === 3 && <><h3><CostDetailIcon kind="document" /> Your review preview</h3><div className={styles.summary}><span><b>0</b> assets saved</span><span><b>{changed.length}</b> proposed value changes</span><span><b>{successful.length - changed.length}</b> calculated values unchanged</span><span><b>{failed.length}</b> failed calculations</span></div>
          <p>{(data?.assets.length || 0) - finalResults.size} assets were excluded, skipped or not selected. No history entries or Saleability flags have been written.</p>
          {saleability.length > 0 && <div className={styles.card}><strong>Saleability would need review for {saleability.length} {saleability.length === 1 ? 'asset' : 'assets'}</strong><p>After a future confirmed update, use Recalculate on the affected assessment. This preview does not change assessments.</p><ul>{saleability.map(row => <li key={row.id}>{data?.assets.find(asset => asset.id === row.id)?.title}</li>)}</ul></div>}
          {failed.length > 0 && <div className={styles.card}><strong>Some calculations need attention</strong><p>Go back to the relevant stage and retry failed calculations. Successful previews will be retained.</p>{failed.map(result => <p key={result.id}>{data?.assets.find(asset => asset.id === result.id)?.title}: {result.error}</p>)}</div>}
          <p>Saving, background updates and annual reminders remain disabled until the preview and separate test-database saving process are approved.</p><div className={styles.wish}><CostDetailIcon kind="calendar" /><p>Wishing you a successful year ahead.<small>The Aim4price team</small></p></div></>}
        {busy && <p role="status" aria-live="polite">{progress || 'Loading preview…'}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
      <footer className={`${chrome.footer} ${styles.footer}`}><button className={styles.closeAction} onClick={close}>Close</button>{step > 0 && <button disabled={busy} onClick={() => { setError(''); setStep(step - 1); }}>Back</button>}
        {step === 0 && <button disabled={busy} onClick={() => setStep(1)}>Next</button>}
        {step === 1 && <><button disabled={busy} onClick={() => { setIncludeDepreciation(false); setStep(2); }}>Skip for now</button><button disabled={busy || !ageComplete} onClick={() => { setIncludeDepreciation(true); setStep(2); }}>Include in preview</button></>}
        {step === 2 && <button disabled={busy || !replacementComplete} onClick={() => { setError(''); setStep(3); }}>Review summary</button>}
        {step === 3 && <a href="/asset-register">Go to Asset Register</a>}
      </footer>
    </dialog>
  </div>;
}
