'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import accessStyles from '../app-access-management.module.css';
import baseStyles from '../dealer-app/page.module.css';
import DateInput from '../../../components/DateInput';
import TeamModal from '../../../components/team/TeamModal';
import teamStyles from '../../../components/team/team.module.css';
import desktopStyles from './desktop-access.module.css';
import ownerStyles from '../owner-login-sections.module.css';
import { AccessSectionIcon } from '../owner-login-sections';
const styles = { ...teamStyles, ...desktopStyles };
import { TEAM_PERMISSIONS, TEAM_TEMPLATES, EMPTY_TEAM_PERMISSIONS, teamCanAccessAsset, type TeamGrant, type TeamPermissions } from '../../../lib/team-access-policy';
function LoginFieldIcon({ kind }: { kind: 'person' | 'email' | 'lock' | 'clock' }) {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {kind === 'person' ? <><circle cx="12" cy="7" r="3.5"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/></> : kind === 'email' ? <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></> : kind === 'lock' ? <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></> : <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}
    </svg>;
}
type Data = {
    businessId: string;
    members: TeamGrant[];
    registers: {
        id: string;
        name: string;
    }[];
    assets: {
        id: string;
        title: string;
        registerId: string | null;
    }[];
    documents: {
        id: string;
        title: string;
        assetIds: string[];
    }[];
    activity: {
        id: string;
        action: string;
        actor_email: string;
        created_at: string;
        asset_id: string | null;
        details?: {
            fields?: string[];
        };
    }[];
};
type Draft = {
    id?: string;
    version?: number;
    email: string;
    password?: string;
    managedLogin?: boolean;
    displayName: string;
    scope: 'all' | 'selected';
    registerIds: string[];
    assetIds: string[];
    documentIds: string[];
    permissions: TeamPermissions;
    expiresAt: string;
};
const fresh = (): Draft => ({ email: '', displayName: '', scope: 'selected', registerIds: [], assetIds: [], documentIds: [], permissions: { ...EMPTY_TEAM_PERMISSIONS }, expiresAt: '' });
export default function TeamAccessClient() {
    const [data, setData] = useState<Data | null>(null), [draft, setDraft] = useState<Draft | null>(null), [tab, setTab] = useState('Person'), [query, setQuery] = useState('');
    const [confirmAction, setConfirmAction] = useState<'revoke' | 'remove'>('revoke');
    const [showPassword, setShowPassword] = useState(false);
    useEffect(() => { setShowPassword(false); }, [tab, draft?.id, Boolean(draft)]);
    const [managing, setManaging] = useState(false);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [confirm, setConfirm] = useState<TeamGrant | null>(null);
    async function refresh() { const response = await fetch('/api/team-access', { cache: 'no-store' }); const next = await response.json(); if (!response.ok)
        throw Error(next.error); setData(next); }
    useEffect(() => { void refresh().catch(e => setError(e.message)); }, []);
    async function submit(body: Record<string, unknown>) { setBusy(true); setError(''); setNotice(''); try {
        const response = await fetch('/api/team-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const result = await response.json();
        if (!response.ok)
            throw Error(result.error);
        setDraft(null);
        setConfirm(null);
        setNotice(result.warning || 'Desktop access saved.');
        await refresh();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to save.');
    }
    finally {
        setBusy(false);
    } }
    function open(member?: TeamGrant) { setError(''); setTab(member ? 'Overview' : 'Person'); setQuery(''); setDraft(member ? { ...member, permissions: { ...member.permissions }, expiresAt: member.expiresAt ? member.expiresAt.slice(0, 10) : '' } : fresh()); }
    function toggle(key: 'registerIds' | 'assetIds' | 'documentIds', id: string) { if (!draft)
        return; setDraft({ ...draft, [key]: draft[key].includes(id) ? draft[key].filter(v => v !== id) : [...draft[key], id] }); }
    const allowedDocs = data?.documents.filter(d => d.assetIds.every(id => data.assets.some(a => a.id === id && draft && teamCanAccessAsset(draft, a)))) || [];
    return <main className={baseStyles.shell}>
    <Link className={baseStyles.backButton} href="/account">Back to account</Link>
    <section className={accessStyles.launcher} aria-labelledby="desktop-users-title">
      <div className={accessStyles.launcherIntro}><h1 id="desktop-users-title">Desktop users</h1><p>Give each person their own desktop access. Choose their permissions and the assets they can use.</p></div>
      <div className={accessStyles.actionGrid}>
        <button type="button" aria-label="Add user" className={`${accessStyles.actionButton} ${accessStyles.actionButtonNew}`} disabled={!data || busy} onClick={() => open()}><span className={accessStyles.actionIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 4v16M4 12h16"/></svg></span><span className={accessStyles.actionCopy}><strong>Add user</strong><small>Invite a person and choose their access.</small></span></button>
        <button type="button" aria-label="Manage users" className={`${accessStyles.actionButton} ${accessStyles.actionButtonManage}`} disabled={!data || busy} onClick={() => setManaging(true)}><span className={accessStyles.actionIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/></svg></span><span className={accessStyles.actionCopy}><strong>Manage users</strong><small>Review permissions or remove access.</small></span><span className={accessStyles.actionMeta}><span className={accessStyles.countPill}>{data ? data.members.length : '…'}</span></span></button>
      </div>
      <div className={styles.actions}><button className={styles.button} onClick={() => { void navigator.clipboard.writeText(location.origin + '/team?business=' + encodeURIComponent(data?.businessId || '')).then(() => setNotice('Desktop sign-in link copied. Only authorised users can access your assets.')).catch(() => setError('Copy this link: ' + location.origin + '/team?business=' + encodeURIComponent(data?.businessId || ''))); }}>Copy user sign-in link</button></div>
    </section>
    {notice && <p className={styles.notice} role="status">{notice}</p>}{error && !draft && !confirm && <p className={styles.error} role="alert">{error}</p>}
    {!data && !error && <p role="status">Loading desktop users…</p>}
    {managing && !draft && !confirm && <TeamModal ownerStyle title="Desktop users" subtitle="Choose a person to manage." onClose={() => setManaging(false)} busy={busy}><div className={styles.body}><div className={styles.directoryToolbar}><strong>{data?.members.length || 0} users</strong><div className={ownerStyles.listActions}><button className={styles.button} disabled={busy} onClick={() => void refresh().catch(e => setError(e.message))}>Refresh</button><button className={styles.primary} onClick={() => open()}>Add user</button></div></div>
{!data ? <p role="status">Loading team access…</p> : <><div className={styles.list} style={{ marginTop: '1.5rem' }}>{data.members.map(member => <article className={accessStyles.directoryCard} key={member.id}>
      <div className={accessStyles.loginSummary}><div className={accessStyles.loginIdentity}><span className={ownerStyles.icon}><AccessSectionIcon name="details"/></span><div><strong>{member.displayName}</strong><span>{member.email}</span></div></div>
      <div className={accessStyles.loginActions}><span className={ownerStyles.status} data-active={member.status === 'active' && (!member.expiresAt || new Date(member.expiresAt) >= new Date())}>{member.expiresAt && new Date(member.expiresAt) < new Date() ? 'Expired' : member.status === 'active' ? 'Active' : member.status === 'revoked' ? 'Inactive' : 'Pending'}</span><button type="button" className={accessStyles.loginManageButton} disabled={busy} onClick={() => open(member)}><span className={styles.smallIcon}><AccessSectionIcon name="permissions"/></span>Manage</button></div></div>
    </article>)}</div>{!data.members.length && <p className={styles.notice}>No desktop users yet. Add a user to get started.</p>}
    <details className={styles.activity}><summary>Recent team activity</summary><p className={styles.muted}>Invitations, permission changes and actions are recorded against the person’s own login.</p>{data.activity.map(a => <article key={a.id}><div><strong>{a.action}{a.asset_id ? ` · ${data.assets.find(asset => asset.id === a.asset_id)?.title || 'Asset record'}` : ''}</strong><p className={styles.muted}>{a.actor_email}{a.details?.fields?.length ? ` · Changed: ${a.details.fields.join(', ')}` : ''}</p></div><time>{new Date(a.created_at).toLocaleString('en-ZA')}</time></article>)}{!data.activity.length && <p>No team activity yet.</p>}</details></>}
    </div></TeamModal>}
    {draft && data && <TeamModal ownerStyle title={draft.id ? `Manage ${draft.displayName}` : 'New desktop user'} subtitle={draft.id ? draft.email : 'Enter the login details and choose their access.'} onClose={() => setDraft(null)} busy={busy}>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); void submit({ ...draft, action: 'save', expiresAt: draft.expiresAt ? draft.expiresAt + 'T21:59:59.000Z' : null, sendInvitation: !draft.id, documentIds: draft.documentIds.filter(id => allowedDocs.some(d => d.id === id)) }); }}>
      <div className={styles.body}><div className={ownerStyles.manager}>
      {draft.id ? <div className={ownerStyles.toolbar}><button type="button" disabled={busy} onClick={() => tab === 'Overview' ? setDraft(null) : setTab('Overview')}>{tab === 'Overview' ? '‹ All users' : '‹ Back'}</button></div> : <h3 className={ownerStyles.sectionTitle}>{tab === 'Person' ? 'Login details' : tab === 'Assets' ? 'Asset access' : tab}</h3>}
      {tab === 'Overview' && <><h3 className={ownerStyles.sectionTitle}>What would you like to change?</h3><div className={ownerStyles.grid}>{[
        { tab: 'Person', icon: 'details', title: 'Login details', text: 'Update their name, password or expiry.' },
        { tab: 'Permissions', icon: 'permissions', title: 'Permissions', text: 'Choose what they can do.' },
        { tab: 'Assets', icon: 'assets', title: 'Asset access', text: 'Choose which assets they can access.' },
        { tab: 'Documents', icon: 'assets', title: 'Documents', text: 'Choose which documents they can open.' },
      ].map(item => <button type="button" key={item.tab} className={ownerStyles.card} disabled={busy} onClick={() => setTab(item.tab)}><span className={ownerStyles.icon}><AccessSectionIcon name={item.icon}/></span><span className={ownerStyles.copy}><strong>{item.title}</strong><span>{item.text}</span></span></button>)}</div><div className={styles.actions} style={{ marginTop: '1.5rem' }}><button type="button" className={styles.button} disabled={busy} onClick={() => setTab('Status')}>Manage login status</button><button type="button" className={styles.danger} disabled={busy} onClick={() => { const member = data.members.find(m => m.id === draft.id); if (member) { setConfirmAction('remove'); setDraft(null); setConfirm(member); } }}>Remove user</button></div></>}
      {tab === 'Status' && <div className={styles.actions}>{data.members.find(m => m.id === draft.id)?.status === 'revoked' ? <button type="button" className={styles.button} disabled={busy} onClick={() => void submit({ action: 'reinvite', id: draft.id, version: draft.version, sendInvitation: true })}>Reactivate access</button> : <><button type="button" className={styles.danger} disabled={busy} onClick={() => { const member = data.members.find(m => m.id === draft.id); if (member) { setConfirmAction('revoke'); setDraft(null); setConfirm(member); } }}>Revoke access</button>{data.members.find(m => m.id === draft.id)?.status === 'pending' && <button type="button" className={styles.button} disabled={busy} onClick={() => void submit({ action: 'reinvite', id: draft.id, version: draft.version, sendInvitation: true })}>Resend invite</button>}</>}</div>}
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {tab === 'Person' && <div className={styles.fields}><label className={styles.field}>Name<span className={styles.inputWithIcon}><LoginFieldIcon kind="person"/><input className={styles.input} required maxLength={100} value={draft.displayName} onChange={e => setDraft({ ...draft, displayName: e.target.value })}/></span></label><label className={styles.field}>Email address<span className={styles.inputWithIcon}><LoginFieldIcon kind="email"/><input className={styles.input} type="email" required disabled={Boolean(draft.id)} value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}/></span></label>{(!draft.id || draft.managedLogin || !data.members.find(m => m.id === draft.id)?.memberUserId) && <label className={styles.field}>{draft.id ? 'New password (optional)' : 'Initial password'}<span className={`${styles.inputWithIcon} ${styles.passwordField}`}><LoginFieldIcon kind="lock"/><input className={styles.input} type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={10} maxLength={128} value={draft.password || ''} onChange={e => setDraft({ ...draft, password: e.target.value })}/><button type="button" className={styles.passwordToggle} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} disabled={busy} onClick={() => setShowPassword(value => !value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{showPassword ? <path d="m3 3 18 18"/> : null}</svg></button></span><small className={styles.muted}>10–128 characters. Existing users keep their password.</small></label>}<label className={styles.field}>Access expires (optional)<DateInput className={styles.input} value={draft.expiresAt} onValueChange={expiresAt => setDraft({ ...draft, expiresAt })}/><small className={styles.muted}>End of the selected day, South Africa time.</small></label></div>}
      {tab === 'Permissions' && <><div className={styles.actions}>{Object.values(TEAM_TEMPLATES).map(t => <button type="button" className={styles.button} onClick={() => setDraft({ ...draft, permissions: { ...t.permissions } })} key={t.label}>{t.label}</button>)}</div><p className={styles.muted}>Templates are starting points. Values are hidden by default in every template.</p><div className={styles.grid}>{TEAM_PERMISSIONS.map(p => <label className={styles.check} key={p.key}><input type="checkbox" checked={draft.permissions[p.key]} onChange={e => setDraft({ ...draft, permissions: { ...draft.permissions, [p.key]: e.target.checked, ...(p.key === 'completeMaintenance' && e.target.checked ? { viewMaintenance: true } : {}), ...(p.key === 'viewMaintenance' && !e.target.checked ? { completeMaintenance: false } : {}) } })}/><span><strong>{p.label}</strong><small>{p.detail}</small></span></label>)}</div></>}
      {tab === 'Assets' && <><label className={styles.check}><input type="checkbox" checked={draft.scope === 'all'} onChange={e => setDraft({ ...draft, scope: e.target.checked ? 'all' : 'selected' })}/><span><strong>All current and future assets</strong><small>Includes assets added to this account later.</small></span></label>{draft.scope === 'selected' && <><h3 className={styles.section}>Registers</h3><p className={styles.muted}>Includes assets added to the selected registers later.</p><div className={styles.selectionList}>{data.registers.map(r => <label className={styles.check} key={r.id}><input type="checkbox" checked={draft.registerIds.includes(r.id)} onChange={() => toggle('registerIds', r.id)}/>{r.name}</label>)}</div><h3 className={styles.section}>Individual assets</h3><input className={styles.input} type="search" placeholder="Search assets…" aria-label="Search assets" value={query} onChange={e => setQuery(e.target.value)}/><div className={styles.selectionList}>{data.assets.filter(a => a.title.toLowerCase().includes(query.toLowerCase())).map(a => <label className={styles.check} key={a.id}><input type="checkbox" checked={draft.assetIds.includes(a.id)} onChange={() => toggle('assetIds', a.id)}/><span><strong>{a.title}</strong><small>{data.registers.find(r => r.id === a.registerId)?.name}</small></span></label>)}</div></>}</>}
      {tab === 'Documents' && <><p className={styles.notice}>Only the documents selected here can be opened. Values hidden does not redact the contents of an approved file. Select only documents this person is allowed to read.</p><div className={styles.selectionList}>{allowedDocs.map(d => <label className={styles.check} key={d.id}><input type="checkbox" checked={draft.documentIds.includes(d.id)} onChange={() => toggle('documentIds', d.id)}/>{d.title}</label>)}</div>{!allowedDocs.length && <p>No documents linked entirely to the selected assets. Choose the asset scope first.</p>}</>}
      </div>{tab !== 'Overview' && tab !== 'Status' && <footer className={styles.footer}><button className={styles.button} type="button" onClick={() => draft.id ? setTab('Overview') : tab === 'Person' ? setDraft(null) : setTab(['Person', 'Permissions', 'Assets', 'Documents'][['Person', 'Permissions', 'Assets', 'Documents'].indexOf(tab) - 1])} disabled={busy}>{!draft.id && tab === 'Person' ? 'Cancel' : 'Back'}</button>{!draft.id && tab !== 'Documents' ? <button type="button" className={styles.primary} onClick={() => setTab(['Person', 'Permissions', 'Assets', 'Documents'][['Person', 'Permissions', 'Assets', 'Documents'].indexOf(tab) + 1])}>Continue</button> : <button type="submit" className={styles.primary} disabled={busy || !draft.displayName.trim() || !draft.email.trim() || (draft.scope === 'selected' && !draft.registerIds.length && !draft.assetIds.length)}>{busy ? 'Saving…' : draft.id ? 'Save access' : 'Create user'}</button>}</footer>}</form>
    </TeamModal>}
    {confirm && <TeamModal ownerStyle title={confirmAction === 'remove' ? 'Remove desktop user?' : 'Revoke access?'} subtitle={confirm.email} onClose={() => setConfirm(null)} busy={busy}><div className={styles.body}><p>{confirmAction === 'remove' ? 'Remove this person from your desktop users and end their access to this business. Their Aim4price account, business records and activity history will be kept. To give access again, add them as a new user.' : 'This person will lose access to this business workspace. You can reactivate their access later.'}</p>{error && <p className={styles.error} role="alert">{error}</p>}</div><footer className={styles.footer}><button className={styles.button} onClick={() => setConfirm(null)} disabled={busy}>Cancel</button><button className={styles.danger} onClick={() => void submit({ action: confirmAction, id: confirm.id, version: confirm.version })} disabled={busy}>{busy ? 'Saving…' : confirmAction === 'remove' ? 'Remove user' : 'Revoke access'}</button></footer></TeamModal>}
  </main>;
}
