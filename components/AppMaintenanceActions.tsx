'use client';
import { useEffect, useState } from 'react';
import AppAssetChecklistButton from './AppAssetChecklistButton';
import AppAssetPartsButton from './AppAssetPartsButton';
import styles from './AppMaintenanceActions.module.css';

function Icon({ kind }: { kind: 'checklist' | 'add' | 'parts' | 'schedule' }) {
  return <span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{kind === 'add' ? <path d="M12 5v14M5 12h14"/> : kind === 'parts' ? <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z M4 7.5l8 4.5 8-4.5M12 12v9"/></> : kind === 'schedule' ? <><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 11h16m-11 5 2 2 4-4"/></> : <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="m8 9 1 1 2-2m2 1h3m-8 6 1 1 2-2m2 1h3"/></>}</svg></span>;
}
export default function AppMaintenanceActions({ apiBase, assetTitle, onRecord, onSchedule, canViewChecklist = true, canParts = true, scheduleLabel = 'Schedule maintenance' }: {
  scheduleLabel?: string;
  apiBase: string; assetTitle: string; onRecord?: () => void; onSchedule?: () => void; canViewChecklist?: boolean; canParts?: boolean;
}) {
  const [access, setAccess] = useState<{ canRecord: boolean; canSchedule: boolean } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setAccess(null);
    if (canViewChecklist) fetch(`${apiBase}/checklist`, { cache: 'no-store', signal: controller.signal }).then(async response => { if (response.ok) { const data = await response.json(); if (!controller.signal.aborted) setAccess(data); } else if ([401, 403].includes(response.status) && !controller.signal.aborted) setAccess({ canRecord: false, canSchedule: false }); }).catch(() => {});
    return () => controller.abort();
  }, [apiBase, canViewChecklist]);
  const record = access?.canRecord === false ? undefined : onRecord;
  const schedule = access?.canSchedule === false ? undefined : onSchedule;
  return <section className={styles.grid} aria-label="Maintenance actions">
    {record && <button className={styles.card} type="button" onClick={record}><Icon kind="add"/><span><strong>Add maintenance</strong><small>Record completed checks, services or repairs.</small></span></button>}
    {canViewChecklist && <AppAssetChecklistButton endpoint={`${apiBase}/checklist`} className={styles.card} onRecord={record} onSchedule={schedule}><Icon kind="checklist"/><span><strong>Checklists</strong><small>View checks, service tasks and custom items.</small></span></AppAssetChecklistButton>}
    {canParts && <AppAssetPartsButton endpoint={`${apiBase}/parts`} assetTitle={assetTitle} className={styles.card}><Icon kind="parts"/><span><strong>Parts</strong><small>View and add part numbers for this asset.</small></span></AppAssetPartsButton>}
    {schedule && <button className={styles.card} type="button" onClick={schedule}><Icon kind="schedule"/><span><strong>{scheduleLabel}</strong><small>{scheduleLabel === 'Edit schedule' ? 'Update the schedule.' : 'Create a schedule for this asset.'}</small></span></button>}
  </section>;
}
