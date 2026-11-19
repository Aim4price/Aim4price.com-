'use client';
import { useState } from 'react';
import AdminNavigation from '../../../components/AdminNavigation';
import AdminSelect from '../../../components/AdminSelect';
import { SECTOR_LABELS } from '../../../lib/equipment-types';
import type { AssetOption } from '../../../lib/asset-options';
import shell from '../page.module.css';
import styles from '../maintenance-catalogue/page.module.css';

const empty: AssetOption = { id:'', label:'', sector:'agricultural', mode:'basic', archived:false, version:0 };
const modes = { basic:'Basic', advanced:'Advanced', both:'Basic and Advanced' };
export default function AssetOptions({initial}: {initial: AssetOption[]}) {
  const [options,setOptions] = useState(initial);
  const [draft,setDraft] = useState(initial.find(option => !option.archived) ?? empty);
  const [search,setSearch] = useState('');
  const [archived,setArchived] = useState(false);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const original = options.find(option => option.id === draft.id) ?? empty;
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const visible = options.filter(option => option.archived === archived &&
    [option.label,option.sector,modes[option.mode]].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  function choose(option: AssetOption) {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setDraft(option);
    setMessage('');
  }
  async function save() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/asset-options', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const saved: AssetOption = data.option;
      setOptions(current => [...current.filter(option => option.id !== saved.id), saved].sort((a,b) => a.label.localeCompare(b.label)));
      setDraft(saved);
      setArchived(saved.archived);
      setSearch('');
      setMessage('Asset option saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save changes.'); }
    finally { setBusy(false); }
  }
  return <main className={shell.page}><section className={shell.shell}>
    <header className={shell.topBar}><div className={shell.titleBlock}><h1>Asset options</h1>
      <p>Manage the asset families available in Get Value.</p></div><AdminNavigation active="asset-options" /></header>
    <div className={styles.page}>
      <div className={styles.toolbar}><p role="status">{message || (dirty ? 'Unsaved changes' : `${options.filter(row => !row.archived).length} active families`)}</p>
        <button disabled={busy} onClick={() => choose(empty)}>Add family</button>
        <button className={styles.saveButton} disabled={busy || !dirty || !draft.label.trim()} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
      <div className={styles.layout}><section className={styles.panel}><h2>Asset families</h2>
        <input type="search" aria-label="Search asset families" placeholder="Search family, sector or estimate type" value={search} onChange={e => setSearch(e.target.value)} />
        <div className={styles.filters}>{[false,true].map(value => <button key={String(value)} aria-pressed={value===archived} onClick={() => setArchived(value)}>{value ? 'Archived' : 'Active'}</button>)}</div>
        <div className={styles.list}>{visible.map(option => <button key={option.id} disabled={busy} aria-pressed={draft.id===option.id} onClick={() => choose(option)}>
          <strong>{option.label}</strong><small>{SECTOR_LABELS[option.sector]} · {modes[option.mode]}</small></button>)}
          {!visible.length && <p>No matching families.</p>}</div>
      </section><section className={styles.panel}><h2>{draft.id ? original.label : 'New asset family'}</h2>
        <label>Family name<input disabled={busy} maxLength={120} value={draft.label} onChange={e => setDraft({...draft,label:e.target.value})} /></label>
        <label>Sector<AdminSelect disabled={busy} value={draft.sector} onChange={e => setDraft({...draft,sector:e.target.value as AssetOption['sector']})}>
          {Object.entries(SECTOR_LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</AdminSelect></label>
        <label>Estimate type<AdminSelect disabled={busy || draft.id.startsWith('basic/')} value={draft.mode} onChange={e => setDraft({...draft,mode:e.target.value as AssetOption['mode']})}>
          {Object.entries(modes).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</AdminSelect></label>
        {draft.id && <><p>{draft.archived ? 'Archived families are hidden in Get Value.' : 'Archive this family to hide it from new estimates.'}</p>
          <button disabled={busy} onClick={() => setDraft({...draft,archived:!draft.archived})}>{draft.archived ? 'Restore family' : 'Archive family'}</button></>}
      </section></div>
    </div></section></main>;
}
