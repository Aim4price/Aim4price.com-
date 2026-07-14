'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from '../owner-app.module.css';

type Item = { id: string; sourceId: string; type: string; section: 'needs_attention' | 'coming_up'; statusLabel: string; assetId: string; assetTitle: string; headline: string; detail: string; notes: string };

export default function OwnerAttentionClient() {
  const [range, setRange] = useState<'week' | 'month'>('week');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => { void load(); }, [range]);
  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/owner-app/attention?range=${range}`, { credentials: 'include', cache: 'no-store' });
      const payload = await response.json().catch(() => null) as { ok?: boolean; items?: Item[]; error?: string } | null;
      if (response.status === 401) { window.location.replace('/owner-app/login'); return; }
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Failed to load Needs Attention.');
      setItems(payload.items ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed to load Needs Attention.'); }
    finally { setLoading(false); }
  }
  async function clear(item: Item) {
    setBusyId(item.id); setError('');
    try {
      const response = await fetch('/api/owner-app/attention', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ range, itemId: item.id, sourceId: item.sourceId }) });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'This item could not be cleared.');
      setItems((current) => current.filter((entry) => entry.id !== item.id || entry.sourceId !== item.sourceId));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'This item could not be cleared.'); }
    finally { setBusyId(''); }
  }
  const render = (item: Item) => <article className={styles.attentionCard} key={`${item.id}:${item.sourceId}`}><div className={styles.attentionLabels}><span>{item.type}</span><span>{item.statusLabel}</span></div><h3>{item.assetTitle}</h3><p><strong>{item.headline}</strong></p><p>{item.detail}</p>{item.notes ? <p>{item.notes}</p> : null}<div className={styles.actions}><button type="button" className={styles.secondaryButton} disabled={Boolean(busyId)} onClick={() => void clear(item)}>{busyId === item.id ? 'Clearing…' : 'Clear'}</button><Link className={styles.primaryButton} href={`/owner-app/assets/${encodeURIComponent(item.assetId)}`}>Open asset</Link></div></article>;
  const attention = items.filter((item) => item.section === 'needs_attention');
  const coming = items.filter((item) => item.section === 'coming_up');
  return <div className={styles.content}><section className={styles.hero}><p className={styles.eyebrow}>Aim4price Owner</p><h1>Needs Attention</h1><p>Problems, maintenance, checkups and licence items across all assets.</p></section><div className={styles.rangeTabs}><button className={range === 'week' ? styles.activeTab : ''} onClick={() => setRange('week')}>Next 7 days</button><button className={range === 'month' ? styles.activeTab : ''} onClick={() => setRange('month')}>Next 30 days</button></div>{error ? <div className={styles.errorNotice}>{error}<button className={styles.smallButton} onClick={() => void load()}>Try again</button></div> : null}{loading ? <div className={styles.loading}>Loading Needs Attention…</div> : null}{!loading ? <><section className={styles.attentionSection}><div className={styles.attentionHeading}><h2>Needs Attention</h2><span className={styles.count}>{attention.length}</span></div>{attention.length ? attention.map(render) : <p className={styles.empty}>Nothing needs attention.</p>}</section><section className={styles.attentionSection}><div className={styles.attentionHeading}><h2>Coming Up</h2><span className={styles.count}>{coming.length}</span></div>{coming.length ? coming.map(render) : <p className={styles.empty}>Nothing coming up.</p>}</section></> : null}</div>;
}
