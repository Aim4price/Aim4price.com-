'use client';
import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from './WebsitePortal';
import MaintenanceChecklistBrowser from './MaintenanceChecklistBrowser';
import styles from './AppMaintenanceActions.module.css';
import type { MaintenanceIdentity } from '../lib/maintenance-catalogue';

type Payload = { asset: { id: string; title: string; headerMeta?: string; maintenanceIdentity: MaintenanceIdentity }; canEdit: boolean; canRemove: boolean; canRecord: boolean; canSchedule: boolean };
export default function AppAssetChecklistButton({ endpoint, className, children, onRecord, onSchedule }: {
  endpoint: string; className?: string; children?: ReactNode; onRecord?: () => void; onSchedule?: () => void;
}) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const opening = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  async function open() {
    if (opening.current) return;
    opening.current = true;
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not open the checklist.');
      setPayload(data);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not open the checklist.'); }
    finally { opening.current = false; setBusy(false); }
  }
  return <>
    <button ref={trigger} type="button" className={className} disabled={busy} aria-busy={busy} onClick={open}>{children || 'Checklists'}</button>
    {busy ? <p className={styles.feedback} role="status">Opening this asset’s checklists…</p> : null}
    {error ? <p className={styles.feedback} role="alert">{error} <button className={styles.retry} type="button" disabled={busy} onClick={open}>Try again</button></p> : null}
    {payload && createPortal(<MaintenanceChecklistBrowser assets={[payload.asset]} initialAssetId={payload.asset.id} endpoint={endpoint} pdfEndpoint={`${endpoint}?pdf=1`} canEdit={payload.canEdit} canRemove={payload.canRemove} canRecord={payload.canRecord && !!onRecord} canSchedule={payload.canSchedule && !!onSchedule} onClose={() => { setPayload(null); trigger.current?.focus(); }} onStartWork={(_, timing) => { setPayload(null); if (timing === 'done') onRecord?.(); else onSchedule?.(); }} />, document.body)}
  </>;
}
