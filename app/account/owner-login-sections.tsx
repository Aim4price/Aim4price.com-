'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './owner-login-sections.module.css';

type Section = 'overview' | 'details' | 'permissions' | 'assets' | 'passcode' | 'status' | 'fuel';
type RecordInfo = { id: string; displayName: string; username: string; accessRole?: string; isActive: boolean; lastLoginAtIso: string | null; updatedAtIso: string };
type Props = {
  dealerPolish?: boolean;
  record: RecordInfo; busy: boolean; accountName: string | null; passwordMinimum: number; passwordMaximum: number;
  onSave: (changes: Record<string, unknown>, message: string) => Promise<boolean>;
  onToggle: () => void; onDelete: () => void; onBack: () => void;
  onDirtyChange: (dirty: boolean) => void; hasUnsavedChanges: boolean;
  renderAssetAccess?: (onSaved: () => void) => ReactNode;
  renderPermissions?: (onSaved: () => void) => ReactNode;
  renderFuelAccess?: (onSaved: () => void) => ReactNode;
  roleOptions?: { value: string; label: string; text: string }[];
  roleField?: 'role' | 'accessRole'; currentRole?: string; passwordLabel?: string;
};
const roles = [
  { value: 'view_only', label: 'View only', text: 'View assets and records.' },
  { value: 'operations', label: 'Operations', text: 'Record usage, maintenance, fuel and field updates.' },
  { value: 'admin', label: 'Owner / Admin', text: 'Full access, including finance and deletion.' },
];
export function AccessSectionIcon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name === 'sales' ? <><path d="M3 4h10l8 8-9 9-9-9Z"/><circle cx="8" cy="9" r="1"/></> : name === 'umbrella' ? <><path d="M3 12a9 9 0 0 1 18 0H3ZM12 12v7a2 2 0 0 0 4 0"/></> : name === 'box' ? <><path d="m3 7 9-4 9 4v10l-9 4-9-4ZM3 7l9 4 9-4M12 11v10"/></> : name === 'eye' ? <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></> : name === 'tools' ? <path d="M14 4a6 6 0 0 0-7 8l-4 5 4 4 5-5a6 6 0 0 0 8-7l-4 4-5-5Z"/> : name === 'login' ? <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/></> : name === 'clock' ? <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></> : name === 'power' ? <><path d="M12 3v9M6 5a9 9 0 1 0 12 0"/></> : name === 'delete' ? <><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></> : name === 'details' ? <><circle cx="12" cy="7" r="3.5"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/></> : name === 'permissions' ? <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></> : name === 'assets' ? <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></> : <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>}</svg>;
}
function date(value: string | null) { return value ? new Date(value).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'; }
export default function OwnerLoginSections(props: Props) {
  const { record, busy } = props;
  const roleOptions = props.roleOptions ?? roles;
  const currentRole = props.currentRole ?? record.accessRole;
  const passwordLabel = props.passwordLabel ?? 'Passcode';
  const [section, setSection] = useState<Section>('overview');
  const [name, setName] = useState(record.displayName);
  const [username, setUsername] = useState(record.username);
  const [role, setRole] = useState(currentRole || roleOptions[0]?.value || '');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const dirty = section === 'details' ? name !== record.displayName || username !== record.username : section === 'permissions' ? role !== currentRole : section === 'passcode' ? !!passcode : false;
  useEffect(() => { if (section !== 'assets' && section !== 'fuel' && !(section === 'permissions' && props.renderPermissions)) props.onDirtyChange(dirty); }, [dirty, section, props.onDirtyChange]);
  useEffect(() => { heading.current?.focus(); }, [section]);
  function open(next: Section) {
    if (busy) return;
    setName(record.displayName); setUsername(record.username); setRole(currentRole || roleOptions[0]?.value || '');
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
    } else if (section === 'permissions') changes = { [props.roleField ?? 'accessRole']: role };
    else {
      if (passcode.length < props.passwordMinimum) { setError(`Use at least ${props.passwordMinimum} characters.`); return; }
      changes = { password: passcode };
    }
    if (await props.onSave(changes, section === 'passcode' ? `${passwordLabel} updated.` : 'Changes saved.')) open('overview');
  }
  const cards: { id: Section; title: string; text: string; value: string }[] = [
    { id: 'details', title: 'Login details', text: 'Change their name or username.', value: record.username },
    { id: 'permissions', title: 'Permissions', text: 'Choose what they can do.', value: roleOptions.find(r => r.value === currentRole)?.label || 'Manage permissions' },
    ...(props.renderAssetAccess ? [{ id: 'assets' as Section, title: 'Asset access', text: 'Choose which assets they can access.', value: currentRole === 'admin' ? 'All assets' : 'Manage asset selection' }] : []),
    ...(props.renderFuelAccess ? [{ id: 'fuel' as Section, title: 'Fuel tank access', text: 'Choose which fuel tanks they can use.', value: 'Manage fuel selection' }] : []),
    { id: 'passcode', title: passwordLabel, text: `Set a new login ${passwordLabel.toLowerCase()}.`, value: `Change ${passwordLabel.toLowerCase()}` },
  ];
  if (props.dealerPolish) cards.push({ id: 'status', title: 'Login status', text: 'Activate, deactivate or remove this login.', value: record.isActive ? 'Active' : 'Inactive' });
  const title = section === 'status' ? 'Manage login status' : cards.find(c => c.id === section)?.title;
  return <div className={`${styles.manager} ${styles.ownerManager} ${props.dealerPolish ? styles.dealerManager : ''}`}>
    <div className={styles.toolbar}>
      {section === 'overview' ? <button type="button" onClick={back} disabled={busy}>‹ All logins</button> : <button type="button" disabled={busy} onClick={() => { if (!(dirty || props.hasUnsavedChanges) || window.confirm('Discard unsaved changes?')) open('overview'); }}>‹ Back</button>}
      <span className={styles.status} data-active={record.isActive}>{record.isActive ? 'Active' : 'Inactive'}</span>
    </div>
    {section === 'overview' ? <>
      <h3 ref={heading} tabIndex={-1} className={styles.sectionTitle}>Manage access</h3>
      <div className={styles.grid}>{cards.map(card => <button key={card.id} type="button" className={styles.card} disabled={busy} onClick={() => open(card.id)}>
        <span className={styles.icon}><AccessSectionIcon name={card.id === 'fuel' ? 'box' : card.id === 'status' ? 'power' : card.id}/></span><span className={styles.copy}><strong>{card.title}</strong><span>{card.text}</span><small>{card.value}</small></span>
      </button>)}</div>
      {!props.dealerPolish ? <button type="button" className={styles.statusLink} onClick={() => open('status')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M12 3v9M6.3 5.8a9 9 0 1 0 11.4 0"/></svg>Manage login status</button> : null}
    </> : <>
      <h3 ref={heading} tabIndex={-1} className={styles.sectionTitle}>{title}</h3>
      {section === 'fuel' ? props.renderFuelAccess?.(() => open('overview')) : section === 'permissions' && props.renderPermissions ? props.renderPermissions(() => open('overview')) : section === 'assets' ? currentRole === 'admin' ? <div className={`${styles.info} ${styles.fullAccess}`}><strong>Full access to all assets</strong><button type="button" onClick={() => open('permissions')}>Change permissions</button></div> : props.renderAssetAccess?.(() => open('overview')) : section === 'status' ? <>
        <dl className={styles.history}><div><dt><AccessSectionIcon name="clock"/>Last login</dt><dd>{date(record.lastLoginAtIso)}</dd></div><div><dt><AccessSectionIcon name="clock"/>Last updated</dt><dd>{date(record.updatedAtIso)}</dd></div></dl>
        <div className={styles.statusAction}><div><strong>{record.isActive ? 'Deactivate login' : 'Activate login'}</strong><p>{record.isActive ? 'Stop sign-in access. You can activate it again later.' : 'Allow this person to sign in again.'}</p></div><button type="button" disabled={busy} onClick={props.onToggle}><AccessSectionIcon name="power"/>{record.isActive ? 'Deactivate' : 'Activate'}</button></div>
        <div className={styles.statusAction}><div><strong>Delete login</strong><p>Permanently remove this login.</p></div><button type="button" className={styles.danger} disabled={busy} onClick={props.onDelete}><AccessSectionIcon name="delete"/>Delete</button></div>
      </> : <form onSubmit={save}>
        <fieldset disabled={busy} className={`${styles.fields} ${section === 'details' ? styles.detailsGrid : ''}`}>
          {section === 'details' ? <>
            <label>Display name<span className={styles.inputIcon}><AccessSectionIcon name="details"/><input value={name} onChange={e => setName(e.target.value)} required /></span></label>
            <label>Username<span className={styles.inputIcon}><AccessSectionIcon name="login"/><input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} required minLength={3} autoCapitalize="none" autoComplete="off" spellCheck={false}/></span></label>
            <p className={styles.hint}>This is an app username, not an email address.</p>
            {props.accountName && !username.endsWith(`@${props.accountName}`) ? <button type="button" onClick={() => setUsername(`${username.split('@')[0]}@${props.accountName}`)}>Use business username</button> : null}
          </> : section === 'permissions' ? <div className={`${styles.choices} ${props.dealerPolish ? styles.dealerRoles : ''}`}>{roleOptions.map(option => <label key={option.value} className={styles.choice} data-selected={role === option.value}><input type="radio" name="owner-role" value={option.value} checked={role === option.value} onChange={() => setRole(option.value)}/><span className={styles.roleIcon}><AccessSectionIcon name={props.dealerPolish && option.value === 'sales' ? 'sales' : props.dealerPolish && option.value === 'parts' ? 'box' : props.dealerPolish && option.value === 'technician' ? 'tools' : option.value === 'view_only' ? 'eye' : option.value === 'operations' ? 'tools' : 'permissions'}/></span><span><strong>{option.label}</strong><small>{option.text}</small></span></label>)}</div> : <>
            <label>New {passwordLabel.toLowerCase()}<div className={`${styles.password} ${styles.inputIcon}`}><AccessSectionIcon name="passcode"/><input type={showPasscode ? 'text' : 'password'} value={passcode} onChange={e => setPasscode(e.target.value)} required minLength={props.passwordMinimum} maxLength={props.passwordMaximum} autoComplete="new-password"/><button type="button" aria-label={`${showPasscode ? 'Hide' : 'Show'} ${passwordLabel.toLowerCase()}`} aria-pressed={showPasscode} onClick={() => setShowPasscode(!showPasscode)}><AccessSectionIcon name="eye"/></button></div></label>
            <p className={styles.hint}>Use at least {props.passwordMinimum} characters. Share the new {passwordLabel.toLowerCase()} with this person.</p>
          </>}
        </fieldset>
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        <footer className={styles.footer}><button type="submit" className={styles.primary} disabled={busy || !dirty || (props.dealerPolish && section === 'passcode' && passcode.length < props.passwordMinimum)}>{busy ? 'Saving…' : 'Save changes'}</button></footer>
      </form>}
    </>}
  </div>;
}
