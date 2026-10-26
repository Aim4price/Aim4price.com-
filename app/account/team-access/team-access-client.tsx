'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import TeamModal from '../../../components/team/TeamModal';
import styles from '../../../components/team/team.module.css';
import { TEAM_PERMISSIONS, TEAM_TEMPLATES, EMPTY_TEAM_PERMISSIONS, teamCanAccessAsset, type TeamGrant, type TeamPermissions } from '../../../lib/team-access-policy';
type Data = {
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
        setNotice(result.warning || 'Team access saved.');
        await refresh();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to save.');
    }
    finally {
        setBusy(false);
    } }
    function open(member?: TeamGrant) { setError(''); setTab('Person'); setQuery(''); setDraft(member ? { ...member, permissions: { ...member.permissions }, expiresAt: member.expiresAt ? member.expiresAt.slice(0, 10) : '' } : fresh()); }
    function toggle(key: 'registerIds' | 'assetIds' | 'documentIds', id: string) { if (!draft)
        return; setDraft({ ...draft, [key]: draft[key].includes(id) ? draft[key].filter(v => v !== id) : [...draft[key], id] }); }
    const allowedDocs = data?.documents.filter(d => d.assetIds.every(id => data.assets.some(a => a.id === id && draft && teamCanAccessAsset(draft, a)))) || [];
    return <main className={styles.page}>
    <header className={styles.header}><div><h1>Team access</h1><p>Give each person their own access to your business’s assets.</p></div><div className={styles.actions}><Link className={styles.button} href="/account">Account</Link><button className={styles.button} disabled={busy} onClick={() => void refresh().catch(e => setError(e.message))}>Refresh</button><button className={styles.primary} onClick={() => open()}>+ Add person</button></div></header>
    <div className={styles.notice}>Each person signs in with their own verified email. Billing, finance balances, selling, deleting, transfers and access management stay owner-only. Approved documents, photos and maintenance notes may contain sensitive information—share them deliberately.</div>
    {notice && <p className={styles.notice} role="status">{notice}</p>}{error && !draft && !confirm && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}><Link className={styles.button} href="/team">Open team workspaces</Link><button className={styles.button} onClick={() => { void navigator.clipboard.writeText(location.origin + '/team').then(() => setNotice('Team workspace link copied. Only invited emails can accept access.')).catch(() => setError('Copy this link: ' + location.origin + '/team')); }}>Copy invitation link</button></div>
    {!data ? <p role="status">Loading team access…</p> : <><div className={styles.grid} style={{ marginTop: '1.5rem' }}>{data.members.map(member => <article className={styles.card} key={member.id}>
      <h2>{member.displayName}</h2><p>{member.email}</p><span className={styles.pill}>{member.expiresAt && new Date(member.expiresAt) < new Date() ? 'Expired' : member.status}</span><span className={styles.pill}>{member.permissions.viewValues ? 'Values visible' : 'Values hidden'}</span>
      <p className={styles.muted}>{member.scope === 'all' ? 'All current and future assets' : `${member.registerIds.length} registers · ${member.assetIds.length} individual assets`} · {member.documentIds.length} approved documents{member.expiresAt ? ` · Expires ${new Date(member.expiresAt).toLocaleDateString('en-ZA')}` : ''}</p>
      <div className={styles.actions}><button className={styles.button} disabled={busy} onClick={() => open(member)}>Edit access</button>{member.status === 'revoked' ? <button className={styles.button} disabled={busy} onClick={() => void submit({ action: 'reinvite', id: member.id, version: member.version, sendInvitation: true })}>Invite again</button> : <><button className={styles.danger} disabled={busy} onClick={() => setConfirm(member)}>Revoke access</button>{member.status === 'pending' && <button className={styles.button} disabled={busy} onClick={() => void submit({ action: 'reinvite', id: member.id, version: member.version, sendInvitation: true })}>Resend invite</button>}</>}</div>
    </article>)}</div>{!data.members.length && <p className={styles.notice}>No team members yet. Add a person, choose their permissions, then send their invitation.</p>}
    <section className={styles.activity}><h2>Recent team activity</h2><p className={styles.muted}>Invitations, permission changes and actions are recorded against the person’s own login.</p>{data.activity.map(a => <article key={a.id}><div><strong>{a.action}{a.asset_id ? ` · ${data.assets.find(asset => asset.id === a.asset_id)?.title || 'Asset record'}` : ''}</strong><p className={styles.muted}>{a.actor_email}{a.details?.fields?.length ? ` · Changed: ${a.details.fields.join(', ')}` : ''}</p></div><time>{new Date(a.created_at).toLocaleString('en-ZA')}</time></article>)}{!data.activity.length && <p>No team activity yet.</p>}</section></>}
    {draft && data && <TeamModal title={draft.id ? 'Edit team access' : 'Add a person'} subtitle="Choose exactly what this person can see and do." onClose={() => setDraft(null)} busy={busy}>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); void submit({ ...draft, action: 'save', expiresAt: draft.expiresAt ? draft.expiresAt + 'T21:59:59.000Z' : null, sendInvitation: !draft.id, documentIds: draft.documentIds.filter(id => allowedDocs.some(d => d.id === id)) }); }}>
      <div className={styles.body}><nav className={styles.tabs} aria-label="Access settings">{['Person', 'Permissions', 'Assets', 'Documents'].map(t => <button type="button" className={tab === t ? styles.primary : styles.button} aria-pressed={tab === t} onClick={() => setTab(t)} key={t}>{t}</button>)}</nav>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {tab === 'Person' && <div className={styles.fields}><label className={styles.field}>Name<input className={styles.input} required maxLength={100} value={draft.displayName} onChange={e => setDraft({ ...draft, displayName: e.target.value })}/></label><label className={styles.field}>Email address<input className={styles.input} type="email" required disabled={Boolean(draft.id)} value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}/></label><label className={styles.field}>Access expires (optional)<input className={styles.input} type="date" value={draft.expiresAt} onChange={e => setDraft({ ...draft, expiresAt: e.target.value })}/><small className={styles.muted}>End of the selected day, South Africa time.</small></label></div>}
      {tab === 'Permissions' && <><div className={styles.actions}>{Object.values(TEAM_TEMPLATES).map(t => <button type="button" className={styles.button} onClick={() => setDraft({ ...draft, permissions: { ...t.permissions } })} key={t.label}>{t.label}</button>)}</div><p className={styles.muted}>Templates are starting points. Values are hidden by default in every template.</p><div className={styles.grid}>{TEAM_PERMISSIONS.map(p => <label className={styles.check} key={p.key}><input type="checkbox" checked={draft.permissions[p.key]} onChange={e => setDraft({ ...draft, permissions: { ...draft.permissions, [p.key]: e.target.checked, ...(p.key === 'completeMaintenance' && e.target.checked ? { viewMaintenance: true } : {}), ...(p.key === 'viewMaintenance' && !e.target.checked ? { completeMaintenance: false } : {}) } })}/><span><strong>{p.label}</strong><small>{p.detail}</small></span></label>)}</div></>}
      {tab === 'Assets' && <><label className={styles.check}><input type="checkbox" checked={draft.scope === 'all'} onChange={e => setDraft({ ...draft, scope: e.target.checked ? 'all' : 'selected' })}/><span><strong>All current and future assets</strong><small>Includes assets added to this account later.</small></span></label>{draft.scope === 'selected' && <><h3 className={styles.section}>Registers</h3><p className={styles.muted}>Includes assets added to the selected registers later.</p><div className={styles.selectionList}>{data.registers.map(r => <label className={styles.check} key={r.id}><input type="checkbox" checked={draft.registerIds.includes(r.id)} onChange={() => toggle('registerIds', r.id)}/>{r.name}</label>)}</div><h3 className={styles.section}>Individual assets</h3><input className={styles.input} type="search" placeholder="Search assets…" aria-label="Search assets" value={query} onChange={e => setQuery(e.target.value)}/><div className={styles.selectionList}>{data.assets.filter(a => a.title.toLowerCase().includes(query.toLowerCase())).map(a => <label className={styles.check} key={a.id}><input type="checkbox" checked={draft.assetIds.includes(a.id)} onChange={() => toggle('assetIds', a.id)}/><span><strong>{a.title}</strong><small>{data.registers.find(r => r.id === a.registerId)?.name}</small></span></label>)}</div></>}</>}
      {tab === 'Documents' && <><p className={styles.notice}>Only the documents selected here can be opened. Values hidden does not redact the contents of an approved file. Select only documents this person is allowed to read.</p><div className={styles.selectionList}>{allowedDocs.map(d => <label className={styles.check} key={d.id}><input type="checkbox" checked={draft.documentIds.includes(d.id)} onChange={() => toggle('documentIds', d.id)}/>{d.title}</label>)}</div>{!allowedDocs.length && <p>No documents linked entirely to the selected assets. Choose the asset scope first.</p>}</>}
      </div><footer className={styles.footer}><button className={styles.button} type="button" onClick={() => setDraft(null)} disabled={busy}>Cancel</button>{tab !== 'Documents' ? <button type="button" className={styles.primary} onClick={() => setTab(['Person', 'Permissions', 'Assets', 'Documents'][['Person', 'Permissions', 'Assets', 'Documents'].indexOf(tab) + 1])}>Continue</button> : <button type="submit" className={styles.primary} disabled={busy || !draft.displayName.trim() || !draft.email.trim() || (draft.scope === 'selected' && !draft.registerIds.length && !draft.assetIds.length)}>{busy ? 'Saving…' : draft.id ? 'Save access' : 'Save and send invitation'}</button>}</footer></form>
    </TeamModal>}
    {confirm && <TeamModal title="Revoke access?" subtitle={confirm.email} onClose={() => setConfirm(null)} busy={busy}><div className={styles.body}><p>This person will lose access to this business workspace. Files already downloaded cannot be recalled.</p>{error && <p className={styles.error} role="alert">{error}</p>}</div><footer className={styles.footer}><button className={styles.button} onClick={() => setConfirm(null)} disabled={busy}>Cancel</button><button className={styles.danger} onClick={() => void submit({ action: 'revoke', id: confirm.id, version: confirm.version })} disabled={busy}>Revoke access</button></footer></TeamModal>}
  </main>;
}
