'use client';
import { useEffect, useState } from 'react';
import { TEAM_TEMPLATES, TEAM_PERMISSION_GROUPS, OWNER_TEAM_PERMISSIONS, normalizeTeamPermissions, updateTeamPermission, type TeamPermissions } from '../../lib/team-access-policy';
import styles from './owner-login-sections.module.css';

export default function ManagerPermissionsPanel({ permissions, userId, documentAccess = 'none', documentIds = [], excludedDocumentIds = [], fuelStorageIds = null, onSave, onDirtyChange, onSaved }: {
  userId: string; documentAccess?: 'none' | 'selected' | 'all'; documentIds?: string[]; excludedDocumentIds?: string[]; fuelStorageIds?: string[] | null;
  permissions: TeamPermissions; onSave: (changes: Record<string, unknown>, message?: string) => Promise<unknown>;
  onDirtyChange: (dirty: boolean) => void; onSaved: () => void;
}) {
  const [draft, setDraft] = useState(() => normalizeTeamPermissions(permissions));
  const [docs, setDocs] = useState<{id:string;title:string;fileName:string}[]>([]), [tanks, setTanks] = useState<{id:string;name:string}[]>([]);
  const [docMode,setDocMode] = useState(documentAccess), [selectedDocs,setSelectedDocs] = useState(documentIds), [excludedDocs,setExcludedDocs] = useState(excludedDocumentIds), [selectedTanks,setSelectedTanks] = useState(fuelStorageIds);
  useEffect(() => { const controller=new AbortController(); fetch(`/api/owner-app/users/${encodeURIComponent(userId)}/access`,{cache:'no-store',signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(!controller.signal.aborted){setDocs(data.documents || []);setTanks(data.tanks || []);}}).catch(()=>{if(!controller.signal.aborted)setError('Could not load document and tank choices. Reopen Permissions to try again.');}); return ()=>controller.abort(); },[userId]);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  function change(next: TeamPermissions) { setDraft(next); onDirtyChange(true); }
  async function save() {
    setBusy(true); setError('');
    try { const result = await onSave({ permissions: draft, accessRole: Object.entries(TEAM_TEMPLATES).find(([, role]) => JSON.stringify(role.permissions) === JSON.stringify(draft))?.[0] || 'manager', documentAccess: docMode, documentIds: selectedDocs, excludedDocumentIds: excludedDocs, fuelStorageIds: selectedTanks }, 'Permissions saved.'); if (result === false) return; onDirtyChange(false); onSaved(); }
    catch { setError('Could not save permissions. Please try again.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.permissionPanel} aria-label="Manager permissions">
    <p>Choose a starting role, then adjust access to each page. Asset access is chosen separately.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBlock: 16 }}>
      {Object.entries(TEAM_TEMPLATES).map(([key, role]) => <button type="button" key={key} disabled={busy} aria-pressed={JSON.stringify(draft) === JSON.stringify(role.permissions)} onClick={() => change({ ...role.permissions })}>{role.label}</button>)}
    </div>
    <p>{draft.viewValues ? 'Asset values visible' : 'Asset values hidden'} · Documents require separate approval.</p>
    {TEAM_PERMISSION_GROUPS.map(group => <details key={group.label} style={{ border: '1px solid var(--border, #d6e4dd)', borderRadius: 14, padding: 16, marginBlock: 10 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{group.label} <span style={{ float: 'right', fontWeight: 400 }}>{group.keys.filter(key => draft[key]).length} of {group.keys.length} allowed</span></summary>
      {group.keys.map(key => { const permission = OWNER_TEAM_PERMISSIONS.find(p => p.key === key)!; return <label key={key} style={{ display: 'flex', alignItems: 'start', gap: 12, paddingBlock: 12 }}>
        <input type="checkbox" checked={draft[key]} disabled={busy} onChange={e => change(updateTeamPermission(draft, key, e.target.checked))}/>
        <span>{permission.label}<small style={{ display: 'block', fontWeight: 400, marginTop: 4 }}>{permission.detail}</small></span>
      </label>; })}
    </details>)}
    <details style={{ border: '1px solid #d6e4dd', borderRadius: 14, padding: 16, marginBlock: 10 }}><summary>Document access</summary>
      <p>Only documents attached to permitted assets are available. Uploaded documents need approval.</p>
      <select aria-label="Document access" value={docMode} disabled={busy} onChange={e=>{setDocMode(e.target.value as typeof docMode);onDirtyChange(true);}}>
        <option value="none">No documents</option><option value="selected">Selected documents</option><option value="all">All in-scope documents, except exclusions</option>
      </select>
      {docMode !== 'none' && <div>{docMode === 'all' && <p>Select any documents to exclude.</p>}{docs.map(doc=><label key={doc.id} style={{display:'flex',gap:10,paddingBlock:10}}><input type="checkbox" checked={(docMode==='all'?excludedDocs:selectedDocs).includes(doc.id)} disabled={busy} onChange={e=>{const list=docMode==='all'?excludedDocs:selectedDocs;const next=e.target.checked?[...list,doc.id]:list.filter(id=>id!==doc.id);if(docMode==='all')setExcludedDocs(next);else setSelectedDocs(next);onDirtyChange(true);}}/>{doc.title || doc.fileName}</label>)}</div>}
    </details>
    <details style={{ border: '1px solid #d6e4dd', borderRadius: 14, padding: 16, marginBlock: 10 }}><summary>Fuel tank access</summary>
      <p>Choose which tanks this person can use when fuel permissions are enabled.</p>
      <label><input type="checkbox" checked={selectedTanks===null} disabled={busy} onChange={e=>{setSelectedTanks(e.target.checked?null:[]);onDirtyChange(true);}}/> All current and future tanks</label>
      {selectedTanks!==null && tanks.map(tank=><label key={tank.id} style={{display:'flex',gap:10,paddingBlock:10}}><input type="checkbox" disabled={busy} checked={selectedTanks.includes(tank.id)} onChange={e=>{setSelectedTanks(e.target.checked?[...selectedTanks,tank.id]:selectedTanks.filter(id=>id!==tank.id));onDirtyChange(true);}}/>{tank.name}</label>)}
    </details>
    {error && <p role="alert">{error}</p>}
    <button type="button" className={styles.primary} disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save permissions'}</button>
  </section>;
}
