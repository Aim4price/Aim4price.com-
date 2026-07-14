'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import styles from '../../owner-app.module.css';

type Document = { id: string; url: string; fileName: string; contentType: string; byteSize: number; uploadedAtIso: string };
type Asset = {
  id: string; registerId: string | null; kind: string; title: string; value: number; replacementPriceExVat: number | null;
  brandName: string; modelName: string; typedModelName: string; yearModel: number | null; hours: number | null;
  lifeWorkedPercent: number | null; condition: string; note: string; serialNumber: string; isFinanced: boolean;
  financeNote: string; isInsured: boolean; insuredValueExVat: number | null; isLicensed: boolean;
  licenseRegistrationNumber: string; specsJson: Record<string, unknown>; photos: string[]; documents: Document[];
  marketplaceStatus: string; marketplacePriceExVat: number | null; marketplaceNotes: string; sellerPhone: string;
  marketplaceSellerName: string; marketplaceSellerCompany: string; marketplaceSellerEmail: string;
  marketplaceProvince: string; marketplaceArea: string; lastScannedAtIso: string | null; lastKnownLat: number | null;
  lastKnownLng: number | null; lastKnownLocationText: string; updatedAtIso: string;
};
type Register = { id: string; businessName: string };
type Maintenance = {
  id: string; maintenanceType: 'service' | 'checkup'; status: string; computedStatusLabel: string; title: string;
  notes: string; triggerType: string; dueDate: string | null; dueUsage: number | null; usageMetric: string | null;
};
type Cost = { id: string; supplierName: string; invoiceNumber: string; invoiceDate: string | null; totalIncVat: number; notes: string };
type DetailResponse = {
  ok: boolean; item?: Asset; register?: Register | null; registers?: Register[]; maintenance?: Maintenance[];
  costs?: Cost[]; costSummary?: { totalSpent: number; invoiceCount: number }; error?: string; requiresUsageConfirmation?: boolean;
};
type UploadResponse = { ok: boolean; uploads?: Array<{ uploadId: string; url: string; fileName: string; contentType: string; byteSize: number }>; error?: string };

