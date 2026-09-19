'use client';
import { useCallback, useEffect, useState } from 'react';
import styles from './AdminCaptureAssistance.module.css';
type Row = { id: string; owner_name: string; owner_email: string; actor_name: string; actor_email: string;
  request_type: string; shown_at: string; requested_at: string | null; resolved_at: string | null; note: string };
const date = (value: string) => new Date(value).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short' });
export default function AdminCaptureAssistance() {
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [pending, setPending] = useState(0);
  const [offset, setOffset] = useState(0);
  const [openOnly, setOpenOnly] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/capture-assistance?open=${openOnly ? 1 : 0}&offset=${offset}`, { cache: 'no-store', credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRows(data.rows); setTotal(data.total); setPending(data.pending); setError('');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not load activity.'); }
  }, [openOnly, offset]);
  useEffect(() => { void load(); const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 30000); return () => window.clearInterval(timer); }, [load]);
  async function resolve(row: Row) {
    setBusy(row.id);
    try {
      const response = await fetch('/api/admin/capture-assistance', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, resolved: !row.resolved_at }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : 'Update failed.'); }
    finally { setBusy(''); }
  }
  return <section className={styles.panel} aria-label="Capture limits and assistance">
    <button type="button" className={styles.toggle} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Capture limits & assistance <strong>{pending} awaiting contact</strong><span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
    {error ? <p role="alert">{error} <button type="button" onClick={() => void load()}>Retry</button></p> : null}
    {expanded ? <div className={styles.body}>
      <p>See who reached a daily limit and who requested help. All times are South African time.</p>
      <label><input type="checkbox" checked={openOnly} onChange={event => { setOpenOnly(event.target.checked); setOffset(0); }} /> Outstanding follow-ups only</label>
      {!rows.length ? <p>No capture-limit activity to show.</p> : <div className={styles.tableWrap}><table><thead><tr><th>Account / contact</th><th>Ledger</th><th>Modal shown</th><th>Assistance</th><th>Follow-up</th></tr></thead><tbody>
        {rows.map(row => <tr key={row.id}>
          <td><strong>{row.owner_name}</strong><br />{row.owner_email}<br /><small>Opened by {row.actor_name || row.actor_email} · {row.actor_email}</small></td>
          <td>{row.request_type === 'invoice' ? 'Cost' : 'Fuel'}</td>
          <td>{date(row.shown_at)}</td>
          <td>{row.requested_at ? <><strong>Requested</strong><br />{date(row.requested_at)}</> : 'Modal shown only'}{row.note ? <p>{row.note}</p> : null}</td>
          <td>{row.resolved_at ? <p>Followed up {date(row.resolved_at)}</p> : null}<button type="button" disabled={!!busy} onClick={() => void resolve(row)}>{busy === row.id ? 'Saving…' : row.resolved_at ? 'Reopen' : 'Mark followed up'}</button></td>
        </tr>)}
      </tbody></table></div>}
      <div className={styles.pages}><button type="button" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button><span>{total ? `${offset + 1}–${Math.min(offset + 50, total)} of ${total}` : '0 records'}</span><button type="button" disabled={offset + 50 >= total} onClick={() => setOffset(offset + 50)}>Next</button></div>
    </div> : null}
  </section>;
}
