'use client';
import { useEffect, useId, useState } from 'react';
import ModalSelect from './AssetModalSelect';
import LeadActionDialog from './leads/LeadActionDialog';
import type { PartsData } from '../lib/asset-parts';
import styles from './AssetPartsModal.module.css';

export default function AssetPartsModal({ endpoint, assetTitle, assetSubtitle, onClose, initialAdd = false }: {
  endpoint: string; assetTitle: string; assetSubtitle?: string; onClose: () => void; initialAdd?: boolean;
}) {
  const [data, setData] = useState<PartsData | null>(null);
  const [adding, setAdding] = useState(initialAdd);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [draft, setDraft] = useState({ itemKey: '', name: '', partNumber: '', brand: '', maintenanceId: '', notes: '' });
  const id = useId();
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
      setRequestId(crypto.randomUUID()); setNotice('Part saved to this asset.'); setAdding(false); setPage(0);
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save the part.'); }
    finally { setBusy(false); }
  }
  const parts = (data?.parts || []).filter(part => `${part.name} ${part.partNumber} ${part.brand} ${part.itemLabel}`.toLowerCase().includes(search.toLowerCase()));
  return <LeadActionDialog title="Parts" assetTitle={assetTitle} assetSubtitle={assetSubtitle} onClose={onClose} busy={busy} className={styles.modal} closeLabel="Back to maintenance">
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {!data ? <p>{error ? 'Close and reopen Parts to try again.' : 'Loading parts…'}</p> : <>
      <div className={styles.intro}><p>Keep part numbers with the maintenance items for this asset.<br/><small>{data.family} · Confirm the correct part for this model and serial / VIN.</small></p>
        {data.canAdd && !adding && <button type="button" className={styles.primary} onClick={() => { setAdding(true); setError(''); }}>Add part</button>}
      </div>
      {adding && data.canAdd ? <form onSubmit={save} className={styles.form}>
        <fieldset disabled={busy} className={styles.fields}>
          <div className={styles.selectField}><ModalSelect label="Maintenance item" value={draft.itemKey} placeholder="Choose an item" options={[...data.suggestions.map(item => ({value:item.id,label:item.label})),{value:'other',label:'Other part'}]} onChange={value => setDraft(current => ({...current,itemKey:value,name:data.suggestions.find(item => item.id === value)?.label || ''}))}/></div>
          <label>Part description<input required maxLength={160} value={draft.name} disabled={busy} onChange={event => update('name', event.target.value)} placeholder="e.g. Primary fuel filter"/></label>
          <label>Part number<input required maxLength={120} value={draft.partNumber} disabled={busy} onChange={event => update('partNumber', event.target.value)} placeholder="Number printed on the part or packaging"/></label>
          <label><span>Brand <small>(optional)</small></span><input maxLength={120} value={draft.brand} disabled={busy} onChange={event => update('brand', event.target.value)} placeholder="Part manufacturer"/></label>
          {data.maintenance.length > 0 && <div className={`${styles.selectField} ${styles.full}`}><ModalSelect label="Link to maintenance (optional)" value={draft.maintenanceId} placeholder="Save for future reference" options={[{value:'',label:'Save for future reference'},...data.maintenance.map(record => ({value:record.id,label:`${record.title} · ${record.status}`}))]} onChange={value => update('maintenanceId', value)}/></div>}
          <label className={styles.full}><span>Notes <small>(optional)</small></span><textarea maxLength={2000} rows={2} value={draft.notes} disabled={busy} onChange={event => update('notes', event.target.value)} placeholder="Position, alternative number or fitting notes"/></label>
        </fieldset>
        <p className={styles.hint}>Saving a part does not complete maintenance or add a cost.</p>
        <div className={styles.actions}><button type="button" disabled={busy} onClick={() => data.canView ? setAdding(false) : onClose()}>Cancel</button><button type="submit" className={styles.primary} disabled={busy}>{busy ? 'Saving…' : 'Save part'}</button></div>
      </form> : data.canView && <>
        <label className={styles.search} htmlFor={id}>Find a part<input id={id} type="search" value={search} placeholder="Search description, number or brand" onChange={event => { setSearch(event.target.value); setPage(0); }}/></label>
        {parts.length ? <div className={styles.list}>{parts.slice(page * 6, (page + 1) * 6).map(part => <article className={styles.part} key={part.id}>
          <div><small>{part.itemLabel}</small><h3>{part.name}</h3><strong className={styles.number}>{part.partNumber}</strong>{part.brand && <span> · {part.brand}</span>}</div>
          {part.notes && <p>{part.notes}</p>}
          {part.maintenanceId && <p className={styles.hint}>Linked to {data.maintenance.find(record => record.id === part.maintenanceId)?.title || 'maintenance'}</p>}
          <small>Added by {part.addedBy} · {new Date(part.createdAt).toLocaleDateString('en-ZA')}</small>
        </article>)}</div> : <p className={styles.empty}>{search ? 'No matching parts.' : 'No parts saved yet. Add the first part number for this asset.'}</p>}
        {parts.length > 6 && <div className={styles.actions}><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} of {Math.ceil(parts.length / 6)}</span><button type="button" disabled={(page + 1) * 6 >= parts.length} onClick={() => setPage(page + 1)}>Next</button></div>}
        <div className={styles.actions}><button type="button" onClick={onClose}>Back</button></div>
      </>}
    </>}
  </LeadActionDialog>;
}
