import styles from './SettingsDetailIcon.module.css';

export type SettingsIconName = 'person' | 'email' | 'business' | 'phone' | 'location' | 'globe' | 'image' | 'lock' | 'discovery' | 'maintenance' | 'licensing' | 'enquiries' | 'approvals' | 'assignments' | 'costs' | 'listings';

export default function SettingsDetailIcon({ name }: { name: SettingsIconName }) {
  const paths = {
    person: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 7 0 0 1 16 0v2" /></>,
    email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
    business: <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 7h1m4 0h1M9 11h1m4 0h1M10 21v-6h4v6" /></>,
    phone: <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M10 5h4m-3 14h2" /></>,
    location: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="2" /><path d="m3 17 5-5 4 4 4-6 5 7" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
    discovery: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2 6-6 2 2-6Z" /></>,
    maintenance: <path d="M14 6a6 6 0 0 0-7 8l-4 4a2 2 0 0 0 3 3l4-4a6 6 0 0 0 8-7l-4 4-4-4Z" />,
    licensing: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-13 5 3 3 5-5" /></>,
    enquiries: <path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z" />,
    approvals: <><circle cx="12" cy="12" r="9" /><path d="m7 12 3 3 7-7" /></>,
    assignments: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3h6v3H9zM8 11h8m-8 4h6" /></>,
    costs: <><circle cx="12" cy="12" r="9" /><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12" /></>,
    listings: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8m-8 5h8m-8 5h5" /></>,
  };
  return <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
