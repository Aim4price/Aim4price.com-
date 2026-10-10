'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useLeadDialog } from './leads/useLeadDialog';
import maintenanceStyles from './MaintenanceDialog.module.css';
import checklistStyles from './MaintenanceChecklistBrowser.module.css';
import type { PartsData } from '../lib/asset-parts';
import styles from './AssetPartsModal.module.css';

type Draft = { requestId: string; itemKey: string; name: string; partNumber: string; brand: string; notes: string };
const newDraft = (itemKey: string, name: string): Draft => ({ requestId: crypto.randomUUID(), itemKey, name, partNumber: '', brand: '', notes: '' });

export default function AssetPartsModal({ endpoint, assetTitle, assetSubtitle, onClose, initialAdd = false }: {
  endpoint: string; assetTitle: string; assetSubtitle?: string; onClose: () => void; initialAdd?: boolean;
}) {
  const [data, setData] = useState<PartsData | null>(null);
  const [adding, setAdding] = useState(initialAdd);
  const [step, setStep] = useState(0);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (adding) stepHeading.current?.focus(); }, [step, adding]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  // Successful request IDs remain stable until the whole batch succeeds.
  const savedRequests = useRef(new Set<string>());
  const [maintenanceId, setMaintenanceId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
  function update(requestId: string, key: 'name' | 'partNumber' | 'brand' | 'notes', value: string) {
    setDrafts(current => current.map(draft => draft.requestId === requestId ? { ...draft, [key]: value } : draft));
  }
  function toggleSuggestion(item: { id: string; label: string }) {
    setDrafts(current => current.some(draft => draft.itemKey === item.id) ? current.filter(draft => draft.itemKey !== item.id) : [...current, newDraft(item.id, item.label)]);
  }
  async function save() {
    if (busy || !drafts.length) return;
    setBusy(true); setError(''); setNotice('');
    try {
      for (const draft of drafts) {
        if (savedRequests.current.has(draft.requestId)) continue;
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, maintenanceId }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not save the part.');
        savedRequests.current.add(draft.requestId);
      }
      setNotice(drafts.length === 1 ? 'Part saved.' : `${drafts.length} parts saved.`);
      setDrafts([]); savedRequests.current.clear(); setMaintenanceId(''); setAdding(false); setStep(0); setPage(0);
      await load();
    } catch (error) {
      const count = savedRequests.current.size;
      setError(`${count ? `${count} saved. Retry to save the remaining parts. ` : ''}${error instanceof Error ? error.message : 'Could not save parts.'}`);
    } finally { setBusy(false); }
  }
  const parts = (data?.parts || []).filter(part => `${part.name} ${part.partNumber} ${part.brand} ${part.itemLabel}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selectedParts = (data?.parts || []).filter(part => selected.has(part.id));
  const allPartsSelected = parts.length > 0 && parts.every(part => selected.has(part.id));
  const allSuggestionsSelected = !!data?.suggestions.length && data.suggestions.every(item => drafts.some(draft => draft.itemKey === item.id));
  async function downloadPdf() {
    if (busy || !selectedParts.length) return;
    setBusy(true); setError('');
    try {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set('format', 'pdf');
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partIds: selectedParts.map(part => part.id) }), cache: 'no-store' });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Could not download the PDF.'); }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = objectUrl; link.download = 'asset-parts.pdf';
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not download the PDF.'); }
    finally { setBusy(false); }
  }
  const steps = ['Choose parts', 'Part details', 'Review'];
  const cancel = () => { setError(''); if (data?.canView) { setAdding(false); if (savedRequests.current.size) void load().catch(error => setError(error.message)); } else onClose(); };
  const hasSaved = savedRequests.current.size > 0;
  const footer = data && <footer className={checklistStyles.footer}>
    {adding && data.canAdd ? <>
      <button type="button" disabled={busy || hasSaved} onClick={() => step ? setStep(step - 1) : cancel()}>Back</button>
      <button type="button" disabled={busy} onClick={cancel}>Cancel</button>
      <button type="submit" form={`${id}-form`} data-primary-action disabled={busy || !drafts.length}>{busy ? 'Saving…' : step === 2 ? (hasSaved ? 'Retry remaining' : drafts.length === 1 ? 'Save part' : 'Save parts') : 'Next'}</button>
    </> : <><button type="button" disabled={busy} onClick={onClose}>Back</button><button type="button" data-primary-action disabled={busy || !selectedParts.length} onClick={downloadPdf}>{busy ? 'Preparing PDF…' : 'Download PDF'}</button></>}
  </footer>;
  return <div className={`${checklistStyles.overlay} ${styles.overlay}`} data-website-overlay onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className={`${checklistStyles.dialog} ${maintenanceStyles.dialog} ${styles.modal}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={data ? `${id}-context` : undefined}>
      <header className={checklistStyles.header}><div><h2 id={`${id}-title`}>{assetTitle}</h2>{assetSubtitle && <p>{assetSubtitle}</p>}</div><button type="button" className={maintenanceStyles.close} onClick={onClose} disabled={busy} aria-label="Back to maintenance">×</button></header>
      <div className={`${maintenanceStyles.body} ${styles.body}`}>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {notice && <p role="status" className={styles.notice}>{notice}</p>}
        {!data ? <p>{error ? 'Close and reopen Parts to try again.' : 'Loading parts…'}</p> : adding && data.canAdd ? <form id={`${id}-form`} onSubmit={event => { event.preventDefault(); if (!drafts.length) return; if (step === 1 && drafts.some(draft => !draft.name.trim() || !draft.partNumber.trim())) { setError('Enter a description and part number for each part.'); return; } if (step < 2) { setError(''); setStep(step + 1); } else void save(); }}>
          <div className={checklistStyles.sectionHeading}><h3 id={`${id}-context`} ref={stepHeading} tabIndex={-1} className={styles.stepTitle}>{steps[step]}</h3><small>{step + 1} / 3</small></div>
          <fieldset disabled={busy || hasSaved} className={styles.fields}>
            {step === 0 && <>
              <div className={`${checklistStyles.sectionHeading} ${styles.full}`}><span className={styles.hint} role="status">{drafts.length} selected</span><div className={styles.toolbar}>
                <button type="button" className={checklistStyles.addButton} disabled={!data.suggestions.length} onClick={() => setDrafts(current => allSuggestionsSelected ? current.filter(draft => !data.suggestions.some(item => item.id === draft.itemKey)) : [...current, ...data.suggestions.filter(item => !current.some(draft => draft.itemKey === item.id)).map(item => newDraft(item.id, item.label))])}>{allSuggestionsSelected ? 'Deselect all' : 'Select all'}</button>
                <button type="button" className={checklistStyles.addButton} onClick={() => setDrafts(current => [...current, newDraft('other', '')])}>+ Add item</button>
              </div></div>
              {data.suggestions.map(item => <button type="button" key={item.id} className={styles.choice} aria-pressed={drafts.some(draft => draft.itemKey === item.id)} onClick={() => toggleSuggestion(item)}><span className={styles.tick} aria-hidden="true">{drafts.some(draft => draft.itemKey === item.id) ? '✓' : ''}</span>{item.label}</button>)}
              {drafts.filter(draft => draft.itemKey === 'other').map(draft => <div key={draft.requestId} className={`${checklistStyles.editor} ${styles.full}`}><label>Part description<input autoFocus required maxLength={160} value={draft.name} onChange={event => update(draft.requestId, 'name', event.target.value)} placeholder="e.g. Hydraulic hose"/></label><button type="button" className={checklistStyles.addButton} onClick={() => setDrafts(current => current.filter(item => item.requestId !== draft.requestId))}>Remove</button></div>)}
            </>}
            {step === 1 && drafts.map(draft => <div key={draft.requestId} className={`${checklistStyles.editor} ${styles.full}`}>
              <h3>{data.suggestions.find(item => item.id === draft.itemKey)?.label || draft.name || 'New part'}</h3>
              <div className={styles.fields}><label>Description<input required maxLength={160} value={draft.name} onChange={event => update(draft.requestId, 'name', event.target.value)}/></label>
              <label>Part number<input required maxLength={120} value={draft.partNumber} onChange={event => update(draft.requestId, 'partNumber', event.target.value)} placeholder="e.g. 001-ABC"/></label>
              <label>Brand <small>(optional)</small><input maxLength={120} value={draft.brand} onChange={event => update(draft.requestId, 'brand', event.target.value)}/></label>
              <label>Notes <small>(optional)</small><textarea maxLength={2000} rows={2} value={draft.notes} onChange={event => update(draft.requestId, 'notes', event.target.value)}/></label></div>
            </div>)}
            {step === 2 && <>
              <div className={`${styles.list} ${styles.full}`}>{drafts.map(draft => <article className={styles.part} key={draft.requestId}><div className={styles.partMain}><h3>{draft.name}</h3><span><strong className={styles.number}>{draft.partNumber}</strong>{draft.brand && ` · ${draft.brand}`}</span></div>{draft.notes && <p>{draft.notes}</p>}</article>)}</div>
              {data.maintenance.length > 0 && <>
                <p className={styles.full}><strong>Link to maintenance</strong> <small>(optional)</small></p>
                <button type="button" className={`${styles.choice} ${styles.full}`} aria-pressed={!maintenanceId} onClick={() => setMaintenanceId('')}><span className={styles.tick} aria-hidden="true">{!maintenanceId ? '✓' : ''}</span>No link</button>
                {data.maintenance.map(record => <button type="button" key={record.id} className={styles.choice} aria-pressed={maintenanceId === record.id} onClick={() => setMaintenanceId(record.id)}><span className={styles.tick} aria-hidden="true">{maintenanceId === record.id ? '✓' : ''}</span><span>{record.title}<small className={styles.recordStatus}>{record.status}</small></span></button>)}
              </>}
              <p className={`${styles.hint} ${styles.full}`}>Check fitment against the model and serial / VIN. Parts do not record costs or completed work.</p>
            </>}
          </fieldset>
        </form> : data.canView && <>
          <div className={checklistStyles.sectionHeading}><h3 id={`${id}-context`} className={styles.stepTitle}>Parts <small>· {data.parts.length}</small></h3>{data.canAdd && <button type="button" className={checklistStyles.addButton} disabled={busy} onClick={() => { setAdding(true); setStep(hasSaved ? 2 : 0); setError(''); setNotice(''); }}>+ Add part</button>}</div>
          <label className={styles.search} htmlFor={id}><span className={styles.srOnly}>Find a part</span><input id={id} type="search" value={search} placeholder="Search parts, numbers or brands" onChange={event => { setSearch(event.target.value); setPage(0); }}/></label>
          <div className={checklistStyles.sectionHeading}><span className={styles.hint} role="status">{selectedParts.length} selected</span><button type="button" className={checklistStyles.addButton} disabled={busy || !parts.length} onClick={() => setSelected(current => { const next = new Set(current); parts.forEach(part => allPartsSelected ? next.delete(part.id) : next.add(part.id)); return next; })}>{allPartsSelected ? 'Deselect all' : 'Select all'}</button></div>
          {parts.length ? <div className={styles.list}>{parts.slice(page * 6, (page + 1) * 6).map(part => <article className={`${styles.part} ${styles.selectable}`} data-selected={selected.has(part.id)} key={part.id}>
            <input type="checkbox" aria-label={`Select ${part.name}, ${part.partNumber}`} checked={selected.has(part.id)} disabled={busy} onChange={() => setSelected(current => { const next = new Set(current); next.has(part.id) ? next.delete(part.id) : next.add(part.id); return next; })}/>
            <div className={styles.partContent}><div className={styles.partMain}><div><h3>{part.name}</h3>{part.itemLabel !== part.name && <small>{part.itemLabel}</small>}</div><span><strong className={styles.number}>{part.partNumber}</strong>{part.brand && <small> · {part.brand}</small>}</span></div>
            {part.notes && <p>{part.notes}</p>}
            {part.maintenanceId && <small>Linked to {data.maintenance.find(record => record.id === part.maintenanceId)?.title || 'maintenance'}</small>}
            <small className={styles.audit}>{part.addedBy} · {new Date(part.createdAt).toLocaleDateString('en-ZA')}</small></div>
          </article>)}</div> : <p className={styles.empty}>{search ? 'No matching parts.' : 'No parts yet.'}</p>}
          {parts.length > 6 && <div className={styles.actions}><button type="button" className={checklistStyles.addButton} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>{page + 1} / {Math.ceil(parts.length / 6)}</span><button type="button" className={checklistStyles.addButton} disabled={(page + 1) * 6 >= parts.length} onClick={() => setPage(page + 1)}>Next</button></div>}
        </>}
      </div>{footer}
    </section>
  </div>;
}
