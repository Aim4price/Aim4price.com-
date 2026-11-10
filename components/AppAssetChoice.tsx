'use client';

import type { ReactNode } from 'react';
import styles from './AppAssetChoice.module.css';

/** Shared touch-friendly selection row for app work, fuel and QR entry flows. */
export default function AppAssetChoice({ title, details, serial, action = 'Select asset', disabled, className, onClick }: {
  title: string;
  details: ReactNode;
  serial?: string;
  action?: string;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return <button type="button" className={[styles.choice, className].filter(Boolean).join(' ')} data-asset-choice-row="true" onClick={onClick} disabled={disabled} aria-label={`${action}: ${title}`}>
    <span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="m12 3 9 5v8l-9 5-9-5V8l9-5Zm0 10 9-5M3 8l9 5v8" /></svg></span>
    <span className={styles.copy} data-asset-choice-copy="true">
      <strong>{title}</strong>
      <span className={styles.details}>{details}</span>
      {serial && !['Not captured', 'Not supplied', '—', '-'].includes(serial) ? <small>Serial / VIN: {serial}</small> : null}
      <span className={styles.action}>{action}</span>
    </span>
  </button>;
}
