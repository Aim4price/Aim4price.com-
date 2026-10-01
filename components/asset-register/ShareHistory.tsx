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
export default function ShareHistory({ assetIds, umbrellaId, mode, onBack }: {
    assetIds: string[];
    umbrellaId?: string;
    mode: 'history' | 'revoke';
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
  <p>{mode === 'revoke' ? 'Choose the link whose access you want to revoke. Other shares stay active.' : 'Your created links. A copied link does not confirm that it was sent or opened.'}</p>
  {error && <p role="alert">{error}</p>}
  {!rows.length ? <p>{busy ? 'Loading…' : 'No links have been created for this selection.'}</p> : <div className={styles.list}>{rows.map(row => <article className={styles.row} key={row.token}>
   <div><strong>{row.recipient_name || row.recipient_email || row.umbrella_name || 'Shared link'}</strong><small>{new Date(row.created_at).toLocaleString('en-ZA')} · {row.revoked_at ? 'Revoked' : 'Active'}</small></div>
   {!row.revoked_at && (mode === 'revoke' ? <button type="button" disabled={busy} onClick={() => void revoke(row.token)}>Revoke access</button> : <a href={`/asset-share/${row.token}`} target="_blank" rel="noreferrer">Open link</a>)}
  </article>)}</div>}
  <footer><button type="button" onClick={onBack}>Back</button>{offset > 0 && <button type="button" disabled={busy} onClick={() => setOffset(offset - 5)}>Previous</button>}{more && <button type="button" disabled={busy} onClick={() => setOffset(offset + 5)}>Next</button>}</footer>
 </div>;
}
