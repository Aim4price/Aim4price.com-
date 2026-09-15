'use client';

import { useEffect, useRef, useState } from 'react';
import pickerStyles from './AssetPicker.module.css';
import AssetSerialNumber from './AssetSerialNumber';
import { useMaintenanceChecklist } from '../lib/use-maintenance-checklist';
import { checklistOptions, type MaintenanceIdentity } from '../lib/maintenance-catalogue';
import styles from './MaintenanceChecklistBrowser.module.css';

type ChecklistAsset = { id: string; title: string; serialNumber?: string; meta?: string; selectedMethod?: string; maintenanceIdentity?: MaintenanceIdentity };

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
  const [mode, setMode] = useState<'checked' | 'serviced'>('checked');
  const asset = assets.find((item) => item.id === assetId) ?? null;
  const checklist = useMaintenanceChecklist(asset);
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
    <section className={`${styles.dialog} ${choosingAsset ? pickerStyles.modal : ''}`} data-asset-choice-surface={choosingAsset ? 'true' : undefined} data-asset-choice-modal={choosingAsset ? 'true' : undefined} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="maintenance-checklists-title" onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') ?? []).filter((element) => element.getClientRects().length > 0);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <header className={styles.header} data-asset-choice-header={choosingAsset ? 'true' : undefined}><div><h2 id="maintenance-checklists-title">Maintenance checklists</h2><p>Choose an asset to see its service and inspection items.</p></div><button type="button" className={styles.close} onClick={onClose} aria-label="Close maintenance checklists">×</button></header>
      {choosingAsset ? <>
        <div data-asset-choice-toolbar="true">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets..." aria-label="Search assets or serial numbers" />
          <button type="button" className={pickerStyles.secondary} onClick={() => setSearch('')}>Clear</button>
        </div>
        <div data-asset-choice-list="true">
          {filteredAssets.length ? filteredAssets.map((item) => <button type="button" key={item.id} data-asset-choice-row="true" onClick={() => { setAssetId(item.id); setChoosingAsset(false); }}>
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
      <div className={styles.body}>
        <button type="button" className={styles.changeAsset} onClick={() => { setSearch(''); setChoosingAsset(true); }}>Change asset</button>
        {asset ? <>
          <div className={styles.identity}><strong>{asset.title}</strong><AssetSerialNumber value={asset.serialNumber} /><span>{checklist.label}</span></div>
          {!checklist.matched ? <p className={styles.hint}>General checks are shown for this asset. Add any other work in notes when recording it.</p> : null}
          <div className={styles.tabs} aria-label="Checklist type"><button type="button" aria-pressed={mode === 'checked'} onClick={() => setMode('checked')}>Inspection checks</button><button type="button" aria-pressed={mode === 'serviced'} onClick={() => setMode('serviced')}>Service items</button></div>
          <p className={styles.hint}>{mode === 'checked' ? 'Inspect condition and safe operation: brakes, tyres, lights and guards where fitted. Record faults found.' : 'Record work carried out: oil changes, filters, lubrication and repairs.'}</p>
          <ul className={styles.items}>{checklistOptions(checklist, mode).map((item) => <li key={item.id}><span className={styles.itemIcon} aria-hidden="true">✓</span><div><strong>{item.label}</strong>{item.description ? <p>{item.description}</p> : null}</div></li>)}</ul>
          <p className={styles.hint}>You can add your own items when recording maintenance. No preset selection is required.</p>
        </> : null}
      </div>
      <footer className={styles.footer}><button type="button" onClick={onClose}>Close</button><button type="button" disabled={!asset} onClick={() => asset && onStartWork(asset.id, 'upcoming')}>Schedule work</button><button className={styles.primary} type="button" disabled={!asset} onClick={() => asset && onStartWork(asset.id, 'done')}>Add own maintenance</button></footer>
      </>}
    </section>
  </div>;
}
