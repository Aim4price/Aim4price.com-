'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from '../owner-app.module.css';

type Notification = { id: string; category: string; title: string; body: string; createdAtIso: string };

function destination(category: string) {
  return category === 'asset_discovery' ? '/owner-app/marketplace' : '/owner-app/assets';
}

export default function OwnerNotificationsClient() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/owner-app/notifications', { credentials: 'include', cache: 'no-store' });
        const payload = await response.json().catch(() => null) as { ok?: boolean; notifications?: Notification[]; error?: string } | null;
        if (response.status === 401) { window.location.replace('/owner-app/login'); return; }
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Failed to load notifications.');
        setItems(payload.notifications ?? []);
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed to load notifications.'); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className={styles.content}>
      <section className={styles.hero}><p className={styles.eyebrow}>Aim4price Owner</p><h1>Notifications</h1><p>Your existing in-app owner notifications.</p></section>
      {error ? <div className={styles.errorNotice}>{error}</div> : null}
      {loading ? <div className={styles.loading}>Loading notifications…</div> : null}
      {!loading && !items.length ? <div className={styles.empty}>No notifications right now.</div> : null}
      <div className={styles.notificationList}>{items.map((item) => <Link key={item.id} className={styles.notificationCard} href={destination(item.category)}><h2>{item.title}</h2><p>{item.body}</p><p>{new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAtIso))}</p></Link>)}</div>
    </div>
  );
}
