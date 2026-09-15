'use client';

import { useEffect, useRef, useState } from 'react';
import { FilterQuestion } from './FilterFlow';
import AssetSerialNumber from './AssetSerialNumber';
import { useMaintenanceChecklist } from '../lib/use-maintenance-checklist';
import type { MaintenanceIdentity } from '../lib/maintenance-catalogue';
import styles from './MaintenanceChecklistBrowser.module.css';

type ChecklistAsset = { id: string; title: string; serialNumber?: string; maintenanceIdentity?: MaintenanceIdentity };

export default function MaintenanceChecklistBrowser({ assets, initialAssetId, onClose, onStartWork }: {
  assets: ChecklistAsset[];
  initialAssetId: string;
  onClose: () => void;
  onStartWork: (assetId: string, timing: 'done' | 'upcoming') => void;
}) {
  const [assetId, setAssetId] = useState(initialAssetId);
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

  return <div className={styles.overlay} data-website-overlay onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={styles.dialog} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="maintenance-checklists-title" onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') ?? []).filter((element) => element.getClientRects().length > 0);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <header className={styles.header}><div><h2 id="maintenance-checklists-title">Maintenance checklists</h2><p>Choose an asset to see its service and inspection items.</p></div><button type="button" className={styles.close} onClick={onClose} aria-label="Close maintenance checklists">×</button></header>
      <div className={styles.body}>
        {assets.length ? <FilterQuestion label="Which asset?" value={assetId} options={[{ value: '', label: 'Choose an asset' }, ...assets.map((item) => ({ value: item.id, label: `${item.title}${item.serialNumber ? ` · ${item.serialNumber}` : ''}` }))]} onChange={setAssetId} searchable searchPlaceholder="Search assets or serial numbers" /> : <p>No saved assets available.</p>}
        {asset ? <>
          <div className={styles.identity}><strong>{asset.title}</strong><AssetSerialNumber value={asset.serialNumber} /><span>{checklist.label}</span></div>
          {!checklist.matched ? <p className={styles.hint}>General checks are shown for this asset. Add any other work in notes when recording it.</p> : null}
          <div className={styles.tabs} aria-label="Checklist type"><button type="button" aria-pressed={mode === 'checked'} onClick={() => setMode('checked')}>Inspection checks</button><button type="button" aria-pressed={mode === 'serviced'} onClick={() => setMode('serviced')}>Service items</button></div>
          <ul className={styles.items}>{checklist.items.map((item) => <li key={item.id}><span className={styles.itemIcon} aria-hidden="true">✓</span><div><strong>{mode === 'checked' ? item.checkLabel : item.serviceLabel}</strong>{item.description ? <p>{item.description}</p> : null}</div></li>)}</ul>
          <p className={styles.hint}>Select the items actually completed when recording work.</p>
        </> : null}
      </div>
      <footer className={styles.footer}><button type="button" onClick={onClose}>Close</button><button type="button" disabled={!asset} onClick={() => asset && onStartWork(asset.id, 'upcoming')}>Schedule work</button><button className={styles.primary} type="button" disabled={!asset} onClick={() => asset && onStartWork(asset.id, 'done')}>Record completed work</button></footer>
    </section>
  </div>;
}
