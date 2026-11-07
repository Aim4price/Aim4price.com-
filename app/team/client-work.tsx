'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TeamClientWork } from '../../lib/team-client-policy';
import styles from '../../components/team/team.module.css';

export default function ClientWork({ membership, version }: { membership: string; version: number }) {
  const [items, setItems] = useState<TeamClientWork[]>([]), [search, setSearch] = useState('');
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const endpoint = '/api/team-workspaces/' + encodeURIComponent(membership) + '/client-work';
  const refresh = useCallback(async () => {
    const ticket = ++generation.current;
    try {
      const response = await fetch(endpoint, { cache: 'no-store' }), body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Client work unavailable.');
      if (ticket === generation.current) { setItems(body.items); setError(''); }
    } catch (error) { if (ticket === generation.current) { setItems([]); setError(error instanceof Error ? error.message : 'Client work unavailable.'); } }
    finally { if (ticket === generation.current) setLoading(false); }
  }, [endpoint]);
  useEffect(() => {
    setItems([]); setLoading(true); void refresh();
    const focus = () => { if (!document.hidden) void refresh(); };
    const visibility = () => { if (document.hidden) { generation.current++; setItems([]); } else void refresh(); };
    const timer = setInterval(focus, 30000);
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', visibility);
    return () => { generation.current++; clearInterval(timer); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visibility); };
  }, [refresh, version]);
  async function respond(item: TeamClientWork, status: string) {
    if (status === 'declined' && !window.confirm('Decline this enquiry? It will be removed from your assigned work.')) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id:item.id,status}) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to save.');
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save.'); }
    finally { setBusy(false); }
  }
  const visible = items.filter(item => `${item.title} ${item.client}`.toLowerCase().includes(search.toLowerCase()));
  const money = (value: number | null) => value === null ? 'Not shared' : new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(value);
  return <main className={styles.page}>
    <header className={styles.header}><div><h1>Client work</h1><p>Enquiries and assets assigned to you.</p></div><button type="button" className={styles.button} disabled={busy} onClick={() => void refresh()}>Refresh</button></header>
    <label className={styles.field}>Search client work<input className={styles.input} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Client or asset"/></label>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {loading ? <p role="status">Loading client work…</p> : !visible.length && <p className={styles.notice}>{items.length ? 'No matching client work.' : 'No client work is currently assigned and available.'}</p>}
    <div className={styles.list}>{visible.map(item => <article className={styles.card} key={item.id}>
      <div className={styles.header}><div><h2>{item.title}</h2><p>{item.client}</p></div><span className={styles.pill}>{item.status}</span></div>
      {item.contact && <p>{[item.contact.name,item.contact.email,item.contact.phone].filter(Boolean).join(' · ')}</p>}
      {item.assets.map((asset,index) => <details key={index}><summary>{asset.title || 'Asset details'}</summary><dl>
        <dt>Serial number</dt><dd>{asset.serialNumber || 'Not shared'}</dd><dt>Year</dt><dd>{asset.year ?? 'Not shared'}</dd><dt>Usage</dt><dd>{asset.usage || 'Not shared'}</dd><dt>Condition</dt><dd>{asset.condition || 'Not shared'}</dd>
        {asset.values && <><dt>Current value</dt><dd>{money(asset.values.current)}</dd><dt>Replacement value</dt><dd>{money(asset.values.replacement)}</dd></>}
      </dl></details>)}
      {item.canRespond && <div className={styles.actions}>{(['viewed','accepted','quoted','declined'] as const).map(status => <button type="button" className={status === 'declined' ? styles.danger : styles.button} key={status} disabled={busy || status === item.status} onClick={() => void respond(item,status)}>{({viewed:'Mark viewed',accepted:'Accept',quoted:'Mark quoted',declined:'Decline'})[status]}</button>)}</div>}
    </article>)}</div>
  </main>;
}
