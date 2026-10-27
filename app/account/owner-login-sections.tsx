'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './owner-login-sections.module.css';

type Section = 'overview' | 'details' | 'permissions' | 'assets' | 'passcode' | 'status';
type RecordInfo = { id: string; displayName: string; username: string; accessRole?: string; isActive: boolean; lastLoginAtIso: string | null; updatedAtIso: string };
type Props = {
  record: RecordInfo; busy: boolean; accountName: string | null; passwordMinimum: number; passwordMaximum: number;
  onSave: (changes: Record<string, unknown>, message: string) => Promise<boolean>;
  onToggle: () => void; onDelete: () => void; onBack: () => void;
  onDirtyChange: (dirty: boolean) => void; hasUnsavedChanges: boolean;
  renderAssetAccess: (onSaved: () => void) => ReactNode;
};
const roles = [
  { value: 'view_only', label: 'View only', text: 'View assets and records without making changes.' },
  { value: 'operations', label: 'Operations', text: 'Update usage, maintenance, fuel, location, photos and problems.' },
  { value: 'admin', label: 'Owner / Admin', text: 'Full access, including values, finance, Marketplace and deletion.' },
];
export function AccessSectionIcon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name === 'details' ? <><circle cx="12" cy="7" r="3.5"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/></> : name === 'permissions' ? <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></> : name === 'assets' ? <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></> : <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>}</svg>;
}
function date(value: string | null) { return value ? new Date(value).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'; }
export default function OwnerLoginSections(props: Props) {
  const { record, busy } = props;
  const [section, setSection] = useState<Section>('overview');
  const [name, setName] = useState(record.displayName);
  const [username, setUsername] = useState(record.username);
  const [role, setRole] = useState(record.accessRole || 'operations');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const dirty = section === 'details' ? name !== record.displayName || username !== record.username : section === 'permissions' ? role !== record.accessRole : section === 'passcode' ? !!passcode : false;
  useEffect(() => { if (section !== 'assets') props.onDirtyChange(dirty); }, [dirty, section, props.onDirtyChange]);
  useEffect(() => { heading.current?.focus(); }, [section]);
  function open(next: Section) {
    if (busy) return;
    setName(record.displayName); setUsername(record.username); setRole(record.accessRole || 'operations');
    setPasscode(''); setShowPasscode(false); setError(''); props.onDirtyChange(false); setSection(next);
  }
  function back() {
    if (busy) return;
    // Asset selection uses the parent's dirty guard too.
    props.onBack();
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    let changes: Record<string, unknown>;
    if (section === 'details') {
      if (!name.trim() || username.trim().length < 3) { setError('Enter a name and a username of at least 3 characters.'); return; }
      changes = { displayName: name.trim(), username: username.trim().toLowerCase() };
    } else if (section === 'permissions') changes = { accessRole: role };
    else {
      if (passcode.length < props.passwordMinimum) { setError(`Use at least ${props.passwordMinimum} characters.`); return; }
      changes = { password: passcode };
    }
    if (await props.onSave(changes, section === 'passcode' ? 'Passcode updated.' : 'Changes saved.')) open('overview');
  }
  const cards: { id: Section; title: string; text: string; value: string }[] = [
    { id: 'details', title: 'Login details', text: 'Change their name or username.', value: record.username },
    { id: 'permissions', title: 'Permissions', text: 'Choose what they can do.', value: roles.find(r => r.value === record.accessRole)?.label || 'Operations' },
    { id: 'assets', title: 'Asset access', text: 'Choose which assets they can access.', value: record.accessRole === 'admin' ? 'All assets' : 'Manage asset selection' },
    { id: 'passcode', title: 'Passcode', text: 'Set a new login passcode.', value: 'Change passcode' },
  ];
  const title = section === 'status' ? 'Manage login status' : cards.find(c => c.id === section)?.title;
  return <div className={styles.manager}>
    <div className={styles.toolbar}>
      {section === 'overview' ? <button type="button" onClick={back} disabled={busy}>‹ All logins</button> : <button type="button" disabled={busy} onClick={() => { if (!(dirty || props.hasUnsavedChanges) || window.confirm('Discard unsaved changes?')) open('overview'); }}>‹ Back</button>}
      <span className={styles.status} data-active={record.isActive}>{record.isActive ? 'Active' : 'Inactive'}</span>
    </div>
    {section === 'overview' ? <>
      <h3 ref={heading} tabIndex={-1} className={styles.sectionTitle}>What would you like to change?</h3>
      <div className={styles.grid}>{cards.map(card => <button key={card.id} type="button" className={styles.card} onClick={() => open(card.id)}>
        <span className={styles.icon}><AccessSectionIcon name={card.id}/></span><span className={styles.copy}><strong>{card.title}</strong><span>{card.text}</span><small>{card.value}</small></span>
      </button>)}</div>
      <button type="button" className={styles.statusLink} onClick={() => open('status')}>Manage login status</button>
    </> : <>
      <h3 ref={heading} tabIndex={-1} className={styles.sectionTitle}>{title}</h3>
      {section === 'assets' ? record.accessRole === 'admin' ? <div className={styles.info}>Owner / Admin has access to all umbrellas and assets. Change their permissions to limit asset access.</div> : props.renderAssetAccess(() => open('overview')) : section === 'status' ? <>
        <dl className={styles.history}><div><dt>Last login</dt><dd>{date(record.lastLoginAtIso)}</dd></div><div><dt>Last updated</dt><dd>{date(record.updatedAtIso)}</dd></div></dl>
        <div className={styles.statusAction}><div><strong>{record.isActive ? 'Deactivate login' : 'Activate login'}</strong><p>{record.isActive ? 'Stop sign-in access. You can activate it again later.' : 'Allow this person to sign in again.'}</p></div><button type="button" disabled={busy} onClick={props.onToggle}>{record.isActive ? 'Deactivate' : 'Activate'}</button></div>
        <div className={styles.statusAction}><div><strong>Delete login</strong><p>Permanently remove this login.</p></div><button type="button" className={styles.danger} disabled={busy} onClick={props.onDelete}>Delete</button></div>
      </> : <form onSubmit={save}>
        <fieldset disabled={busy} className={styles.fields}>
          {section === 'details' ? <>
            <label>Display name<input value={name} onChange={e => setName(e.target.value)} required /></label>
            <label>Username<input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} required minLength={3} autoCapitalize="none" autoComplete="off" spellCheck={false}/></label>
            <p className={styles.hint}>This is an app username, not an email address.</p>
            {props.accountName && !username.endsWith(`@${props.accountName}`) ? <button type="button" onClick={() => setUsername(`${username.split('@')[0]}@${props.accountName}`)}>Use business username</button> : null}
          </> : section === 'permissions' ? <div className={styles.choices}>{roles.map(option => <label key={option.value} className={styles.choice} data-selected={role === option.value}><input type="radio" name="owner-role" value={option.value} checked={role === option.value} onChange={() => setRole(option.value)}/><span><strong>{option.label}</strong><small>{option.text}</small></span></label>)}</div> : <>
            <label>New passcode<div className={styles.password}><input type={showPasscode ? 'text' : 'password'} value={passcode} onChange={e => setPasscode(e.target.value)} required minLength={props.passwordMinimum} maxLength={props.passwordMaximum} autoComplete="new-password"/><button type="button" aria-pressed={showPasscode} onClick={() => setShowPasscode(!showPasscode)}>{showPasscode ? 'Hide' : 'Show'}</button></div></label>
            <p className={styles.hint}>Use at least {props.passwordMinimum} characters. Share the new passcode with this person.</p>
          </>}
        </fieldset>
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        <footer className={styles.footer}><button type="submit" className={styles.primary} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</button></footer>
      </form>}
    </>}
  </div>;
}
