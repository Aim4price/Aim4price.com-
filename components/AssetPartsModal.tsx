'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useLeadDialog } from './leads/useLeadDialog';
import maintenanceStyles from './MaintenanceDialog.module.css';
import checklistStyles from './MaintenanceChecklistBrowser.module.css';
import type { PartsData } from '../lib/asset-parts';
import styles from './AssetPartsModal.module.css';

export default function AssetPartsModal({ endpoint, assetTitle, assetSubtitle, onClose, initialAdd = false }: {
  endpoint: string; assetTitle: string; assetSubtitle?: string; onClose: () => void; initialAdd?: boolean;
}) {
  const [data, setData] = useState<PartsData | null>(null);
  const [adding, setAdding] = useState(initialAdd);
  const [step, setStep] = useState(0);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (adding) stepHeading.current?.focus(); }, [step, adding, data]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [draft, setDraft] = useState({ itemKey: '', name: '', partNumber: '', brand: '', maintenanceId: '', notes: '' });
  const id = useId();
  const dialogRef = useLeadDialog(onClose, busy);
  useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; }; }, []);
  async function load(signal?: AbortSignal) {
    const response = await fetch(endpoint, { cache: 'no-store', signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load parts.');
    setData(result); if (!result.canView && result.canAdd) setAdding(true);
  }
  useEffect(() => { const controller = new AbortController(); load(controller.signal).catch(error => { if (!controller.signal.aborted) setError(error.message); }); return () => controller.abort(); }, [endpoint]);
  function update(key: keyof typeof draft, value: string) { setDraft(current => ({ ...current, [key]: value })); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, requestId }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save the part.');
      setDraft({ itemKey: '', name: '', partNumber: '', brand: '', maintenanceId: '', notes: '' });
      setRequestId(crypto.randomUUID()); setNotice('Part saved to this asset.'); setAdding(false); setStep(0); setPage(0);
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save the part.'); }
    finally { setBusy(false); }
  }
  const parts = (data?.parts || []).filter(part => `${part.name} ${part.partNumber} ${part.brand} ${part.itemLabel}`.toLowerCase().includes(search.toLowerCase()));
  const steps = ['Choose an item', 'Part details', 'Review and save'];
  const cancel = () => { setError(''); data?.canView ? setAdding(false) : onClose(); };
  const footer = data && <footer className={checklistStyles.footer}>
    {adding && data.canAdd ? <>
      <button type="button" disabled={busy} onClick={() => step ? setStep(step - 1) : cancel()}>Back</button>
      <button type="button" disabled={busy} onClick={cancel}>Cancel</button>
      <button type="submit" form={`${id}-form`} data-primary-action disabled={busy || (step === 0 && (!draft.itemKey || (draft.itemKey === 'other' && !draft.name.trim())))}>{busy ? 'Saving…' : step === 2 ? 'Save part' : 'Next'}</button>
    </> : <button type="button" onClick={onClose}>Back</button>}
  </footer>;
  return <div className={`${checklistStyles.overlay} ${styles.overlay}`} data-website-overlay onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className={`${checklistStyles.dialog} ${maintenanceStyles.dialog} ${styles.modal}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-context`}>
      <header className={checklistStyles.header}><div><h2 id={`${id}-title`}>{assetTitle}</h2>{assetSubtitle && <p>{assetSubtitle}</p>}</div><button type="button" className={maintenanceStyles.close} onClick={onClose} disabled={busy} aria-label="Back to maintenance">×</button></header>
      <div className={`${maintenanceStyles.body} ${styles.body}`}>

    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {!data ? <p>{error ? 'Close and reopen Parts to try again.' : 'Loading parts…'}</p> : <>
      {adding && data.canAdd ? <form id={`${id}-form`} onSubmit={event => { if (step < 2) { event.preventDefault(); setError(''); setStep(step + 1); } else void save(event); }} className={styles.form}>
        <div className={checklistStyles.sectionHeading}><h3 id={`${id}-context`} ref={stepHeading} tabIndex={-1} className={styles.stepTitle}>Parts · {steps[step]}</h3><small className={styles.hint}>Step {step + 1} of 3</small></div>
        <fieldset disabled={busy} className={`${styles.fields} ${step === 1 ? checklistStyles.editor : ''}`}>
          {step === 0 && <>
            <div className={`${checklistStyles.sectionHeading} ${styles.full}`}><span className={styles.hint}>{draft.itemKey ? '1 selected' : 'Choose an item'} · {data.family}</span><button type="button" className={checklistStyles.addButton} disabled={draft.itemKey === 'other'} onClick={() => setDraft(current => ({ ...current, itemKey: 'other', name: '' }))}>+ Add item</button></div>
            {draft.itemKey === 'other' && <div className={`${checklistStyles.editor} ${styles.full}`}><h3>Add item</h3><label>Part description<input autoFocus required maxLength={160} value={draft.name} onChange={event => update('name', event.target.value)} placeholder="e.g. Hydraulic hose"/></label><div className={checklistStyles.editorActions}><button type="button" onClick={() => setDraft(current => ({ ...current, itemKey: '', name: '' }))}>Cancel</button><button type="button" className={checklistStyles.primary} disabled={!draft.name.trim()} onClick={() => setStep(1)}>Continue</button></div></div>}
            {data.suggestions.map(item => <button type="button" key={item.id} className={styles.choice} aria-pressed={draft.itemKey === item.id} onClick={() => setDraft(current => ({ ...current, itemKey: item.id, name: current.itemKey === item.id ? current.name : item.label }))}><span className={styles.tick} aria-hidden="true">{draft.itemKey === item.id ? '✓' : ''}</span>{item.label}</button>)}
          </>}
          {step === 1 && <>
            <p className={styles.full}>Selected item: <strong>{data.suggestions.find(item => item.id === draft.itemKey)?.label || 'Other part'}</strong></p>
            <label>Part description<input required maxLength={160} value={draft.name} onChange={event => update('name', event.target.value)} placeholder="e.g. Primary fuel filter"/></label>
            <label>Part number<input required maxLength={120} value={draft.partNumber} onChange={event => update('partNumber', event.target.value)} placeholder="Number printed on the part or packaging"/></label>
            <label className={styles.full}><span>Brand <small>(optional)</small></span><input maxLength={120} value={draft.brand} onChange={event => update('brand', event.target.value)} placeholder="Part manufacturer"/></label>
            <label className={styles.full}><span>Notes <small>(optional)</small></span><textarea maxLength={2000} rows={2} value={draft.notes} onChange={event => update('notes', event.target.value)} placeholder="Position, alternative number or fitting notes"/></label>
          </>}
          {step === 2 && <>
            <div className={`${styles.part} ${styles.full}`}><small>{data.suggestions.find(item => item.id === draft.itemKey)?.label || 'Other part'}</small><h3>{draft.name}</h3><strong className={styles.number}>{draft.partNumber}</strong>{draft.brand && <p>{draft.brand}</p>}{draft.notes && <p>{draft.notes}</p>}</div>
            {data.maintenance.length > 0 && <>
              <p className={styles.full}><strong>Link to maintenance</strong> <small>(optional)</small></p>
              <button type="button" className={`${styles.choice} ${styles.full}`} aria-pressed={!draft.maintenanceId} onClick={() => update('maintenanceId', '')}><span className={styles.tick} aria-hidden="true">{!draft.maintenanceId ? '✓' : ''}</span>Save for future reference</button>
              {data.maintenance.map(record => <button type="button" key={record.id} className={styles.choice} aria-pressed={draft.maintenanceId === record.id} onClick={() => update('maintenanceId', record.id)}><span className={styles.tick} aria-hidden="true">{draft.maintenanceId === record.id ? '✓' : ''}</span><span>{record.title}<small className={styles.recordStatus}>{record.status}</small></span></button>)}
            </>}
            <p className={`${styles.hint} ${styles.full}`}>Confirm the number matches this asset’s model and serial / VIN. Saving a part does not complete maintenance or add a cost.</p>
          </>}
        </fieldset>
      </form> : data.canView && <>
        <div className={checklistStyles.sectionHeading}><h3 id={`${id}-context`} className={styles.stepTitle}>Parts</h3>{data.canAdd && <button type="button" className={checklistStyles.addButton} onClick={() => { setAdding(true); setStep(0); setError(''); setNotice(''); }}>+ Add part</button>}</div>
        <label className={styles.search} htmlFor={id}>Find a part<input id={id} type="search" value={search} placeholder="Search description, number or brand" onChange={event => { setSearch(event.target.value); setPage(0); }}/></label>
        {parts.length ? <div className={styles.list}>{parts.slice(page * 6, (page + 1) * 6).map(part => <article className={styles.part} key={part.id}>
          <div><small>{part.itemLabel}</small><h3>{part.name}</h3><strong className={styles.number}>{part.partNumber}</strong>{part.brand && <span> · {part.brand}</span>}</div>
          {part.notes && <p>{part.notes}</p>}
          {part.maintenanceId && <p className={styles.hint}>Linked to {data.maintenance.find(record => record.id === part.maintenanceId)?.title || 'maintenance'}</p>}
          <small>Added by {part.addedBy} · {new Date(part.createdAt).toLocaleDateString('en-ZA')}</small>
        </article>)}</div> : <p className={styles.empty}>{search ? 'No matching parts.' : 'No parts saved yet. Add the first part number for this asset.'}</p>}
        {parts.length > 6 && <div className={styles.actions}><button type="button" className={checklistStyles.addButton} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} of {Math.ceil(parts.length / 6)}</span><button type="button" className={checklistStyles.addButton} disabled={(page + 1) * 6 >= parts.length} onClick={() => setPage(page + 1)}>Next</button></div>}
      </>}
    </>}
      </div>
      {footer}
    </section>
  </div>;
}
