import styles from './AssetCardDetails.module.css';

const paths: Record<string, string> = {
  serial: 'M3 5v14M6 5v14M10 5v14M14 5v14M17 5v14M21 5v14',
  year: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z',
  usage: 'M4 19a10 10 0 1 1 16 0M12 12l5-5M4 12h2M12 4v2M18 12h2M6 6l2 2M10 14a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
  condition: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7ZM8 12l3 3 5-6',
  replacement: 'M12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8',
  market: 'M3 3h7l11 11-7 7L3 10ZM7 7h.01',
  size: 'M3 3h18v18H3ZM7 3v4M11 3v4M15 3v4M3 7h4M3 11h4M3 15h4',
  calculator: 'M5 3h14v18H5ZM8 6h8v4H8ZM8 14h1M15 14h1M8 17h1M15 17h1',
};
export default function AssetDetailIcon({kind}: {kind: string}) {
  return <svg className={styles.detailIcon} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind] || paths.serial}/></svg>;
}
