'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AssetActionIcon from '../asset-register/AssetActionIcon';
import actionColours from './ManageActionGrid.module.css';
import SharedAssetContributionDialog from './SharedAssetContributionDialog';
import SharedAssetPaperwork from './SharedAssetPaperwork';
import MaintenanceEntryChoice from '../MaintenanceEntryChoice';
import DesktopServiceModal from '../DesktopServiceModal';
import AssetDetailsFields from '../AssetDetailsFields';
import styles from './SharedAssetWorkDialog.module.css';
import assetStyles from '../../app/asset-register/page.module.css';
import LeadActionDialog from './LeadActionDialog';
import type { AssetOption } from '../../app/my-invoices/my-invoices-client';
import type { MaintenanceIdentity } from '../../lib/maintenance-catalogue';
export default function SharedAssetWorkDialog({ endpoint, action, assetTitle, assetSubtitle, onClose, onSaved, onSchedule, initialField, onDocuments }: {
    onDocuments?: () => void;
    initialField?: 'year'|'usage'|'condition'|'finance'|'insurance'|'license';
    endpoint: string;
    action: 'details' | 'maintenance' | 'history';
    assetTitle: string;
    assetSubtitle?: string;
    onClose: () => void;
    onSaved?: () => void;
    onSchedule?: () => void;
}) {
    const [detailsTab,setDetailsTab]=useState<'menu'|'details'|'paperwork'|'documents'|'photos'>(initialField ? ['finance','insurance','license'].includes(initialField) ? 'paperwork' : 'details' : 'menu');
    const [entryStep, setEntryStep] = useState<'timing' | 'type'>('timing');
    const router = useRouter(), [asset, setAsset] = useState<(Omit<AssetOption, 'usageMetric'> & {
        usageMetric: AssetOption['usageMetric'] | 'none';
        maintenanceIdentity?: MaintenanceIdentity;
    }) | null>(null), [permissions, setPermissions] = useState<Record<string, boolean>>({}), [items, setItems] = useState<Array<{
        actor_name: string;
        created_at: string;
        action: string;
        before_data: Record<string, unknown>;
        after_data: Record<string, unknown>;
    }>>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [type, setType] = useState<'service' | 'checkup' | null>(null), [year, setYear] = useState(''), [usage, setUsage] = useState(''), [condition, setCondition] = useState(''), [requestId,setRequestId] = useState(() => crypto.randomUUID());
    useEffect(() => { const c = new AbortController(); fetch(`${endpoint}/${action}`, { cache: 'no-store', signal: c.signal }).then(async (r) => { const d = await r.json(); if (!r.ok)
        throw Error(d.error); if (d.asset) {
        setAsset(d.asset);
        setYear(String(d.asset.yearModel || ''));
        setUsage(String(d.asset.usageReading ?? ''));
        setCondition(d.asset.condition || '');
        setPermissions(d.permissions);
    } setItems(d.items || []); }).catch(e => { if (!c.signal.aborted)
        setError(e.message); }); return () => c.abort(); }, [endpoint, action]);
    const backToMenu=()=>{setDetailsTab('menu');setSaved(false);};
    const focusRoot = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (!asset || !initialField) return;
      const target = focusRoot.current?.querySelector<HTMLElement>(`[data-asset-detail-edit-target="${initialField}"] input, [data-asset-detail-edit-target="${initialField}"] button`);
      target?.focus();
    }, [asset, initialField, detailsTab]);
    async function save(body: Record<string, unknown>) { setBusy(true); setError(''); try {
        const r = await fetch(`${endpoint}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, requestId }) });
        const d = await r.json();
        if (!r.ok)
            throw Error(d.error || 'Could not save.');
        setSaved(true);
        setRequestId(crypto.randomUUID());
        if(action==='details')setAsset(current=>current?{...current,yearModel:year?Number(year):null,usageReading:usage?Number(usage):null,condition}:current);
        router.refresh();
        onSaved?.();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Please try again.');
        throw e;
    }
    finally {
        setBusy(false);
    } }
    if (action === 'maintenance' && asset && !type && !saved)
        return entryStep === 'timing' ? <MaintenanceEntryChoice step="timing" assetTitle={asset.title} onClose={onClose} onDone={() => setEntryStep('type')} onUpcoming={onSchedule} /> : <MaintenanceEntryChoice step="type" timing="done" assetTitle={asset.title} onClose={onClose} onBack={() => setEntryStep('timing')} onType={setType} />;
    if (action === 'maintenance' && asset && type && !saved)
        return <><DesktopServiceModal checklistEndpoint={`${endpoint}/checklist`} standalone record={{ id: asset.id, assetId: asset.id, assetTitle: asset.title, assetKind: asset.kind, assetCategoryLabel: asset.categoryLabel, assetYearModel: asset.yearModel, assetCondition: asset.condition, maintenanceIdentity: asset.maintenanceIdentity, maintenanceType: type, title: type === 'service' ? 'Service or repair' : 'Check-up', currentUsage: asset.usageReading, usageMetric: asset.usageMetric === 'none' ? null : asset.usageMetric }} busy={busy} onClose={onClose} onBack={() => setType(null)} onSubmit={completion => save({ ...completion, maintenanceType: type })}/></>;
    if(action==='details' && detailsTab==='photos' && permissions.addPhotos) return <SharedAssetContributionDialog kind="photos" endpoint={`${endpoint}/photos`} assetTitle={assetTitle} onClose={()=>setDetailsTab('documents')} onSaved={onSaved}/>;
    if(action==='details' && detailsTab==='menu') return <LeadActionDialog title="Update asset" assetTitle={assetTitle} onClose={onClose} className={`${styles.detailsDialog} ${styles.menuDialog}`} footer={<button type="button" className={assetStyles.secondaryButton} onClick={onClose}>Exit</button>}>
      {error?<p role="alert">{error}</p>:!asset?<p>Loading asset…</p>:<div className={`${assetStyles.optionsGrid} ${assetStyles.assetOptionsGrid} ${assetStyles.ownerCommandGrid} ${actionColours.grid} ${styles.updateMenu}`} data-manage-actions>
        {(permissions.yearModel||permissions.usage||permissions.condition)&&<button data-manage-action="details" type="button" className={`${assetStyles.optionActionButton} ${assetStyles.ownerCommandAction}`} onClick={()=>setDetailsTab('details')}><AssetActionIcon action="details" className={assetStyles.buttonIcon}/><span><strong>Details</strong><small>Edit asset details and usage.</small></span></button>}
        {permissions.updateDetails&&<button data-manage-action="documents" type="button" className={`${assetStyles.optionActionButton} ${assetStyles.ownerCommandAction}`} onClick={()=>setDetailsTab('paperwork')}><svg className={assetStyles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/></svg><span><strong>Paperwork</strong><small>Manage asset paperwork.</small></span></button>}
        {(permissions.addPhotos||onDocuments)&&<button data-manage-action="addPhotos" type="button" className={`${assetStyles.optionActionButton} ${assetStyles.ownerCommandAction}`} onClick={()=>setDetailsTab('documents')}><AssetActionIcon action="documents" className={assetStyles.buttonIcon}/><span><strong>Documents</strong><small>{onDocuments?'Manage documents and photos.':'Manage asset photos.'}</small></span></button>}
      </div>}
    </LeadActionDialog>;
    if(action==='details' && detailsTab==='documents') return <LeadActionDialog title={assetTitle} assetTitle="Documents" onClose={backToMenu} className={styles.detailsDialog} footer={<button type="button" className={assetStyles.secondaryButton} onClick={backToMenu}>Back to update asset</button>}><div className={`${styles.updateMenu} ${actionColours.grid}`} data-manage-actions>
      {permissions.addPhotos&&<button data-manage-action="addPhotos" className={`${assetStyles.optionActionButton} ${assetStyles.ownerCommandAction}`} onClick={()=>setDetailsTab('photos')}><AssetActionIcon action="addPhotos" className={assetStyles.buttonIcon}/><span><strong>Add photos</strong><small>Add photos to the owner's asset.</small></span></button>}
      {onDocuments&&<button data-manage-action="documents" className={`${assetStyles.optionActionButton} ${assetStyles.ownerCommandAction}`} onClick={onDocuments}><AssetActionIcon action="documents" className={assetStyles.buttonIcon}/><span><strong>Documents</strong><small>Open shared documents.</small></span></button>}
    </div></LeadActionDialog>;
    return <LeadActionDialog title={action === 'details' ? assetTitle : action === 'history' ? 'Asset history' : 'Add maintenance'} assetTitle={action==='details' ? detailsTab==='paperwork'?'Paperwork':'Details' : assetTitle} assetSubtitle={assetSubtitle} onClose={action==='details'&&!initialField?backToMenu:onClose} busy={busy} className={action === 'details' ? styles.detailsDialog : ''} footer={action === 'details' && detailsTab === 'details' && asset && !saved ? <><button type="button" className={assetStyles.secondaryButton} onClick={initialField?onClose:backToMenu}>{initialField?'Cancel':'Back'}</button><button className={assetStyles.primaryButton} disabled={busy || !(permissions.yearModel && year !== String(asset.yearModel || '') || permissions.usage && usage !== String(asset.usageReading ?? '') || permissions.condition && condition !== asset.condition)} onClick={() => { const patch: Record<string, unknown> = {}; if (permissions.yearModel && year !== String(asset.yearModel || ''))
        patch.yearModel = year ? Number(year) : null; if (permissions.usage && usage !== String(asset.usageReading ?? ''))
        patch.usage = Number(usage); if (permissions.condition && condition !== asset.condition)
        patch.condition = condition; void save({ patch }).catch(() => { }); }}>{busy ? 'Saving…' : 'Save changes'}</button></> : action==='details'?<button type="button" className={assetStyles.secondaryButton} onClick={initialField?onClose:backToMenu}>{initialField?'Done':'Back to update asset'}</button>:undefined}>

 {detailsTab === 'paperwork' && action === 'details' ? <SharedAssetPaperwork initialSection={initialField === 'finance' || initialField === 'insurance' || initialField === 'license' ? initialField : undefined} endpoint={endpoint} onSaved={()=>{router.refresh();onSaved?.()}}/> : <>{error && <p role="alert">{error}</p>}{saved ? <p role="status">Saved to the owner’s asset.</p> : action === 'history' ? <>{!items.length ? <p>No shared changes recorded yet.</p> : items.map((i, index) => <article className={styles.event} key={index}><strong>{i.actor_name} · {new Date(i.created_at).toLocaleString('en-ZA')}</strong><p>{i.action}</p>{i.action === 'Maintenance completed' && <p>{String(i.after_data.title || 'Maintenance')} · {String(i.after_data.date || '')}</p>}{['yearModel', 'usage', 'condition'].filter(k => i.before_data[k] !== i.after_data[k] && k in i.after_data).map(k => <p key={k}>{k === 'yearModel' ? 'Year' : k === 'usage' ? 'Usage' : 'Condition'}: {String(i.before_data[k] ?? 'Not saved')} → {String(i.after_data[k] ?? 'Not saved')}</p>)}</article>)}</> : !asset ? <p>Loading asset…</p> : <div ref={focusRoot}><div className={styles.assetIdentity}><span>Asset</span><strong>{asset.title}</strong></div><AssetDetailsFields className={styles.fields} year={year} usage={usage} condition={condition} onYear={setYear} onUsage={setUsage} onCondition={setCondition} canYear={permissions.yearModel} canUsage={permissions.usage && asset.usageMetric !== 'none'} canCondition={permissions.condition} usageLabel={`Usage (${asset.usageMetric})`}/></div>}
 </>}
 </LeadActionDialog>;
}