const STATUS_OPTIONS = [
  { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Unknown' }, { value: 'not_applicable', label: 'Not applicable' },
];

function text(value: unknown) { return String(value ?? '').trim(); }
function money(value: number | null | undefined) { return value && value > 0 ? `R ${Math.round(value).toLocaleString('en-ZA')}` : 'Not saved'; }
function dateTime(value: string | null) {
  if (!value) return 'Not saved';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not saved' : new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}
function specValue(specs: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) { const value = text(specs[key]); if (value) return value; }
  return '';
}
function statusValue(asset: Asset, type: 'finance' | 'insurance' | 'license') {
  const explicit = specValue(asset.specsJson, `${type}Status`, `${type}_status`, type === 'insurance' ? 'insuredStatus' : type === 'license' ? 'licensedStatus' : 'financedStatus');
  if (explicit) return explicit;
  return (type === 'finance' ? asset.isFinanced : type === 'insurance' ? asset.isInsured : asset.isLicensed) ? 'yes' : 'no';
}

export default function OwnerAssetDetailClient({ assetId }: { assetId: string }) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [draft, setDraft] = useState<Asset | null>(null);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [registerName, setRegisterName] = useState('');
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [costSummary, setCostSummary] = useState({ totalSpent: 0, invoiceCount: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [location, setLocation] = useState({ locationText: '', latitude: '', longitude: '' });

  const primaryPhoto = draft?.photos[0] || '';
  const financeStatus = draft ? statusValue(draft, 'finance') : 'unknown';
  const insuranceStatus = draft ? statusValue(draft, 'insurance') : 'unknown';
  const licenseStatus = draft ? statusValue(draft, 'license') : 'unknown';
  const flagged = Boolean(draft?.specsJson.assetFlagged ?? draft?.specsJson.asset_flagged ?? draft?.specsJson.flagged);
  const upcomingMaintenance = useMemo(() => maintenance.find((record) => record.status === 'upcoming') ?? null, [maintenance]);

  useEffect(() => { void loadDetail(); }, [assetId]);

  function applyDetail(payload: DetailResponse) {
    if (!payload.item) return;
    setAsset(payload.item); setDraft(payload.item); setRegisters(payload.registers ?? []);
    setRegisterName(payload.register?.businessName ?? 'Asset register');
    setMaintenance(payload.maintenance ?? []); setCosts(payload.costs ?? []);
    setCostSummary(payload.costSummary ?? { totalSpent: 0, invoiceCount: 0 });
    setLocation({
      locationText: payload.item.lastKnownLocationText || '',
      latitude: payload.item.lastKnownLat === null ? '' : String(payload.item.lastKnownLat),
      longitude: payload.item.lastKnownLng === null ? '' : String(payload.item.lastKnownLng),
    });
  }

  async function loadDetail(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/owner-app/assets/${encodeURIComponent(assetId)}`, { credentials: 'include', cache: 'no-store' });
      const payload = await response.json().catch(() => null) as DetailResponse | null;
      if (response.status === 401) { window.location.replace('/owner-app/login'); return; }
      if (!response.ok || !payload?.ok || !payload.item) throw new Error(payload?.error || 'Failed to load this asset.');
      applyDetail(payload);
    } catch (cause) { setNotice({ tone: 'error', message: cause instanceof Error ? cause.message : 'Failed to load this asset.' }); }
    finally { if (!silent) setLoading(false); }
  }

  function update<K extends keyof Asset>(key: K, value: Asset[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  }
  function updateSpec(key: string, value: unknown) {
    setDraft((current) => current ? { ...current, specsJson: { ...current.specsJson, [key]: value } } : current);
  }
  function updateStatus(type: 'finance' | 'insurance' | 'license', value: string) {
    setDraft((current) => current ? {
      ...current,
      isFinanced: type === 'finance' ? value === 'yes' : current.isFinanced,
      isInsured: type === 'insurance' ? value === 'yes' : current.isInsured,
      isLicensed: type === 'license' ? value === 'yes' : current.isLicensed,
      specsJson: { ...current.specsJson, [`${type}Status`]: value, [`${type}_status`]: value },
    } : current);
  }

  async function saveAsset(allowUsageDecrease = false) {
    if (!draft || saving) return;
    setSaving(true); setNotice(null);
    try {
      const response = await fetch(`/api/owner-app/assets/${encodeURIComponent(assetId)}`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, allowUsageDecrease }),
      });
      const payload = await response.json().catch(() => null) as DetailResponse | null;
      if (payload?.requiresUsageConfirmation && !allowUsageDecrease) {
        if (window.confirm('This lowers the saved usage reading. Save this as a deliberate correction?')) {
          setSaving(false); await saveAsset(true); return;
        }
      }
      if (!response.ok || !payload?.ok || !payload.item) throw new Error(payload?.error || 'Failed to update this asset.');
      applyDetail(payload); setNotice({ tone: 'success', message: 'Asset changes saved.' });
    } catch (cause) { setNotice({ tone: 'error', message: cause instanceof Error ? cause.message : 'Failed to update this asset.' }); }
    finally { setSaving(false); }
  }

  async function action(body: Record<string, unknown>, successMessage: string) {
    const actionName = text(body.action) || 'action';
    setActionBusy(actionName); setNotice(null);
    try {
      const response = await fetch(`/api/owner-app/assets/${encodeURIComponent(assetId)}/actions`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'The action could not be completed.');
      await loadDetail(true); setNotice({ tone: 'success', message: successMessage });
    } catch (cause) { setNotice({ tone: 'error', message: cause instanceof Error ? cause.message : 'The action could not be completed.' }); }
    finally { setActionBusy(''); }
  }

  async function uploadFiles(type: 'photo' | 'document', files: FileList | null) {
    if (!files?.length || !draft) return;
    setActionBusy(`upload-${type}`); setNotice(null);
    const formData = new FormData(); formData.append('uploadType', type);
    Array.from(files).forEach((file) => formData.append('files', file));
    try {
      const response = await fetch('/api/asset-register/uploads', { method: 'POST', credentials: 'include', body: formData });
      const payload = await response.json().catch(() => null) as UploadResponse | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Upload failed.');
      if (type === 'photo') update('photos', [...draft.photos, ...(payload.uploads ?? []).map((upload) => upload.url)]);
      else update('documents', [...draft.documents, ...(payload.uploads ?? []).map((upload) => ({ id: upload.uploadId, url: upload.url, fileName: upload.fileName, contentType: upload.contentType, byteSize: upload.byteSize, uploadedAtIso: new Date().toISOString() }))]);
      setNotice({ tone: 'success', message: `${type === 'photo' ? 'Photos' : 'Documents'} uploaded. Save changes to attach them to this asset.` });
    } catch (cause) { setNotice({ tone: 'error', message: cause instanceof Error ? cause.message : 'Upload failed.' }); }
    finally { setActionBusy(''); }
  }

  async function deleteAsset() {
    if (!draft || !window.confirm(`Delete ${draft.title}? This cannot be undone.`)) return;
    setActionBusy('delete');
    try {
      const response = await fetch(`/api/owner-app/assets/${encodeURIComponent(assetId)}`, { method: 'DELETE', credentials: 'include' });
      const payload = await response.json().catch(() => null) as { ok?: boolean; redirectTo?: string; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Failed to delete this asset.');
      window.location.assign(payload.redirectTo || '/owner-app/assets');
    } catch (cause) { setNotice({ tone: 'error', message: cause instanceof Error ? cause.message : 'Failed to delete this asset.' }); setActionBusy(''); }
  }

  if (loading) return <div className={`${styles.wideContent} ${styles.loading}`}>Loading asset…</div>;
  if (!draft || !asset) return <div className={styles.wideContent}><div className={styles.errorNotice}>{notice?.message || 'Asset not found.'}</div></div>;

  const extra = (key: string, ...fallbackKeys: string[]) => specValue(draft.specsJson, key, ...fallbackKeys);
  const extraInput = (key: string, label: string, options: { type?: string; inputMode?: 'text' | 'decimal' | 'numeric'; fallbackKeys?: string[] } = {}) => (
    <label className={styles.field}><span>{label}</span><input type={options.type} inputMode={options.inputMode} value={extra(key, ...(options.fallbackKeys ?? []))} onChange={(event) => updateSpec(key, event.target.value)} /></label>
  );

  return (
    <div className={styles.wideContent}>
      {notice ? <div className={notice.tone === 'success' ? styles.successNotice : styles.errorNotice}>{notice.message}</div> : null}

      <section className={`${styles.summaryCard} ${styles.detailHero}`}>
        {primaryPhoto ? <img className={styles.detailPhoto} src={primaryPhoto} alt={draft.title} /> : null}
        <div className={styles.detailHeroBody}>
          <p className={styles.eyebrow}>Aim4price Owner</p><h1>{draft.title}</h1><p>{registerName}</p>
          <div className={styles.metrics}>
            <div className={styles.metric}><span>Aim4price value</span><strong>{money(draft.value)}</strong></div>
            <div className={styles.metric}><span>Replacement</span><strong>{money(draft.replacementPriceExVat)}</strong></div>
            <div className={styles.metric}><span>Insurance</span><strong>{insuranceStatus === 'yes' ? money(draft.insuredValueExVat) : insuranceStatus.replace('_', ' ')}</strong></div>
            <div className={styles.metric}><span>Usage</span><strong>{draft.lifeWorkedPercent !== null && extra('usageMetric', 'usage_metric').includes('percent') ? `${draft.lifeWorkedPercent}%` : draft.hours !== null ? `${draft.hours.toLocaleString('en-ZA')} ${extra('usageMetric', 'usage_metric') === 'km' || draft.kind === 'vehicle' ? 'km' : 'hours'}` : 'Not saved'}</strong></div>
            <div className={styles.metric}><span>Licence</span><strong>{licenseStatus === 'yes' ? draft.licenseRegistrationNumber || 'Licensed' : licenseStatus.replace('_', ' ')}</strong></div>
            <div className={styles.metric}><span>Maintenance</span><strong>{upcomingMaintenance ? upcomingMaintenance.computedStatusLabel : 'Nothing upcoming'}</strong></div>
            <div className={styles.metric}><span>Recorded costs</span><strong>{money(costSummary.totalSpent)}</strong></div>
            <div className={styles.metric}><span>Last scan</span><strong>{dateTime(draft.lastScannedAtIso)}</strong></div>
            <div className={styles.metric}><span>Location</span><strong>{draft.lastKnownLocationText || 'Not saved'}</strong></div>
            <div className={styles.metric}><span>Marketplace</span><strong>{draft.marketplaceStatus === 'live' ? 'Live' : 'Not listed'}</strong></div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}><div><h2>Asset details</h2><p>Edit the full owner record.</p></div></div>
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.fieldFull}`}><span>Asset name</span><input value={draft.title} onChange={(event) => update('title', event.target.value)} /></label>
          <label className={styles.field}><span>Register</span><select value={draft.registerId ?? ''} onChange={(event) => update('registerId', event.target.value)}>{registers.map((register) => <option key={register.id} value={register.id}>{register.businessName}</option>)}</select></label>
          <label className={styles.field}><span>Asset type</span><select value={draft.kind} onChange={(event) => update('kind', event.target.value)}><option value="tractor">Tractor</option><option value="equipment">Equipment</option><option value="vehicle">Vehicle</option><option value="property">Property</option><option value="tools">Tools</option><option value="stock">Stock</option><option value="manual">Other</option></select></label>
          <label className={styles.field}><span>Make</span><input value={draft.brandName} onChange={(event) => update('brandName', event.target.value)} /></label>
          <label className={styles.field}><span>Model</span><input value={draft.modelName} onChange={(event) => update('modelName', event.target.value)} /></label>
          <label className={styles.field}><span>Year model / year built</span><input inputMode="numeric" value={draft.yearModel ?? ''} onChange={(event) => update('yearModel', event.target.value ? Number(event.target.value) : null)} /></label>
          <label className={styles.field}><span>Serial / VIN / chassis</span><input value={draft.serialNumber} onChange={(event) => update('serialNumber', event.target.value)} /></label>
          {extraInput('internalReference', 'Internal reference', { fallbackKeys: ['internal_reference'] })}
          <label className={styles.field}><span>Condition</span><select value={draft.condition} onChange={(event) => update('condition', event.target.value)}><option value="">Not saved</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="used">Used</option><option value="serious">Serious</option></select></label>
          <label className={styles.field}><span>Usage type</span><select value={extra('usageMetric', 'usage_metric') || (draft.kind === 'vehicle' ? 'km' : 'hours')} onChange={(event) => { updateSpec('usageMetric', event.target.value); updateSpec('usage_metric', event.target.value); }}><option value="hours">Hours</option><option value="km">Kilometres</option><option value="percentage">Percentage worked</option></select></label>
          {extra('usageMetric', 'usage_metric') === 'percentage' ? <label className={styles.field}><span>Percentage worked</span><input inputMode="decimal" value={draft.lifeWorkedPercent ?? ''} onChange={(event) => update('lifeWorkedPercent', event.target.value ? Number(event.target.value) : null)} /></label> : <label className={styles.field}><span>Current usage</span><input inputMode="decimal" value={draft.hours ?? ''} onChange={(event) => update('hours', event.target.value ? Number(event.target.value) : null)} /></label>}
          <label className={styles.field}><span>Current Aim4price value excl. VAT</span><input inputMode="decimal" value={draft.value || ''} onChange={(event) => update('value', Number(event.target.value) || 0)} /></label>
          <label className={styles.field}><span>Replacement price excl. VAT</span><input inputMode="decimal" value={draft.replacementPriceExVat ?? ''} onChange={(event) => update('replacementPriceExVat', event.target.value ? Number(event.target.value) : null)} /></label>
          <label className={`${styles.field} ${styles.fieldFull}`}><span>Notes</span><textarea value={draft.note} onChange={(event) => update('note', event.target.value)} /></label>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Finance</h2>
        <div className={styles.formGrid}>
          <label className={styles.field}><span>Finance status</span><select value={financeStatus} onChange={(event) => updateStatus('finance', event.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {financeStatus === 'yes' ? <>
            <label className={styles.field}><span>Finance type</span><select value={extra('financeType', 'finance_type')} onChange={(event) => updateSpec('financeType', event.target.value)}><option value="">Not saved</option><option value="asset_specific">Asset-specific finance</option><option value="bulk_group">Bulk / group finance</option></select></label>
            {extraInput('financierName', 'Financier', { fallbackKeys: ['financier_name'] })}
            {extraInput('financeCurrentOutstandingExVat', 'Current outstanding excl. VAT', { inputMode: 'decimal', fallbackKeys: ['finance_current_outstanding_ex_vat'] })}
            {extraInput('financeBoughtWhen', 'Bought when', { type: 'date', fallbackKeys: ['finance_bought_when'] })}
            {extraInput('financeBoughtForExVat', 'Bought for excl. VAT', { inputMode: 'decimal', fallbackKeys: ['finance_bought_for_ex_vat'] })}
            {extraInput('financeOriginalAmountExVat', 'Original financed amount', { inputMode: 'decimal', fallbackKeys: ['finance_original_amount_ex_vat'] })}
            {extraInput('financeMonthlyPaymentExVat', 'Monthly payment', { inputMode: 'decimal', fallbackKeys: ['finance_monthly_payment_ex_vat'] })}
            {extraInput('financeInterestRatePercent', 'Interest rate %', { inputMode: 'decimal', fallbackKeys: ['finance_interest_rate_percent'] })}
            {extraInput('financeTermMonths', 'Term months', { inputMode: 'numeric', fallbackKeys: ['finance_term_months'] })}
            {extraInput('financeBalloonPaymentExVat', 'Balloon payment', { inputMode: 'decimal', fallbackKeys: ['finance_balloon_payment_ex_vat'] })}
            {extraInput('financeSettlementDate', 'Settlement date', { type: 'date', fallbackKeys: ['finance_settlement_date'] })}
            {extraInput('financeReferenceNumber', 'Finance reference', { fallbackKeys: ['finance_reference_number'] })}
            <label className={`${styles.field} ${styles.fieldFull}`}><span>Finance notes</span><textarea value={draft.financeNote} onChange={(event) => update('financeNote', event.target.value)} /></label>
          </> : null}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Insurance</h2>
        <div className={styles.formGrid}>
          <label className={styles.field}><span>Insurance status</span><select value={insuranceStatus} onChange={(event) => updateStatus('insurance', event.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {insuranceStatus === 'yes' ? <>
            <label className={styles.field}><span>Insured value excl. VAT</span><input inputMode="decimal" value={draft.insuredValueExVat ?? ''} onChange={(event) => update('insuredValueExVat', event.target.value ? Number(event.target.value) : null)} /></label>
            {extraInput('insuranceInsurerName', 'Insurer / broker', { fallbackKeys: ['insurance_insurer_name'] })}
            {extraInput('insurancePolicyNumber', 'Policy number', { fallbackKeys: ['insurance_policy_number'] })}
            {extraInput('insuranceRenewalDate', 'Renewal date', { type: 'date', fallbackKeys: ['insurance_renewal_date'] })}
            <label className={`${styles.field} ${styles.fieldFull}`}><span>Insurance notes</span><textarea value={extra('insuranceNote', 'insurance_note')} onChange={(event) => updateSpec('insuranceNote', event.target.value)} /></label>
          </> : null}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Licence and registration</h2>
        <div className={styles.formGrid}>
          <label className={styles.field}><span>Licence status</span><select value={licenseStatus} onChange={(event) => updateStatus('license', event.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {licenseStatus === 'yes' ? <>
            <label className={styles.field}><span>Registration / licence number</span><input value={draft.licenseRegistrationNumber} onChange={(event) => update('licenseRegistrationNumber', event.target.value)} /></label>
            {extraInput('licenseRenewalDate', 'Licence renewal date', { type: 'date', fallbackKeys: ['license_renewal_date', 'licenceRenewalDate'] })}
            <label className={`${styles.field} ${styles.fieldFull}`}><span>Licence notes</span><textarea value={extra('licenseNote', 'license_note')} onChange={(event) => updateSpec('licenseNote', event.target.value)} /></label>
          </> : null}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Location, scan and flags</h2>
        <p>Last scanned: {dateTime(draft.lastScannedAtIso)}</p>
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.fieldFull}`}><span>Location description</span><input value={location.locationText} onChange={(event) => setLocation((current) => ({ ...current, locationText: event.target.value }))} /></label>
          <label className={styles.field}><span>Latitude</span><input inputMode="decimal" value={location.latitude} onChange={(event) => setLocation((current) => ({ ...current, latitude: event.target.value }))} /></label>
          <label className={styles.field}><span>Longitude</span><input inputMode="decimal" value={location.longitude} onChange={(event) => setLocation((current) => ({ ...current, longitude: event.target.value }))} /></label>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} disabled={Boolean(actionBusy)} onClick={() => void action({ action: 'location', ...location }, 'Location updated.')}>Save location</button>
          <button type="button" className={styles.secondaryButton} disabled={Boolean(actionBusy)} onClick={() => void action({ action: 'flag', isFlagged: !flagged }, flagged ? 'Flag removed.' : 'Asset flagged.')}>{flagged ? 'Remove flag' : 'Flag asset'}</button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Photos and documents</h2>
        <div className={styles.mediaGrid}>
          {draft.photos.map((url) => <div className={styles.mediaItem} key={url}><img src={url} alt="Asset" /><button type="button" onClick={() => update('photos', draft.photos.filter((photo) => photo !== url))}>×</button></div>)}
          {draft.documents.map((document) => <div className={styles.mediaItem} key={document.id}><a href={document.url} target="_blank" rel="noreferrer">{document.fileName}</a><button type="button" onClick={() => update('documents', draft.documents.filter((entry) => entry.id !== document.id))}>×</button></div>)}
        </div>
        <label className={styles.fileInput}>Add photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => void uploadFiles('photo', event.target.files)} disabled={Boolean(actionBusy)} /></label>
        <label className={styles.fileInput}>Add documents<input type="file" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => void uploadFiles('document', event.target.files)} disabled={Boolean(actionBusy)} /></label>
      </section>

      <MarketplaceSection draft={draft} action={action} busy={Boolean(actionBusy)} />
      <MaintenanceSection records={maintenance} action={action} busy={Boolean(actionBusy)} />
      <CostsSection records={costs} summary={costSummary} action={action} busy={Boolean(actionBusy)} />

      <section className={styles.section}>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={() => void saveAsset()} disabled={saving || Boolean(actionBusy)}>{saving ? 'Saving…' : 'Save all changes'}</button>
          <button type="button" className={styles.dangerButton} onClick={() => void deleteAsset()} disabled={Boolean(actionBusy)}>{actionBusy === 'delete' ? 'Deleting…' : 'Delete asset'}</button>
        </div>
      </section>
    </div>
  );
}

function MarketplaceSection({ draft, action, busy }: { draft: Asset; action: (body: Record<string, unknown>, message: string) => Promise<void>; busy: boolean }) {
  const [form, setForm] = useState({
    askingPriceExVat: String(draft.marketplacePriceExVat ?? draft.value ?? ''), marketplaceNotes: draft.marketplaceNotes,
    sellerName: draft.marketplaceSellerName, sellerCompany: draft.marketplaceSellerCompany, sellerPhone: draft.sellerPhone,
    sellerEmail: draft.marketplaceSellerEmail, province: draft.marketplaceProvince, area: draft.marketplaceArea,
  });
  return (
    <section className={styles.section}>
      <h2>Marketplace</h2><p>Status: {draft.marketplaceStatus === 'live' ? 'Live' : 'Not listed'}</p>
      <div className={styles.formGrid}>
        {Object.entries({ askingPriceExVat: 'Asking price excl. VAT', sellerName: 'Seller name', sellerCompany: 'Company', sellerPhone: 'Phone', sellerEmail: 'Email', province: 'Province', area: 'Area' }).map(([key, label]) => <label className={styles.field} key={key}><span>{label}</span><input value={form[key as keyof typeof form]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
        <label className={`${styles.field} ${styles.fieldFull}`}><span>Listing description</span><textarea value={form.marketplaceNotes} onChange={(event) => setForm((current) => ({ ...current, marketplaceNotes: event.target.value }))} /></label>
      </div>
      <div className={styles.actions}><button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void action({ action: 'marketplace-publish', ...form }, draft.marketplaceStatus === 'live' ? 'Marketplace listing updated.' : 'Asset listed on Marketplace.')}>{draft.marketplaceStatus === 'live' ? 'Update listing' : 'List on Marketplace'}</button>{draft.marketplaceStatus === 'live' ? <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => void action({ action: 'marketplace-remove' }, 'Marketplace listing removed.')}>Remove listing</button> : null}</div>
    </section>
  );
}

function MaintenanceSection({ records, action, busy }: { records: Maintenance[]; action: (body: Record<string, unknown>, message: string) => Promise<void>; busy: boolean }) {
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form).entries());
    await action({ action: 'maintenance-create', maintenanceType: 'service', triggerType: 'date', status: 'upcoming', alertBeforeValue: 7, alertBeforeUnit: 'days', ...data }, 'Maintenance item created.');
    form.reset();
  }
  return (
    <section className={styles.section}>
      <h2>Maintenance</h2>
      <div className={styles.recordList}>{records.length ? records.map((record) => <article className={styles.record} key={record.id}><div className={styles.recordHeader}><h3>{record.title}</h3><span className={styles.recordStatus}>{record.computedStatusLabel}</span></div><p>{[record.maintenanceType, record.dueDate || (record.dueUsage !== null ? `${record.dueUsage} ${record.usageMetric || ''}` : ''), record.notes].filter(Boolean).join(' • ')}</p><div className={styles.actions}>{record.status === 'upcoming' ? <><button type="button" className={styles.smallButton} disabled={busy} onClick={() => void action({ action: 'maintenance-complete', maintenanceId: record.id }, 'Maintenance marked complete.')}>Complete</button><button type="button" className={styles.smallButton} disabled={busy} onClick={() => void action({ action: 'maintenance-cancel', maintenanceId: record.id }, 'Maintenance cancelled.')}>Cancel</button></> : record.status === 'done' ? <button type="button" className={styles.smallButton} disabled={busy} onClick={() => void action({ action: 'maintenance-reopen', maintenanceId: record.id }, 'Maintenance reopened.')}>Reopen</button> : null}</div></article>) : <p>No maintenance records yet.</p>}</div>
      <form className={styles.formGrid} onSubmit={(event) => void create(event)}>
        <label className={styles.field}><span>Type</span><select name="maintenanceType"><option value="service">Service</option><option value="checkup">Checkup</option></select></label>
        <label className={styles.field}><span>Due date</span><input name="dueDate" type="date" required /></label>
        <label className={`${styles.field} ${styles.fieldFull}`}><span>Title</span><input name="title" required placeholder="Next service" /></label>
        <label className={`${styles.field} ${styles.fieldFull}`}><span>Notes</span><textarea name="notes" /></label>
        <button className={`${styles.secondaryButton} ${styles.fieldFull}`} type="submit" disabled={busy}>Add maintenance</button>
      </form>
    </section>
  );
}

function CostsSection({ records, summary, action, busy }: { records: Cost[]; summary: { totalSpent: number; invoiceCount: number }; action: (body: Record<string, unknown>, message: string) => Promise<void>; busy: boolean }) {
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form).entries());
    await action({ action: 'cost-create', source: 'manual', usageMetric: 'none', ...data }, 'Cost record added.');
    form.reset();
  }
  return (
    <section className={styles.section}>
      <h2>Recorded costs</h2><p>{summary.invoiceCount} record{summary.invoiceCount === 1 ? '' : 's'} • {money(summary.totalSpent)} total</p>
      <div className={styles.recordList}>{records.length ? records.map((record) => <article className={styles.record} key={record.id}><div className={styles.recordHeader}><h3>{record.supplierName || 'Cost record'}</h3><span className={styles.recordStatus}>{money(record.totalIncVat)}</span></div><p>{[record.invoiceDate, record.invoiceNumber, record.notes].filter(Boolean).join(' • ')}</p><button type="button" className={styles.smallButton} disabled={busy} onClick={() => { if (window.confirm('Delete this cost record?')) void action({ action: 'cost-delete', invoiceId: record.id }, 'Cost record deleted.'); }}>Delete</button></article>) : <p>No costs recorded yet.</p>}</div>
      <form className={styles.formGrid} onSubmit={(event) => void create(event)}>
        <label className={styles.field}><span>Supplier</span><input name="supplierName" /></label><label className={styles.field}><span>Invoice number</span><input name="invoiceNumber" /></label>
        <label className={styles.field}><span>Date</span><input name="invoiceDate" type="date" required /></label><label className={styles.field}><span>Total incl. VAT</span><input name="totalIncVat" inputMode="decimal" required /></label>
        <label className={`${styles.field} ${styles.fieldFull}`}><span>Notes</span><textarea name="notes" /></label><button className={`${styles.secondaryButton} ${styles.fieldFull}`} type="submit" disabled={busy}>Add cost</button>
      </form>
    </section>
  );
}
