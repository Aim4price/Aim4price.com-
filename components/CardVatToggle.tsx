'use client';

import registerStyles from '../app/asset-register/page.module.css';
import styles from './CardVatToggle.module.css';

export default function CardVatToggle({ included, onToggle, label }: { included: boolean; onToggle: () => void; label?: string }) {
  const action = included ? 'Show excl. VAT' : 'Show incl. VAT';
  return <button type="button" className={`${styles.button} ${registerStyles.controlTooltip}`} onClick={onToggle} aria-label={label || action} aria-pressed={included} data-tooltip={action}>
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M8 6h8M8 10h2m4 0h2M8 14h2m4 0h2M8 18h2m4 0h2" />
    </svg>
  </button>;
}
