'use client';

import styles from './CardVatToggle.module.css';

export default function CardVatToggle({ included, onToggle, label }: { included: boolean; onToggle: () => void; label?: string }) {
  const action = included ? 'Show excl. VAT' : 'Show incl. VAT';
  return <button type="button" className={styles.button} onClick={onToggle} aria-label={label || action} aria-pressed={included} title={action}>
    <span aria-hidden="true">{included ? '‹' : '›'}</span>
  </button>;
}
