'use client';

import { useState } from 'react';
import type { AssetPart } from '../lib/asset-parts';
import type { MaintenanceWorkPart } from '../lib/maintenance-catalogue';
import ItemActionButton from './ItemActionButton';
import styles from './DesktopServiceModal.module.css';

export type ServiceWorkDetail = { label: string; parts: MaintenanceWorkPart[] };

export default function ServiceWorkItem({ itemKey, value, description, selected, busy, referenceParts, partsError, reloadParts, editor, setEditor, onToggle, onChange, onRemove }: {
  itemKey: string; value: ServiceWorkDetail; description?: string; selected: boolean; busy: boolean;
  referenceParts: AssetPart[]; partsError: string; reloadParts: () => void;
  editor: string | null; setEditor: (value: string | null) => void;
  onToggle: () => void; onChange: (value: ServiceWorkDetail) => void; onRemove?: () => void;
}) {
  const [name, setName] = useState('');
  const [part, setPart] = useState<MaintenanceWorkPart>({ name: '', partNumber: '', brand: '' });
  const [error, setError] = useState('');
  const editing = editor === `${itemKey}:edit`, adding = editor === `${itemKey}:parts`;
  const validText = (text: string) => !!text.trim() && !/[\r\n\u0000-\u001f]/.test(text);
  function addPart(next: MaintenanceWorkPart) {
    if (!validText(next.name) || !validText(next.partNumber)) { setError('Enter a part name and number.'); return; }
    if (value.parts.length >= 20) { setError('Add up to 20 parts per work item.'); return; }
    if (value.parts.some(p => p.name === next.name && p.partNumber === next.partNumber && p.brand === next.brand)) { setError('This part is already added.'); return; }
    onChange({ ...value, parts: [...value.parts, next] });
    setPart({ name: '', partNumber: '', brand: '' }); setError('');
  }
  return <div className={styles.workRow}>
    <div className={styles.workRowMain}>
      <button type="button" className={selected ? styles.checkOptionSelected : styles.checkOption} onClick={onToggle} aria-pressed={selected} disabled={busy}>
        <span className={styles.checkbox} aria-hidden="true">{selected ? <svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="2" d="m5 12 4 4L19 7" /></svg> : null}</span>
        <span><strong>{value.label}</strong>{description ? <small>{description}</small> : null}
          {value.parts.map((p, index) => <small key={index}>{p.name} · {p.partNumber}{p.brand ? ` · ${p.brand}` : ''}</small>)}
        </span>
      </button>
      <div className={styles.workActions}>
        <ItemActionButton action="edit" name={value.label} disabled={busy} onClick={() => { setName(value.label); setError(''); setEditor(editing ? null : `${itemKey}:edit`); }} />
        <button type="button" className={styles.partsAction} aria-label={`Add parts to ${value.label}`} title={`Add parts to ${value.label}`} aria-expanded={adding} disabled={busy} onClick={() => { setError(''); setEditor(adding ? null : `${itemKey}:parts`); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5" /></svg>
        </button>
        {onRemove ? <ItemActionButton action="delete" name={value.label} disabled={busy} onClick={onRemove} /> : null}
      </div>
    </div>
    {editing ? <div className={styles.workEditor} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); if (event.key === 'Escape') { event.stopPropagation(); setEditor(null); } }}>
      <label className={styles.field}><span>Work item</span><input autoFocus aria-label="Work item name" maxLength={160} value={name} onChange={event => setName(event.target.value)} /></label>
      <small>For this record</small>
      <div className={styles.editorActions}><button type="button" className={styles.cancelButton} onClick={() => setEditor(null)}>Cancel</button><button type="button" className={styles.submitButton} disabled={busy || !validText(name)} onClick={() => { onChange({ ...value, label: name.trim() }); setEditor(null); }}>Save</button></div>
    </div> : null}
    {adding ? <div className={styles.workEditor} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); if (event.key === 'Escape') { event.stopPropagation(); setEditor(null); } }}>
      <strong>Parts used</strong>
      {partsError ? <p role="alert">{partsError} <button type="button" onClick={reloadParts}>Retry</button></p> : null}
      {referenceParts.length ? <label className={styles.field}><span>Saved parts</span><select aria-label="Choose saved part" value="" disabled={busy} onChange={event => { const saved = referenceParts.find(p => p.id === event.target.value); if (saved) addPart({ name: saved.name, partNumber: saved.partNumber, brand: saved.brand }); }}><option value="">Choose a part…</option>{referenceParts.map(p => <option key={p.id} value={p.id}>{p.name} · {p.partNumber}{p.brand ? ` · ${p.brand}` : ''}</option>)}</select></label> : <small>No saved parts. Enter one below.</small>}
      {value.parts.length ? <ul className={styles.attachedParts}>{value.parts.map((p, index) => <li key={index}><span><strong>{p.name}</strong><small>{p.partNumber}{p.brand ? ` · ${p.brand}` : ''}</small></span><ItemActionButton action="delete" name={`${p.name} from this work`} disabled={busy} onClick={() => onChange({ ...value, parts: value.parts.filter((_, i) => i !== index) })} /></li>)}</ul> : null}
      <div className={styles.partEntry}>
        <label className={styles.field}><span>Part name</span><input aria-label="Part name" maxLength={160} value={part.name} onChange={event => setPart({ ...part, name: event.target.value })} /></label>
        <label className={styles.field}><span>Part number</span><input aria-label="Part number" maxLength={120} value={part.partNumber} onChange={event => setPart({ ...part, partNumber: event.target.value })} /></label>
        <label className={styles.field}><span>Brand</span><input aria-label="Part brand" placeholder="Brand (optional)" maxLength={120} value={part.brand} onChange={event => setPart({ ...part, brand: event.target.value })} /></label>
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <div className={styles.editorActions}><button type="button" className={styles.cancelButton} disabled={busy || !part.name.trim() || !part.partNumber.trim()} onClick={() => addPart({ name: part.name.trim(), partNumber: part.partNumber.trim(), brand: part.brand.trim() })}>Add part</button><button type="button" className={styles.submitButton} onClick={() => { if (part.name.trim() || part.partNumber.trim() || part.brand.trim()) { setError('Add the part before closing, or clear its fields.'); return; } setEditor(null); }}>Done</button></div>
    </div> : null}
  </div>;
}
