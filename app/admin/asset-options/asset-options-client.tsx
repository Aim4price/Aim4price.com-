'use client';
import { useRef, useState } from 'react';
import AdminNavigation from '../../../components/AdminNavigation';
import AdminSelect from '../../../components/AdminSelect';
import { SECTOR_LABELS } from '../../../lib/equipment-types';
import type { AssetOption } from '../../../lib/asset-options';
import { assetOptionsCsv, planAssetOptionsCsv } from '../../../lib/asset-options-csv';
import csvStyles from './import.module.css';
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
  const fileInput = useRef<HTMLInputElement>(null);
  const [review,setReview] = useState<{csv:string; changes:ReturnType<typeof planAssetOptionsCsv>} | null>(null);
  const locked = busy || Boolean(review);
  function exportCsv() {
    const url = URL.createObjectURL(new Blob([assetOptionsCsv(options)], {type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Aim4price-asset-options.csv';
    link.click();
    setMessage('CSV exported. Keep existing IDs and versions. Leave both blank for new families.');
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function readFile(file: File) {
    setBusy(true);
    setMessage('');
    try {
      if (file.size > 2000000) throw new Error('Choose a CSV smaller than 2 MB.');
      const csv = await file.text();
      const changes = planAssetOptionsCsv(csv, options);
      if (changes.length) setReview({csv,changes});
      else setMessage('The CSV matches the catalogue. No changes to apply.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not read this CSV.'); }
    finally { setBusy(false); }
  }
  async function applyImport() {
    if (!review) return;
    setBusy(true);
    try {
      const response = await fetch('/api/admin/asset-options', {method:'PUT',headers:{'Content-Type':'text/csv'},body:review.csv});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const updated: AssetOption[] = data.options;
      setOptions(updated);
      const selected = updated.find(option => option.id === draft.id) ?? updated[0] ?? empty;
      setDraft(selected);
      setArchived(selected.archived);
      setReview(null);
      setMessage(`Imported ${data.count} family changes.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not apply the import.'); }
    finally { setBusy(false); }
  }
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
        <button disabled={locked || dirty} onClick={exportCsv}>Export CSV</button>
        <button disabled={locked || dirty} onClick={() => fileInput.current?.click()}>Import CSV</button>
        <input ref={fileInput} hidden type="file" accept=".csv,text/csv" aria-label="Import asset options CSV" onChange={e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void readFile(file);
        }} />
        <button disabled={locked} onClick={() => choose(empty)}>Add family</button>
        <button className={styles.saveButton} disabled={locked || !dirty || !draft.label.trim()} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
      {review && <section className={styles.panel} aria-label="Review CSV import">
        <h2>Review CSV import</h2>
        <p>{review.changes.length} family changes · Only the listed rows will be applied.</p>
        <div className={csvStyles.review} tabIndex={0} aria-label="Proposed family changes"><table>
          <thead><tr>{['Row','Change','Family name','Sector','Estimate type','Status'].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
          <tbody>{review.changes.map(({row,option}) => <tr key={row}><td>{row}</td><td>{option.id ? 'Update' : 'Add'}</td>
            <td>{option.label}</td><td>{SECTOR_LABELS[option.sector]}</td><td>{modes[option.mode]}</td><td>{option.archived ? 'Archived' : 'Active'}</td></tr>)}</tbody>
        </table></div>
        <div className={styles.filters}><button disabled={busy} onClick={() => {setReview(null); setMessage('');}}>Cancel</button>
          <button className={styles.saveButton} disabled={busy} onClick={applyImport}>{busy ? 'Importing…' : 'Apply changes'}</button></div>
      </section>}
      <div className={styles.layout}><section className={styles.panel}><h2>Asset families</h2>
        <input type="search" aria-label="Search asset families" placeholder="Search family, sector or estimate type" value={search} onChange={e => setSearch(e.target.value)} />
        <div className={styles.filters}>{[false,true].map(value => <button key={String(value)} aria-pressed={value===archived} onClick={() => setArchived(value)}>{value ? 'Archived' : 'Active'}</button>)}</div>
        <div className={styles.list}>{visible.map(option => <button key={option.id} disabled={locked} aria-pressed={draft.id===option.id} onClick={() => choose(option)}>
          <strong>{option.label}</strong><small>{SECTOR_LABELS[option.sector]} · {modes[option.mode]}</small></button>)}
          {!visible.length && <p>No matching families.</p>}</div>
      </section><section className={styles.panel}><h2>{draft.id ? original.label : 'New asset family'}</h2>
        <label>Family name<input disabled={locked} maxLength={120} value={draft.label} onChange={e => setDraft({...draft,label:e.target.value})} /></label>
        <label>Sector<AdminSelect disabled={locked} value={draft.sector} onChange={e => setDraft({...draft,sector:e.target.value as AssetOption['sector']})}>
          {Object.entries(SECTOR_LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</AdminSelect></label>
        <label>Estimate type<AdminSelect disabled={locked || draft.id.startsWith('basic/')} value={draft.mode} onChange={e => setDraft({...draft,mode:e.target.value as AssetOption['mode']})}>
          {Object.entries(modes).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</AdminSelect></label>
        {draft.id && <><p>{draft.archived ? 'Archived families are hidden in Get Value.' : 'Archive this family to hide it from new estimates.'}</p>
          <button disabled={locked} onClick={() => setDraft({...draft,archived:!draft.archived})}>{draft.archived ? 'Restore family' : 'Archive family'}</button></>}
      </section></div>
    </div></section></main>;
}
