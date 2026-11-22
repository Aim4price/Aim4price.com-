import type { CardKey } from '../../lib/workspace-navigation';
import styles from './workspace.module.css';

const paths: Partial<Record<CardKey, string>> = {
  shared: 'M12 2l4.5 2.5v5L12 12 7.5 9.5v-5L12 2zm-4.5 2.5L12 7l4.5-2.5M12 7v5m-4.5-2.5L3 12v5l4.5 2.5L12 17v-5m-9 0l4.5 2.5L12 12m-4.5 2.5v5m9-10L21 12v5l-4.5 2.5L12 17m0-5l4.5 2.5L21 12m-4.5 2.5v5',
  value: 'M3 12l9-9h8v8l-9 10-8-8z M16 7h.01',
  marketplace: 'M3 10l2-6h14l2 6M3 10a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0M5 13v7h14v-7M10 20v-5h4v5',
  discovery: 'M22 12a10 10 0 11-20 0 10 10 0 0120 0z M16 8l-2.5 5.5L8 16l2.5-5.5L16 8z',
  register: 'M9 5H5v16h14V5h-4 M9 3h6v4H9z M8 11h2m3 0h3m-8 5h2m3 0h3',
  registers: 'M2 8l10-5 10 5-10 5L2 8zm1 5l9 4.5 9-4.5m-18 5l9 4.5 9-4.5',
  parts: 'M3 7l9-5 9 5v10l-9 5-9-5V7zm0 0l9 5 9-5m-9 5v10m-5-17l9 5v4',
  tracking: 'M14 5a5 5 0 00-6 6L3 16a2.8 2.8 0 004 4l6-6a5 5 0 006-6l-3 3-4-4 3-3z',
  businessCosts: 'M4 6c0-4 16-4 16 0s-16 4-16 0zm0 0v12c0 4 16 4 16 0V6M4 12c0 4 16 4 16 0',
  showroom: 'M3 13l3-7h12l3 7v6H3v-6zm0 0h18M5 19v2m14-2v2M6 16h2m8 0h2',
  template: 'M5 2h10l4 4v16H5V2zm10 0v5h4M8 17l3-4 2 2 2-3 2 5H8z',
  advert: 'M3 10h5l12-6v16L8 14H3v-4zm5 0v4m-3 0l2 6h3l-2-6',
};

export default function BusinessCardIcon({name}: {name: CardKey}) {
  return <svg className={styles.glyph} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>;
}
