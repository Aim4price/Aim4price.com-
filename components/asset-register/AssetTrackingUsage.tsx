'use client';
import { useEffect, useId, useState } from 'react';
import styles from './AssetTrackingUsage.module.css';
type Usage = {enabled: boolean; metric: string; reading: number | null; estimated: boolean; baselineValue: number | null; baselineAt: string | null; lastTrackedAt: string | null; events?: {id: string; action: string; reading: number; metric: string; created_at: string}[]};
const number = (value: number | null) => value == null ? 'Not captured' : value.toLocaleString('en-ZA', {maximumFractionDigits: 2});
const date = (value: string) => new Date(value).toLocaleString('en-ZA', {timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short'});
export default function AssetTrackingUsage({assetId}: {assetId: string}) {
  const id = useId();
  const [usage, setUsage] = useState<Usage | null>(null), [error, setError] = useState('');
  const [editing, setEditing] = useState(false), [reading, setReading] = useState(''), [busy, setBusy] = useState(false);
  const endpoint = `/api/asset-register/${encodeURIComponent(assetId)}/tracking/usage`;
  useEffect(() => {
    let gone = false;
    const refresh = async () => {
      try { const response = await fetch(endpoint, {cache: 'no-store'}); const data = await response.json();
        if (!response.ok) throw Error(data.error || 'Could not load usage.');
        if (!gone) {setUsage(data); setError('');}
      } catch (e) {if (!gone) setError(e instanceof Error ? e.message : 'Could not load usage.');}
    };
    void refresh(); const timer = setInterval(refresh, 30000);
    return () => {gone = true; clearInterval(timer);};
  }, [endpoint]);
  async function save(action: 'enable' | 'pause' | 'confirm') {
    if (busy || !usage) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action, enabled: action === 'enable' || (action === 'confirm' && usage.enabled), reading: Number(reading)})});
      const data = await response.json(); if (!response.ok) throw Error(data.error || 'Could not save usage.');
      setUsage(data); setEditing(false);
      window.dispatchEvent(new CustomEvent('aim4price:asset-register-updated', {detail: {assetId}}));
    } catch (e) {setError(e instanceof Error ? e.message : 'Could not save usage.');} finally {setBusy(false);}
  }
  if (!usage) return <div className={styles.card}><p role={error ? 'alert' : 'status'}>{error || 'Loading automatic usage…'}</p></div>;
  if (!['hours','km'].includes(usage.metric)) return null;
  const valid = reading.trim() !== '' && Number.isFinite(Number(reading)) && Number(reading) >= 0 && Number(reading) < 1e12;
  return <section className={styles.card} aria-labelledby={`${id}-title`}>
    <div className={styles.heading}><span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg></span><div><h4 id={`${id}-title`}>Automatic {usage.metric === 'hours' ? 'hours' : 'kilometres'}</h4><p>{usage.metric === 'hours' ? 'Add tracked moving time to estimated hours.' : 'Add tracked distance to estimated kilometres.'}</p></div><span className={styles.badge}>{usage.enabled ? 'On' : 'Off'}</span></div>
    <div className={styles.reading}><strong>{number(usage.reading)} <small>{usage.metric}</small></strong><span>{usage.estimated ? 'Estimated from tracking' : 'Meter reading'}</span></div>
    {usage.baselineAt && <p className={styles.note}>Last confirmed: {number(usage.baselineValue)} {usage.metric} · {date(usage.baselineAt)}</p>}
    {usage.lastTrackedAt && <p className={styles.note}>Latest recorded location: {date(usage.lastTrackedAt)}</p>}
    {editing ? <form className={styles.form} onSubmit={event => {event.preventDefault(); if (valid) void save(usage.enabled ? 'confirm' : 'enable');}}>
      <label htmlFor={`${id}-reading`}>Current meter reading ({usage.metric})</label>
      <input id={`${id}-reading`} type="number" inputMode="decimal" min="0" step="0.01" required autoFocus value={reading} onChange={event => setReading(event.target.value)} placeholder="Read the machine’s meter" disabled={busy}/>
      <p className={styles.note}>This becomes your starting reading from now. Previous history stays saved.{usage.metric === 'hours' ? ' Moving time is an estimate, not engine-meter hours.' : ''}</p>
      <div className={styles.actions}><button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button><button type="submit" disabled={busy || !valid}>{busy ? 'Saving…' : usage.enabled ? 'Confirm reading' : 'Enable automatic updates'}</button></div>
    </form> : <div className={styles.actions}><button type="button" onClick={() => {setReading(''); setEditing(true);}}>{usage.enabled ? 'Confirm meter reading' : 'Set up automatic updates'}</button>{usage.enabled && <button type="button" disabled={busy} onClick={() => void save('pause')}>{busy ? 'Saving…' : 'Pause updates'}</button>}</div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!!usage.events?.length && <details className={styles.history}><summary>Reading history</summary><ol>{usage.events.map(event => <li key={event.id}><div><strong>{event.action}</strong><span>{number(Number(event.reading))} {event.metric}</span></div><time dateTime={event.created_at}>{date(event.created_at)}</time></li>)}</ol></details>}
  </section>;
}
