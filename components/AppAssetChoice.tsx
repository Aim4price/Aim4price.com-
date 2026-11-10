'use client';

import styles from './AppAssetChoice.module.css';

/** The standard app asset card, shared by work and fuel QR selection. */
export default function AppAssetChoice({ title, year, usage, serial, action = 'Open', disabled, className, onClick }: {
  title: string;
  year: string;
  usage: string;
  serial?: string;
  action?: string;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <article className={[styles.card, className].filter(Boolean).join(' ')} data-app-asset-card="true">
      <h2 className={styles.title}>{title}</h2>
      <dl className={styles.details}>
        <div><dt>Serial / VIN</dt><dd>{serial?.trim() || 'Not captured'}</dd></div>
        <div><dt>Year</dt><dd>{year || 'Not captured'}</dd></div>
        <div><dt>Usage</dt><dd>{usage || 'Not captured'}</dd></div>
      </dl>
      <button type="button" className={styles.action} onClick={onClick} disabled={disabled} aria-label={`${action}: ${title}`}>
        {action}
      </button>
    </article>
  );
}
