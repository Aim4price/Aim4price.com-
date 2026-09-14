import styles from './PricingActionIcon.module.css';

export default function PricingActionIcon({ kind }: { kind: 'recalculate' | 'future' | 'saleability' }) {
  return (
    <svg className={`${styles.icon} ${styles[kind]}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {kind === 'recalculate' ? (
        <>
          <rect x="7" y="5" width="10" height="14" rx="2" />
          <path d="M10 9h4M10 12h.01M14 12h.01M10 15h.01M14 15h.01M3 9a10 10 0 0 1 16-5M19 1v3h-3M21 15a10 10 0 0 1-16 5M5 23v-3h3" />
        </>
      ) : kind === 'future' ? (
        <>
          <path d="M4 20V4M4 20h17M8 17v-3M13 17v-5M18 17v-8M7 10l5-4 4 1 5-5M17 2h4v4" />
        </>
      ) : (
        <>
          <path d="M3.5 19a10 10 0 1 1 17 0M6 15H4M7.5 7.5 6 6M12 5V3M16.5 7.5 18 6M18 15h2M13.5 13.5 17 10" />
          <circle cx="12" cy="15" r="2" />
          <path d="M8 21h8" />
        </>
      )}
    </svg>
  );
}
