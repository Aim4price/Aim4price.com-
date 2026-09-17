'use client';

import { useEffect, useRef, useState } from 'react';
import dialogStyles from './MaintenanceDialog.module.css';
import pickerStyles from './AssetPicker.module.css';
import AssetSerialNumber from './AssetSerialNumber';
import { useAssetChecklistItems } from '../lib/use-asset-checklist-items';
import { validateAssetChecklistItem } from '../lib/asset-checklist';
import { useMaintenanceChecklist } from '../lib/use-maintenance-checklist';
import { checklistOptions, type MaintenanceIdentity } from '../lib/maintenance-catalogue';
import styles from './MaintenanceChecklistBrowser.module.css';

type ChecklistAsset = { id: string; title: string; serialNumber?: string; meta?: string; headerMeta?: string; selectedMethod?: string; maintenanceIdentity?: MaintenanceIdentity };

export default function MaintenanceChecklistBrowser({ assets, initialAssetId, onClose, onStartWork }: {
  assets: ChecklistAsset[];
  initialAssetId: string;
  onClose: () => void;
  onStartWork: (assetId: string, timing: 'done' | 'upcoming') => void;
}) {
  const [assetId, setAssetId] = useState(initialAssetId);
  const [choosingAsset, setChoosingAsset] = useState(!assets.some((item) => item.id === initialAssetId));
  const [search, setSearch] = useState('');
  const filteredAssets = assets.filter((item) => `${item.title} ${item.serialNumber ?? ''} ${item.meta ?? ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'checked' | 'serviced' | 'repaired'>('checked');
  const asset = assets.find((item) => item.id === assetId) ?? null;
  const baseChecklist = useMaintenanceChecklist(asset);
  const saved = useAssetChecklistItems(asset?.id);
  const checklist = { ...baseChecklist, customItems: saved.items };
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const options = checklistOptions(checklist, mode).filter(item => mode !== 'repaired' || item.id.startsWith('asset_custom_'));
  const selectedKeys = (['checked', 'serviced', 'repaired'] as const).flatMap(section => checklistOptions(checklist, section).filter(item => (section !== 'repaired' || item.id.startsWith('asset_custom_')) && selected.has(`${section}:${item.id}`)).map(item => `${section}:${item.id}`));
  function toggleItem(key: string) {
    setSelected(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }
  async function saveItem(event: React.FormEvent) {
    event.preventDefault();
    if (!asset || busy) return;
    setError(''); setNotice('');
    try {
      const input = validateAssetChecklistItem({ mode, label, description });
      setBusy('save');
      const response = await fetch(`/api/maintenance/checklist?assetId=${encodeURIComponent(asset.id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      saved.setItems([...saved.items, data.item]);
      setLabel(''); setDescription(''); setEditing(false);
      dialogRef.current?.focus();
      setNotice('Item saved.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save the item.'); }
    finally { setBusy(''); }
  }
  async function removeItem(id: string) {
    if (!asset || busy) return;
    setBusy(id); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/maintenance/checklist?assetId=${encodeURIComponent(asset.id)}&itemId=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      saved.setItems(saved.items.filter(item => item.id !== id));
      dialogRef.current?.focus();
      setNotice('Item removed.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not remove the item.'); }
    finally { setBusy(''); }
  }
  async function downloadPdf() {
    if (!asset || busy || !selectedKeys.length) return;
    setBusy('pdf'); setError('');
    try {
      const params = new URLSearchParams({ assetId: asset.id });
      selectedKeys.forEach(key => params.append('item', key));
      const response = await fetch(`/api/maintenance/checklist/pdf?${params}`, { cache: 'no-store' });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = 'maintenance-checklist.pdf';
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not download the PDF.'); }
    finally { setBusy(''); }
  }
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => { document.body.style.overflow = overflow; if (trigger?.isConnected) trigger.focus(); };
  }, []);
  useEffect(() => { dialogRef.current?.focus(); }, [choosingAsset]);

  return <div className={`${styles.overlay} ${choosingAsset ? pickerStyles.overlay : ''}`} data-website-overlay onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`${styles.dialog} ${choosingAsset ? pickerStyles.modal : dialogStyles.dialog}`} data-asset-choice-surface={choosingAsset ? 'true' : undefined} data-asset-choice-modal={choosingAsset ? 'true' : undefined} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="maintenance-checklists-title" onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]') ?? []).filter((element) => element.getClientRects().length > 0);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <header className={styles.header} data-asset-choice-header={choosingAsset ? 'true' : undefined}><div><h2 id="maintenance-checklists-title">{choosingAsset ? 'Maintenance checklists' : asset?.title}</h2><p>{choosingAsset ? 'Choose an asset.' : asset?.headerMeta || 'No key details saved yet'}</p></div><button type="button" className={dialogStyles.close} onClick={onClose} aria-label="Close maintenance checklists">×</button></header>
      {choosingAsset ? <>
        <div data-asset-choice-toolbar="true">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets..." aria-label="Search assets or serial numbers" />
          <button type="button" className={pickerStyles.secondary} onClick={() => setSearch('')}>Clear</button>
        </div>
        <div data-asset-choice-list="true">
          {filteredAssets.length ? filteredAssets.map((item) => <button type="button" key={item.id} data-asset-choice-row="true" onClick={() => { setAssetId(item.id); setSelected(new Set()); setChoosingAsset(false); }}>
            <span data-asset-choice-copy="true"><strong>{item.title}</strong>
              {item.meta ? <small data-asset-choice-meta="true">{item.meta}</small> : null}
              {item.selectedMethod ? <small data-asset-choice-secondary="true">{item.selectedMethod === 'manual' ? 'Manual' : 'Aim4price'}</small> : null}
              <AssetSerialNumber value={item.serialNumber} />
            </span>
            <span data-asset-choice-value="true"><span className={pickerStyles.select}><i aria-hidden="true" /><strong>Select</strong></span></span>
          </button>) : <div className={pickerStyles.empty}>No matching assets found.</div>}
        </div>
        <footer className={styles.footer} data-asset-choice-footer="true">
          {asset ? <button type="button" onClick={() => setChoosingAsset(false)}>Back</button> : null}
          <button type="button" onClick={onClose}>Cancel</button>
        </footer>
      </> : <>
      <div className={`${styles.body} ${dialogStyles.body}`}>
        {asset ? <>
          <div className={styles.tabs} aria-label="Checklist type">
            {([['checked', 'Checks'], ['serviced', 'Service'], ['repaired', 'Repairs']] as const).map(([value, title]) => <button key={value} type="button" disabled={!!busy || editing} aria-pressed={mode === value} onClick={() => setMode(value)}>{title}</button>)}
          </div>
          <div className={styles.sectionHeading}><span className={styles.hint} role="status">{selectedKeys.length} selected</span><button className={styles.addButton} type="button" disabled={!!busy || saved.loading || !!saved.error || editing} onClick={() => { setEditing(true); setError(''); }}>+ Add item</button></div>
          {saved.loading ? <p role="status">Loading your saved items…</p> : null}
          {saved.error ? <div role="alert" className={styles.error}>{saved.error} <button type="button" onClick={saved.reload}>Try again</button></div> : null}
          {error ? <p role="alert" className={styles.error}>{error}</p> : null}
          {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
          {editing ? <form className={styles.editor} onSubmit={saveItem}>
            <h3>Add item</h3>
            <label htmlFor="checklist-item-name">Task<input autoFocus id="checklist-item-name" value={label} maxLength={160} required placeholder="e.g. Inspect belt" disabled={!!busy} onChange={event => setLabel(event.target.value)} /></label>
            <label htmlFor="checklist-item-instructions"><span>Instructions (optional)</span><textarea id="checklist-item-instructions" value={description} maxLength={500} rows={2} placeholder="Details" disabled={!!busy} onChange={event => setDescription(event.target.value)} /></label>
            <div className={styles.editorActions}><button type="button" disabled={!!busy} onClick={() => setEditing(false)}>Cancel</button><button className={styles.primary} disabled={!!busy} type="submit">{busy === 'save' ? 'Saving…' : 'Save item'}</button></div>
          </form> : null}
          <ul className={styles.items}>{options.map(item => <li key={item.id} data-selected={selected.has(`${mode}:${item.id}`)}><label className={styles.itemLabel}><input type="checkbox" checked={selected.has(`${mode}:${item.id}`)} disabled={!!busy || editing} onChange={() => toggleItem(`${mode}:${item.id}`)} /><span className={styles.itemCopy}><strong>{item.label}</strong>{item.description ? <span className={styles.itemDescription}>{item.description}</span> : null}</span></label>{item.id.startsWith('asset_custom_') ? <button className={styles.remove} type="button" disabled={!!busy || editing} aria-label={`Remove custom item: ${item.label}`} onClick={() => removeItem(item.id.slice('asset_custom_'.length))}>Remove</button> : null}</li>)}</ul>
          {!options.length && !saved.loading ? <p className={styles.empty}>No items yet. Add a task.</p> : null}
        </> : null}
      </div>
      <footer className={styles.footer}><button type="button" disabled={!asset || !!busy || editing} onClick={() => asset && onStartWork(asset.id, 'upcoming')}>Schedule</button><button type="button" disabled={!asset || !!busy || editing} onClick={() => asset && onStartWork(asset.id, 'done')}>Record work</button><button className={styles.primary} data-primary-action type="button" disabled={!asset || !!busy || editing || saved.loading || !!saved.error || !selectedKeys.length} onClick={downloadPdf}>{busy === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}</button></footer>
      </>}
    </section>
  </div>;
}
