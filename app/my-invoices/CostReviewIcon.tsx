import styles from './cost-review.module.css';

const paths = {
  supplier: 'M3 21h18M5 21V5l7-2v18M12 8h7v13M8 7v1M8 11v1M8 15v1M15 12h1M15 16h1',
  invoice: 'M6 3h9l4 4v14H6ZM14 3v5h5M9 12h7M9 16h5',
  calendar: 'M8 3v4M16 3v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2M8 14h3M14 14h2M8 17h3',
  usage: 'M4 18a9 9 0 1 1 16 0ZM12 14l4-5M7 12l-1-1M12 7V6M17 12l1-1',
  subtotal: 'M4 6h16M4 12h8M4 18h8M18 10v10M14 15h8',
  vat: 'm7 17 10-10M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6M16 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  total: 'M20 8V5H6a3 3 0 0 0 0 6h14v10H6a3 3 0 0 1-3-3V8M20 13h-5v4h5',
  maintenance: 'm14.7 6.3 3 3a1 1 0 0 0 1.4 0l2.8-2.8a6 6 0 0 1-7.9 7.9l-7.7 7.7a2.1 2.1 0 0 1-3-3l7.7-7.7a6 6 0 0 1 7.9-7.9l-2.8 2.8a1 1 0 0 0 0 1.4Z',
  parts: 'm12 3 9 5v9l-9 5-9-5V8ZM3 8l9 5 9-5M12 13v9M7.5 5.5l9 5v4',
  repairs: 'm14 4 6 6 2-2-6-6-2 2-3-1-4 4 4 4 3-3M10 10l-7 7a2.1 2.1 0 0 0 3 3l7-7',
  notes: 'M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8 8h8M8 12h8M8 16h5',
};

export default function CostReviewIcon({ kind }: { kind: keyof typeof paths }) {
  return <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[kind]} /></svg>;
}
