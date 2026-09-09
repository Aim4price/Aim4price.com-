import styles from './AppHomeLauncher.module.css';

const ICON_PATHS: Record<string, string> = {
  notifications: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  overview: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
  assets: 'M12 2 3 7v10l9 5 9-5V7Z M3 7l9 5 9-5 M12 12v10',
  operations: 'M14.7 6.3a5.5 5.5 0 0 0-7 7L2.9 18.1a2.1 2.1 0 0 0 3 3l4.8-4.8a5.5 5.5 0 0 0 7-7l-3 3-3-3Z',
  valuation: 'M14 2H5v20h14V7Z M14 2v5h5 M8 11h8 M8 15h8 M8 19h5',
  discovery: 'M12 2 3 7v10l9 5 9-5V7Z M3 7l9 5 9-5 M12 12v10',
  marketplace: 'M2 3h3l3 13h11l3-9H6 M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2 M18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
  fuel: 'M3 21V3h10v18 M2 21h12 M3 9h10 M13 12h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V8l-4-4 M18 5v4h3',
};

export default function AppHomeIcon({ name }: { name: string }) {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

export function AppHomeChevron() {
  return (
    <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}
