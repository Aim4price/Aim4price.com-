'use client';
import { useEffect, useState } from 'react';
import styles from './ShareHistory.module.css';
type Entry = {
    token: string;
    created_at: string;
    revoked_at: string | null;
    recipient_name: string | null;
    recipient_email: string | null;
    umbrella_name: string | null;
};
export default function ShareHistory({ assetIds, umbrellaId, onBack }: {
    assetIds: string[];
    umbrellaId?: string;
    onBack: () => void;
}) {
    const [rows, setRows] = useState<Entry[]>([]), [offset, setOffset] = useState(0), [more, setMore] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const key = assetIds.join(',');
    useEffect(() => {
        const controller = new AbortController();
        setBusy(true);
        setError('');
        const query = new URLSearchParams({ offset: String(offset) });
        key.split(',').forEach(id => query.append('assetId', id));
        if (umbrellaId)
            query.set('umbrellaId', umbrellaId);
        fetch(`/api/asset-share-links/history?${query}`, { cache: 'no-store', signal: controller.signal }).then(async (r) => { const data = await r.json(); if (!r.ok)
            throw Error(data.error); return data; }).then(data => { setRows(data.shares); setMore(data.hasMore); }).catch(e => { if (!controller.signal.aborted)
            setError(e.message); }).finally(() => { if (!controller.signal.aborted)
            setBusy(false); });
        return () => controller.abort();
    }, [key, umbrellaId, offset]);
    async function revoke(token: string) {
        setBusy(true);
        setError('');
        try {
            const response = await fetch('/api/asset-share-links', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
            if (!response.ok)
                throw Error('Access could not be revoked. Please try again.');
            setRows(current => current.map(row => row.token === token ? { ...row, revoked_at: new Date().toISOString() } : row));
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    return <div className={styles.panel}>
  <p className={styles.intro}>Open a shared link or revoke its access.</p>
  {error && <p role="alert" className={styles.error}>{error}</p>}
  {!rows.length ? <p className={styles.empty} role="status">{busy ? 'Loading shared links…' : 'No shared links yet.'}</p> : <div className={styles.list} aria-busy={busy}>{rows.map(row => <article className={styles.row} key={row.token}>
   <div className={styles.details}><strong>{row.recipient_name || row.recipient_email || row.umbrella_name || 'Shared link'}</strong><small>{new Date(row.created_at).toLocaleString('en-ZA', {dateStyle: 'medium', timeStyle: 'short'})}</small><span className={styles.status} data-revoked={Boolean(row.revoked_at)}>{row.revoked_at ? 'Access revoked' : 'Active'}</span></div>
   <div className={styles.actions}>{row.revoked_at ? <span className={styles.revoked}>This link no longer grants access</span> : <><a href={`/asset-share/${row.token}`} target="_blank" rel="noreferrer">Open<span className={styles.srOnly}> shared link in a new tab</span><span aria-hidden="true"> ↗</span></a><button className={styles.revoke} type="button" disabled={busy} onClick={() => void revoke(row.token)}>Revoke access</button></>}</div>
  </article>)}</div>}
  <footer><button type="button" onClick={onBack}>← Share options</button><span className={styles.page}>Page {offset / 5 + 1}</span>{offset > 0 && <button type="button" disabled={busy} onClick={() => setOffset(offset - 5)}>Previous</button>}{more && <button type="button" disabled={busy} onClick={() => setOffset(offset + 5)}>Next</button>}</footer>
 </div>;
}
