'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DesktopServiceModal from '../DesktopServiceModal';
import AssetDetailsFields from '../AssetDetailsFields';
import styles from './SharedAssetWorkDialog.module.css';
import assetStyles from '../../app/asset-register/page.module.css';
import LeadActionDialog from './LeadActionDialog';
import type { AssetOption } from '../../app/my-invoices/my-invoices-client';
import type { MaintenanceIdentity } from '../../lib/maintenance-catalogue';
export default function SharedAssetWorkDialog({ endpoint, action, assetTitle, assetSubtitle, onClose, onSaved }: {
    endpoint: string;
    action: 'details' | 'maintenance' | 'history';
    assetTitle: string;
    assetSubtitle?: string;
    onClose: () => void;
    onSaved?: () => void;
}) {
    const router = useRouter(), [asset, setAsset] = useState<(Omit<AssetOption, 'usageMetric'> & {
        usageMetric: AssetOption['usageMetric'] | 'none';
        maintenanceIdentity?: MaintenanceIdentity;
    }) | null>(null), [permissions, setPermissions] = useState<Record<string, boolean>>({}), [items, setItems] = useState<Array<{
        actor_name: string;
        created_at: string;
        action: string;
        before_data: Record<string, unknown>;
        after_data: Record<string, unknown>;
    }>>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [type, setType] = useState<'service' | 'checkup' | null>(null), [year, setYear] = useState(''), [usage, setUsage] = useState(''), [condition, setCondition] = useState(''), [requestId] = useState(() => crypto.randomUUID());
    useEffect(() => { const c = new AbortController(); fetch(`${endpoint}/${action}`, { cache: 'no-store', signal: c.signal }).then(async (r) => { const d = await r.json(); if (!r.ok)
        throw Error(d.error); if (d.asset) {
        setAsset(d.asset);
        setYear(String(d.asset.yearModel || ''));
        setUsage(String(d.asset.usageReading ?? ''));
        setCondition(d.asset.condition || '');
        setPermissions(d.permissions);
    } setItems(d.items || []); }).catch(e => { if (!c.signal.aborted)
        setError(e.message); }); return () => c.abort(); }, [endpoint, action]);
    async function save(body: Record<string, unknown>) { setBusy(true); setError(''); try {
        const r = await fetch(`${endpoint}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, requestId }) });
        const d = await r.json();
        if (!r.ok)
            throw Error(d.error || 'Could not save.');
        setSaved(true);
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
    if (action === 'maintenance' && asset && type && !saved)
        return <><DesktopServiceModal checklistEndpoint={`${endpoint}/checklist`} standalone record={{ id: asset.id, assetId: asset.id, assetTitle: asset.title, assetKind: asset.kind, assetCategoryLabel: asset.categoryLabel, assetYearModel: asset.yearModel, assetCondition: asset.condition, maintenanceIdentity: asset.maintenanceIdentity, maintenanceType: type, title: type === 'service' ? 'Service or repair' : 'Check-up', currentUsage: asset.usageReading, usageMetric: asset.usageMetric === 'none' ? null : asset.usageMetric }} busy={busy} onClose={onClose} onBack={() => setType(null)} onSubmit={completion => save({ ...completion, maintenanceType: type })}/></>;
    return <LeadActionDialog title={action === 'details' ? 'Update asset' : action === 'history' ? 'Asset history' : 'Add maintenance'} assetTitle={assetSubtitle ?? assetTitle} onClose={onClose} busy={busy} footer={action === 'details' && asset && !saved ? <><button type="button" className={assetStyles.secondaryButton} onClick={onClose}>Cancel</button><button className={assetStyles.primaryButton} disabled={busy || !(permissions.yearModel && year !== String(asset.yearModel || '') || permissions.usage && usage !== String(asset.usageReading ?? '') || permissions.condition && condition !== asset.condition)} onClick={() => { const patch: Record<string, unknown> = {}; if (permissions.yearModel && year !== String(asset.yearModel || ''))
        patch.yearModel = year ? Number(year) : null; if (permissions.usage && usage !== String(asset.usageReading ?? ''))
        patch.usage = Number(usage); if (permissions.condition && condition !== asset.condition)
        patch.condition = condition; void save({ patch }).catch(() => { }); }}>{busy ? 'Saving…' : 'Save changes'}</button></> : undefined}>
 {error && <p role="alert">{error}</p>}{saved ? <p role="status">Saved to the owner’s asset.</p> : action === 'history' ? <>{!items.length ? <p>No shared changes recorded yet.</p> : items.map((i, index) => <article className={styles.event} key={index}><strong>{i.actor_name} · {new Date(i.created_at).toLocaleString('en-ZA')}</strong><p>{i.action}</p>{i.action === 'Maintenance completed' && <p>{String(i.after_data.title || 'Maintenance')} · {String(i.after_data.date || '')}</p>}{['yearModel', 'usage', 'condition'].filter(k => i.before_data[k] !== i.after_data[k] && k in i.after_data).map(k => <p key={k}>{k === 'yearModel' ? 'Year' : k === 'usage' ? 'Usage' : 'Condition'}: {String(i.before_data[k] ?? 'Not saved')} → {String(i.after_data[k] ?? 'Not saved')}</p>)}</article>)}</> : !asset ? <p>Loading asset…</p> : action === 'maintenance' ? <div className={styles.choices}><button className={assetStyles.optionActionButton} type="button" onClick={() => setType('service')}>Service or repair completed</button><button className={assetStyles.optionActionButton} type="button" onClick={() => setType('checkup')}>Check-up completed</button></div> : <AssetDetailsFields className={styles.fields} year={year} usage={usage} condition={condition} onYear={setYear} onUsage={setUsage} onCondition={setCondition} canYear={permissions.yearModel} canUsage={permissions.usage && asset.usageMetric !== 'none'} canCondition={permissions.condition} usageLabel={`Usage (${asset.usageMetric})`}/>}
 </LeadActionDialog>;
}
