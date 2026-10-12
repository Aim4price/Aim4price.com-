'use client';
import { useEffect, useState } from 'react';
import { appRealmForPath } from '../lib/app-realm';
import { DEFAULT_FUEL_WORK_CHOICES, type FuelWorkChoice } from '../lib/fuel-work-choice-options';
import styles from './FuelWorkField.module.css';

export default function FuelWorkField({ value, onChange, choices: provided, invalid, autoFocus = false }: {
  value: string; onChange: (value: string) => void; choices?: FuelWorkChoice[]; invalid?: boolean; autoFocus?: boolean;
}) {
  const [choices, setChoices] = useState(provided ?? DEFAULT_FUEL_WORK_CHOICES);
  const [revision, setRevision] = useState<number | null>(null);
  const [editing, setEditing] = useState<FuelWorkChoice | null>(null);
  const [deleting, setDeleting] = useState<FuelWorkChoice | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const headers = () => ({ 'Content-Type': 'application/json', 'x-aim4price-client-realm': appRealmForPath(window.location.pathname) ?? 'website' });
  useEffect(() => {
    if (provided) { setChoices(provided); return; }
    let active = true;
    fetch('/api/fuel/work-choices', { credentials: 'include', cache: 'no-store', headers: headers() })
      .then(async response => { if (!response.ok) throw new Error('Saved work choices could not be loaded. You can still type the activity.'); return response.json(); })
      .then(data => { if (active) { setChoices(data.choices); setRevision(data.revision); } })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [provided]);
  async function save(next: FuelWorkChoice[]) {
    if (busy || revision === null) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/fuel/work-choices', { method: 'PUT', credentials: 'include', headers: headers(), body: JSON.stringify({ choices: next, revision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save work choices.');
      setChoices(data.choices); setRevision(data.revision); setEditing(null); setDeleting(null); setName('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save work choices.'); }
    finally { setBusy(false); }
  }
  const editable = provided === undefined && revision !== null;
  return <div className={styles.field}>
    <input aria-label="Work activity" aria-invalid={invalid} data-fuel-slip-field="activityText" value={value} maxLength={120} onChange={event => onChange(event.target.value)} placeholder="Choose saved work or describe the job" autoFocus={autoFocus} />
    <details className={styles.choices}>
      <summary>Saved work</summary>
      <div className={styles.list}>
        {choices.map(choice => <div className={styles.row} key={choice.id}>
          <button type="button" className={styles.select} onClick={() => onChange(choice.name)}>{choice.name}</button>
          {editable ? <><button type="button" className={styles.edit} disabled={busy} aria-label={`Edit ${choice.name}`} onClick={() => { setEditing(choice); setDeleting(null); setName(choice.name); }}><svg viewBox="0 0 24 24"><path d="m15 4 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14z" /></svg></button><button type="button" className={styles.delete} disabled={busy} aria-label={`Delete ${choice.name}`} onClick={() => { setDeleting(choice); setEditing(null); }}><svg viewBox="0 0 24 24"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" /></svg></button></> : null}
        </div>)}
        {!choices.length ? <p>No saved work yet. Type the activity above.</p> : null}
      </div>
      {editable && !editing && !deleting ? <button type="button" className={styles.add} onClick={() => { setName(''); setEditing({ id: crypto.randomUUID(), name: '' }); }}>+ Add work</button> : null}
      {editing ? <div className={styles.editor}><input aria-label="Work choice name" maxLength={120} value={name} onChange={e => setName(e.target.value)} disabled={busy} /><div className={styles.actions}><button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button type="button" disabled={busy || name.trim().length < 2} onClick={() => void save(choices.some(c => c.id === editing.id) ? choices.map(c => c.id === editing.id ? { ...c, name } : c) : [...choices, { ...editing, name }])}>{busy ? 'Saving…' : 'Save'}</button></div></div> : null}
      {deleting ? <div className={styles.editor}><p>Delete “{deleting.name}” from saved work? Existing fuel records stay unchanged.</p><div className={styles.actions}><button type="button" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button type="button" className={styles.delete} disabled={busy} onClick={() => void save(choices.filter(c => c.id !== deleting.id))}>Delete</button></div></div> : null}
    </details>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
  </div>;
}
