'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import TeamModal from '../../components/team/TeamModal';
import SwitchAccountButton from '../../components/SwitchAccountButton';
import styles from '../../components/team/team.module.css';
import { TEAM_PERMISSIONS, type TeamAsset, type TeamPermissions } from '../../lib/team-access-policy';
type Workspace = {
    id: string;
    name: string;
    status: 'pending' | 'active';
    permissions: TeamPermissions;
    expiresAt: string | null;
};
type WorkspaceData = {
    name: string;
    permissions: TeamPermissions;
    assets: TeamAsset[];
    version: number;
};
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
const money = (n: number | null | undefined) => n == null ? 'Not recorded' : new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);
export default function TeamWorkspaceClient({ email, managed = false }: {
    email: string;
    managed?: boolean;
}) {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]), [membership, setMembership] = useState(''), [data, setData] = useState<WorkspaceData | null>(null);
    const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [query, setQuery] = useState(''), [register, setRegister] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [documents, setDocuments] = useState<Document[]>([]), [maintenance, setMaintenance] = useState<Maintenance[]>([]);
    const [section, setSection] = useState<'details' | 'maintenance' | 'documents' | 'photos'>('details');
    const [edit, setEdit] = useState(false), [patch, setPatch] = useState<Record<string, unknown>>({}), [completion, setCompletion] = useState<Maintenance | null>(null), [workNotes, setWorkNotes] = useState('');
    const [company,setCompany]=useState(''),[mechanic,setMechanic]=useState('');
    const [file, setFile] = useState<File | null>(null);
    const uploadKey = useRef('');
    const generation = useRef(0);
    const currentVersion = useRef<number | null>(null);
    const base = '/api/team-workspaces/' + encodeURIComponent(membership);
    const selected = data?.assets.find(a => a.id === selectedId);
    const loadWorkspaces = useCallback(async () => { const response = await api('/api/team-workspaces'); setWorkspaces(response.workspaces); }, []);
    useEffect(() => { void loadWorkspaces().catch(e => setError(e.message)).finally(() => setLoading(false)); }, [loadWorkspaces]);
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
                setEdit(false);
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
        setEdit(false);
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
    function openAsset(asset: TeamAsset) { setError(''); setNotice(''); setSection('details'); setSelectedId(asset.id); setEdit(false); setPatch({}); }
    async function upload() { if (!file || !selected)
        return; const form = new FormData(); form.set('file', file); form.set('assetId', selected.id); form.set('requestId', uploadKey.current); await api(base + '/' + section, { method: 'POST', body: form }); setFile(null); await refresh(); setNotice(section === 'documents' ? 'Document uploaded for owner review.' : 'Photo uploaded.'); }
    return <main className={styles.page}>
    <header className={styles.header}><div><h1>{data?.name || 'My desktop access'}</h1><p>Signed in as {email}</p></div><div className={styles.actions}>{membership && <button className={styles.button} onClick={() => { setMembership(''); setError(''); void loadWorkspaces().catch(e => setError(e.message)); }}>Switch workspace</button>}{managed ? <button className={styles.button} onClick={() => void act(async () => { await api('/api/team-login', { method: 'DELETE' }); window.location.assign('/team'); })}>Sign out</button> : <SwitchAccountButton returnTo="/team"/>}</div></header>
    {error && !selected && <p className={styles.error} role="alert">{error}</p>}{notice && !selected && <p className={styles.notice} role="status">{notice}</p>}
    {loading && <p role="status">Loading workspace…</p>}
    {!membership && <div className={styles.grid}>{workspaces.map(w => <article className={styles.card} key={w.id}><h2>{w.name}</h2><span className={styles.pill}>Active access</span><p className={styles.muted}>{w.permissions.viewValues ? 'Asset values are visible.' : 'Asset values are hidden.'} {w.expiresAt ? `Access expires ${new Date(w.expiresAt).toLocaleDateString('en-ZA')}.` : ''}</p><p className={styles.muted}>{TEAM_PERMISSIONS.filter(p => w.permissions[p.key]).map(p => p.label).join(' · ') || 'View asset details only'}</p><button className={styles.primary} disabled={busy} onClick={() => void act(async () => { if (w.status === 'pending')
        await api('/api/team-workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: w.id }) }); setMembership(w.id); setQuery(''); setRegister(''); })}>Open workspace</button></article>)}</div>}
    {!loading && !membership && !workspaces.length && <p className={styles.notice}>No desktop access for this email. Ask the business owner to add {email} under Account → Desktop users.</p>}
    {data && <><div className={styles.header}><div className={styles.actions}><span className={styles.pill}>{data.assets.length} accessible assets</span><span className={styles.pill}>{data.permissions.viewValues ? 'Values visible' : 'Values hidden'}</span></div><div className={styles.actions}><button className={styles.button} disabled={busy} onClick={() => void refresh()}>Refresh</button>{data.permissions.exportAssets && <button className={styles.button} disabled={busy} onClick={() => void act(() => download(base + '/export', 'team-assets.csv'))}>Download asset list</button>}</div></div>
      <div className={`${styles.fields} ${styles.search}`}><input className={styles.input} type="search" aria-label="Search assets" placeholder="Search assets, brands or serial numbers…" value={query} onChange={e => setQuery(e.target.value)}/><select className={styles.select} aria-label="Filter register" value={register} onChange={e => setRegister(e.target.value)}><option value="">All accessible registers</option>{[...new Map(data.assets.map(a => [a.registerId || '', a.registerName])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
      <div className={styles.list}>{data.assets.filter(a => (!register || a.registerId === register) && [a.title, a.brand, a.model, a.serial, a.registration].join(' ').toLowerCase().includes(query.toLowerCase())).map(asset => <article key={asset.id} className={`${styles.card} ${styles.asset}`}><div><h2>{asset.title}</h2><p>{asset.registerName}</p><p className={styles.muted}>{asset.year || 'Year not recorded'} · {asset.usage ?? '—'} {asset.usageMetric} · {asset.condition}</p></div><div className={styles.actions}>{asset.values && <div className={styles.values}>{money(asset.values.current)}<small>Current value · excl. VAT</small></div>}<button className={styles.button} onClick={() => openAsset(asset)}>Open asset →</button></div></article>)}</div>{!data.assets.length && <p className={styles.notice}>No assets are currently included in your access. Contact the business owner.</p>}
    </>}
    {selected && data && <TeamModal title={selected.title} subtitle={`${selected.registerName} · ${selected.year || 'Year not recorded'} · ${selected.condition}`} onClose={() => setSelectedId('')} busy={busy}>
      <div className={styles.body}>
        <div className={styles.tabs}>{(['details', ...(data.permissions.viewMaintenance ? ['maintenance'] : []), 'documents', ...((data.permissions.viewPhotos || data.permissions.uploadPhotos) ? ['photos'] : [])] as typeof section[]).map(s => <button key={s} className={section === s ? styles.primary : styles.button} aria-pressed={section === s} onClick={() => setSection(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
        {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
        {section === 'details' && <><dl className={styles.details}>{[['Brand', selected.brand], ['Model', selected.model], ['Serial / VIN', selected.serial], ['Registration', selected.registration], ['Usage', `${selected.usage ?? 'Not recorded'} ${selected.usageMetric}`], ...(selected.values ? [['Current value (excl. VAT)', money(selected.values.current)], ['Replacement value (excl. VAT)', money(selected.values.replacement)], ['Insured value (excl. VAT)', money(selected.values.insured)]] : [])].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>
        {!edit && (data.permissions.editDetails || data.permissions.updateUsage) && <button className={styles.button} onClick={() => { setEdit(true); setPatch({}); }}>Edit permitted details</button>}
        {edit && <form onSubmit={e => { e.preventDefault(); void act(async () => { await api(base, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId: selected.id, patch }) }); setEdit(false); await refresh(); setNotice('Asset details saved.'); }); }}><div className={styles.fields}>
          {data.permissions.editDetails && <>{(['title', 'brand', 'model'] as const).map(key => <label className={styles.field} key={key}>{key[0].toUpperCase() + key.slice(1)}<input className={styles.input} maxLength={180} value={String(patch[key] ?? selected[key])} onChange={e => setPatch({ ...patch, [key]: e.target.value })}/></label>)}<label className={styles.field}>Year<input className={styles.input} type="number" min={1900} max={new Date().getFullYear() + 1} value={patch.yearModel === null ? '' : String(patch.yearModel ?? selected.year ?? '')} onChange={e => setPatch({ ...patch, yearModel: e.target.value ? Number(e.target.value) : null })}/></label><label className={styles.field}>Condition<select className={styles.select} value={String(patch.condition ?? selected.condition)} onChange={e => setPatch({ ...patch, condition: e.target.value })}>{['excellent', 'good', 'fair', 'poor'].map(v => <option key={v}>{v}</option>)}</select></label></>}
          {data.permissions.updateUsage && !['not_applicable', 'none'].includes(selected.usageMetric) && <label className={styles.field}>Usage ({selected.usageMetric})<input className={styles.input} type="number" min={selected.usage ?? 0} step="any" value={String(patch.usage ?? selected.usage ?? '')} onChange={e => setPatch({ ...patch, usage: e.target.value === '' ? undefined : Number(e.target.value) })}/><small className={styles.muted}>Readings can increase only. Ask the owner to correct an incorrect reading.</small></label>}
        </div><div className={styles.actions} style={{ marginTop: '1rem' }}><button className={styles.button} type="button" onClick={() => setEdit(false)}>Cancel edit</button><button className={styles.primary} disabled={busy || !Object.keys(patch).length}>Save changes</button></div></form>}</>}
        {section === 'maintenance' && <div className={styles.list}>{maintenance.map(r => <article className={styles.card} key={r.id}><h3>{r.title}</h3><span className={styles.pill}>{r.statusLabel}</span><p className={styles.muted}>{r.dueDate ? `Due ${r.dueDate}` : r.dueUsage != null ? `Due at ${r.dueUsage} ${r.usageMetric}` : ''}</p><p>{r.notes}</p>{r.status === 'done' ? <p>{r.completedNotes} · {r.completedBy}</p> : data.permissions.completeMaintenance && r.status !== 'cancelled' && <button className={styles.button} onClick={() => { setCompletion(r); setWorkNotes(''); setCompany(''); setMechanic(''); }}>Mark completed</button>}
          {completion?.id === r.id && <form onSubmit={e => { e.preventDefault(); void act(async () => { await api(base + '/maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId: selected.id, recordId: r.id, notes: workNotes, company, mechanic }) }); setCompletion(null); const result = await api(base + '/maintenance?assetId=' + selected.id); setMaintenance(result.records); setNotice('Maintenance completion recorded under your name.'); }); }}><label className={styles.field}>Work completed<textarea className={styles.textarea} required maxLength={3000} value={workNotes} onChange={e => setWorkNotes(e.target.value)}/></label><div className={styles.fields}>{r.type==='service'&&<><label className={styles.field}>Service company<input className={styles.input} required maxLength={150} value={company} onChange={e=>setCompany(e.target.value)}/></label><label className={styles.field}>Mechanic<input className={styles.input} required maxLength={150} value={mechanic} onChange={e=>setMechanic(e.target.value)}/></label></>}</div><p className={styles.muted}>Any existing repeat schedule continues. The owner manages future repeats.</p><div className={styles.actions}><button type="button" className={styles.button} onClick={() => setCompletion(null)}>Cancel</button><button className={styles.primary} disabled={busy}>Confirm completed</button></div></form>}
        </article>)}{!maintenance.length && <p>No maintenance records for this asset.</p>}</div>}
        {section === 'documents' && <><p className={styles.muted}>Only documents explicitly approved by the owner appear here.</p>{!documents.some(d => d.assetIds.includes(selected.id)) && <p>No approved documents for this asset.</p>}<div className={styles.list}>{documents.filter(d => d.assetIds.includes(selected.id)).map(d => <article className={styles.card} key={d.id}><h3>{d.title}</h3><button className={styles.button} disabled={busy} onClick={() => void act(() => download(base + '/documents?id=' + encodeURIComponent(d.id), d.fileName))}>Download document</button></article>)}</div></>}
        {section === 'photos' && <div className={styles.photos}>{Array.from({ length: selected.photoCount }, (_, i) => <img key={i} src={base + '/photos?assetId=' + selected.id + '&index=' + i} alt={`Asset photo ${i + 1}`} onError={e => { e.currentTarget.style.display = 'none'; }}/>)}</div>}
        {(section === 'photos' && data.permissions.uploadPhotos || section === 'documents' && data.permissions.uploadDocuments) && <form onSubmit={e => { e.preventDefault(); void act(upload); }} style={{ marginTop: '1.4rem' }}><label className={styles.field}>{section === 'photos' ? 'Add a photo (up to 5 MB)' : 'Upload a document for owner review (up to 25 MB)'}<input className={styles.input} key={section} type="file" accept={section === 'photos' ? 'image/jpeg,image/png,image/webp' : '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt'} onChange={e => { setFile(e.target.files?.[0] || null); uploadKey.current = crypto.randomUUID(); }}/></label><button className={styles.primary} style={{ marginTop: '.8rem' }} disabled={busy || !file}>{busy ? 'Uploading…' : 'Upload'}</button></form>}
      </div><footer className={styles.footer}><button className={styles.primary} onClick={() => setSelectedId('')} disabled={busy}>Done</button></footer>
    </TeamModal>}
  </main>;
}
