'use client';

import styles from './CardVatToggle.module.css';

export default function CardVatToggle({ included, onToggle, label }: { included: boolean; onToggle: () => void; label?: string }) {
  const action = included ? 'Show excl. VAT' : 'Show incl. VAT';
  return <button type="button" className={styles.button} onClick={onToggle} aria-label={label || action} aria-pressed={included} title={action}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={included ? 'm14 6-6 6 6 6' : 'm10 6 6 6-6 6'} /></svg>
  </button>;
}
