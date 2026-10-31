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
import { TEAM_PERMISSIONS, TEAM_TEMPLATES, EMPTY_TEAM_PERMISSIONS, teamCanAccessAsset, type TeamGrant, type TeamPermissions } from '../../../lib/team-access-policy';
function LoginFieldIcon({ kind }: { kind: 'person' | 'email' | 'lock' | 'clock' }) {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {kind === 'person' ? <><circle cx="12" cy="7" r="3.5"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/></> : kind === 'email' ? <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></> : kind === 'lock' ? <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></> : <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}
    </svg>;
}
type Data = {
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
const countLabel = (count: number, label: string) => `${count} ${label}${count === 1 ? '' : 's'}`;
const fresh = (): Draft => ({ email: '', displayName: '', scope: 'selected', registerIds: [], assetIds: [], documentIds: [], permissions: { ...EMPTY_TEAM_PERMISSIONS }, expiresAt: '' });
export default function TeamAccessClient() {
    const [data, setData] = useState<Data | null>(null), [draft, setDraft] = useState<Draft | null>(null), [tab, setTab] = useState('Person');
    const [activityOpen, setActivityOpen] = useState(false);
    const [picker, setPicker] = useState<'registers' | 'assets' | 'umbrellas' | null>(null);
    const [assetChoicesOpen, setAssetChoicesOpen] = useState(false);
    useEffect(() => { setAssetChoicesOpen(false); }, [tab, draft?.id]);
    const bodyRef = useRef<HTMLDivElement>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    useEffect(() => { bodyRef.current?.scrollTo(0, 0); headingRef.current?.focus(); }, [tab]);
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
    function open(member?: TeamGrant) { setError(''); setTab(member ? 'Overview' : 'Person'); setPicker(null); setDraft(member ? { ...member, permissions: { ...member.permissions }, expiresAt: member.expiresAt ? member.expiresAt.slice(0, 10) : '' } : fresh()); }
    const allowedDocs = data?.documents.filter(d => d.assetIds.every(id => data.assets.some(a => a.id === id && draft && teamCanAccessAsset(draft, a)))) || [];
    const member = data?.members.find(m => m.id === draft?.id);
    const permissionSummary = draft ? Object.values(TEAM_TEMPLATES).find(t => TEAM_PERMISSIONS.every(p => t.permissions[p.key] === draft.permissions[p.key]))?.label || 'Custom access' : '';
    const assetSummary = draft?.scope === 'all' ? 'All current and future assets' : [draft?.registerIds.length ? countLabel(draft.registerIds.length, 'register') : '', draft?.assetIds.length ? countLabel(draft.assetIds.length, 'individual asset') : ''].filter(Boolean).join(' · ') || 'No assets selected';
    const selectedDocs = draft?.documentIds.filter(id => allowedDocs.some(d => d.id === id)) || [];
    const personValid = Boolean(draft?.displayName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email) && (!draft.password || (draft.password.length >= 10 && draft.password.length <= 128)) && (!draft.expiresAt || new Date(draft.expiresAt + 'T21:59:59.000Z').getTime() > Date.now()));
    const assetsValid = draft?.scope === 'all' || Boolean(draft?.registerIds.length || draft?.assetIds.length);
    const steps = ['Person', 'Permissions', 'Assets', 'Documents', 'Review'];
    const stageTitle = tab === 'Person' ? 'Login details' : tab === 'Assets' ? 'Asset access' : tab === 'Review' ? 'Review access' : tab;
    function status(m: TeamGrant) { return m.expiresAt && new Date(m.expiresAt) < new Date() ? 'Expired' : m.status === 'active' ? 'Active' : m.status === 'revoked' ? 'Inactive' : 'Invitation pending'; }
    const icon = (name: string) => <span className={styles.smallIcon}><AccessSectionIcon name={name}/></span>;
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
    {managing && !draft && !confirm && !activityOpen && <TeamModal ownerStyle title="Desktop users" subtitle="Choose a person to manage." onClose={() => setManaging(false)} busy={busy}><div className={styles.body}><div className={styles.directoryToolbar}><strong>{data?.members.length || 0} {data?.members.length === 1 ? 'user' : 'users'}</strong><div className={ownerStyles.listActions}><button className={styles.button} disabled={busy} onClick={() => void refresh().catch(e => setError(e.message))}>Refresh</button><button className={styles.primary} onClick={() => open()}>Add user</button></div></div>
{error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}{!data ? <p role="status">Loading team access…</p> : <><div className={styles.list} style={{ marginTop: '1.5rem' }}>{data.members.map(member => <article className={`${accessStyles.directoryCard} ${styles.userCard}`} key={member.id}>
      <div className={accessStyles.loginSummary}><div className={accessStyles.loginIdentity}><span className={ownerStyles.icon}><AccessSectionIcon name="details"/></span><div><strong>{member.displayName}</strong><span>{member.email}</span></div></div>
      <div className={accessStyles.loginActions}><span className={styles.statusPill} data-status={status(member)}>{status(member)}</span><button type="button" className={accessStyles.loginManageButton} disabled={busy} onClick={() => open(member)}><span className={styles.smallIcon}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m9 3-1 3-3 1-2 4 2 2v3l3 2 1 3h6l1-3 3-2v-3l2-2-2-4-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></svg></span>Manage</button></div></div>
    </article>)}</div>{!data.members.length && <p className={styles.notice}>No desktop users yet. Add a user to get started.</p>}
    <button type="button" className={styles.activityButton} onClick={() => setActivityOpen(true)}>{icon('clock')}View activity</button></>}
    </div></TeamModal>}
    {draft && data && <TeamModal ownerStyle title={draft.id ? `Manage ${draft.displayName}` : 'New desktop user'} subtitle={draft.id ? draft.email : 'Enter the login details and choose their access.'} onClose={() => setDraft(null)} busy={busy}>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); if (!draft.id && tab !== 'Review') { if ((tab !== 'Person' || personValid) && (tab !== 'Assets' || assetsValid)) setTab(steps[steps.indexOf(tab) + 1]); return; } if (!personValid || !assetsValid) return; void submit({ ...draft, action: 'save', expiresAt: draft.expiresAt ? draft.expiresAt + 'T21:59:59.000Z' : null, sendInvitation: !draft.id, documentIds: draft.documentIds.filter(id => allowedDocs.some(d => d.id === id)) }); }}>
      <div className={styles.body} ref={bodyRef}><div className={`${ownerStyles.manager} ${styles.manager}`}>
      {draft.id && <div className={ownerStyles.toolbar}><button type="button" disabled={busy} onClick={() => assetChoicesOpen ? setAssetChoicesOpen(false) : tab === 'Overview' ? setDraft(null) : setTab('Overview')}>{tab === 'Overview' ? 'All users' : 'Back'}</button>{member && <span className={styles.statusPill} data-status={status(member)}>{status(member)}</span>}</div>}
      {tab !== 'Overview' && <h3 ref={headingRef} tabIndex={-1} className={styles.sectionTitle}>{stageTitle === 'Status' ? 'Manage login status' : stageTitle}</h3>}
      {tab === 'Overview' && <><h3 className={ownerStyles.sectionTitle}>What would you like to change?</h3><div className={ownerStyles.grid}>{[
        { tab: 'Person', icon: 'details', title: 'Login details', text: 'Update their name, password or expiry.' },
        { tab: 'Permissions', icon: 'permissions', title: 'Permissions', text: 'Choose what they can do.' },
        { tab: 'Assets', icon: 'box', title: 'Asset access', text: 'Choose which assets they can access.' },
        { tab: 'Documents', icon: 'assets', title: 'Documents', text: 'Choose which documents they can open.' },
      ].map(item => <button type="button" key={item.tab} className={ownerStyles.card} disabled={busy} onClick={() => setTab(item.tab)}><span className={ownerStyles.icon}><AccessSectionIcon name={item.icon}/></span><span className={ownerStyles.copy}><strong>{item.title}</strong><span>{item.text}</span><small>{item.tab === 'Person' ? (draft.expiresAt ? `Expires ${draft.expiresAt.split('-').reverse().join('/')}` : 'No expiry') : item.tab === 'Permissions' ? permissionSummary : item.tab === 'Assets' ? assetSummary : `${countLabel(selectedDocs.length, 'document')} selected`}</small></span></button>)}</div><div className={styles.actions} style={{ marginTop: '1.5rem' }}><button type="button" className={styles.button} disabled={busy} onClick={() => setTab('Status')}>{icon('power')}Manage login status</button><button type="button" className={styles.danger} disabled={busy} onClick={() => { const member = data.members.find(m => m.id === draft.id); if (member) { setConfirmAction('remove'); setDraft(null); setConfirm(member); } }}>{icon('delete')}Remove user</button></div></>}
      {tab === 'Status' && <div className={styles.actions}>{data.members.find(m => m.id === draft.id)?.status === 'revoked' ? <button type="button" className={styles.button} disabled={busy} onClick={() => void submit({ action: 'reinvite', id: draft.id, version: draft.version, sendInvitation: true })}>Reactivate access</button> : <><button type="button" className={styles.danger} disabled={busy} onClick={() => { const member = data.members.find(m => m.id === draft.id); if (member) { setConfirmAction('revoke'); setDraft(null); setConfirm(member); } }}>Revoke access</button>{data.members.find(m => m.id === draft.id)?.status === 'pending' && <button type="button" className={styles.button} disabled={busy} onClick={() => void submit({ action: 'reinvite', id: draft.id, version: draft.version, sendInvitation: true })}>Resend invite</button>}</>}</div>}
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {tab === 'Person' && <div className={styles.fields}><label className={styles.field}>Name<span className={styles.inputWithIcon}><LoginFieldIcon kind="person"/><input className={styles.input} required maxLength={100} value={draft.displayName} onChange={e => setDraft({ ...draft, displayName: e.target.value })}/></span></label><label className={styles.field}>Email address<span className={styles.inputWithIcon}><LoginFieldIcon kind="email"/><input className={styles.input} type="email" required disabled={Boolean(draft.id)} value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}/></span></label>{(!draft.id || draft.managedLogin || !data.members.find(m => m.id === draft.id)?.memberUserId) && <label className={styles.field}>{draft.id ? 'New password (optional)' : 'Initial password'}<span className={`${styles.inputWithIcon} ${styles.passwordField}`}><LoginFieldIcon kind="lock"/><input className={styles.input} type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={10} maxLength={128} value={draft.password || ''} onChange={e => setDraft({ ...draft, password: e.target.value })}/><button type="button" className={styles.passwordToggle} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} disabled={busy} onClick={() => setShowPassword(value => !value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{showPassword ? <path d="m3 3 18 18"/> : null}</svg></button></span><small className={styles.muted}>10–128 characters. Existing users receive an invitation and keep their own password.</small></label>}<label className={styles.field}>Access expires (optional)<DateInput className={styles.input} value={draft.expiresAt} onValueChange={expiresAt => setDraft({ ...draft, expiresAt })}/><small className={styles.muted}>Leave blank for no expiry.</small></label></div>}
      {tab === 'Permissions' && <>
        <div className={styles.templates}>{Object.entries(TEAM_TEMPLATES).map(([key, t]) => <button type="button" className={styles.choice} aria-pressed={permissionSummary === t.label} onClick={() => setDraft({ ...draft, permissions: { ...t.permissions } })} key={key}>{icon(key === 'viewer' ? 'eye' : key === 'workshop' ? 'tools' : 'permissions')}<span><strong>{t.label}</strong><small>{key === 'viewer' ? 'See the assets you select.' : key === 'workshop' ? 'Record usage and maintenance.' : 'Manage day-to-day asset records.'}</small></span></button>)}</div>
        <p className={styles.muted}>{permissionSummary} · Adjust permissions below. Asset values are hidden unless enabled.</p>
        <div className={styles.grid}>{TEAM_PERMISSIONS.map(p => <label className={styles.permission} data-selected={draft.permissions[p.key]} key={p.key}><input type="checkbox" checked={draft.permissions[p.key]} onChange={e => setDraft({ ...draft, permissions: { ...draft.permissions, [p.key]: e.target.checked, ...(p.key === 'completeMaintenance' && e.target.checked ? { viewMaintenance: true } : {}), ...(p.key === 'viewMaintenance' && !e.target.checked ? { completeMaintenance: false } : {}) } })}/>{icon(p.key.includes('Maintenance') ? 'tools' : p.key === 'viewValues' || p.key === 'viewPhotos' ? 'eye' : p.key === 'updateUsage' ? 'clock' : 'assets')}<span><strong>{p.label}</strong><small>{p.detail}</small></span></label>)}</div>
      </>}
      {tab === 'Assets' && <>
        {!assetChoicesOpen && <div className={styles.grid}>{(['all', 'selected'] as const).map(scope => <button type="button" className={styles.choice} aria-pressed={draft.scope === scope} key={scope} onClick={() => { setDraft({ ...draft, scope }); setAssetChoicesOpen(scope === 'selected'); }}>{icon(scope === 'all' ? 'box' : 'permissions')}<span><strong>{scope === 'all' ? 'All assets' : 'Choose assets'}</strong><small>{scope === 'all' ? 'All current and future assets.' : 'Select umbrellas, registers or assets.'}</small></span></button>)}</div>}
        {assetChoicesOpen && <><div className={styles.templates} style={{ marginTop: '1rem' }}>{[{key:'umbrellas', title:'Umbrellas', icon:'umbrella', text:'Add their current assets.'},{key:'registers',title:'Registers',icon:'assets',text:'Includes future assets.'},{key:'assets',title:'Choose assets',icon:'box',text:'Select individual assets.'}].map(item => <button type="button" className={styles.choice} key={item.key} onClick={() => setPicker(item.key as 'umbrellas' | 'registers' | 'assets')}>{icon(item.icon)}<span><strong>{item.title}</strong><small>{item.text}</small></span></button>)}</div></>}
        {draft.scope === 'selected' && <p className={styles.summary} role="status">{assetsValid ? assetSummary : 'Select at least one register or asset to continue.'}</p>}
      </>}
      {tab === 'Documents' && <>
        <p className={styles.muted}>Only selected documents can be opened. Amounts inside approved documents remain visible.</p>
        {allowedDocs.length ? <><div className={styles.grid}>{allowedDocs.map(d => <label className={styles.permission} data-selected={selectedDocs.includes(d.id)} key={d.id}><input type="checkbox" checked={selectedDocs.includes(d.id)} onChange={() => setDraft({ ...draft, documentIds: selectedDocs.includes(d.id) ? selectedDocs.filter(id => id !== d.id) : [...selectedDocs, d.id] })}/>{icon('assets')}<span><strong>{d.title}</strong></span></label>)}</div></> : <div className={styles.empty}>{icon('assets')}<strong>No documents available for these assets.</strong><span>{draft.id ? 'This user has no documents to select.' : 'You can create this user without document access.'}</span></div>}
      </>}
      {tab === 'Review' && <div className={styles.review}>
        {[{title:'Login details',value:draft.displayName,detail:draft.email,tab:'Person'}, {title:'Permissions',value:permissionSummary,detail:`${TEAM_PERMISSIONS.filter(p => draft.permissions[p.key]).length} permissions enabled · Values ${draft.permissions.viewValues ? 'visible' : 'hidden'}`,tab:'Permissions'}, {title:'Asset access',value:assetSummary,detail:'Access is limited to this business.',tab:'Assets'}, {title:'Documents',value:`${countLabel(selectedDocs.length, 'document')} selected`,detail:draft.expiresAt ? `Access expires ${draft.expiresAt.split('-').reverse().join('/')} at the end of the day (South Africa).` : 'No expiry date.',tab:'Documents'}].map(item => <div key={item.title}><span><small>{item.title}</small><strong>{item.value}</strong><span>{item.detail}</span></span><button type="button" className={styles.button} aria-label={`Edit ${item.title.toLowerCase()}`} onClick={() => setTab(item.tab)}>Edit</button></div>)}
        <p className={styles.muted}>Existing Aim4price users receive an invitation and use their own password. New users use the initial password you set.</p>
      </div>}
      </div>{tab !== 'Overview' && tab !== 'Status' && <footer className={styles.footer}><button className={styles.button} type="button" onClick={() => assetChoicesOpen ? setAssetChoicesOpen(false) : draft.id ? setTab('Overview') : tab === 'Person' ? setDraft(null) : setTab(steps[steps.indexOf(tab) - 1])} disabled={busy}>{!draft.id && tab === 'Person' ? 'Cancel' : 'Back'}</button>{!draft.id && tab !== 'Review' ? <button type="button" className={styles.primary} disabled={busy || (tab === 'Person' && !personValid) || (tab === 'Assets' && !assetsValid)} onClick={() => setTab(steps[steps.indexOf(tab) + 1])}>Continue</button> : <button type="submit" className={styles.primary} disabled={busy || !personValid || !assetsValid}>{busy ? 'Saving…' : draft.id ? 'Save access' : 'Create user'}</button>}</footer>}</form>
    </TeamModal>}
    {picker && draft && data && <AssetAccessPicker kind={picker} options={picker === 'umbrellas' ? (data.groups || []).map(g => ({id:g.id,title:g.name,detail:'Current assets only',count:g.memberCount})) : picker === 'registers' ? data.registers.map(r => ({id:r.id,title:r.name,detail:'Includes future assets',count:data.assets.filter(a => a.registerId === r.id).length})) : data.assets.map(a => ({id:a.id,title:a.title,detail:data.registers.find(r => r.id === a.registerId)?.name}))} selected={picker === 'umbrellas' ? [] : picker === 'registers' ? draft.registerIds : draft.assetIds} onClose={() => setPicker(null)} onConfirm={ids => { setDraft({ ...draft, ...(picker === 'umbrellas' ? {assetIds:[...new Set([...draft.assetIds, ...(data.groups || []).filter(g => ids.includes(g.id)).flatMap(g => g.memberAssetIds)])]} : picker === 'registers' ? {registerIds:ids} : {assetIds:ids}) }); setPicker(null); }}/>}
    {activityOpen && data && <TeamModal ownerStyle title="Team activity" subtitle="Changes to your desktop users and their access." onClose={() => setActivityOpen(false)}><div className={styles.body}><div className={styles.activity}>{data.activity.map(a => <article key={a.id}>{icon('clock')}<div><strong>{a.action}</strong><p>{a.details?.targetName || a.target_name || a.details?.displayName || a.details?.targetEmail || a.target_email || a.details?.email || 'Team member'}{a.asset_id ? ` · ${data.assets.find(asset => asset.id === a.asset_id)?.title || 'Asset record'}` : ''}</p><small>By {a.actor_email}{a.details?.fields?.length ? ` · ${a.details.fields.join(', ')}` : ''}</small></div><time>{new Date(a.created_at).toLocaleString('en-ZA', {timeZone:'Africa/Johannesburg',dateStyle:'medium',timeStyle:'short'})}</time></article>)}{!data.activity.length && <div className={styles.empty}>{icon('clock')}<strong>No team activity yet.</strong></div>}</div></div><footer className={styles.footer}><button type="button" className={styles.button} onClick={() => setActivityOpen(false)}>Back to users</button></footer></TeamModal>}
    {confirm && <TeamModal ownerStyle title={confirmAction === 'remove' ? 'Remove desktop user?' : 'Revoke access?'} subtitle={confirm.email} onClose={() => setConfirm(null)} busy={busy}><div className={styles.body}><p>{confirmAction === 'remove' ? 'Remove this person from your desktop users and end their access to this business. Their Aim4price account, business records and activity history will be kept. To give access again, add them as a new user.' : 'This person will lose access to this business workspace. You can reactivate their access later.'}</p>{error && <p className={styles.error} role="alert">{error}</p>}</div><footer className={styles.footer}><button className={styles.button} onClick={() => setConfirm(null)} disabled={busy}>Cancel</button><button className={styles.danger} onClick={() => void submit({ action: confirmAction, id: confirm.id, version: confirm.version })} disabled={busy}>{busy ? 'Saving…' : confirmAction === 'remove' ? 'Remove user' : 'Revoke access'}</button></footer></TeamModal>}
  </main>;
}
