'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import accessStyles from '../app-access-management.module.css';
import baseStyles from '../dealer-app/page.module.css';
import AssetAccessPicker from './asset-access-picker';
import DateInput from '../../../components/DateInput';
import TeamModal from '../../../components/team/TeamModal';
import teamStyles from '../../../components/team/team.module.css';
import desktopStyles from './desktop-access.module.css';
import ownerStyles from '../owner-login-sections.module.css';
import { AccessSectionIcon } from '../owner-login-sections';
const styles = { ...teamStyles, ...desktopStyles };
import { teamTemplates, teamPermissionGroups, type TeamAccountKind } from '../../../lib/team-account-policy';
import { isDesktopUsername, TEAM_PERMISSIONS, updateTeamPermission, teamDocumentAccessLabel, type TeamDocumentAccess, EMPTY_TEAM_PERMISSIONS, teamCanAccessAsset, type TeamGrant, type TeamPermissions } from '../../../lib/team-access-policy';
function LoginFieldIcon({ kind }: { kind: 'person' | 'email' | 'lock' | 'clock' }) {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {kind === 'person' ? <><circle cx="12" cy="7" r="3.5"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/></> : kind === 'email' ? <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></> : kind === 'lock' ? <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></> : <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}
    </svg>;
}
type Data = {
    clientWork: {id:string;title:string;client:string}[];
    businessId: string;
    groups?: { id: string; name: string; memberAssetIds: string[]; memberCount: number }[];
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
        target_name?: string;
        target_email?: string;
        details?: {
            targetName?: string; targetEmail?: string; displayName?: string; email?: string;
            fields?: string[];
        };
    }[];
};
type Draft = {
    clientWorkIds: string[];
    id?: string;
    version?: number;
    email: string;
    username?: string;
    loginType?: 'existing' | 'managed';
    password?: string;
    managedLogin?: boolean;
    displayName: string;
    scope: 'all' | 'selected';
    registerIds: string[];
    assetIds: string[];
    documentIds: string[];
    documentAccess: TeamDocumentAccess;
    excludedDocumentIds: string[];
    permissions: TeamPermissions;
    expiresAt: string;
};
const countLabel = (count: number, label: string) => `${count} ${label}${count === 1 ? '' : 's'}`;
const fresh = (): Draft => ({ clientWorkIds: [], email: '', username: '', loginType: 'managed', displayName: '', scope: 'selected', registerIds: [], assetIds: [], documentIds: [], documentAccess: 'selected', excludedDocumentIds: [], permissions: { ...EMPTY_TEAM_PERMISSIONS }, expiresAt: '' });
const memberDraft = (member: TeamGrant): Draft => ({ ...member, clientWorkIds: member.clientWorkIds || [], documentAccess: member.documentAccess || 'selected', excludedDocumentIds: member.excludedDocumentIds || [], loginType: member.managedLogin ? 'managed' : 'existing', permissions: { ...member.permissions }, expiresAt: member.expiresAt ? member.expiresAt.slice(0, 10) : '' });
export default function TeamAccessClient({ accountKind = 'owner' }: { accountKind?: TeamAccountKind }) {
    const commercial = accountKind !== 'owner';
    const templates = teamTemplates(accountKind);
    const permissionGroups = teamPermissionGroups(accountKind);
    const [clientSearch, setClientSearch] = useState('');
    const [data, setData] = useState<Data | null>(null), [draft, setDraft] = useState<Draft | null>(null), [tab, setTab] = useState('Person');
    const [activityOpen, setActivityOpen] = useState(false);
    const [picker, setPicker] = useState<'registers' | 'assets' | 'umbrellas' | null>(null);

    const bodyRef = useRef<HTMLDivElement>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    useEffect(() => { bodyRef.current?.scrollTo(0, 0); headingRef.current?.focus(); }, [tab]);
    const [confirmAction, setConfirmAction] = useState<'revoke' | 'remove'>('revoke');
    const [showPassword, setShowPassword] = useState(false);
    useEffect(() => { setShowPassword(false); }, [tab, draft?.id, Boolean(draft)]);
    const [documentSearch, setDocumentSearch] = useState('');
    const [search, setSearch] = useState('');
    const [managing, setManaging] = useState(false);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [confirm, setConfirm] = useState<TeamGrant | null>(null);
    async function refresh() { const response = await fetch('/api/team-access', { cache: 'no-store' }); const next = await response.json(); if (!response.ok)
        throw Error(next.error); setData(next); return next as Data; }
    useEffect(() => { void refresh().catch(e => setError(e.message)); }, []);
    async function submit(body: Record<string, unknown>) { setBusy(true); setError(''); setNotice(''); try {
        const response = await fetch('/api/team-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const result = await response.json();
        if (!response.ok)
            throw Error(result.error);
        const next = await refresh();
        const savedMember = body.action === 'save' && body.id ? next.members.find(member => member.id === body.id) : undefined;
        setDraft(savedMember ? memberDraft(savedMember) : null);
        setShowPassword(false);
        setConfirm(null);
        setNotice(result.warning || 'Desktop access saved.');
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to save.');
    }
    finally {
        setBusy(false);
    } }
    function open(member?: TeamGrant) { setError(''); setNotice(''); setTab('Person'); setDocumentSearch(''); setPicker(null); setDraft(member ? memberDraft(member) : fresh()); }
    const allowedDocs = data?.documents.filter(d => d.assetIds.every(id => data.assets.some(a => a.id === id && draft && teamCanAccessAsset(draft, a)))) || [];
    const member = data?.members.find(m => m.id === draft?.id);
    const dirty = Boolean(draft && (draft.id ? member && JSON.stringify(memberDraft(member)) !== JSON.stringify(draft) : JSON.stringify(draft) !== JSON.stringify(fresh())));
    function closeEditor() { if (!dirty || window.confirm('Discard unsaved changes?')) setDraft(null); }
    const settingsTabs = [{ id: 'Person', label: 'Login details' }, { id: 'Permissions', label: 'Permissions' }, { id: 'Assets', label: 'Asset access' }, ...(commercial ? [{id:'Clients',label:'Client work'}] : []), { id: 'Documents', label: 'Documents' }, { id: 'Status', label: 'Login status' }];
    const permissionSummary = draft ? Object.values(templates).find(t => TEAM_PERMISSIONS.every(p => t.permissions[p.key] === draft.permissions[p.key]))?.label || 'Custom access' : '';
    const assetSummary = draft?.scope === 'all' ? 'All current and future assets' : [draft?.registerIds.length ? countLabel(draft.registerIds.length, 'register') : '', draft?.assetIds.length ? countLabel(draft.assetIds.length, 'individual asset') : ''].filter(Boolean).join(' · ') || 'No assets selected';
    const documentSummary = draft ? teamDocumentAccessLabel(draft.documentAccess, draft.documentIds.length, draft.excludedDocumentIds.length) : '';
    const selectedDocs = draft?.documentIds.filter(id => allowedDocs.some(d => d.id === id)) || [];
    const usernameLogin = draft?.loginType === 'managed' && (!draft.id || Boolean(draft.username));
    const personValid = Boolean(draft?.loginType && draft.displayName.trim() && (usernameLogin ? isDesktopUsername(draft.username || '') : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) && (draft.loginType === 'existing' || ((draft.id && !draft.password) || (draft.password && draft.password.length >= 10 && draft.password.length <= 128))) && (!draft.expiresAt || new Date(draft.expiresAt + 'T21:59:59.000Z').getTime() > Date.now()));
    const assetsValid = commercial || draft?.scope === 'all' || Boolean(draft?.registerIds.length || draft?.assetIds.length);
    const steps = ['Person', 'Permissions', 'Assets', ...(commercial ? ['Clients'] : []), 'Documents', 'Review'];
    const stageTitle = tab === 'Person' ? 'Login details' : tab === 'Assets' ? 'Asset access' : tab === 'Clients' ? 'Client work' : tab === 'Review' ? 'Review access' : tab;
    function status(m: TeamGrant) { return m.expiresAt && new Date(m.expiresAt) < new Date() ? 'Expired' : m.status === 'active' ? 'Active' : m.status === 'revoked' ? 'Inactive' : 'Login setup needed'; }
    const icon = (name: string) => <span className={styles.smallIcon}><AccessSectionIcon name={name}/></span>;
    return <main className={baseStyles.shell}>
    <Link className={baseStyles.backButton} href="/account">Back to account</Link>
    <section className={accessStyles.launcher} aria-labelledby="desktop-users-title">
      <div className={accessStyles.launcherIntro}><h1 id="desktop-users-title">Desktop users</h1><p>Give each person their own desktop access. Choose their permissions and the assets they can use.</p>{commercial && <p>Choose business-owned assets and client work separately. Client sharing limits still apply.</p>}</div>
      <div className={accessStyles.actionGrid}>
        <button type="button" aria-label="Add user" className={`${accessStyles.actionButton} ${accessStyles.actionButtonNew}`} disabled={!data || busy} onClick={() => open()}><span className={accessStyles.actionIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 4v16M4 12h16"/></svg></span><span className={accessStyles.actionCopy}><strong>Add user</strong><small>Add a person and choose their access.</small></span></button>
        <button type="button" aria-label="Manage users" className={`${accessStyles.actionButton} ${accessStyles.actionButtonManage}`} disabled={!data || busy} onClick={() => setManaging(true)}><span className={accessStyles.actionIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/></svg></span><span className={accessStyles.actionCopy}><strong>Manage users</strong><small>Review permissions or remove access.</small></span><span className={accessStyles.actionMeta}><span className={accessStyles.countPill}>{data ? data.members.length : '…'}</span></span></button>
      </div>
      <div className={styles.actions}><button className={styles.button} onClick={() => { void navigator.clipboard.writeText(location.origin + '/auth#login').then(() => setNotice('Desktop sign-in link copied. Only authorised users can access your assets.')).catch(() => setError('Copy this link: ' + location.origin + '/auth#login')); }} data-tooltip={!commercial ? 'Copy the sign-in link for your desktop users.' : undefined} data-tooltip-style="description">Copy user sign-in link</button></div>
    </section>
    {notice && <p className={styles.notice} role="status">{notice}</p>}{error && !draft && !confirm && <p className={styles.error} role="alert">{error}</p>}
    {!data && !error && <p role="status">Loading desktop users…</p>}
    {managing && !draft && !confirm && !activityOpen && <TeamModal ownerStyle title="Desktop users" subtitle="Choose a person to manage." onClose={() => setManaging(false)} busy={busy}><div className={`${styles.body} ${styles.refined}`}><div className={styles.directoryToolbar}><strong>{data?.members.length || 0} {data?.members.length === 1 ? 'user' : 'users'}</strong><div className={ownerStyles.listActions}><button className={styles.button} disabled={busy} onClick={() => void refresh().catch(e => setError(e.message))} data-tooltip={!commercial ? 'Refresh the latest desktop users and access details.' : undefined} data-tooltip-style="description">Refresh</button><button className={styles.primary} onClick={() => open()}>Add user</button></div></div>
{error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}{!data ? <p role="status">Loading team access…</p> : <><label className={styles.field}>Search users<input className={styles.input} type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email or username"/></label>{data.members.length > 0 && !data.members.some(member => `${member.displayName} ${member.email} ${member.username || ''}`.toLowerCase().includes(search.trim().toLowerCase())) && <p className={styles.muted}>No matching users.</p>}<div className={styles.list} style={{ marginTop: '1rem' }}>{data.members.filter(member => `${member.displayName} ${member.email} ${member.username || ''}`.toLowerCase().includes(search.trim().toLowerCase())).map(member => <article className={`${accessStyles.directoryCard} ${styles.userCard}`} key={member.id}>
      <div className={accessStyles.loginSummary}><div className={accessStyles.loginIdentity}><span className={ownerStyles.icon}><AccessSectionIcon name="details"/></span><div><strong>{member.displayName}</strong><span>{member.username || member.email}</span></div></div>
      <div className={accessStyles.loginActions}><span className={styles.statusPill} data-status={status(member)}>{status(member)}</span><button type="button" className={`${accessStyles.loginManageButton} ${styles.manageButton}`} disabled={busy} onClick={() => open(member)}><span className={styles.smallIcon}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3v8m0 4v6M12 3v2m0 4v12M19 3v10m0 4v4"/><circle cx="5" cy="13" r="2"/><circle cx="12" cy="7" r="2"/><circle cx="19" cy="15" r="2"/></svg></span>Manage</button></div></div>
    </article>)}</div>{!data.members.length && <p className={styles.notice}>No desktop users yet. Add a user to get started.</p>}
    <button type="button" className={styles.activityButton} onClick={() => setActivityOpen(true)}>{icon('clock')}View activity</button></>}
    </div></TeamModal>}
    {draft && data && <TeamModal ownerStyle title={draft.id ? `Manage ${draft.displayName}` : 'New desktop user'} subtitle={draft.id ? draft.username || draft.email : 'Give this person access to your business.'} onClose={closeEditor} busy={busy}>
      <form className={`${styles.editorForm} ${styles.refined}`} onSubmit={e => { e.preventDefault(); if (!draft.id && tab !== 'Review') { if ((tab !== 'Person' || personValid) && (tab !== 'Assets' || assetsValid)) setTab(steps[steps.indexOf(tab) + 1]); return; } if (!personValid || !assetsValid) return; void submit({ ...draft, action: 'save', expiresAt: draft.expiresAt ? draft.expiresAt + 'T21:59:59.000Z' : null, documentIds: draft.documentIds.filter(id => allowedDocs.some(d => d.id === id)), excludedDocumentIds: draft.excludedDocumentIds.filter(id => data.documents.some(d => d.id === id)) }); }}>
      <div className={`${styles.body} ${styles.editorBody}`} ref={bodyRef}>
      <div className={draft.id ? styles.settingsLayout : undefined}>
      {draft.id && <nav className={styles.settingsNav} aria-label="User settings"><button className={styles.backToUsers} type="button" disabled={busy} onClick={closeEditor}>All users</button>{settingsTabs.map(item => <button type="button" key={item.id} aria-current={tab === item.id ? 'page' : undefined} disabled={busy} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>}
      <div className={`${styles.settingsContent} ${tab === 'Person' ? styles.loginDetails : ''}`}>
      <div className={styles.sectionHeading}><h3 ref={headingRef} tabIndex={-1} className={styles.sectionTitle}>{stageTitle === 'Status' ? 'Login status' : stageTitle}</h3>{member && <span className={styles.statusPill} data-status={status(member)}>{status(member)}</span>}</div>
      {tab === 'Status' && <div className={styles.statusSections}>
        <div className={styles.statusRow}><div><strong>Sign-in link</strong><p>{draft.managedLogin ? 'Share this link and their desktop login details yourself.' : 'They use their existing Aim4price email and password.'}</p></div><button type="button" className={styles.button} disabled={busy} onClick={() => { const link = location.origin + (draft.managedLogin ? '/team?business=' + encodeURIComponent(data.businessId) : '/team'); void navigator.clipboard.writeText(link).then(() => setNotice('Sign-in link copied.')).catch(() => setError('Copy this link: ' + link)); }}>Copy sign-in link</button></div>
        <div className={styles.statusRow}><div><strong>{member?.status === 'revoked' ? 'Reactivate access' : 'Deactivate access'}</strong><p>{member?.status === 'revoked' ? 'Allow this person to use the desktop workspace again.' : 'Stop access to this business. You can reactivate it later.'}</p></div>{member?.status === 'revoked' ? <button type="button" className={styles.button} disabled={busy} onClick={() => { if (!dirty || window.confirm('Discard unsaved changes?')) void submit({ action: 'reinvite', id: draft.id, version: draft.version }); }}>Reactivate access</button> : <button type="button" className={styles.danger} disabled={busy} onClick={() => { if (dirty && !window.confirm('Discard unsaved changes?')) return; const member = data.members.find(m => m.id === draft.id); if (member) { setConfirmAction('revoke'); setDraft(null); setConfirm(member); } }}>Revoke access</button>}</div>
        {member?.status === 'active' && !draft.managedLogin && <div className={styles.statusRow}><div><strong>Access email</strong><p>Send this person the instructions to access your business.</p></div><button type="button" className={styles.button} disabled={busy} onClick={() => { if (!dirty || window.confirm('Discard unsaved changes?')) void submit({ action: 'send-invitation', id: draft.id, version: draft.version }); }}>Send access email</button></div>}
        <div className={styles.statusRow}><div><strong>Remove user</strong><p>Remove their access to this business. Records and activity history are kept.</p></div><button type="button" className={styles.danger} disabled={busy} onClick={() => { if (dirty && !window.confirm('Discard unsaved changes?')) return; if (member) { setConfirmAction('remove'); setDraft(null); setConfirm(member); } }}>Remove user</button></div>
      </div>}
      {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
      {tab === 'Person' && <>
        <p className={styles.muted}>{draft.loginType === 'existing' ? 'They sign in with their existing Aim4price account. Their password stays private.' : usernameLogin ? 'Use these details on the Aim4price login page. Each person should have their own login.' : 'This existing desktop login still uses its email and business password.'}</p>
        <div className={styles.fields}>
          <label className={styles.field}>Name<span className={styles.inputWithIcon}><LoginFieldIcon kind="person"/><input className={styles.input} required maxLength={100} value={draft.displayName} onChange={e => setDraft({ ...draft, displayName: e.target.value })}/></span></label>
          {usernameLogin ? <label className={styles.field}>Username<span className={styles.inputWithIcon}><LoginFieldIcon kind="person"/><input className={styles.input} required autoComplete="off" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={40} disabled={Boolean(draft.id)} value={draft.username || ''} placeholder="e.g. kuyler@skimmelkrans" onChange={e => setDraft({ ...draft, username: e.target.value.toLowerCase() })}/></span><small className={styles.muted}>{draft.id ? 'Username cannot be changed.' : '3–40 characters, including @business.'}</small></label> : <label className={styles.field}>Email address<span className={styles.inputWithIcon}><LoginFieldIcon kind="email"/><input className={styles.input} type="email" required disabled={Boolean(draft.id)} value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}/></span></label>}
          {draft.loginType === 'managed' && <label className={styles.field}>{draft.id ? 'New password (optional)' : 'Initial password'}<span className={`${styles.inputWithIcon} ${styles.passwordField}`}><LoginFieldIcon kind="lock"/><input className={styles.input} required={!draft.id} type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={10} maxLength={128} value={draft.password || ''} onChange={e => setDraft({ ...draft, password: e.target.value })}/><button type="button" className={styles.passwordToggle} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} disabled={busy} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</button></span><small className={styles.muted}>{draft.id ? 'Leave blank to keep the current password.' : '10–128 characters.'}</small></label>}
          <label className={styles.field}>Access expires (optional)<DateInput className={styles.input} value={draft.expiresAt} onValueChange={expiresAt => setDraft({ ...draft, expiresAt })}/><small className={styles.muted}>Leave blank for no expiry.</small></label>
        </div>
      </>}
      {tab === 'Permissions' && <div className={styles.permissionPanel}>
        <p className={styles.permissionIntro}>Choose a starting role, then open each page to adjust access.</p>
        <div className={styles.presetGrid}>{Object.entries(templates).map(([key, t]) => <button type="button" className={styles.preset} aria-pressed={permissionSummary === t.label} onClick={() => setDraft({ ...draft, permissions: { ...t.permissions } })} key={key} title={t.detail}><strong>{t.label}</strong></button>)}</div>
        <p className={styles.presetDescription}>{Object.values(templates).find(t => t.label === permissionSummary)?.detail || 'Custom permissions for this person.'}</p>
        <div className={styles.accessSummary} role="status"><strong>{permissionSummary}</strong><span>{draft.permissions.viewValues ? 'Asset values visible' : 'Asset values hidden'} · {draft.documentAccess === 'none' ? 'No document access' : draft.documentAccess === 'all' ? 'Document exceptions set separately' : 'Only approved documents'}</span></div>
        <div className={styles.permissionGroups}>{permissionGroups.map((group) => <details className={styles.permissionGroup} key={group.label}>
          <summary><strong>{group.label}</strong><span>{group.keys.filter(key => draft.permissions[key]).length} of {group.keys.length} allowed</span></summary>
          <div className={styles.permissionOptions}>{group.keys.map(key => { const permission = TEAM_PERMISSIONS.find(p => p.key === key)!; return <label className={styles.permission} data-selected={draft.permissions[key]} key={key}><input type="checkbox" checked={draft.permissions[key]} onChange={e => setDraft({ ...draft, permissions: updateTeamPermission(draft.permissions, key, e.target.checked) })}/><span><strong>{permission.label}</strong><small>{permission.detail}</small></span></label>; })}</div>
        </details>)}</div>
        <details className={styles.permissionGroup}><summary><strong>Home, Marketplace &amp; account</strong><span>Browse &amp; account rules</span></summary><p className={styles.permissionIntro}>Home, Value Asset and Marketplace browsing are available to all desktop users. Saving valuations, publishing listings, sharing or deleting assets, billing, user administration and tracking-device setup remain with the account holder. Manager enables the listed permissions; it does not transfer account ownership.</p></details>
      </div>}
      {tab === 'Assets' && <div className={styles.assetAccess}>
        {commercial && <p className={styles.permissionIntro}>Assets owned by this business. Leave the selection empty for client-work-only access.</p>}
        {<div className={styles.grid}>{(['all', 'selected'] as const).map(scope => <button type="button" className={`${styles.assetCard} ${scope === 'all' ? accessStyles.actionButtonNew : accessStyles.actionButtonManage}`} aria-pressed={draft.scope === scope} key={scope} onClick={() => { setDraft({ ...draft, scope }); }}><span className={styles.assetCardIcon} aria-hidden="true"><AccessSectionIcon name={scope === 'all' ? 'box' : 'assets'}/></span><span><strong>{scope === 'all' ? 'All assets' : 'Selected assets only'}</strong><small>{scope === 'all' ? 'All current and future assets.' : 'Select umbrellas, registers or assets.'}</small></span></button>)}</div>}
        {draft.scope === 'selected' && <><div className={styles.templates}>{[{key:'umbrellas', title:'Umbrellas', icon:'umbrella', text:'Add their current assets.'},{key:'registers',title:'Registers',icon:'assets',text:'Includes future assets.'},{key:'assets',title:'Choose assets',icon:'box',text:'Select individual assets.'}].map(item => <button type="button" className={`${styles.assetCard} ${item.key === 'registers' ? accessStyles.actionButtonManage : accessStyles.actionButtonNew}`} key={item.key} onClick={() => setPicker(item.key as 'umbrellas' | 'registers' | 'assets')}><span className={styles.assetCardIcon} aria-hidden="true"><AccessSectionIcon name={item.icon}/></span><span><strong>{item.title}</strong><small>{item.text}</small></span></button>)}</div></>}
        <p className={styles.assetSelectionSummary} data-selected={assetsValid} role="status">{(draft.scope === 'all' || draft.registerIds.length > 0 || draft.assetIds.length > 0) ? <><strong>Access selected</strong><span>{assetSummary}</span></> : commercial ? 'No business-owned assets selected.' : 'Choose the assets this person can access.'}</p>
      </div>}
      {tab === 'Clients' && <div className={styles.documentPanel}>
        <p className={styles.permissionIntro}>Choose the enquiries and shared assets this person may see. New client work stays private until selected. Client permissions can never exceed the original share.</p>
        <div className={styles.accessSummary} role="status"><strong>{draft.clientWorkIds.length} selected</strong><span>{draft.permissions.viewClientWork ? 'Client work enabled' : 'Enable View assigned client work under Permissions to make this selection available.'}</span></div>
        <label className={styles.field}>Search client work<input className={styles.input} type="search" value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Search client or asset"/></label>
        <div className={styles.documentList}>{(data.clientWork || []).filter(work => `${work.client} ${work.title}`.toLowerCase().includes(clientSearch.toLowerCase())).map(work => <label className={styles.permission} key={work.id} data-selected={draft.clientWorkIds.includes(work.id)}><input type="checkbox" checked={draft.clientWorkIds.includes(work.id)} onChange={e => setDraft({...draft,clientWorkIds:e.target.checked ? [...draft.clientWorkIds,work.id] : draft.clientWorkIds.filter(id => id !== work.id)})}/><span><strong>{work.title}</strong><small>{work.client}</small></span></label>)}</div>
        {!(data.clientWork || []).length && <p className={styles.muted}>No client work is currently shared with this business.</p>}
        {draft.clientWorkIds.some(id => !(data.clientWork || []).some(work => work.id === id)) && <p className={styles.notice}>Some selected work is no longer available. <button type="button" className={styles.button} onClick={() => setDraft({...draft,clientWorkIds:draft.clientWorkIds.filter(id => (data.clientWork || []).some(work => work.id === id))})}>Remove unavailable selections</button></p>}
      </div>}
      {tab === 'Documents' && <div className={styles.documentPanel}>
        <p className={styles.permissionIntro}>Choose which documents this person can open and download.</p>
        <div className={styles.documentModes}>{([{key:'none',title:'No documents',detail:'Existing documents stay private.'},{key:'selected',title:'Choose documents',detail:'Only documents you approve.'},{key:'all',title:'All with exceptions',detail:'Includes future documents for their accessible assets.'}] as const).map(mode => <button type="button" className={styles.preset} aria-pressed={draft.documentAccess === mode.key} key={mode.key} onClick={() => setDraft({...draft, documentAccess:mode.key})}><strong>{mode.title}</strong><small>{mode.detail}</small></button>)}</div>
        <div className={styles.accessSummary} role="status"><strong>{documentSummary}</strong><span>{draft.permissions.uploadDocuments ? 'Can upload documents for owner review.' : 'Cannot upload documents.'}</span></div>
        {draft.documentAccess !== 'none' && allowedDocs.length > 0 && <>
          <label className={styles.field}>{draft.documentAccess === 'all' ? 'Keep these documents private' : 'Allow these documents'}<input className={styles.input} type="search" value={documentSearch} onChange={e => setDocumentSearch(e.target.value)} placeholder="Search documents" /></label>
          <div className={styles.documentList}>{allowedDocs.filter(d => d.title.toLowerCase().includes(documentSearch.trim().toLowerCase())).map(d => { const all = draft.documentAccess === 'all'; const chosen = all ? draft.excludedDocumentIds : selectedDocs; const checked = chosen.includes(d.id); return <label className={styles.permission} data-selected={checked} key={d.id}><input type="checkbox" checked={checked} onChange={() => setDraft({...draft, [all ? 'excludedDocumentIds' : 'documentIds']: checked ? chosen.filter(id => id !== d.id) : [...chosen,d.id]})}/>{icon('assets')}<span><strong>{d.title}</strong><small>{all ? 'Keep private' : 'Allow access'}</small></span></label>; })}</div>
          {!allowedDocs.some(d => d.title.toLowerCase().includes(documentSearch.trim().toLowerCase())) && <p className={styles.muted}>No matching documents for the selected assets.</p>}
        </>}
        {draft.documentAccess !== 'none' && allowedDocs.length === 0 && <div className={styles.emptyDocuments}><strong>No documents available</strong><p>There are no documents for this person’s accessible assets yet.</p></div>}
        <p className={styles.permissionIntro}>Prices printed inside approved documents remain visible. Documents linked to assets outside this person's access stay unavailable.</p>
      </div>}
      {tab === 'Review' && <div className={styles.review}>
        {[{title:'Login details',value:draft.displayName,detail:(draft.username || draft.email) + (draft.loginType === 'existing' ? ' · Existing Aim4price account' : ' · Separate desktop login'),tab:'Person'}, {title:'Permissions',value:permissionSummary,detail:`${TEAM_PERMISSIONS.filter(p => draft.permissions[p.key]).length} permissions enabled · Values ${draft.permissions.viewValues ? 'visible' : 'hidden'}`,tab:'Permissions'}, {title:'Asset access',value:assetSummary,detail:'Access is limited to this business.',tab:'Assets'}, ...(commercial ? [{title:'Client work',value:`${draft.clientWorkIds.length} selected`,detail:draft.permissions.viewClientWork ? 'Original client sharing limits apply.' : 'Client work is switched off.',tab:'Clients'}] : []), {title:'Documents',value:documentSummary,detail:draft.expiresAt ? `Access expires ${draft.expiresAt.split('-').reverse().join('/')} at the end of the day (South Africa).` : 'No expiry date.',tab:'Documents'}].map(item => <div key={item.title}><span><small>{item.title}</small><strong>{item.value}</strong><span>{item.detail}</span></span><button type="button" className={styles.button} aria-label={`Edit ${item.title.toLowerCase()}`} onClick={() => setTab(item.tab)}>Edit</button></div>)}
        <p className={styles.muted}>{draft.loginType === 'managed' ? 'No email is sent. Share the sign-in link, username and password yourself.' : 'No email is sent. Share the workspace link yourself, or choose Send access email under Login status.'}</p>
      </div>}
      </div></div></div>
      {tab !== 'Status' && <footer className={styles.footer}>{!draft.id && <button className={styles.button} type="button" onClick={() => tab === 'Person' ? closeEditor() : setTab(steps[steps.indexOf(tab) - 1])} disabled={busy}>{tab === 'Person' ? 'Cancel' : 'Previous step'}</button>}{!draft.id && tab !== 'Review' ? <button type="button" className={styles.primary} disabled={busy || (tab === 'Person' && !personValid) || (tab === 'Assets' && !assetsValid)} onClick={() => setTab(steps[steps.indexOf(tab) + 1])}>Continue</button> : <><span className={styles.saveHint} role="status">{dirty ? 'Unsaved changes' : 'All changes saved'}</span><button type="submit" className={styles.primary} disabled={busy || !personValid || !assetsValid || Boolean(draft.id && !dirty)}>{busy ? 'Saving…' : draft.id ? 'Save access' : 'Create user'}</button></>}</footer>}
      </form>
    </TeamModal>}
    {picker && draft && data && <AssetAccessPicker kind={picker} options={picker === 'umbrellas' ? (data.groups || []).map(g => ({id:g.id,title:g.name,detail:'Current assets only',count:g.memberCount})) : picker === 'registers' ? data.registers.map(r => ({id:r.id,title:r.name,detail:'Includes future assets',count:data.assets.filter(a => a.registerId === r.id).length})) : data.assets.map(a => ({id:a.id,title:a.title,detail:data.registers.find(r => r.id === a.registerId)?.name}))} selected={picker === 'umbrellas' ? [] : picker === 'registers' ? draft.registerIds : draft.assetIds} onClose={() => setPicker(null)} onConfirm={ids => { setDraft({ ...draft, ...(picker === 'umbrellas' ? {assetIds:[...new Set([...draft.assetIds, ...(data.groups || []).filter(g => ids.includes(g.id)).flatMap(g => g.memberAssetIds)])]} : picker === 'registers' ? {registerIds:ids} : {assetIds:ids}) }); setPicker(null); }}/>}
    {activityOpen && data && <TeamModal ownerStyle title="Team activity" subtitle="Changes to your desktop users and their access." onClose={() => setActivityOpen(false)}><div className={`${styles.body} ${styles.refined}`}><div className={styles.activity}>{data.activity.map(a => <article key={a.id}>{icon('clock')}<div><strong>{a.action}</strong><p>{a.details?.targetName || a.target_name || a.details?.displayName || a.details?.targetEmail || a.target_email || a.details?.email || 'Team member'}{a.asset_id ? ` · ${data.assets.find(asset => asset.id === a.asset_id)?.title || 'Asset record'}` : ''}</p><small>By {a.actor_email}{a.details?.fields?.length ? ` · ${a.details.fields.join(', ')}` : ''}</small></div><time>{new Date(a.created_at).toLocaleString('en-ZA', {timeZone:'Africa/Johannesburg',dateStyle:'medium',timeStyle:'short'})}</time></article>)}{!data.activity.length && <div className={styles.empty}>{icon('clock')}<strong>No team activity yet.</strong></div>}</div></div><footer className={styles.footer}><button type="button" className={styles.button} onClick={() => setActivityOpen(false)}>Back to users</button></footer></TeamModal>}
    {confirm && <TeamModal ownerStyle title={confirmAction === 'remove' ? 'Remove desktop user?' : 'Revoke access?'} subtitle={confirm.username || confirm.email} onClose={() => setConfirm(null)} busy={busy}><div className={`${styles.body} ${styles.refined}`}><p>{confirmAction === 'remove' ? 'Remove this person from your desktop users and end their access to this business. Their Aim4price account, business records and activity history will be kept. To give access again, add them as a new user.' : 'This person will lose access to this business workspace. You can reactivate their access later.'}</p>{error && <p className={styles.error} role="alert">{error}</p>}</div><footer className={styles.footer}><button className={styles.button} onClick={() => setConfirm(null)} disabled={busy}>Cancel</button><button className={styles.danger} onClick={() => void submit({ action: confirmAction, id: confirm.id, version: confirm.version })} disabled={busy}>{busy ? 'Saving…' : confirmAction === 'remove' ? 'Remove user' : 'Revoke access'}</button></footer></TeamModal>}
  </main>;
}

