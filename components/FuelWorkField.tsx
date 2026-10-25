'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { appRealmForPath } from '../lib/app-realm';
import { DEFAULT_FUEL_WORK_CHOICES, fuelActivityChoices, fuelActivityProfile, fuelActivitySuggestions, type FuelActivityAsset, type FuelWorkChoice } from '../lib/fuel-work-choice-options';
import styles from './FuelWorkField.module.css';

export default function FuelWorkField({ value, onChange, choices: provided, asset, invalid, autoFocus = false, dropdown = false, guided = false }: {
  asset?: FuelActivityAsset | null; value: string; onChange: (value: string) => void; choices?: FuelWorkChoice[]; invalid?: boolean; autoFocus?: boolean; dropdown?: boolean; guided?: boolean;
}) {
  const hintId = useId();
  const chooserRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [manual, setManual] = useState(false);
  const [entryMode, setEntryMode] = useState<'saved' | 'manual' | null>(null);
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
  const visibleChoices = fuelActivityChoices(choices, asset);
  const examples = fuelActivitySuggestions(asset).slice(0, 2).map(c => c.name.toLowerCase()).join(" or ");
  const editable = provided === undefined && revision !== null;
  return <div tabIndex={guided ? -1 : undefined} data-fuel-slip-field={guided ? "activityText" : undefined} aria-invalid={guided ? invalid : undefined} className={`${styles.field} ${dropdown ? styles.dropdownField : ''} ${guided ? styles.guidedField : ''}`}>
    {guided ? <div className={styles.entryModes} role="group" aria-label="How to enter the activity">
      <button type="button" aria-pressed={entryMode === 'saved'} onClick={() => { setEntryMode('saved'); setManual(false); requestAnimationFrame(() => { if (chooserRef.current) chooserRef.current.open = true; summaryRef.current?.focus(); }); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 8h10M7 12h10M7 16h6" /></svg>
        <span>Choose activity<small>Use a saved activity</small></span>
      </button>
      <button type="button" aria-pressed={entryMode === 'manual'} onClick={() => { setEntryMode('manual'); setManual(true); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m15 4 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14z" /></svg>
        <span>Enter manually<small>Describe the work</small></span>
      </button>
    </div> : null}
    {(!dropdown && !guided) || manual ? <>
    <input aria-label="Work activity" aria-describedby={hintId} aria-invalid={invalid} data-fuel-slip-field="activityText" value={value} maxLength={120} onChange={event => onChange(event.target.value)} placeholder="Choose saved work or describe the job" autoFocus={autoFocus || ((dropdown || guided) && manual)} />
    <p id={hintId} className={styles.hint}>Describe the work, for example: {examples}. Add the job or destination if useful.</p>
    </> : null}
    <details hidden={guided && entryMode !== 'saved'} ref={chooserRef} className={styles.choices} onKeyDown={event => { if (event.key === 'Escape' && chooserRef.current?.open) { event.stopPropagation(); chooserRef.current.open = false; summaryRef.current?.focus(); } }}>
      <summary ref={summaryRef} aria-label={dropdown || guided ? 'Choose saved activity' : undefined} aria-invalid={(dropdown || guided) && !manual ? invalid : undefined} data-fuel-slip-field={dropdown && !manual ? 'activityText' : undefined}>
        {dropdown || guided ? <><span>{value || 'Choose an activity'}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></> : 'Saved Activities'}
      </summary>
      <div className={styles.list} hidden={guided && Boolean(editing || deleting)}>
        {visibleChoices.map(choice => <div className={styles.row} key={choice.id}>
          <button type="button" className={styles.select} aria-pressed={guided ? value === choice.name : undefined} onClick={() => { onChange(choice.name); if (dropdown || guided) { setManual(false); if (chooserRef.current) chooserRef.current.open = false; summaryRef.current?.focus(); } }}>{choice.name}</button>
          {editable && choices.some(c => c.id === choice.id) ? <><button type="button" className={styles.edit} disabled={busy} aria-label={`Edit ${choice.name}`} onClick={() => { setEditing(choice); setDeleting(null); setName(choice.name); }}><svg viewBox="0 0 24 24"><path d="m15 4 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14z" /></svg></button><button type="button" className={styles.delete} disabled={busy} aria-label={`Delete ${choice.name}`} onClick={() => { setDeleting(choice); setEditing(null); }}><svg viewBox="0 0 24 24"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" /></svg></button></> : null}
        </div>)}
        {!visibleChoices.length ? <p>No saved work yet. Use manual entry to describe the activity.</p> : null}
      </div>

      {editable && !editing && !deleting ? <button type="button" className={styles.add} onClick={() => { setName(''); setEditing({ id: crypto.randomUUID(), name: '', profile: fuelActivityProfile(asset) }); }}>+ Add work</button> : null}
      {editing ? <div className={styles.editor}><input aria-label="Work choice name" maxLength={120} value={name} onChange={e => setName(e.target.value)} disabled={busy} /><div className={styles.actions}><button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button type="button" disabled={busy || name.trim().length < 2} onClick={() => void save(choices.some(c => c.id === editing.id) ? choices.map(c => c.id === editing.id ? { ...c, name } : c) : [...choices, { ...editing, name }])}>{busy ? 'Saving…' : 'Save'}</button></div></div> : null}
      {deleting ? <div className={styles.editor}><p>Delete “{deleting.name}” from saved work? Existing fuel records stay unchanged.</p><div className={styles.actions}><button type="button" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button type="button" className={styles.delete} disabled={busy} onClick={() => void save(choices.filter(c => c.id !== deleting.id))}>Delete</button></div></div> : null}
    </details>
    {dropdown && !guided ? <button type="button" className={styles.manualToggle} onClick={() => { setManual(!manual); if (!guided && chooserRef.current) chooserRef.current.open = false; }}>{manual ? 'Use saved activity' : 'Enter activity manually'}</button> : null}
    {guided && entryMode !== 'manual' && value ? <p className={styles.hint}>Selected activity: <strong>{value}</strong></p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
  </div>;
}
