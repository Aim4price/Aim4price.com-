import type { CSSProperties } from 'react';
const paths: Record<string, string> = {
  account: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',
  search: 'M19 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M15 15l6 6',
  record: 'M9 4H5v17h14V4h-4 M9 3h6v4H9Z M8 14l3 3 5-6',
  document: 'M14 2H5v20h14V7Z M14 2v6h5 M8 12h8 M8 16h6',
  add: 'M12 5v14 M5 12h14',
  edit: 'M14 5l5 5 M3 21l5-1L21 7a2.1 2.1 0 0 0-4-4L4 16Z',
  home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
  assets: 'M12 2 3 7v10l9 5 9-5V7Z M3 7l9 5 9-5 M12 12v10',
  work: 'M14.5 6.5l3 3 4-4a6 6 0 0 1-7.9 7.9L6 21a2.1 2.1 0 0 1-3-3l7.6-7.6a6 6 0 0 1 7.9-7.9Z',
  more: 'M3 3h7v7H3Z M14 3h7v7h-7Z M3 14h7v7H3Z M14 14h7v7h-7Z',
  fuel: 'M3 21V3h10v18 M2 21h12 M3 9h10 M13 12h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V8l-4-4 M18 5v4h3',
  problem: 'M12 3 2 21h20Z M12 9v5 M12 17h.01',
  valuation: 'M3 3h8l10 10-8 8L3 11Z M7 7h.01',
  discovery: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M16 8l-3 5-5 3 3-5Z',
  marketplace: 'M3 9l2-6h14l2 6 M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0 M4 12v9h16v-9 M9 21v-6h6v6',
  offline: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
  calendar: 'M4 5h16v16H4Z M8 3v4 M16 3v4 M4 10h16 M8 14h2 M14 14h2',
  usage: 'M3 18a10 10 0 1 1 18 0 M5 18h14 M12 14l5-6 M6 8l1 1 M12 5v2',
};
export default function OwnerIcon({ name, style }: { name: string; style?: CSSProperties }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={style}><path d={paths[name] ?? paths.assets} /></svg>;
}
