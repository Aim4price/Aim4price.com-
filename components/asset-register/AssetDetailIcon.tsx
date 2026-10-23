import type {ReactNode} from 'react';
import styles from './AssetCardDetails.module.css';

// A shared 24px grid keeps the symbols optically aligned at card size.
const symbols: Record<string, ReactNode> = {
  serial: <><path d="M7 3H4a1 1 0 0 0-1 1v3m14-4h3a1 1 0 0 1 1 1v3M3 17v3a1 1 0 0 0 1 1h3m10 0h3a1 1 0 0 0 1-1v-3"/><path d="M7 8v8m3-8v8m4-8v8m3-8v8"/></>,
  registration: <><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M6 10h4m4 0h4M6 14h12"/></>,
  year: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18"/><path d="M7 14h2m4 0h4m-10 3h2m4 0h2"/></>,
  usage: <><path d="M4.2 19a10 10 0 1 1 15.6 0M12 4v2M5.6 7.6 7 9m12-1.4L17.6 9M3 14h2m14 0h2M13.4 12.6 17 9"/><circle cx="12" cy="14" r="2"/></>,
  condition: <><path d="m12 3 8 3.5V12c0 4.3-4.6 7.4-8 9-3.4-1.6-8-4.7-8-9V6.5L12 3Z"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/></>,
  replacement: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9M8 5.3l8 4.5v3"/></>,
  market: <><path d="M4 3h6.2a2 2 0 0 1 1.4.6l8.8 8.8a2 2 0 0 1 0 2.8l-5.2 5.2a2 2 0 0 1-2.8 0l-8.8-8.8A2 2 0 0 1 3 10.2V4a1 1 0 0 1 1-1Z"/><circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none"/></>,
  size: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 3v4m5-4v4m5-4v4M3 8h4m-4 5h4m-4 5h4"/></>,
  calculator: <><rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M8.5 6h7v3h-7Z"/><path d="M9 13h.01M15 13h.01M9 17h.01M15 17h.01" strokeWidth="2.8"/></>,
  alert: <><path d="M10.3 4.4 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0Z"/><path d="M12 9v5"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/></>,
};
export default function AssetDetailIcon({kind}: {kind: string}) {
  return <svg className={styles.detailIcon} data-detail-icon={kind} aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{symbols[kind] || symbols.serial}</svg>;
}
