'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './owner-mobile.module.css';
type Summary = { needsAttentionCount: number; comingUpCount: number };
export default function OwnerHomeAttention() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch('/api/owner-app/attention?range=upcoming', { credentials: 'include', cache: 'no-store', signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload.ok || !payload.summary) throw new Error('Overview unavailable');
        if (!controller.signal.aborted) { setSummary(payload.summary); setFailed(false); }
      } catch { if (!controller.signal.aborted) setFailed(true); }
    }
    void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(onVisible, 60_000);
    return () => { controller.abort(); window.clearInterval(interval); window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return <section aria-label="Your overview">
    <h2 className={styles.sectionTitle}>Your overview</h2>
    {failed ? <Link className={styles.row} href="/owner-app/attention">Open overview — summary unavailable</Link> : <div className={styles.counts} aria-busy={!summary}>
      <Link className={styles.count} href="/owner-app/attention#needs-attention-title"><strong>{summary?.needsAttentionCount ?? '—'}</strong><span>Needs attention</span></Link>
      <Link className={styles.count} href="/owner-app/attention#upcoming-title"><strong>{summary?.comingUpCount ?? '—'}</strong><span>Upcoming</span></Link>
    </div>}
  </section>;
}
