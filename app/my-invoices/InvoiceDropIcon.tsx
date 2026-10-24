import styles from './invoice-drop-final.module.css';
const paths = {
  code: 'M8 9l-4 3 4 3M16 9l4 3-4 3M14 5l-4 14',
  view: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  hide: 'm3 3 18 18M10 5a11 11 0 0 1 12 7s-1 2-3 4M6 6a17 17 0 0 0-4 6s4 7 10 7c2 0 3-1 4-1',
  change: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1',
  revoke: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM6 6l12 12',
  copy: 'M9 9h11v12H9ZM5 16H3V3h12v2',
  link: 'm10 13 4-4M8 15l-2 2a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0M14 9l2-2a3 3 0 0 1 4 4l-4 4a3 3 0 0 1-4 0',
  open: 'M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5',
  share: 'M12 16V3M7 8l5-5 5 5M5 13v8h14v-8',
  calendar: 'M8 3v4M16 3v4M3 10h18M5 5h14v16H5Z',
};
export default function InvoiceDropIcon({kind}: {kind: keyof typeof paths}) {
  return <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[kind]} /></svg>;
}
