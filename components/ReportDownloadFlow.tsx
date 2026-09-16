'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { FilterQuestion } from './FilterFlow';
import report from './ReportDownload.module.css';
import styles from './ReportDownloadFlow.module.css';

export type ReportSelection = { assetId: string; year: string; month: string; format: 'pdf' | 'xlsx'; fields: Record<string, string> };
type Choice = { value: string; label: string };
type Props = {
  title: string; allLabel: string;
  assets: Array<{ id: string; title: string; serialNumber?: string; meta?: string }>;
  years?: string[]; budgetPeriods?: boolean; lockedAssetId?: string;
  fields?: Array<{ key: string; label: string; initial: string; options: Choice[]; allAssetsOnly?: boolean }>;
  scopes?: Array<{ label: string; description: string; field: string; value: string }>;
  onClose: () => void; onDownload: (selection: ReportSelection) => void | Promise<void>;
};

function ScopeIcon({ kind = 'all' }: { kind?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    {kind === 'asset' ? <><circle cx="12" cy="7" r="4" fill="currentColor" stroke="none" /><path d="M4 22v-3a8 8 0 0 1 16 0v3" fill="currentColor" stroke="none" /></>
      : kind === 'upcoming' ? <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 2v6M17 2v6M3 10h18M12 13v4l3 2" /></>
      : kind === 'done' ? <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="m7 12 3 3 7-7" stroke="white" strokeWidth="2.2" /></>
      : <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V3H3v13h5M12 13h5M12 17h5" /></>}
  </svg>;
}

export default function ReportDownloadFlow({ title, allLabel, assets, years = [], budgetPeriods = false, lockedAssetId, fields = [], scopes = [], onClose, onDownload }: Props) {
  const [step, setStep] = useState<'scope' | 'asset' | 'timeline' | 'format'>(lockedAssetId ? 'timeline' : 'scope');
  const [selection, setSelection] = useState<ReportSelection>({ assetId: lockedAssetId || 'all', year: 'all', month: 'all', format: 'pdf', fields: Object.fromEntries(fields.map(field => [field.key, field.initial])) });
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const closing = useRef(onClose); closing.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    heading.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => { heading.current?.focus(); setError(''); }, [step]);
  const currentYear = new Date().getFullYear();
  const availableYears = [...new Set([...years, ...Array.from({ length: currentYear - 2000 + 3 }, (_, index) => String(2000 + index))])].filter(value => /^\d{4}$/.test(value)).sort((a,b) => Number(b)-Number(a));
  const selectedAsset = assets.find(asset => asset.id === selection.assetId);
  const periodLabel = budgetPeriods ? 'Current budget periods' : selection.year === 'all' ? 'All dates' : `${selection.month === 'all' ? '' : new Date(2000, Number(selection.month)-1).toLocaleString('en-ZA',{month:'long'})+' '}${selection.year}`;
  async function submit(format: 'pdf' | 'xlsx') {
    setBusy(true); setError('');
    try { await onDownload({ ...selection, format }); closing.current(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to download this report. Please try again.'); }
    finally { setBusy(false); }
  }
  function back() { setStep(step === 'format' ? 'timeline' : step === 'timeline' && selection.assetId !== 'all' && !lockedAssetId ? 'asset' : 'scope'); }
  return <div className={`${styles.overlay} ${report.backdrop}`} data-website-overlay>
    <div ref={dialog} className={`${styles.surface} ${report.dialog}`} data-download-dialog="true" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busy) onClose(); }
      if (event.key !== 'Tab') return;
      const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]') || []).filter(item => item.getClientRects().length);
      const first=items[0], last=items[items.length-1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <header data-download-header="true"><div><h2 id={titleId} ref={heading} tabIndex={-1}>{step === 'scope' ? title : step === 'asset' ? 'Choose an asset' : step === 'timeline' ? 'Choose report timeline' : 'Download report'}</h2><p>{step === 'scope' ? 'Choose the records to include.' : step === 'asset' ? 'Search by asset or serial number.' : `${selectedAsset?.title || allLabel} · ${periodLabel}`}</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="Close download"><span aria-hidden="true">×</span></button></header>
      <div className={styles.body} data-download-body="true">
        {step === 'scope' ? <div data-download-grid="true">
          <button type="button" data-download-option="true" onClick={() => { setSelection(s=>({...s,assetId:'all',fields:Object.fromEntries(fields.map(field=>[field.key,field.initial]))})); setStep('timeline'); }}><span data-download-icon="true"><ScopeIcon /></span><span data-download-copy="true"><strong>{allLabel}</strong><small>All records in your chosen period.</small></span></button>
          <button type="button" data-download-option="true" onClick={() => setStep('asset')}><span data-download-icon="true"><ScopeIcon kind="asset" /></span><span data-download-copy="true"><strong>Specific asset</strong><small>One asset’s records.</small></span></button>
          {scopes.map(scope => <button type="button" key={scope.value} data-download-option="true" onClick={() => {setSelection(s=>({...s,assetId:'all',fields:{...s.fields,[scope.field]:scope.value}}));setStep('timeline');}}><span data-download-icon="true"><ScopeIcon kind={scope.value} /></span><span data-download-copy="true"><strong>{scope.label}</strong><small>{scope.description}</small></span></button>)}
        </div> : step === 'asset' ? <>
          <input className={styles.search} aria-label="Search report assets" placeholder="Search assets or serial numbers…" value={search} onChange={event=>setSearch(event.target.value)} />
          <div className={styles.assets}>{assets.filter(asset=>`${asset.title} ${asset.serialNumber || ''}`.toLowerCase().includes(search.trim().toLowerCase())).map(asset=><button type="button" key={asset.id} className={styles.asset} onClick={()=>{setSelection(s=>({...s,assetId:asset.id}));setStep('timeline');}}><span><strong>{asset.title}</strong>{asset.meta ? <small>{asset.meta}</small> : null}<small>Serial number: {asset.serialNumber || 'Not provided'}</small></span><span>Select ›</span></button>)}{!assets.some(asset=>`${asset.title} ${asset.serialNumber || ''}`.toLowerCase().includes(search.trim().toLowerCase())) ? <p>No matching assets.</p> : null}</div>
        </> : step === 'timeline' ? <div className={styles.fields}>
          {budgetPeriods ? <p>Budgets show the current month and year. Historical budget snapshots are not available.</p> : <>
            <FilterQuestion label="Year" value={selection.year} options={[{value:'all',label:'All years'},...availableYears.map(year=>({value:year,label:year}))]} onChange={year=>setSelection(s=>({...s,year,month:'all'}))} />
            <FilterQuestion label="Month" value={selection.month} disabled={selection.year === 'all'} options={[{value:'all',label:'All months'},...Array.from({length:12},(_,i)=>({value:String(i+1),label:new Date(2000,i).toLocaleString('en-ZA',{month:'long'})}))]} onChange={month=>setSelection(s=>({...s,month}))} />
          </>}
          {fields.filter(field=>!field.allAssetsOnly || selection.assetId === 'all').map(field=><FilterQuestion key={field.key} label={field.label} value={selection.fields[field.key]} options={field.options} onChange={value=>setSelection(s=>({...s,fields:{...s.fields,[field.key]:value}}))} />)}
        </div> : <>
          <div className={styles.summary}>{fields.filter(field=>!field.allAssetsOnly || selection.assetId === 'all').map(field=><p key={field.key}><strong>{field.label}:</strong> {field.options.find(option=>option.value===selection.fields[field.key])?.label}</p>)}</div>
          <div data-download-grid="true">{(['pdf','xlsx'] as const).map(format=><button key={format} type="button" disabled={busy} data-download-option="true" onClick={()=>void submit(format)}><span data-download-icon="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M14 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8zM14 2v6h6" />{format === 'pdf' ? <text x="12" y="17" textAnchor="middle" fill="currentColor" stroke="none" fontSize="6" fontWeight="700">PDF</text> : <><path d="M7 12h10v7H7zM7 15.5h10M12 12v7" /></>}</svg></span><span data-download-copy="true"><strong>{format === 'pdf' ? 'PDF report' : 'Excel workbook'}</strong><small>{format === 'pdf' ? 'Open a printable report.' : 'Download the selected records.'}</small></span></button>)}</div>
        </>}
        {busy ? <p role="status">Preparing report…</p> : null}{error ? <p role="alert" className={styles.error}>{error}</p> : null}
      </div>
      <footer data-download-footer="true">{step !== 'scope' && !(lockedAssetId && step === 'timeline') ? <button type="button" disabled={busy} onClick={back}>Back</button> : null}<button type="button" disabled={busy} onClick={onClose}>Cancel</button>{step === 'timeline' ? <button type="button" data-download-primary="true" onClick={()=>setStep('format')}>Next</button> : null}</footer>
    </div>
  </div>;
}
