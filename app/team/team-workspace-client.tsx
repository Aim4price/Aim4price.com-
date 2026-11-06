'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import PageLoadingState from '../../components/PageLoadingState';
const AssetRegisterClient = dynamic(() => import('../asset-register/asset-register-client'), { loading: () => <PageLoadingState label="Loading Asset Register" detail="Getting your assets ready." /> });
import AppHeader from '../../components/AppHeader';
import type { TeamRegisterData } from '../../lib/team-register';
import registerStyles from '../asset-register/page.module.css';
import AssetAccessSettingsDialog from '../../components/asset-register/AssetAccessSettingsDialog';
import SwitchAccountButton from '../../components/SwitchAccountButton';
import styles from '../../components/team/team.module.css';
import { TEAM_PERMISSIONS, type TeamAsset, type TeamPermissions } from '../../lib/team-access-policy';
type Workspace = {
    available: boolean;
    id: string;
    name: string;
    status: 'pending' | 'active';
    permissions: TeamPermissions;
    expiresAt: string | null;
};
type WorkspaceData = TeamRegisterData;
type Document = {
    id: string;
    title: string;
    fileName: string;
    assetIds: string[];
};
type Maintenance = {
    id: string;
    title: string;
    type: string;
    status: string;
    statusLabel: string;
    dueDate: string | null;
    dueUsage: number | null;
    usageMetric: string | null;
    completedAt: string | null;
    completedBy: string;
    notes: string;
    completedNotes: string;
};
async function api(path: string, init?: RequestInit) { const response = await fetch(path, { ...init, cache: 'no-store' }); const body = await response.json(); if (!response.ok)
    throw new Error(body.error || 'This workspace is unavailable.'); return body; }
