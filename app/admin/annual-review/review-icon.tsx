/** Decorative icons share one grid and inherit their surrounding contrast colour. */
export default function ReviewIcon({ kind }: { kind: 'welcome' | 'assets' | 'adjust' | 'keep' | 'replacement' | 'value' | 'review' | 'complete' | 'help' }) {
  const paths = {
    welcome: <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z" /><path d="M20 3v4m-2-2h4" /></>,
    assets: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    adjust: <><path d="M5 4v8m0 4v4M12 4v3m0 4v9M19 4v12m0 4h0" /><circle cx="5" cy="14" r="2" /><circle cx="12" cy="9" r="2" /><circle cx="19" cy="18" r="2" /></>,
    keep: <><circle cx="12" cy="12" r="9" /><path d="M9 8v8m6-8v8" /></>,
    replacement: <><path d="M20 13 13 20a2 2 0 0 1-3 0l-7-7V4h9l8 7a1.5 1.5 0 0 1 0 2Z" /><circle cx="7.5" cy="8.5" r="1" /></>,
    value: <><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 4 16 4 16 0V6M4 12v6c0 4 16 4 16 0v-6" /></>,
    review: <><rect x="5" y="5" width="14" height="16" rx="2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="m8 14 3 3 5-6" /></>,
    complete: <><circle cx="12" cy="12" r="9" /><path d="m7.5 12 3 3 6-6" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" /></>,
  };
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[kind]}</svg>;
}
