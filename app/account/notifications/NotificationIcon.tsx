import type { PushCategory } from '../../../lib/push-policy';
import styles from './page.module.css';

/** Decorative notification symbols share one size, stroke and quiet green tile. */
export default function NotificationIcon({ name }: { name: PushCategory | 'phone' }) {
  const paths = {
    phone: <><rect x="4" y="2.5" width="11" height="19" rx="2.5" /><path d="M8 5h3m-2 13.5h1M18 6a5 5 0 0 1 0 9m2-12a9 9 0 0 1 0 15" /></>,
    maintenance: <><path d="M14.5 3.5a5.5 5.5 0 0 0-6.9 6.9L3.5 14.5a3.5 3.5 0 0 0 5 5l4.1-4.1a5.5 5.5 0 0 0 6.9-6.9L16 12l-4-4Z" /><circle cx="6.5" cy="17.5" r=".8" fill="currentColor" stroke="none" /></>,
    licensing: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 2.5v5m10-5v5M3 10h18m-13 5 3 3 5-5" /></>,
    enquiries: <><path d="M14 15H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-3Z" /><path d="M8 7h8m-8 4h5m-3 8h6l4 3v-6" /></>,
    approvals: <><path d="m12 2 8 3v6c0 5-4 8.5-8 11-4-2.5-8-6-8-11V5Z" /><path d="m8 11.5 3 3 5-5" /></>,
    assignments: <><rect x="4.5" y="4.5" width="15" height="17" rx="2.5" /><rect x="8" y="2" width="8" height="5" rx="1.5" /><path d="m8 13 2.5 2.5L16 10" /></>,
    costs: <><path d="M10.5 20a8.5 8.5 0 1 1 9-12" /><path d="M7 14V7h3a2 2 0 0 1 0 4H7m3 0 2 3m5-3 5 9H12Z" /><path d="M17 14.5v2" /><circle cx="17" cy="18.2" r=".65" fill="currentColor" stroke="none" /></>,
    listings: <><path d="M13 3H5a2 2 0 0 0-2 2v8l8 8 10-10Z" /><circle cx="7.5" cy="7.5" r="1.25" /><path d="m10 13 2 2 4-4" /></>,
  };
  return <span className={styles.notificationIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">{paths[name]}</svg></span>;
}
