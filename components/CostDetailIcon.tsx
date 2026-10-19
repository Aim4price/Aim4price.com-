import styles from './CostDetailIcon.module.css';

type Kind = 'asset' | 'calendar' | 'money' | 'percent' | 'usage' | 'document' | 'person' | 'clock' | 'maintenance' | 'parts' | 'repair' | 'other';

export default function CostDetailIcon({kind}: {kind: Kind}) {
  const paths = {
    asset: <><rect x="4" y="6" width="16" height="15" rx="2"/><path d="M9 6V3h6v3M8 11h8M8 15h5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h3m4 0h3"/></>,
    money: <><ellipse cx="9" cy="8" rx="6" ry="3"/><path d="M3 8v8c0 4 12 4 12 0V8M3 12c0 4 12 4 12 0m0-9c8 0 8 6 0 6m6-3v8c0 2-2 3-6 3"/></>,
    percent: <><path d="m5 19 14-14"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/></>,
    usage: <><path d="M4 18a9 9 0 1 1 16 0M12 5v2M5 10l2 1m12-1-2 1m-5 4 4-5"/><circle cx="12" cy="15" r="1"/></>,
    document: <><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8m-8 4h6"/></>,
    person: <><circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 6 0 0 1 16 0v3"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
    maintenance: <path d="M14 6a6 6 0 0 0-7 8l-4 4a2 2 0 0 0 3 3l4-4a6 6 0 0 0 8-7l-4 4-4-4z"/>,
    parts: <><path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5m-9 5v9M7 6l9 5"/></>,
    repair: <><path d="m14 3 7 7-4 4-3-3-9 10-3-3 10-9-2-2z"/></>,
    other: <><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8m-8 4h6"/></>,
  };
  return <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[kind]}</svg>;
}
