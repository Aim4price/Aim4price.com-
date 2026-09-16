'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { FilterQuestion } from './FilterFlow';
import report from './ReportDownload.module.css';
import styles from './ReportDownloadFlow.module.css';
import picker from './AssetPicker.module.css';
import AssetSerialNumber from './AssetSerialNumber';

export type ReportSelection = { assetId: string; year: string; month: string; format: 'pdf' | 'xlsx'; fields: Record<string, string> };
type Choice = { value: string; label: string };
type Props = {
  title: string; allLabel: string;
  assets: Array<{ id: string; title: string; serialNumber?: string; meta?: string; selectedMethod?: string; categoryLabel?: string }>;
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
    <div ref={dialog} className={`${styles.surface} ${step === 'asset' ? picker.modal : report.dialog}`} data-download-dialog={step !== 'asset' ? 'true' : undefined} data-asset-choice-modal={step === 'asset' ? 'true' : undefined} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busy) onClose(); }
      if (event.key !== 'Tab') return;
      const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]') || []).filter(item => item.getClientRects().length);
      const first=items[0], last=items[items.length-1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <header data-download-header="true" data-asset-choice-header={step === 'asset' ? 'true' : undefined}><div><h2 id={titleId} ref={heading} tabIndex={-1}>{step === 'scope' ? title : step === 'asset' ? `Choose asset for ${title.replace(/ reports$/i, '').toLowerCase()}` : step === 'timeline' ? 'Choose report timeline' : selectedAsset?.title || title}</h2><p>{step === 'scope' ? 'Choose the records to include.' : step === 'asset' ? 'Choose a saved asset.' : step === 'format' && selectedAsset?.meta ? selectedAsset.meta : `${selectedAsset?.title || allLabel} · ${periodLabel}`}</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="Close download"><span aria-hidden="true">×</span></button></header>
      <div className={step === 'asset' ? picker.contents : styles.body} data-download-body={step !== 'asset' ? 'true' : undefined}>
        {step === 'scope' ? <div data-download-grid="true">
          <button type="button" data-download-option="true" onClick={() => { setSelection(s=>({...s,assetId:'all',fields:Object.fromEntries(fields.map(field=>[field.key,field.initial]))})); setStep('timeline'); }}><span data-download-icon="true"><ScopeIcon /></span><span data-download-copy="true"><strong>{allLabel}</strong><small>All records in your chosen period.</small></span></button>
          <button type="button" data-download-option="true" onClick={() => setStep('asset')}><span data-download-icon="true"><ScopeIcon kind="asset" /></span><span data-download-copy="true"><strong>Specific asset</strong><small>One asset’s records.</small></span></button>
          {scopes.map(scope => <button type="button" key={scope.value} data-download-option="true" onClick={() => {setSelection(s=>({...s,assetId:'all',fields:{...s.fields,[scope.field]:scope.value}}));setStep('timeline');}}><span data-download-icon="true"><ScopeIcon kind={scope.value} /></span><span data-download-copy="true"><strong>{scope.label}</strong><small>{scope.description}</small></span></button>)}
        </div> : step === 'asset' ? <>
          <div data-asset-choice-toolbar="true">
            <input aria-label="Search saved assets" placeholder="Search assets..." value={search} onChange={event=>setSearch(event.target.value)} />
            <button type="button" className={picker.secondary} onClick={()=>setSearch('')}>Clear</button>
          </div>
          <div data-asset-choice-list="true">{assets.filter(asset=>`${asset.title} ${asset.serialNumber || ''}`.toLowerCase().includes(search.trim().toLowerCase())).map(asset=><button type="button" key={asset.id} data-asset-choice-row="true" onClick={()=>{setSelection(s=>({...s,assetId:asset.id}));setStep('timeline');}}>
            <span data-asset-choice-copy="true"><strong>{asset.title}</strong>{asset.meta ? <small data-asset-choice-meta="true">{asset.meta}</small> : null}{asset.selectedMethod ? <small data-asset-choice-secondary="true">{asset.selectedMethod === 'manual' ? 'Manual' : 'Aim4price'}</small> : null}<AssetSerialNumber value={asset.serialNumber} /></span>
            <span data-asset-choice-value="true"><span className={picker.select}><i aria-hidden="true" />Select</span></span>
          </button>)}{!assets.some(asset=>`${asset.title} ${asset.serialNumber || ''}`.toLowerCase().includes(search.trim().toLowerCase())) ? <div className={picker.empty}>No saved assets found.</div> : null}</div>
        </> : step === 'timeline' ? <div className={styles.fields}>
          {budgetPeriods ? <p>Budgets show the current month and year. Historical budget snapshots are not available.</p> : <>
            <FilterQuestion menuClassName={styles.timelineMenu} label="Year" value={selection.year} options={[{value:'all',label:'All years'},...availableYears.map(year=>({value:year,label:year}))]} onChange={year=>setSelection(s=>({...s,year,month:'all'}))} />
            <FilterQuestion menuClassName={styles.timelineMenu} label="Month" disabledHint="Choose a year to select a month." value={selection.month} disabled={selection.year === 'all'} options={[{value:'all',label:'All months'},...Array.from({length:12},(_,i)=>({value:String(i+1),label:new Date(2000,i).toLocaleString('en-ZA',{month:'long'})}))]} onChange={month=>setSelection(s=>({...s,month}))} />
          </>}
          {fields.filter(field=>!field.allAssetsOnly || selection.assetId === 'all').map(field=><FilterQuestion menuClassName={styles.timelineMenu} key={field.key} label={field.label} value={selection.fields[field.key]} options={field.options} onChange={value=>setSelection(s=>({...s,fields:{...s.fields,[field.key]:value}}))} />)}
        </div> : <>
          <div className={styles.formatHeading}><strong>Choose export format</strong><span>Choose PDF or Excel.</span></div>
          <div data-download-grid="true" aria-label="Report format">{(['pdf','xlsx'] as const).map(format=><button key={format} type="button" disabled={busy} data-download-option="true" aria-pressed={selection.format === format} onClick={()=>setSelection(s=>({...s,format}))}><span data-download-icon="true"><img src={format === 'pdf' ? '/brand/pdf.png' : '/brand/sheet.png'} alt="" /></span><span data-download-copy="true"><strong>{format === 'pdf' ? 'PDF report' : 'XLSX workbook'}</strong><small>{format === 'pdf' ? 'Printable asset report.' : 'Selected records in Excel.'}</small></span></button>)}</div>
        </>}
        {busy ? <p role="status">Preparing report…</p> : null}{error ? <p role="alert" className={styles.error}>{error}</p> : null}
      </div>
      <footer data-download-footer="true" data-asset-choice-footer={step === 'asset' ? 'true' : undefined}>{step !== 'scope' && !(lockedAssetId && step === 'timeline') ? <button type="button" disabled={busy} onClick={back}>Back</button> : null}<button type="button" disabled={busy} onClick={onClose}>Cancel</button>{step === 'timeline' || step === 'format' ? <button type="button" disabled={busy} data-download-primary="true" onClick={()=>step === 'format' ? void submit(selection.format) : setStep('format')}>{busy ? 'Preparing…' : 'Next'}</button> : null}</footer>
    </div>
  </div>;
}
