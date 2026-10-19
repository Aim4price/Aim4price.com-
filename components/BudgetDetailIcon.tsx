import styles from './BudgetDetailIcon.module.css';

type DetailIconKind = 'budget' | 'remaining' | 'alert' | 'calendar' | 'fuel' | 'receipt' | 'asset';
const detailPaths: Record<DetailIconKind, string> = {
  budget: 'M20 8V6a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v10H6a3 3 0 0 1-3-3V7M20 12h-5v4h5M17 14h.01',
  remaining: 'M21 11.1V12a9 9 0 1 1-5.3-8.2M21 4l-9 9-3-3',
  alert: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  calendar: 'M8 3v4M16 3v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2M7 14h3M14 14h3M7 17h3',
  fuel: 'M4 21V4h10v17M3 21h12M7 7h4v4H7ZM14 13h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V9l-4-4M19 6v4h3',
  asset: 'M12 3 3 8v9l9 5 9-5V8ZM3 8l9 5 9-5M12 13v9',
  receipt: 'M5 3l2 1 2-1 3 1 3-1 2 1 2-1v18l-2-1-2 1-3-1-3 1-2-1-2 1ZM8 8h8M8 12h8M8 16h5',
};
export default function BudgetDetailIcon({ kind }: { kind: DetailIconKind }) {
  return <svg className={styles.icon} data-budget-icon={kind} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={detailPaths[kind]} /></svg>;
}