export default function TeamWorkspaceClient({ email, managed = false, managementAccount = false, initialWorkspace = '' }: {
    email: string;
    managed?: boolean;
    managementAccount?: boolean;
    initialWorkspace?: string;
}) {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]), [membership, setMembership] = useState(initialWorkspace), [data, setData] = useState<WorkspaceData | null>(null);
    const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState('');
    const [documents, setDocuments] = useState<Document[]>([]), [maintenance, setMaintenance] = useState<Maintenance[]>([]);
    const [section, setSection] = useState<'details' | 'maintenance' | 'documents' | 'photos'>('details');
    const [completion, setCompletion] = useState<Maintenance | null>(null), [workNotes, setWorkNotes] = useState('');
    const [company,setCompany]=useState(''),[mechanic,setMechanic]=useState('');
    const [file, setFile] = useState<File | null>(null);
    const uploadKey = useRef('');
    const generation = useRef(0);
    const currentVersion = useRef<number | null>(null);
    const base = '/api/team-workspaces/' + encodeURIComponent(membership);
    const selected = data?.assets.find(a => a.id === selectedId);
    const loadWorkspaces = useCallback(async () => { const response = await api('/api/team-workspaces'); setWorkspaces(response.workspaces);
      const available = response.workspaces.filter((workspace: Workspace) => workspace.available && workspace.status === 'active');
      if (available.length === 1) setMembership(current => current || available[0].id); }, []);
    useEffect(() => { void loadWorkspaces().catch(e => setError(e.message)).finally(() => { if (!initialWorkspace) setLoading(false); }); }, [loadWorkspaces, initialWorkspace]);
    const refresh = useCallback(async () => {
        if (!membership)
            return;
        const ticket = ++generation.current;
        try {
            const response = await api('/api/team-workspaces/' + encodeURIComponent(membership));
            if (ticket !== generation.current)
                return;
            if (currentVersion.current !== null && response.version !== currentVersion.current) {
                setSelectedId('');
                setDocuments([]);
                setMaintenance([]);

                setCompletion(null);
                setNotice('Your access has changed. The workspace has been refreshed.');
            }
            currentVersion.current = response.version;
            setData(response);
            setError('');
        }
        catch (e) {
            if (ticket !== generation.current)
                return;
            setData(null);
            setSelectedId('');
            setDocuments([]);
            setMaintenance([]);
            setError(e instanceof Error ? e.message : 'Workspace unavailable.');
        }
        finally {
            if (ticket === generation.current)
                setLoading(false);
        }
    }, [membership]);
    useEffect(() => {
        setData(null);
        setSelectedId('');
        setDocuments([]);
        setMaintenance([]);
        currentVersion.current = null;
        if (!membership)
            return;
        setLoading(true);
        void refresh();
        const onFocus = () => { if (!document.hidden)
            void refresh(); };
        const onVisibility = () => { if (document.hidden) {
            generation.current++;
            setData(null);
            setSelectedId('');
            setDocuments([]);
            setMaintenance([]);
        }
        else
            void refresh(); };
        const timer = setInterval(onFocus, 30000);
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);
        return () => { generation.current++; clearInterval(timer); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisibility); };
    }, [membership, refresh]);
    useEffect(() => {
        let cancelled = false;
        setDocuments([]);
        setMaintenance([]);
        setFile(null);

        setCompletion(null);
        if (!selectedId || !data)
            return;
        if (section === 'documents')
            void api(base + '/documents').then(r => { if (!cancelled)
                setDocuments(r.documents); }).catch(e => { if (!cancelled)
                setError(e.message); });
        if (section === 'maintenance' && data.permissions.viewMaintenance)
            void api(base + '/maintenance?assetId=' + encodeURIComponent(selectedId)).then(r => { if (!cancelled)
                setMaintenance(r.records); }).catch(e => { if (!cancelled)
                setError(e.message); });
        return () => { cancelled = true; };
    }, [selectedId, section, membership, data?.version]); // Permission revisions invalidate all subsidiary data.
    async function act(fn: () => Promise<void>) { setBusy(true); setError(''); setNotice(''); try {
        await fn();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to complete the action.');
    }
    finally {
        setBusy(false);
    } }
    async function download(path: string, name: string) { const response = await fetch(path, { cache: 'no-store' }); if (!response.ok) {
        const r = await response.json();
        throw Error(r.error);
    } const url = URL.createObjectURL(await response.blob()); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    function openAsset(asset: TeamAsset) { setError(''); setNotice(''); setSection('details'); setSelectedId(asset.id);   }
    async function upload() { if (!file || !selected)
        return; const form = new FormData(); form.set('file', file); form.set('assetId', selected.id); form.set('requestId', uploadKey.current); await api(base + '/' + section, { method: 'POST', body: form }); setFile(null); await refresh(); setNotice(section === 'documents' ? 'Document uploaded for owner review.' : 'Photo uploaded.'); }
    return <>
    {managed && <AppHeader active="asset-register" brandAlignment="working-column" desktopContext={{name:data?.name || "Aim4price", logoUrl:data?.logoUrl, accountType:data?.accountType, accountSubtype:data?.accountSubtype, onSignOut:() => void act(async () => { await api('/api/team-login', { method: 'DELETE' }); window.location.assign('/auth#login'); })}}/>}
    {!data && <main className={styles.page}>
    <header className={styles.header}><div><h1>{membership ? 'Asset Register' : 'Choose a business'}</h1><p>Signed in as {email}</p></div><div className={styles.actions}><Link className={styles.button} href={managementAccount ? "/account" : "/team/access"}>{managementAccount ? "Account" : "My access"}</Link>{membership && <button className={styles.button} onClick={() => { setMembership(''); setError(''); void loadWorkspaces().catch(e => setError(e.message)); }}>Switch workspace</button>}{managed ? <button className={styles.button} onClick={() => void act(async () => { await api('/api/team-login', { method: 'DELETE' }); window.location.assign('/team'); })}>Sign out</button> : <SwitchAccountButton returnTo="/team"/>}</div></header>
    {error && !selected && <p className={styles.error} role="alert">{error}</p>}{notice && !selected && <p className={styles.notice} role="status">{notice}</p>}
    {loading && <p role="status">Loading workspace…</p>}
    {!membership && <div className={styles.grid}>{workspaces.map(w => <article className={styles.card} key={w.id}><h2>{w.name}</h2><span className={styles.pill}>{!w.available ? "Workspace unavailable" : w.status === "active" ? "Active access" : "Ready to accept"}</span><p className={styles.muted}>{w.permissions.viewValues ? 'Asset values are visible.' : 'Asset values are hidden.'} {w.expiresAt ? `Access expires ${new Date(w.expiresAt).toLocaleDateString('en-ZA')}.` : ''}</p><p className={styles.muted}>{TEAM_PERMISSIONS.filter(p => w.permissions[p.key]).map(p => p.label).join(' · ') || 'View asset details only'}</p><button className={styles.primary} disabled={busy || !w.available} onClick={() => void act(async () => { if (w.status === 'pending')
        await api('/api/team-workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: w.id }) }); setMembership(w.id); })}>Open workspace</button></article>)}</div>}
    {!loading && !membership && !workspaces.length && <p className={styles.notice}>No desktop access is available. Ask your business owner to check your access.</p>}
    </main>}
    {data && <>
      {!managed && <div className={styles.actions} style={{padding:'1rem 6%'}}><Link className={styles.button} href={managementAccount ? '/account' : '/team/access'}>{managementAccount ? 'Account' : 'My access'}</Link>{workspaces.length > 1 && <button className={styles.button} onClick={() => {generation.current++;setData(null);setMembership('');setSelectedId('');}}>Switch business</button>}</div>}
      {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
      <AssetRegisterClient showAppHeader={false} desktopAccess={{data, membership, onRefresh: () => void refresh(),
        onManage: (id, target = "details") => {const asset = data.assets.find(item => item.id === id);if(asset) {openAsset(asset);setSection(target);}},
        onUpload: async (id, kind, files) => {for(const file of files) {const form = new FormData();form.set('file',file);form.set('assetId',id);form.set('requestId',crypto.randomUUID());await api(base+'/'+kind,{method:'POST',body:form});} await refresh();},
        onSave: async (id, patch) => {await api(base, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({assetId:id,patch})}); await refresh();}}}/>
    </>}
    {selected && data && <AssetAccessSettingsDialog title={section === 'maintenance' ? 'Maintenance' : section === 'photos' ? 'Photos' : 'Documents'} assetTitle={selected.title} documentsLayout onClose={() => {if(!busy)setSelectedId('');}} footer={<button className={registerStyles.primaryButton} onClick={() => setSelectedId('')} disabled={busy}>Done</button>}>
      <div className={styles.body}>

        {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
        {section === 'maintenance' && <div className={styles.list}>{maintenance.map(r => <article className={styles.card} key={r.id}><h3>{r.title}</h3><span className={styles.pill}>{r.statusLabel}</span><p className={styles.muted}>{r.dueDate ? `Due ${r.dueDate}` : r.dueUsage != null ? `Due at ${r.dueUsage} ${r.usageMetric}` : ''}</p><p>{r.notes}</p>{r.status === 'done' ? <p>{r.completedNotes} · {r.completedBy}</p> : data.permissions.completeMaintenance && r.status !== 'cancelled' && <button className={styles.button} onClick={() => { setCompletion(r); setWorkNotes(''); setCompany(''); setMechanic(''); }}>Mark completed</button>}
          {completion?.id === r.id && <form onSubmit={e => { e.preventDefault(); void act(async () => { await api(base + '/maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId: selected.id, recordId: r.id, notes: workNotes, company, mechanic }) }); setCompletion(null); const result = await api(base + '/maintenance?assetId=' + selected.id); setMaintenance(result.records); setNotice('Maintenance completion recorded under your name.'); }); }}><label className={styles.field}>Work completed<textarea className={styles.textarea} required maxLength={3000} value={workNotes} onChange={e => setWorkNotes(e.target.value)}/></label><div className={styles.fields}>{r.type==='service'&&<><label className={styles.field}>Service company<input className={styles.input} required maxLength={150} value={company} onChange={e=>setCompany(e.target.value)}/></label><label className={styles.field}>Mechanic<input className={styles.input} required maxLength={150} value={mechanic} onChange={e=>setMechanic(e.target.value)}/></label></>}</div><p className={styles.muted}>Any existing repeat schedule continues. The owner manages future repeats.</p><div className={styles.actions}><button type="button" className={styles.button} onClick={() => setCompletion(null)}>Cancel</button><button className={styles.primary} disabled={busy}>Confirm completed</button></div></form>}
        </article>)}{!maintenance.length && <p>No maintenance records for this asset.</p>}</div>}
        {section === 'documents' && <><p className={styles.muted}>Documents allowed by your account holder appear here. Downloads contain the original file, which may include prices.</p>{!documents.some(d => d.assetIds.includes(selected.id)) && <p>No approved documents for this asset.</p>}<div className={styles.list}>{documents.filter(d => d.assetIds.includes(selected.id)).map(d => <article className={styles.card} key={d.id}><h3>{d.title}</h3><button className={styles.button} disabled={busy} onClick={() => void act(() => download(base + '/documents?id=' + encodeURIComponent(d.id), d.fileName))}>Download document</button></article>)}</div></>}
        {section === 'photos' && <div className={styles.photos}>{Array.from({ length: selected.photoCount }, (_, i) => <img key={i} src={base + '/photos?assetId=' + selected.id + '&index=' + i} alt={`Asset photo ${i + 1}`} onError={e => { e.currentTarget.style.display = 'none'; }}/>)}</div>}
        {(section === 'photos' && data.permissions.uploadPhotos || section === 'documents' && data.permissions.uploadDocuments) && <form onSubmit={e => { e.preventDefault(); void act(upload); }} style={{ marginTop: '1.4rem' }}><label className={styles.field}>{section === 'photos' ? 'Add a photo (up to 5 MB)' : 'Upload a document for owner review (up to 25 MB)'}<input className={styles.input} key={section} type="file" accept={section === 'photos' ? 'image/jpeg,image/png,image/webp' : '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt'} onChange={e => { setFile(e.target.files?.[0] || null); uploadKey.current = crypto.randomUUID(); }}/></label><button className={styles.primary} style={{ marginTop: '.8rem' }} disabled={busy || !file}>{busy ? 'Uploading…' : 'Upload'}</button></form>}
      </div>
    </AssetAccessSettingsDialog>}
  </>;
}
