'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { formatResolvedAssetUsage, resolveAssetUsage, type AssetUsageMetric } from '../../../../lib/asset-usage';
import { openAssetSheetPrint } from '../../../../lib/report-print';
import BalancedHeadingText from '../../balanced-heading';
import styles from '../../owner-app.module.css';
import OwnerAssetOptionsClient from './owner-asset-options-client';

declare global {
  interface Window { L?: any }
}

type Document = { id: string; url: string; fileName: string; contentType: string; byteSize: number; uploadedAtIso: string };
type Asset = {
  id: string; registerId: string | null; kind: string; title: string; value: number; replacementPriceExVat: number | null;
  valuationRunId: number | null; selectedMethod: string;
  brandName: string; modelName: string; typedModelName: string; yearModel: number | null; hours: number | null;
  lifeWorkedPercent: number | null; condition: string; note: string; serialNumber: string; isFinanced: boolean;
  financeNote: string; isInsured: boolean; insuredValueExVat: number | null; isLicensed: boolean;
  licenseRegistrationNumber: string; specsJson: Record<string, unknown>; photos: string[]; documents: Document[];
  marketplaceStatus: string; marketplacePriceExVat: number | null; marketplaceNotes: string; sellerPhone: string;
  marketplaceSellerName: string; marketplaceSellerCompany: string; marketplaceSellerEmail: string;
  marketplaceProvince: string; marketplaceArea: string; lastScannedAtIso: string | null; lastKnownLat: number | null;
  lastKnownLng: number | null; lastKnownLocationText: string; createdAtIso: string; updatedAtIso: string;
};
type Register = { id: string; businessName: string };
type OwnerContext = {
  businessName: string; contactName: string; phone: string; email: string; province: string; area: string;
  address: string; reportLogoUrl: string;
};
type Maintenance = {
  id: string; maintenanceType: 'service' | 'checkup'; status: string; computedStatusLabel: string; title: string;
  notes: string; triggerType: string; dueDate: string | null; dueUsage: number | null; usageMetric: string | null;
};
type DetailResponse = {
  ok: boolean; item?: Asset; register?: Register | null; registers?: Register[]; maintenance?: Maintenance[];
  ownerContext?: OwnerContext;
  error?: string; requiresUsageConfirmation?: boolean;
};
type UploadResponse = { ok: boolean; uploads?: Array<{ uploadId: string; url: string; fileName: string; contentType: string; byteSize: number }>; error?: string };

export type OwnerAssetView = 'summary' | 'details' | 'options' | 'manage' | 'section';
export type OwnerAssetManageSection = 'details' | 'reports' | 'pricing' | 'finance' | 'insurance' | 'licence' | 'location' | 'media' | 'marketplace' | 'maintenance' | 'delete';
type OwnerAssetManageGroup = 'asset' | 'records' | 'selling' | 'removal';

const STATUS_OPTIONS = [
  { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Unknown' }, { value: 'not_applicable', label: 'Not applicable' },
];

const MANAGE_SECTIONS: Array<{ id: OwnerAssetManageSection; group: OwnerAssetManageGroup; title: string; description: string; tone?: 'danger' }> = [
  { id: 'details', group: 'asset', title: 'Update asset', description: 'Details, usage and values' },
  { id: 'pricing', group: 'asset', title: 'Manage pricing', description: 'Current and future values' },
  { id: 'location', group: 'asset', title: 'Location', description: 'GPS position and map' },
  { id: 'media', group: 'asset', title: 'Photos & documents', description: 'Saved photos and files' },
  { id: 'reports', group: 'records', title: 'Reports', description: 'Download available PDF reports' },
  { id: 'maintenance', group: 'records', title: 'Maintenance', description: 'Schedules and service records' },
  { id: 'finance', group: 'records', title: 'Finance', description: 'Finance status and information' },
  { id: 'insurance', group: 'records', title: 'Insurance', description: 'Insurance status and cover' },
  { id: 'licence', group: 'records', title: 'Licence', description: 'Licence and registration' },
  { id: 'marketplace', group: 'selling', title: 'Marketplace', description: 'Create or update the listing' },
  { id: 'delete', group: 'removal', title: 'Delete asset', description: 'Permanently remove this asset', tone: 'danger' },
];

const MANAGE_GROUPS: Array<{ id: OwnerAssetManageGroup; title: string }> = [
  { id: 'asset', title: 'Asset information' },
  { id: 'records', title: 'Records & cover' },
  { id: 'selling', title: 'Selling' },
  { id: 'removal', title: 'Asset removal' },
];

function text(value: unknown) { return String(value ?? '').trim(); }
function money(value: number | null | undefined) { return value && value > 0 ? `R ${Math.round(value).toLocaleString('en-ZA')}` : 'Not saved'; }
function dateOnly(value: string | null | undefined) {
  if (!value) return 'Not saved';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not saved' : new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium' }).format(parsed);
}
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
function normalizeStatus(value: string): 'yes' | 'no' | 'unknown' | 'not_applicable' {
  const normalized = text(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (['yes', 'y', 'true', 'financed', 'insured', 'licensed', 'licenced', 'is_financed', 'is_insured', 'is_licensed'].includes(normalized)) return 'yes';
  if (['no', 'n', 'false', 'not_financed', 'not_insured', 'not_licensed', 'not_licenced', 'unfinanced', 'uninsured', 'unlicensed', 'unlicenced'].includes(normalized)) return 'no';
  if (['not_applicable', 'not_app', 'n/a', 'na'].includes(normalized)) return 'not_applicable';
  return 'unknown';
}
function statusVisual(value: string) {
  const status = normalizeStatus(value);
  return {
    yes: { symbol: '✓', title: 'Yes', className: styles.assetMirrorStatusMarkYes },
    no: { symbol: '×', title: 'No', className: styles.assetMirrorStatusMarkNo },
    unknown: { symbol: '?', title: 'Not sure', className: styles.assetMirrorStatusMarkUnknown },
    not_applicable: { symbol: 'N/A', title: 'Not applicable', className: styles.assetMirrorStatusMarkNotApplicable },
  }[status];
}
function conditionLabel(value: string) {
  const normalized = text(value).replace(/[_-]+/g, ' ');
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Not saved';
}
function manualMarketplaceNote(value: string) {
  const note = text(value).replace(/\r\n/g, '\n');
  if (!note) return '';
  const compact = note.replace(/\s+/g, ' ').toLowerCase();
  const isOperationalNote = compact.includes('lifetime worked updated to') ||
    (/^checked\b/.test(compact) && compact.includes('checked items:')) ||
    (/^serviced\b/.test(compact) && (compact.includes('serviced items:') || compact.includes('service items:') || compact.includes('work done:'))) ||
    (/^repaired\b/.test(compact) && (compact.includes('work done:') || compact.includes('mechanic:') || compact.includes('company:')));
  return isOperationalNote ? '' : note;
}

export default function OwnerAssetDetailClient({ assetId, view = 'summary', section }: {
  assetId: string;
  view?: OwnerAssetView;
  section?: OwnerAssetManageSection;
}) {
  const [draft, setDraft] = useState<Asset | null>(null);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [registerName, setRegisterName] = useState('');
  const [ownerContext, setOwnerContext] = useState<OwnerContext | null>(null);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [location, setLocation] = useState({ locationText: '', latitude: '', longitude: '' });
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);

  const photoCount = draft?.photos.length ?? 0;
  const safePhotoIndex = photoCount ? Math.min(photoIndex, photoCount - 1) : 0;
  const primaryPhoto = draft?.photos[safePhotoIndex] || '';
  const financeStatus = draft ? statusValue(draft, 'finance') : 'unknown';
  const insuranceStatus = draft ? statusValue(draft, 'insurance') : 'unknown';
  const licenseStatus = draft ? statusValue(draft, 'license') : 'unknown';
  const upcomingMaintenance = useMemo(() => maintenance.find((record) => record.status === 'upcoming') ?? null, [maintenance]);

  useEffect(() => { void loadDetail(); }, [assetId]);

  useEffect(() => {
    setPhotoIndex((current) => photoCount ? Math.min(current, photoCount - 1) : 0);
  }, [photoCount]);

  useEffect(() => {
    if (!photoViewerOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleViewerKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPhotoViewerOpen(false);
      if (event.key === 'ArrowLeft' && photoCount > 1) {
        setPhotoIndex((current) => (current - 1 + photoCount) % photoCount);
      }
      if (event.key === 'ArrowRight' && photoCount > 1) {
        setPhotoIndex((current) => (current + 1) % photoCount);
      }
    }

    window.addEventListener('keydown', handleViewerKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleViewerKeyDown);
    };
  }, [photoCount, photoViewerOpen]);

  function cyclePhoto(direction: -1 | 1) {
    if (photoCount <= 1) return;
    setPhotoIndex((current) => (current + direction + photoCount) % photoCount);
  }

  function applyDetail(payload: DetailResponse) {
    if (!payload.item) return;
    setDraft(payload.item);
    setRegisters(payload.registers ?? []);
    setRegisterName(payload.register?.businessName ?? 'Asset register');
    setOwnerContext(payload.ownerContext ?? null);
    setMaintenance(payload.maintenance ?? []);
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
    } catch (cause) {
      setNotice({ tone: 'error', message: cause instanceof Error ? cause.message : 'Failed to load this asset.' });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function update<K extends keyof Asset>(key: K, value: Asset[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  }
  function updateSpec(key: string, value: unknown) {
    setDraft((current) => current ? { ...current, specsJson: { ...current.specsJson, [key]: value } } : current);
  }
  function updateUsageMetric(metric: AssetUsageMetric) {
    setDraft((current) => {
      if (!current) return current;

      if (metric === 'percentage') {
        return {
          ...current,
          hours: null,
          specsJson: {
            ...current.specsJson,
            usageMode: 'percent',
            usage_mode: 'percent',
            usageBasis: 'percent',
            usage_basis: 'percent',
            selectedUsageMode: 'percent',
            selected_usage_mode: 'percent',
          },
        };
      }

      return {
        ...current,
        lifeWorkedPercent: null,
        specsJson: {
          ...current.specsJson,
          usageMetric: metric,
          usage_metric: metric,
          usageUnit: metric,
          usage_unit: metric,
          usageMode: metric,
          usage_mode: metric,
          usageBasis: 'reading',
          usage_basis: 'reading',
          selectedUsageMode: metric,
          selected_usage_mode: metric,
        },
      };
    });
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
    setSaving(true);
    setNotice(null);
    try {
      const usageMetric = resolveAssetUsage({
        kind: draft.kind,
        hours: draft.hours,
        lifeWorkedPercent: draft.lifeWorkedPercent,
        specsJson: draft.specsJson,
      }).metric;
      const response = await fetch(`/api/owner-app/assets/${encodeURIComponent(assetId)}`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, usageMetric, allowUsageDecrease }),
      });
      const payload = await response.json().catch(() => null) as DetailResponse | null;
      if (payload?.requiresUsageConfirmation && !allowUsageDecrease) {
        if (window.confirm('This lowers the saved usage reading. Save this as a deliberate correction?')) {
          setSaving(false);
          await saveAsset(true);
          return;
        }
      }
      if (!response.ok || !payload?.ok || !payload.item) throw new Error(payload?.error || 'Failed to update this asset.');
      applyDetail(payload);
      setNotice({ tone: 'success', message: 'Asset changes saved.' });
    } catch (cause) {
      setNotice({ tone: 'error', message: cause instanceof Error ? cause.message : 'Failed to update this asset.' });
    } finally {
      setSaving(false);
    }
  }

  async function action(body: Record<string, unknown>, successMessage: string) {
    const actionName = text(body.action) || 'action';
    setActionBusy(actionName);
    setNotice(null);
    try {
      const response = await fetch(`/api/owner-app/assets/${encodeURIComponent(assetId)}/actions`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'The action could not be completed.');
      await loadDetail(true);
      setNotice({ tone: 'success', message: successMessage });
    } catch (cause) {
      setNotice({ tone: 'error', message: cause instanceof Error ? cause.message : 'The action could not be completed.' });
    } finally {
      setActionBusy('');
    }
  }

  async function uploadFiles(type: 'photo' | 'document', files: FileList | null) {
    if (!files?.length || !draft) return;
    setActionBusy(`upload-${type}`);
    setNotice(null);
    const formData = new FormData();
    formData.append('uploadType', type);
    Array.from(files).forEach((file) => formData.append('files', file));
    try {
      const response = await fetch('/api/asset-register/uploads', { method: 'POST', credentials: 'include', body: formData });
      const payload = await response.json().catch(() => null) as UploadResponse | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Upload failed.');
      const nextDraft: Asset = type === 'photo'
        ? { ...draft, photos: [...draft.photos, ...(payload.uploads ?? []).map((upload) => upload.url)] }
        : {
            ...draft,
            documents: [
              ...draft.documents,
              ...(payload.uploads ?? []).map((upload) => ({
                id: upload.uploadId,
                url: upload.url,
                fileName: upload.fileName,
                contentType: upload.contentType,
                byteSize: upload.byteSize,
                uploadedAtIso: new Date().toISOString(),
              })),
            ],
          };
      setDraft(nextDraft);

      const saveResponse = await fetch(`/api/owner-app/assets/${encodeURIComponent(assetId)}/actions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'media', photos: nextDraft.photos, documents: nextDraft.documents }),
      });
      const savedPayload = await saveResponse.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (saveResponse.status === 401) { window.location.replace('/owner-app/login'); return; }
      if (!saveResponse.ok || !savedPayload?.ok) {
        throw new Error(savedPayload?.error || `The ${type === 'photo' ? 'photos' : 'documents'} uploaded but could not be attached to this asset.`);
      }
      await loadDetail(true);
      setNotice({ tone: 'success', message: `${type === 'photo' ? 'Photos' : 'Documents'} uploaded and saved.` });
    } catch (cause) {
      setNotice({ tone: 'error', message: cause instanceof Error ? cause.message : 'Upload failed.' });
    } finally {
      setActionBusy('');
    }
  }

  async function deleteAsset() {
    if (!draft || !window.confirm(`Delete ${draft.title}? This cannot be undone.`)) return;
    setActionBusy('delete');
    setNotice(null);
    try {
      const response = await fetch(`/api/owner-app/assets/${encodeURIComponent(assetId)}`, { method: 'DELETE', credentials: 'include' });
      const payload = await response.json().catch(() => null) as { ok?: boolean; redirectTo?: string; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Failed to delete this asset.');
      window.location.assign(payload.redirectTo || '/owner-app/assets');
    } catch (cause) {
      setNotice({ tone: 'error', message: cause instanceof Error ? cause.message : 'Failed to delete this asset.' });
      setActionBusy('');
    }
  }

  function openValuationReport() {
    if (!draft) return;
    const usage = formatResolvedAssetUsage(resolveAssetUsage({
      kind: draft.kind,
      hours: draft.hours,
      lifeWorkedPercent: draft.lifeWorkedPercent,
      specsJson: draft.specsJson,
    }), 'Not saved');
    const methodLabel = draft.selectedMethod === 'manual' ? 'Manual value' : 'Aim4price value';
    const didOpen = openAssetSheetPrint({
      logoUrl: ownerContext?.reportLogoUrl || '/brand/aim4price-mark-black.png',
      generatedAt: dateOnly(new Date().toISOString()),
      assetBadge: draft.kind === 'property' ? 'Property / Buildings' : draft.kind.charAt(0).toUpperCase() + draft.kind.slice(1),
      heroTitle: draft.title,
      heroMeta: [draft.yearModel, draft.brandName, draft.modelName].filter(Boolean).join(' · '),
      valueLabel: 'Estimated Value',
      value: money(draft.value),
      valueNote: methodLabel,
      statusLabel: dateOnly(draft.updatedAtIso),
      issuerName: 'Aim4price',
      issuerAddress: 'Saved asset register data',
      issuerEmail: 'aim4price@gmail.com',
      clientRows: [
        { label: 'Business Name', value: ownerContext?.businessName || 'Aim4price client' },
        { label: 'Contact Details', value: ownerContext?.phone || '—' },
        { label: 'Business Email', value: ownerContext?.email || '—' },
        { label: 'Location / Address', value: ownerContext?.address || ownerContext?.area || '—' },
      ],
      photoUrl: draft.photos[0] || null,
      photoUrls: draft.photos,
      facts: [
        { label: 'Category', value: draft.kind === 'property' ? 'Property / Buildings' : draft.kind },
        { label: 'Brand', value: draft.brandName || '—' },
        { label: 'Model', value: draft.modelName || draft.typedModelName || '—' },
        { label: 'Year', value: draft.yearModel ? String(draft.yearModel) : '—' },
        { label: 'Usage', value: usage },
        { label: 'Condition', value: conditionLabel(draft.condition) },
        { label: 'Replacement Price', value: draft.replacementPriceExVat ? `${money(draft.replacementPriceExVat)} excl. VAT` : 'Not saved' },
        { label: 'Serial Number', value: draft.serialNumber || '—' },
        { label: 'Insured', value: statusVisual(statusValue(draft, 'insurance')).title },
        { label: 'Insured Value', value: draft.insuredValueExVat ? `${money(draft.insuredValueExVat)} excl. VAT` : 'Not saved' },
        { label: 'Financed', value: statusVisual(statusValue(draft, 'finance')).title },
        { label: 'Licensed', value: statusVisual(statusValue(draft, 'license')).title },
        { label: 'Documents', value: draft.documents.length ? `${draft.documents.length} saved` : 'None' },
        { label: 'Last Updated', value: dateOnly(draft.updatedAtIso) },
      ],
      notes: [],
      methodCards: [{ label: methodLabel, value: money(draft.value), note: 'Saved value excluding VAT', selected: true }],
      footerNote: 'Values are indicative estimates based on saved asset-register information and available pricing inputs. This is not a certified valuation, inspection report or guarantee of selling price.',
    });

    if (!didOpen) setNotice({ tone: 'error', message: 'Unable to open the valuation report. Please allow pop-ups and try again.' });
  }

  if (loading) return <div className={`${styles.wideContent} ${styles.loading}`}>Loading asset…</div>;
  if (!draft) return <div className={styles.wideContent}><div className={styles.errorNotice}>{notice?.message || 'Asset not found.'}</div></div>;

  const extra = (key: string, ...fallbackKeys: string[]) => specValue(draft.specsJson, key, ...fallbackKeys);
  const resolvedUsage = resolveAssetUsage({
    kind: draft.kind,
    hours: draft.hours,
    lifeWorkedPercent: draft.lifeWorkedPercent,
    specsJson: draft.specsJson,
  });
  const usageMetric = resolvedUsage.metric;
  const usageText = formatResolvedAssetUsage(resolvedUsage, 'Not saved');
  const extraInput = (key: string, label: string, options: { type?: string; inputMode?: 'text' | 'decimal' | 'numeric'; fallbackKeys?: string[] } = {}) => (
    <label className={styles.field}><span>{label}</span><input type={options.type} inputMode={options.inputMode} value={extra(key, ...(options.fallbackKeys ?? []))} onChange={(event) => updateSpec(key, event.target.value)} /></label>
  );
  const editorHeader = (title: string, description: string) => (
    <div className={`${styles.sectionHeader} ${styles.editorHeader}`}><div><h2><BalancedHeadingText text={title} /></h2><p>{description}</p></div></div>
  );

  if (view === 'summary') {
    return (
      <div className={styles.wideContent}>
        {notice ? <div className={notice.tone === 'success' ? styles.successNotice : styles.errorNotice}>{notice.message}</div> : null}
        <section className={`${styles.summaryCard} ${styles.detailHero} ${styles.assetMirrorCard}`}>
          <div className={styles.detailPhotoStage}>
            {primaryPhoto ? (
              <button
                type="button"
                className={styles.detailPhotoOpenButton}
                onClick={() => setPhotoViewerOpen(true)}
                aria-label={`Open ${draft.title} photo ${safePhotoIndex + 1}`}
              >
                <img className={styles.detailPhoto} src={primaryPhoto} alt={`${draft.title} photo ${safePhotoIndex + 1}`} />
              </button>
            ) : (
              <div className={styles.detailPhotoPlaceholder}>No asset photo saved</div>
            )}

            {photoCount > 1 ? (
              <>
                <button
                  type="button"
                  className={`${styles.detailPhotoNavButton} ${styles.detailPhotoNavPrevious}`}
                  onClick={() => cyclePhoto(-1)}
                  aria-label="Show previous asset photo"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className={`${styles.detailPhotoNavButton} ${styles.detailPhotoNavNext}`}
                  onClick={() => cyclePhoto(1)}
                  aria-label="Show next asset photo"
                >
                  ›
                </button>
                <span className={styles.detailPhotoCounter}>{safePhotoIndex + 1} / {photoCount}</span>
              </>
            ) : null}
          </div>

          <div className={styles.detailHeroBody}>
            <div className={styles.detailIdentity}>
              <h1><BalancedHeadingText text={draft.title} /></h1>
            </div>

            <div className={styles.detailValueSummary}>
              <span>Aim4price value</span>
              <strong>{money(draft.value)}</strong>
              <small>Excl. VAT · Updated {dateOnly(draft.updatedAtIso)}</small>
            </div>

            <div className={styles.assetMirrorActions} aria-label="Asset actions">
              <Link
                className={`${styles.assetMirrorAction} ${styles.assetMirrorViewAction}`}
                href={`/owner-app/assets/${encodeURIComponent(assetId)}/details`}
                prefetch={false}
              >
                View Details
              </Link>
              <Link
                className={`${styles.assetMirrorAction} ${styles.assetMirrorOptionsAction}`}
                href={`/owner-app/assets/${encodeURIComponent(assetId)}/options`}
                prefetch={false}
              >
                Options
              </Link>
              <Link
                className={`${styles.assetMirrorAction} ${styles.assetMirrorManageAction}`}
                href={`/owner-app/assets/${encodeURIComponent(assetId)}/manage`}
                prefetch={false}
              >
                Manage
              </Link>
            </div>

          </div>
        </section>

        {photoViewerOpen && primaryPhoto ? (
          <div className={styles.ownerPhotoViewer} role="dialog" aria-modal="true" aria-label={`${draft.title} photo viewer`}>
            <button type="button" className={styles.ownerPhotoViewerBackdrop} onClick={() => setPhotoViewerOpen(false)} aria-label="Close photo viewer" />
            <div className={styles.ownerPhotoViewerCard}>
              <button type="button" className={styles.ownerPhotoViewerClose} onClick={() => setPhotoViewerOpen(false)} aria-label="Close photo viewer">×</button>
              <img src={primaryPhoto} alt={`${draft.title} enlarged photo ${safePhotoIndex + 1}`} />
              {photoCount > 1 ? (
                <>
                  <button type="button" className={`${styles.ownerPhotoViewerNav} ${styles.ownerPhotoViewerPrevious}`} onClick={() => cyclePhoto(-1)} aria-label="Show previous photo">‹</button>
                  <button type="button" className={`${styles.ownerPhotoViewerNav} ${styles.ownerPhotoViewerNext}`} onClick={() => cyclePhoto(1)} aria-label="Show next photo">›</button>
                  <span className={styles.ownerPhotoViewerCounter}>{safePhotoIndex + 1} / {photoCount}</span>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (view === 'details') {
    const hasMappedLocation = draft.lastKnownLat !== null && draft.lastKnownLng !== null;
    const manageBase = `/owner-app/assets/${encodeURIComponent(assetId)}/manage`;
    const mapHref = hasMappedLocation ? `https://www.google.com/maps?q=${draft.lastKnownLat},${draft.lastKnownLng}` : '';
    const financeVisual = statusVisual(financeStatus);
    const insuranceVisual = statusVisual(insuranceStatus);
    const licenceVisual = statusVisual(licenseStatus);
    const mappedVisual = statusVisual(hasMappedLocation ? 'yes' : 'no');
    const licenceRenewalDate = specValue(
      draft.specsJson,
      'licenseRenewalDate',
      'license_renewal_date',
      'licenceRenewalDate',
      'licence_renewal_date',
    );

    return (
      <div className={styles.wideContent}>
        {notice ? <div className={notice.tone === 'success' ? styles.successNotice : styles.errorNotice}>{notice.message}</div> : null}

        <section className={`${styles.summaryCard} ${styles.detailHero} ${styles.assetMirrorCard} ${styles.assetDetailsPageCard}`}>
          <div className={styles.detailPhotoStage}>
            {primaryPhoto ? (
              <button
                type="button"
                className={styles.detailPhotoOpenButton}
                onClick={() => setPhotoViewerOpen(true)}
                aria-label={`Open ${draft.title} photo ${safePhotoIndex + 1}`}
              >
                <img className={styles.detailPhoto} src={primaryPhoto} alt={`${draft.title} photo ${safePhotoIndex + 1}`} />
              </button>
            ) : (
              <div className={styles.detailPhotoPlaceholder}>No asset photo saved</div>
            )}

            {photoCount > 1 ? <>
              <button type="button" className={`${styles.detailPhotoNavButton} ${styles.detailPhotoNavPrevious}`} onClick={() => cyclePhoto(-1)} aria-label="Show previous asset photo">‹</button>
              <button type="button" className={`${styles.detailPhotoNavButton} ${styles.detailPhotoNavNext}`} onClick={() => cyclePhoto(1)} aria-label="Show next asset photo">›</button>
              <span className={styles.detailPhotoCounter}>{safePhotoIndex + 1} / {photoCount}</span>
            </> : null}
          </div>

          <div className={styles.detailHeroBody}>
            <div className={styles.detailIdentity}>
              <h1><BalancedHeadingText text={draft.title} /></h1>
            </div>

            <div className={styles.detailValueSummary}>
              <span>Aim4price value</span>
              <strong>{money(draft.value)}</strong>
              <small>Excl. VAT · Updated {dateOnly(draft.updatedAtIso)}</small>
            </div>

            <div className={styles.assetMirrorDetails}>
              <section className={styles.assetMirrorMediaSection}>
                <h2><BalancedHeadingText text="Photos and saved documents" /></h2>

                {photoCount > 1 ? (
                  <div className={styles.detailPhotoThumbs} aria-label="Saved asset photos">
                    {draft.photos.map((photo, index) => (
                      <button
                        type="button"
                        key={`${photo}-${index}`}
                        className={`${styles.detailPhotoThumbButton} ${index === safePhotoIndex ? styles.detailPhotoThumbButtonActive : ''}`}
                        onClick={() => setPhotoIndex(index)}
                        aria-label={`Show asset photo ${index + 1}`}
                        aria-pressed={index === safePhotoIndex}
                      >
                        <img src={photo} alt={`${draft.title} thumbnail ${index + 1}`} />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className={styles.detailMediaActions}>
                  <label className={styles.detailUploadButton}>
                    <span>{actionBusy === 'upload-photo' ? 'Uploading photos…' : photoCount ? 'Add photos' : 'Upload photos'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(event: ChangeEvent<HTMLInputElement>) => void uploadFiles('photo', event.target.files)}
                      disabled={Boolean(actionBusy)}
                    />
                  </label>
                </div>

                <div className={styles.assetDocumentPanel}>
                  <div className={styles.assetDocumentPanelHeading}>
                    <span aria-hidden="true">▤</span>
                    <strong>Documents</strong>
                    <small>{draft.documents.length} saved</small>
                  </div>
                  {draft.documents.length ? (
                    <div className={styles.assetDocumentLinks}>
                      {draft.documents.map((document, index) => (
                        <a key={document.id || `${document.url}-${index}`} href={document.url} target="_blank" rel="noreferrer">
                          <span>{document.fileName || `Document ${index + 1}`}</span>
                          <span aria-hidden="true">↗</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p>No documents have been saved for this asset.</p>
                  )}
                  <label className={`${styles.detailUploadButton} ${styles.detailDocumentUploadButton}`}>
                    <span>{actionBusy === 'upload-document' ? 'Uploading documents…' : 'Add documents'}</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp"
                      multiple
                      onChange={(event: ChangeEvent<HTMLInputElement>) => void uploadFiles('document', event.target.files)}
                      disabled={Boolean(actionBusy)}
                    />
                  </label>
                </div>
              </section>

              <section className={styles.assetMirrorValuesSection}>
                <h2><BalancedHeadingText text="Saved asset details and values" /></h2>

                <Link className={styles.assetDetailsEditLink} href={`${manageBase}/details`} prefetch={false}>
                  <div className={styles.assetMirrorDetailGrid}>
                    <div><span>Serial</span><strong>{draft.serialNumber || 'Not saved'}</strong></div>
                    <div><span>Year</span><strong>{draft.yearModel || 'Not saved'}</strong></div>
                    <div><span>Usage</span><strong>{usageText}</strong></div>
                    <div><span>Condition</span><strong>{conditionLabel(draft.condition)}</strong></div>
                  </div>
                  <small>Open asset details ›</small>
                </Link>

                <div className={styles.assetMirrorStatusGrid} aria-label="Asset status">
                  <Link href={`${manageBase}/finance`} prefetch={false} aria-label={`Financed: ${financeVisual.title}. Open finance details.`}>
                    <span className={styles.assetMirrorStatusCopy}><span>Financed</span><small>Open finance ›</small></span>
                    <strong className={`${styles.assetMirrorStatusMark} ${financeVisual.className}`} aria-hidden="true">{financeVisual.symbol}</strong>
                  </Link>
                  <Link href={`${manageBase}/insurance`} prefetch={false} aria-label={`Insured: ${insuranceVisual.title}. Open insurance details.`}>
                    <span className={styles.assetMirrorStatusCopy}><span>Insured</span><small>Open insurance ›</small></span>
                    <strong className={`${styles.assetMirrorStatusMark} ${insuranceVisual.className}`} aria-hidden="true">{insuranceVisual.symbol}</strong>
                  </Link>
                  <Link href={`${manageBase}/licence`} prefetch={false} aria-label={`Licensed: ${licenceVisual.title}. Open licence details.`}>
                    <span className={styles.assetMirrorStatusCopy}><span>Licensed</span><small>Open licence ›</small></span>
                    <strong className={`${styles.assetMirrorStatusMark} ${licenceVisual.className}`} aria-hidden="true">{licenceVisual.symbol}</strong>
                  </Link>
                  {hasMappedLocation ? (
                    <a href={mapHref} target="_blank" rel="noreferrer" aria-label="Mapped: Yes. Open map.">
                      <span className={styles.assetMirrorStatusCopy}><span>Mapped</span><small>Open map ›</small></span>
                      <strong className={`${styles.assetMirrorStatusMark} ${mappedVisual.className}`} aria-hidden="true">{mappedVisual.symbol}</strong>
                    </a>
                  ) : (
                    <Link href={`${manageBase}/location`} prefetch={false} aria-label="Mapped: No. Add a location.">
                      <span className={styles.assetMirrorStatusCopy}><span>Mapped</span><small>Add location ›</small></span>
                      <strong className={`${styles.assetMirrorStatusMark} ${mappedVisual.className}`} aria-hidden="true">{mappedVisual.symbol}</strong>
                    </Link>
                  )}
                </div>

                <div className={styles.assetMirrorValueSummaries}>
                  <Link className={styles.detailValueSummary} href={`${manageBase}/details`} prefetch={false}>
                    <span>Replacement price</span>
                    <strong>{money(draft.replacementPriceExVat)}</strong>
                    <small>Excl. VAT · Open ›</small>
                  </Link>
                  {insuranceStatus === 'yes' || draft.insuredValueExVat !== null ? (
                    <Link className={styles.detailValueSummary} href={`${manageBase}/insurance`} prefetch={false}>
                      <span>Insured value</span>
                      <strong>{money(draft.insuredValueExVat)}</strong>
                      <small>Excl. VAT · Open ›</small>
                    </Link>
                  ) : null}
                  {draft.licenseRegistrationNumber ? (
                    <Link className={styles.detailValueSummary} href={`${manageBase}/licence`} prefetch={false}>
                      <span>Registration</span>
                      <strong>{draft.licenseRegistrationNumber}</strong>
                      <small>Open ›</small>
                    </Link>
                  ) : null}
                </div>

                <div className={styles.assetMirrorSecondaryGrid}>
                  <Link href={`${manageBase}/licence`} prefetch={false}>
                    <span>Licence renewal</span>
                    <strong>{dateOnly(licenceRenewalDate)}</strong>
                    <small>{licenceRenewalDate ? 'Open licence ›' : 'Add date ›'}</small>
                  </Link>
                  <Link href={`${manageBase}/maintenance`} prefetch={false}><span>Maintenance</span><strong>{upcomingMaintenance ? upcomingMaintenance.computedStatusLabel : 'Nothing upcoming'}</strong><small>Open ›</small></Link>
                  {draft.marketplaceStatus === 'live' ? (
                    <Link href={`${manageBase}/marketplace`} prefetch={false}><span>Marketplace</span><strong>Listed</strong><small>Open listing ›</small></Link>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        </section>

        {photoViewerOpen && primaryPhoto ? (
          <div className={styles.ownerPhotoViewer} role="dialog" aria-modal="true" aria-label={`${draft.title} photo viewer`}>
            <button type="button" className={styles.ownerPhotoViewerBackdrop} onClick={() => setPhotoViewerOpen(false)} aria-label="Close photo viewer" />
            <div className={styles.ownerPhotoViewerCard}>
              <button type="button" className={styles.ownerPhotoViewerClose} onClick={() => setPhotoViewerOpen(false)} aria-label="Close photo viewer">×</button>
              <img src={primaryPhoto} alt={`${draft.title} enlarged photo ${safePhotoIndex + 1}`} />
              {photoCount > 1 ? <>
                <button type="button" className={`${styles.ownerPhotoViewerNav} ${styles.ownerPhotoViewerPrevious}`} onClick={() => cyclePhoto(-1)} aria-label="Show previous photo">‹</button>
                <button type="button" className={`${styles.ownerPhotoViewerNav} ${styles.ownerPhotoViewerNext}`} onClick={() => cyclePhoto(1)} aria-label="Show next photo">›</button>
                <span className={styles.ownerPhotoViewerCounter}>{safePhotoIndex + 1} / {photoCount}</span>
              </> : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (view === 'options') {
    return <OwnerAssetOptionsClient assetId={assetId} assetTitle={draft.title} assetKind={draft.kind} assetValue={draft.value} />;
  }

  if (view === 'manage') {
    const manageMeta = [draft.serialNumber ? `Serial: ${draft.serialNumber}` : '', draft.yearModel ? `Year: ${draft.yearModel}` : '', usageText !== 'Not saved' ? `Usage: ${usageText}` : ''].filter(Boolean).join(' · ');
    const availableManageSections = MANAGE_SECTIONS.filter((item) => item.id !== 'marketplace' || draft.kind !== 'property');
    return (
      <div className={styles.wideContent}>
        <section className={styles.manageAssetIdentity}>
          <div className={styles.manageAssetIdentityCopy}>
            <span>Manage asset</span>
            <h1><BalancedHeadingText text={draft.title} /></h1>
            {manageMeta ? <p>{manageMeta}</p> : null}
          </div>
          <Link href={`/owner-app/assets/${encodeURIComponent(assetId)}/details`} prefetch={false}>View details <span aria-hidden="true">›</span></Link>
        </section>

        <section className={styles.manageSection} aria-label="Asset management options">
          <div className={styles.manageGroupGrid}>
            {MANAGE_GROUPS.map((group) => {
              const groupItems = availableManageSections.filter((item) => item.group === group.id);
              if (!groupItems.length) return null;
              return (
                <section className={`${styles.manageGroup} ${group.id === 'removal' ? styles.manageGroupDanger : ''}`} key={group.id}>
                  <h2>{group.title}</h2>
                  <div className={styles.manageList}>
                    {groupItems.map((item) => (
                      <Link
                        key={item.id}
                        href={`/owner-app/assets/${encodeURIComponent(assetId)}/manage/${item.id}`}
                        prefetch={false}
                        className={`${styles.manageButton} ${item.tone === 'danger' ? styles.manageButtonDanger : ''}`}
                      >
                        <span className={styles.manageButtonCopy}><strong>{item.title}</strong><small>{item.description}</small></span>
                        <span className={styles.manageButtonArrow} aria-hidden="true">›</span>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.wideContent}>
      <section className={styles.taskIdentity}>
        <span>{MANAGE_SECTIONS.find((item) => item.id === section)?.title || 'Manage asset'}</span>
        <h1><BalancedHeadingText text={draft.title} /></h1>
        <p>{draft.serialNumber ? `Serial: ${draft.serialNumber}` : registerName}</p>
      </section>

      {notice ? <div className={notice.tone === 'success' ? styles.successNotice : styles.errorNotice}>{notice.message}</div> : null}

      {section === 'details' ? <section className={`${styles.section} ${styles.editorSection}`}>
        {editorHeader('Update asset', 'Edit the asset details, usage and values.')}
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.fieldFull}`}><span>Asset name</span><input value={draft.title} onChange={(event) => update('title', event.target.value)} /></label>
          <label className={styles.field}><span>Register</span><select value={draft.registerId ?? ''} onChange={(event) => update('registerId', event.target.value)}>{registers.map((register) => <option key={register.id} value={register.id}>{register.businessName}</option>)}</select></label>
          <label className={styles.field}><span>Asset type</span><select value={draft.kind} onChange={(event) => update('kind', event.target.value)}><option value="tractor">Tractor</option><option value="equipment">Equipment</option><option value="vehicle">Vehicle</option><option value="property">Property</option><option value="tools">Tools</option><option value="stock">Stock</option><option value="manual">Other</option></select></label>
          <label className={styles.field}><span>Make</span><input value={draft.brandName} onChange={(event) => update('brandName', event.target.value)} /></label>
          <label className={styles.field}><span>Model</span><input value={draft.modelName} onChange={(event) => update('modelName', event.target.value)} /></label>
          <label className={styles.field}><span>Year model / year built</span><input inputMode="numeric" value={draft.yearModel ?? ''} onChange={(event) => update('yearModel', event.target.value ? Number(event.target.value) : null)} /></label>
          <label className={styles.field}><span>Serial / VIN / chassis</span><input value={draft.serialNumber} onChange={(event) => update('serialNumber', event.target.value)} /></label>
          <label className={styles.field}><span>Condition</span><select value={draft.condition} onChange={(event) => update('condition', event.target.value)}><option value="">Not saved</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="used">Used</option><option value="serious">Serious</option></select></label>
          <label className={styles.field}><span>Usage type</span><select value={usageMetric} onChange={(event) => updateUsageMetric(event.target.value as AssetUsageMetric)}><option value="hours">Hours</option><option value="km">Kilometres</option><option value="percentage">Percentage worked</option></select></label>
          {usageMetric === 'percentage' ? <label className={styles.field}><span>Percentage worked</span><input inputMode="decimal" value={draft.lifeWorkedPercent ?? ''} onChange={(event) => update('lifeWorkedPercent', event.target.value ? Number(event.target.value) : null)} /></label> : <label className={styles.field}><span>Current usage</span><input inputMode="decimal" value={draft.hours ?? ''} onChange={(event) => update('hours', event.target.value ? Number(event.target.value) : null)} /></label>}
          <label className={styles.field}><span>Current Aim4price value excl. VAT</span><input inputMode="decimal" value={draft.value || ''} onChange={(event) => update('value', Number(event.target.value) || 0)} /></label>
          <label className={styles.field}><span>Replacement price excl. VAT</span><input inputMode="decimal" value={draft.replacementPriceExVat ?? ''} onChange={(event) => update('replacementPriceExVat', event.target.value ? Number(event.target.value) : null)} /></label>
          <label className={`${styles.field} ${styles.fieldFull}`}><span>Notes</span><textarea value={draft.note} onChange={(event) => update('note', event.target.value)} /></label>
        </div>
        <div className={styles.actions}><button type="button" className={styles.primaryButton} onClick={() => void saveAsset()} disabled={saving || Boolean(actionBusy)}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </section> : null}

      {section === 'reports' ? <ReportsSection draft={draft} openValuationReport={openValuationReport} /> : null}

      {section === 'pricing' ? <PricingSection draft={draft} reload={() => loadDetail(true)} setNotice={setNotice} /> : null}

      {section === 'finance' ? <section className={`${styles.section} ${styles.editorSection}`}>
        {editorHeader('Finance', 'Manage finance status and information.')}
        <div className={styles.formGrid}>
          <label className={styles.field}><span>Finance status</span><select value={financeStatus} onChange={(event) => updateStatus('finance', event.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {financeStatus === 'yes' ? <>
            <label className={styles.field}><span>Finance type</span><select value={extra('financeType', 'finance_type')} onChange={(event) => updateSpec('financeType', event.target.value)}><option value="">Not saved</option><option value="asset_specific">Asset-specific finance</option><option value="bulk_group">Bulk / group finance</option></select></label>
            {extraInput('financierName', 'Financier', { fallbackKeys: ['financier_name'] })}{extraInput('financeCurrentOutstandingExVat', 'Current outstanding excl. VAT', { inputMode: 'decimal', fallbackKeys: ['finance_current_outstanding_ex_vat'] })}{extraInput('financeBoughtWhen', 'Bought when', { type: 'date', fallbackKeys: ['finance_bought_when'] })}{extraInput('financeBoughtForExVat', 'Bought for excl. VAT', { inputMode: 'decimal', fallbackKeys: ['finance_bought_for_ex_vat'] })}{extraInput('financeOriginalAmountExVat', 'Original financed amount', { inputMode: 'decimal', fallbackKeys: ['finance_original_amount_ex_vat'] })}{extraInput('financeMonthlyPaymentExVat', 'Monthly payment', { inputMode: 'decimal', fallbackKeys: ['finance_monthly_payment_ex_vat'] })}{extraInput('financeInterestRatePercent', 'Interest rate %', { inputMode: 'decimal', fallbackKeys: ['finance_interest_rate_percent'] })}{extraInput('financeTermMonths', 'Term months', { inputMode: 'numeric', fallbackKeys: ['finance_term_months'] })}{extraInput('financeBalloonPaymentExVat', 'Balloon payment', { inputMode: 'decimal', fallbackKeys: ['finance_balloon_payment_ex_vat'] })}{extraInput('financeSettlementDate', 'Settlement date', { type: 'date', fallbackKeys: ['finance_settlement_date'] })}{extraInput('financeReferenceNumber', 'Finance reference', { fallbackKeys: ['finance_reference_number'] })}
            <label className={`${styles.field} ${styles.fieldFull}`}><span>Finance notes</span><textarea value={draft.financeNote} onChange={(event) => update('financeNote', event.target.value)} /></label>
          </> : null}
        </div>
        <div className={styles.actions}><button type="button" className={styles.primaryButton} onClick={() => void saveAsset()} disabled={saving || Boolean(actionBusy)}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </section> : null}

      {section === 'insurance' ? <section className={`${styles.section} ${styles.editorSection}`}>
        {editorHeader('Insurance', 'Manage insurance status and cover.')}
        <div className={styles.formGrid}>
          <label className={styles.field}><span>Insurance status</span><select value={insuranceStatus} onChange={(event) => updateStatus('insurance', event.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {insuranceStatus === 'yes' ? <><label className={styles.field}><span>Insured value excl. VAT</span><input inputMode="decimal" value={draft.insuredValueExVat ?? ''} onChange={(event) => update('insuredValueExVat', event.target.value ? Number(event.target.value) : null)} /></label>{extraInput('insuranceInsurerName', 'Insurer / broker', { fallbackKeys: ['insurance_insurer_name'] })}{extraInput('insurancePolicyNumber', 'Policy number', { fallbackKeys: ['insurance_policy_number'] })}{extraInput('insuranceRenewalDate', 'Renewal date', { type: 'date', fallbackKeys: ['insurance_renewal_date'] })}<label className={`${styles.field} ${styles.fieldFull}`}><span>Insurance notes</span><textarea value={extra('insuranceNote', 'insurance_note')} onChange={(event) => updateSpec('insuranceNote', event.target.value)} /></label></> : null}
        </div>
        <div className={styles.actions}><button type="button" className={styles.primaryButton} onClick={() => void saveAsset()} disabled={saving || Boolean(actionBusy)}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </section> : null}

      {section === 'licence' ? <section className={`${styles.section} ${styles.editorSection}`}>
        {editorHeader('Licence and registration', 'Manage licence and registration details.')}
        <div className={styles.formGrid}>
          <label className={styles.field}><span>Licence status</span><select value={licenseStatus} onChange={(event) => updateStatus('license', event.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {licenseStatus === 'yes' ? <><label className={styles.field}><span>Registration / licence number</span><input value={draft.licenseRegistrationNumber} onChange={(event) => update('licenseRegistrationNumber', event.target.value)} /></label>{extraInput('licenseRenewalDate', 'Licence renewal date', { type: 'date', fallbackKeys: ['license_renewal_date', 'licenceRenewalDate'] })}<label className={`${styles.field} ${styles.fieldFull}`}><span>Licence notes</span><textarea value={extra('licenseNote', 'license_note')} onChange={(event) => updateSpec('licenseNote', event.target.value)} /></label></> : null}
        </div>
        <div className={styles.actions}><button type="button" className={styles.primaryButton} onClick={() => void saveAsset()} disabled={saving || Boolean(actionBusy)}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </section> : null}

      {section === 'location' ? <LocationSection draft={draft} location={location} setLocation={setLocation} action={action} busy={Boolean(actionBusy)} /> : null}

      {section === 'media' ? <section className={`${styles.section} ${styles.editorSection}`}>
        {editorHeader('Photos and documents', 'Add, open or remove saved files.')}
        <div className={styles.mediaGrid}>{draft.photos.map((url) => <div className={styles.mediaItem} key={url}><img src={url} alt="Asset" /><button type="button" onClick={() => update('photos', draft.photos.filter((photo) => photo !== url))}>×</button></div>)}{draft.documents.map((document) => <div className={styles.mediaItem} key={document.id}><a href={document.url} target="_blank" rel="noreferrer">{document.fileName}</a><button type="button" onClick={() => update('documents', draft.documents.filter((entry) => entry.id !== document.id))}>×</button></div>)}</div>
        <label className={styles.fileInput}>Add photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => void uploadFiles('photo', event.target.files)} disabled={Boolean(actionBusy)} /></label><label className={styles.fileInput}>Add documents<input type="file" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => void uploadFiles('document', event.target.files)} disabled={Boolean(actionBusy)} /></label>
        <div className={styles.actions}><button type="button" className={styles.primaryButton} onClick={() => void saveAsset()} disabled={saving || Boolean(actionBusy)}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </section> : null}

      {section === 'marketplace' ? <MarketplaceSection draft={draft} ownerContext={ownerContext} action={action} busy={Boolean(actionBusy)} /> : null}
      {section === 'maintenance' ? <MaintenanceSection records={maintenance} action={action} busy={Boolean(actionBusy)} /> : null}
      {section === 'delete' ? <section className={`${styles.section} ${styles.deleteSection}`}>
        {editorHeader('Delete asset', 'Permanently remove this asset and its saved Owner App record.')}
        <p>This cannot be undone. Only continue if you are certain that this asset must be removed.</p>
        <button type="button" className={styles.dangerButton} onClick={() => void deleteAsset()} disabled={Boolean(actionBusy)}>{actionBusy === 'delete' ? 'Deleting asset…' : 'Delete asset permanently'}</button>
      </section> : null}
    </div>
  );
}

function ReportsSection({ draft, openValuationReport }: { draft: Asset; openValuationReport: () => void }) {
  type FilterableReport = 'maintenance' | 'fuel' | 'depreciation' | 'ownership';
  const currentYear = new Date().getFullYear();
  const reportYear = (value: string | null | undefined) => {
    if (!value) return null;
    const year = new Date(value).getFullYear();
    return Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : null;
  };
  const reportYears = [
    currentYear,
    reportYear(draft.lastScannedAtIso),
    reportYear(draft.updatedAtIso),
    reportYear(draft.createdAtIso),
  ].filter((value): value is number => value !== null);
  const firstYear = Math.min(...reportYears, currentYear);
  const lastYear = Math.max(...reportYears, currentYear);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => String(lastYear - index));
  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');
  const [maintenanceType, setMaintenanceType] = useState('all');
  const [selectedReport, setSelectedReport] = useState<FilterableReport | null>(null);

  function reportUrl(report: Exclude<FilterableReport, 'ownership'>) {
    const params = new URLSearchParams({ assetId: draft.id, report });
    if (year !== 'all') {
      params.set('year', year);
      if (month !== 'all') params.set('month', month);
    }
    if (report === 'maintenance' && maintenanceType !== 'all') params.set('maintenanceType', maintenanceType);
    return `/api/asset-register/scan-report?${params.toString()}`;
  }

  function ownershipUrl() {
    const params = new URLSearchParams({ assetId: draft.id, format: 'pdf', source: 'owner-app' });
    if (year !== 'all') {
      params.set('year', year);
      if (month !== 'all') params.set('month', month);
    }
    return `/api/my-invoices/report?${params.toString()}`;
  }

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const filterableReports: Array<{ id: FilterableReport; title: string; description: string }> = [
    { id: 'maintenance', title: 'Maintenance report', description: 'Service, checks and repair activity.' },
    ...(draft.kind !== 'property' ? [
      { id: 'fuel' as const, title: 'Fuel report', description: 'Fuel activity, usage and costs.' },
      { id: 'depreciation' as const, title: 'Depreciation log', description: 'Saved value changes and depreciation history.' },
    ] : []),
    { id: 'ownership', title: 'Cost of ownership', description: 'Invoices, ownership costs and VAT.' },
  ];
  const selectedReportDetails = filterableReports.find((report) => report.id === selectedReport) ?? null;
  const selectedReportHref = selectedReport
    ? selectedReport === 'ownership' ? ownershipUrl() : reportUrl(selectedReport)
    : '';

  useEffect(() => {
    if (!selectedReport) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedReport(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedReport]);

  function chooseReport(report: FilterableReport) {
    setYear('all');
    setMonth('all');
    setMaintenanceType('all');
    setSelectedReport(report);
  }

  const reportCard = (key: string, title: string, description: string, onClick: () => void) => (
    <article className={styles.reportCard} key={key}>
      <span className={styles.reportPdfBadge} aria-hidden="true">PDF</span>
      <div><strong>{title}</strong><small>{description}</small></div>
      <button type="button" onClick={onClick}>Download PDF</button>
    </article>
  );

  return (
    <section className={`${styles.section} ${styles.editorSection}`}>
      <div className={`${styles.sectionHeader} ${styles.editorHeader}`}><div><h2>Available reports</h2><p>Choose a report first. Any available filters will appear before the PDF opens.</p></div></div>
      <div className={styles.reportList}>
        {reportCard('valuation', 'Asset valuation', 'Value summary, asset details, photos and saved status.', openValuationReport)}
        {filterableReports.map((report) => reportCard(report.id, report.title, report.description, () => chooseReport(report.id)))}
      </div>

      {selectedReport && selectedReportDetails ? (
        <div className={styles.reportFilterDialog} role="dialog" aria-modal="true" aria-labelledby="owner-report-filter-title">
          <button type="button" className={styles.reportFilterBackdrop} onClick={() => setSelectedReport(null)} aria-label="Close report filters" />
          <section className={styles.reportFilterModal}>
            <div className={styles.reportFilterModalHeader}>
              <div>
                <span>PDF report</span>
                <h2 id="owner-report-filter-title">{selectedReportDetails.title}</h2>
                <p>Choose what the PDF should include.</p>
              </div>
              <button type="button" onClick={() => setSelectedReport(null)} aria-label="Close report filters">×</button>
            </div>
            <div className={styles.reportFilterGrid}>
              <label className={styles.field}><span>Year</span><select value={year} onChange={(event) => { setYear(event.target.value); setMonth('all'); }}><option value="all">All years</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className={styles.field}><span>Month</span><select value={month} disabled={year === 'all'} onChange={(event) => setMonth(event.target.value)}><option value="all">All months</option>{months.map((label, index) => <option key={label} value={String(index + 1)}>{label}</option>)}</select></label>
              {selectedReport === 'maintenance' ? <label className={`${styles.field} ${styles.fieldFull}`}><span>Maintenance type</span><select value={maintenanceType} onChange={(event) => setMaintenanceType(event.target.value)}><option value="all">All maintenance</option><option value="checked">Checked</option><option value="serviced">Service</option><option value="repaired">Repair</option></select></label> : null}
            </div>
            <div className={styles.reportFilterActions}>
              <button type="button" onClick={() => setSelectedReport(null)}>Cancel</button>
              <a href={selectedReportHref} target="_blank" rel="noreferrer" onClick={() => setSelectedReport(null)}>Download PDF</a>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

type RevalueResponse = {
  ok?: boolean; item?: Asset; oldValueExVat?: number; newValueExVat?: number; warning?: string;
  replacementPriceUsedExVat?: number | null; error?: string;
};
type ProjectionResponse = {
  ok?: boolean; error?: string; projection?: {
    baseYear: number; targetYear: number; inflationRatePct: number; usageMetric?: string;
    current: { hours: number; lifeWorkedPercent?: number | null };
    projected: { retailExVat: number; hours: number; lifeWorkedPercent?: number | null };
  };
};

function PricingSection({ draft, reload, setNotice }: {
  draft: Asset;
  reload: () => Promise<void>;
  setNotice: Dispatch<SetStateAction<{ tone: 'success' | 'error'; message: string } | null>>;
}) {
  const usage = resolveAssetUsage({ kind: draft.kind, hours: draft.hours, lifeWorkedPercent: draft.lifeWorkedPercent, specsJson: draft.specsJson });
  const canRecalculate = draft.valuationRunId !== null && draft.selectedMethod !== 'manual';
  const [replacementMode, setReplacementMode] = useState<'saved' | 'custom'>('saved');
  const [replacementPrice, setReplacementPrice] = useState(String(draft.replacementPriceExVat ?? ''));
  const [preview, setPreview] = useState<RevalueResponse | null>(null);
  const [pricingBusy, setPricingBusy] = useState('');
  const [pricingError, setPricingError] = useState('');
  const [targetYear, setTargetYear] = useState(String(new Date().getFullYear() + 1));
  const [inflationRatePct, setInflationRatePct] = useState('8');
  const [extraUsage, setExtraUsage] = useState('0');
  const [targetPercent, setTargetPercent] = useState(String(draft.lifeWorkedPercent ?? ''));
  const [projection, setProjection] = useState<ProjectionResponse['projection'] | null>(null);

  async function requestRevalue(previewOnly: boolean) {
    if (!canRecalculate || pricingBusy) return;
    const customPrice = Number(replacementPrice.replace(/[^0-9.]/g, ''));
    if (replacementMode === 'custom' && (!Number.isFinite(customPrice) || customPrice <= 0)) {
      setPricingError('Enter a valid replacement price excluding VAT.');
      return;
    }
    setPricingBusy(previewOnly ? 'preview' : 'save');
    setPricingError('');
    try {
      const response = await fetch('/api/asset-register/revalue', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: draft.id,
          selectedMethod: 'aim4price',
          ...(previewOnly ? { previewOnly: true } : {}),
          ...(replacementMode === 'custom' ? { replacementPriceExVat: customPrice, saveReplacementPrice: !previewOnly } : {}),
        }),
      });
      const data = await response.json().catch(() => null) as RevalueResponse | null;
      if (response.status === 401) { window.location.replace('/owner-app/login'); return; }
      if (!response.ok || !data?.ok || !data.item) throw new Error(data?.error || 'The Aim4price value could not be recalculated.');
      if (previewOnly) {
        setPreview(data);
      } else {
        setPreview(null);
        await reload();
        setNotice({ tone: 'success', message: `${draft.title} Aim4price value updated to ${money(data.newValueExVat ?? data.item.value)}.${data.warning ? ` ${data.warning}` : ''}` });
      }
    } catch (cause) {
      setPricingError(cause instanceof Error ? cause.message : 'The Aim4price value could not be recalculated.');
    } finally {
      setPricingBusy('');
    }
  }

  async function calculateProjection() {
    if (pricingBusy) return;
    setPricingBusy('projection');
    setPricingError('');
    setProjection(null);
    try {
      const response = await fetch('/api/asset-register/projection', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: draft.id,
          targetYear: Number(targetYear),
          inflationRatePct: Number(inflationRatePct),
          ...(usage.metric === 'percentage' ? { targetLifeWorkedPercent: Number(targetPercent) } : { extraUsage: Number(extraUsage) }),
        }),
      });
      const data = await response.json().catch(() => null) as ProjectionResponse | null;
      if (response.status === 401) { window.location.replace('/owner-app/login'); return; }
      if (!response.ok || !data?.ok || !data.projection) throw new Error(data?.error || 'The future price could not be calculated.');
      setProjection(data.projection);
    } catch (cause) {
      setPricingError(cause instanceof Error ? cause.message : 'The future price could not be calculated.');
    } finally {
      setPricingBusy('');
    }
  }

  return (
    <section className={`${styles.section} ${styles.editorSection}`}>
      <div className={`${styles.sectionHeader} ${styles.editorHeader}`}><div><h2>Manage pricing</h2><p>Recalculate the current Aim4price value or estimate a future price.</p></div></div>
      <div className={styles.pricingSummaryGrid}>
        <div><span>Aim4price value</span><strong>{money(draft.value)}</strong><small>Excl. VAT</small></div>
        <div><span>Replacement price</span><strong>{money(draft.replacementPriceExVat)}</strong><small>Excl. VAT</small></div>
      </div>
      <article className={styles.pricingPanel}>
        <div className={styles.pricingPanelHeader}><strong>Recalculate value</strong><small>Refresh the saved Aim4price estimate using current asset information.</small></div>
        {canRecalculate ? <>
          <div className={styles.choiceRow}>
            <button type="button" className={replacementMode === 'saved' ? styles.choiceActive : ''} onClick={() => { setReplacementMode('saved'); setPreview(null); }}>Use saved replacement price</button>
            <button type="button" className={replacementMode === 'custom' ? styles.choiceActive : ''} onClick={() => { setReplacementMode('custom'); setPreview(null); }}>Enter updated price</button>
          </div>
          {replacementMode === 'custom' ? <label className={styles.field}><span>Replacement price excl. VAT</span><input inputMode="decimal" value={replacementPrice} onChange={(event) => { setReplacementPrice(event.target.value); setPreview(null); }} /></label> : null}
          {preview?.item ? <div className={styles.pricingResult}><span>New Aim4price value</span><strong>{money(preview.newValueExVat ?? preview.item.value)}</strong><small>Current value: {money(preview.oldValueExVat ?? draft.value)}</small></div> : null}
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} disabled={Boolean(pricingBusy)} onClick={() => void requestRevalue(true)}>{pricingBusy === 'preview' ? 'Calculating…' : 'Preview new value'}</button>
            {preview?.item ? <button type="button" className={styles.primaryButton} disabled={Boolean(pricingBusy)} onClick={() => void requestRevalue(false)}>{pricingBusy === 'save' ? 'Saving…' : 'Save new value'}</button> : null}
          </div>
        </> : <p className={styles.infoNotice}>Automatic recalculation is available for assets saved from an Aim4price valuation.</p>}
      </article>
      <article className={styles.pricingPanel}>
        <div className={styles.pricingPanelHeader}><strong>Calculate future price</strong><small>Estimate a future value using inflation and expected usage.</small></div>
        <div className={styles.formGrid}>
          <label className={styles.field}><span>Target year</span><input inputMode="numeric" value={targetYear} onChange={(event) => setTargetYear(event.target.value)} /></label>
          <label className={styles.field}><span>Inflation % per year</span><input inputMode="decimal" value={inflationRatePct} onChange={(event) => setInflationRatePct(event.target.value)} /></label>
          {usage.metric === 'percentage' ? <label className={`${styles.field} ${styles.fieldFull}`}><span>Expected worked percentage</span><input inputMode="decimal" value={targetPercent} onChange={(event) => setTargetPercent(event.target.value)} /></label> : <label className={`${styles.field} ${styles.fieldFull}`}><span>Extra {usage.metric === 'km' ? 'kilometres' : 'hours'}</span><input inputMode="decimal" value={extraUsage} onChange={(event) => setExtraUsage(event.target.value)} /></label>}
        </div>
        <button type="button" className={styles.primaryButton} disabled={Boolean(pricingBusy)} onClick={() => void calculateProjection()}>{pricingBusy === 'projection' ? 'Calculating…' : 'Calculate future price'}</button>
        {projection ? <div className={styles.pricingResult}><span>Estimated {projection.targetYear} value</span><strong>{money(projection.projected.retailExVat)}</strong><small>{projection.inflationRatePct}% annual inflation · excl. VAT</small></div> : null}
      </article>
      {pricingError ? <div className={styles.errorNotice}>{pricingError}</div> : null}
    </section>
  );
}

type LocationDraft = { locationText: string; latitude: string; longitude: string };

function LocationSection({ draft, location, setLocation, action, busy }: {
  draft: Asset;
  location: LocationDraft;
  setLocation: Dispatch<SetStateAction<LocationDraft>>;
  action: (body: Record<string, unknown>, message: string) => Promise<void>;
  busy: boolean;
}) {
  const [mode, setMode] = useState<'current' | 'manual' | 'map'>('current');
  const [locationError, setLocationError] = useState('');
  const [deviceBusy, setDeviceBusy] = useState(false);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const hasCoordinates = location.latitude.trim() !== '' && location.longitude.trim() !== '' &&
    Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude));
  const mapsHref = hasCoordinates ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}` : '';

  useEffect(() => {
    if (mode !== 'map' || !mapElementRef.current) return undefined;
    let active = true;

    function loadLeaflet(): Promise<any> {
      if (window.L) return Promise.resolve(window.L);
      if (!document.getElementById('owner-leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'owner-leaflet-css'; link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      return new Promise((resolve, reject) => {
        const existing = document.getElementById('owner-leaflet-script') as HTMLScriptElement | null;
        const script = existing || document.createElement('script');
        if (!existing) { script.id = 'owner-leaflet-script'; script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; document.body.appendChild(script); }
        script.addEventListener('load', () => resolve(window.L), { once: true });
        script.addEventListener('error', () => reject(new Error('The location map could not be loaded.')), { once: true });
      });
    }

    void loadLeaflet().then((L) => {
      if (!active || !L || !mapElementRef.current) return;
      const savedLat = Number(location.latitude);
      const savedLng = Number(location.longitude);
      const center: [number, number] = hasCoordinates ? [savedLat, savedLng] : [-29, 24];
      const map = L.map(mapElementRef.current).setView(center, hasCoordinates ? 13 : 5);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      mapRef.current = map;
      const setPoint = (lat: number, lng: number) => {
        if (!markerRef.current) {
          markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
          markerRef.current.on('dragend', () => { const point = markerRef.current.getLatLng(); setLocation((current) => ({ ...current, latitude: point.lat.toFixed(6), longitude: point.lng.toFixed(6) })); });
        } else markerRef.current.setLatLng([lat, lng]);
        setLocation((current) => ({ ...current, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
      };
      if (hasCoordinates) setPoint(savedLat, savedLng);
      map.on('click', (event: any) => setPoint(event.latlng.lat, event.latlng.lng));
      window.setTimeout(() => map.invalidateSize(), 0);
    }).catch((cause) => setLocationError(cause instanceof Error ? cause.message : 'The location map could not be loaded.'));

    return () => {
      active = false;
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [mode]);

  function useDeviceLocation() {
    setLocationError('');
    if (!navigator.geolocation) { setLocationError('GPS is not available in this browser.'); return; }
    setDeviceBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { ...location, latitude: position.coords.latitude.toFixed(6), longitude: position.coords.longitude.toFixed(6) };
        setLocation(next);
        void action({ action: 'location', ...next, source: 'device' }, 'Device location saved.').finally(() => setDeviceBusy(false));
      },
      (error) => { setDeviceBusy(false); setLocationError(error.code === 1 ? 'Location permission was denied.' : 'Your location could not be found.'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  return (
    <section className={`${styles.section} ${styles.editorSection}`}>
      <div className={`${styles.sectionHeader} ${styles.editorHeader}`}><div><h2>Location</h2><p>Save this asset’s position from the device, GPS coordinates or the map.</p></div></div>
      <div className={styles.locationCurrentCard}>
        <div><span>Saved location</span><strong>{location.locationText || (hasCoordinates ? `${location.latitude}, ${location.longitude}` : 'No location saved')}</strong><small>Last scanned: {dateTime(draft.lastScannedAtIso)}</small></div>
        {mapsHref ? <a href={mapsHref} target="_blank" rel="noreferrer">Open in Maps</a> : null}
      </div>
      <div className={styles.locationChoiceGrid}>
        <button type="button" onClick={useDeviceLocation} disabled={busy || deviceBusy}><strong>{deviceBusy ? 'Finding location…' : 'Use this device'}</strong><small>Save the phone or computer GPS position.</small></button>
        <button type="button" onClick={() => setMode('manual')} className={mode === 'manual' ? styles.locationChoiceActive : ''}><strong>Enter GPS</strong><small>Type latitude and longitude manually.</small></button>
        <button type="button" onClick={() => setMode('map')} className={mode === 'map' ? styles.locationChoiceActive : ''}><strong>Choose on map</strong><small>Tap the exact position on a map.</small></button>
      </div>
      {mode === 'manual' ? <div className={styles.locationEditor}>
        <div className={styles.formGrid}><label className={`${styles.field} ${styles.fieldFull}`}><span>Location description</span><input value={location.locationText} onChange={(event) => setLocation((current) => ({ ...current, locationText: event.target.value }))} placeholder="Farm, branch, camp or address" /></label><label className={styles.field}><span>Latitude</span><input inputMode="decimal" value={location.latitude} onChange={(event) => setLocation((current) => ({ ...current, latitude: event.target.value }))} /></label><label className={styles.field}><span>Longitude</span><input inputMode="decimal" value={location.longitude} onChange={(event) => setLocation((current) => ({ ...current, longitude: event.target.value }))} /></label></div>
        <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void action({ action: 'location', ...location, source: 'manual' }, 'Location updated.')}>Save GPS location</button>
      </div> : null}
      {mode === 'map' ? <div className={styles.locationEditor}>
        <label className={styles.field}><span>Location description</span><input value={location.locationText} onChange={(event) => setLocation((current) => ({ ...current, locationText: event.target.value }))} placeholder="Farm, branch, camp or address" /></label>
        <div ref={mapElementRef} className={styles.locationMap} aria-label="Choose the asset position on the map" />
        <p className={styles.mapHint}>Tap the map or drag the marker to choose the asset position.</p>
        <button type="button" className={styles.primaryButton} disabled={busy || !hasCoordinates} onClick={() => void action({ action: 'location', ...location, source: 'manual' }, 'Map location saved.')}>Save map position</button>
      </div> : null}
      {locationError ? <div className={styles.errorNotice}>{locationError}</div> : null}
    </section>
  );
}

function MarketplaceSection({ draft, ownerContext, action, busy }: { draft: Asset; ownerContext: OwnerContext | null; action: (body: Record<string, unknown>, message: string) => Promise<void>; busy: boolean }) {
  const [form, setForm] = useState({
    askingPriceExVat: String(draft.marketplacePriceExVat ?? draft.value ?? ''), marketplaceNotes: draft.marketplaceNotes || manualMarketplaceNote(draft.note),
    sellerName: draft.marketplaceSellerName || ownerContext?.contactName || ownerContext?.businessName || 'Aim4price seller', sellerCompany: draft.marketplaceSellerCompany || ownerContext?.businessName || '', sellerPhone: draft.sellerPhone || ownerContext?.phone || '',
    sellerEmail: draft.marketplaceSellerEmail || ownerContext?.email || '', province: draft.marketplaceProvince || ownerContext?.province || '', area: draft.marketplaceArea || ownerContext?.area || '',
  });
  const [formError, setFormError] = useState('');
  const listingBaseTitle = draft.title || [draft.brandName, draft.modelName || draft.typedModelName].filter(Boolean).join(' ') || 'Marketplace listing';
  const listingUsage = formatResolvedAssetUsage(resolveAssetUsage({ kind: draft.kind, hours: draft.hours, lifeWorkedPercent: draft.lifeWorkedPercent, specsJson: draft.specsJson }), 'Usage not set');
  const listingTitle = `${listingBaseTitle} · ${draft.yearModel || 'Year not set'} · ${listingUsage} · ${draft.condition ? conditionLabel(draft.condition) : 'Condition not set'}`;

  async function publishMarketplaceListing() {
    const askingPrice = Number(form.askingPriceExVat.replace(/[^0-9.]/g, ''));
    if (draft.kind === 'property') { setFormError('Property / Buildings assets cannot be sent to Marketplace.'); return; }
    if (!Number.isFinite(askingPrice) || askingPrice <= 0) { setFormError('Enter a valid marketplace price before continuing.'); return; }
    if (!form.sellerName.trim() || !form.sellerPhone.trim()) { setFormError('Add at least a contact name and phone number before sending to Marketplace.'); return; }
    setFormError('');
    await action({ action: 'marketplace-publish', ...form, askingPriceExVat: askingPrice }, draft.marketplaceStatus === 'live' ? 'Marketplace listing updated.' : 'Asset listed on Marketplace.');
  }

  return (
    <section className={styles.section}>
      <div className={`${styles.sectionHeader} ${styles.editorHeader}`}><div><h2>Marketplace</h2><p>Status: {draft.marketplaceStatus === 'live' ? 'Live' : 'Not listed'} · Asset and seller information is filled in automatically.</p></div></div>
      <div className={styles.marketplacePreview}>
        {draft.photos[0] ? <img src={draft.photos[0]} alt={listingTitle} /> : <div>No photo saved</div>}
        <span><small>Listing title</small><strong>{listingTitle}</strong><em>{draft.photos.length} saved photo{draft.photos.length === 1 ? '' : 's'} will be used</em></span>
      </div>
      <div className={styles.formGrid}>
        {Object.entries({ askingPriceExVat: 'Asking price excl. VAT', sellerName: 'Contact name', sellerCompany: 'Business name', sellerPhone: 'Phone', sellerEmail: 'Business email', province: 'Province', area: 'Area' }).map(([key, label]) => <label className={styles.field} key={key}><span>{label}</span><input value={form[key as keyof typeof form]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
        <label className={`${styles.field} ${styles.fieldFull}`}><span>Listing description</span><textarea value={form.marketplaceNotes} onChange={(event) => setForm((current) => ({ ...current, marketplaceNotes: event.target.value }))} /></label>
      </div>
      {formError ? <div className={styles.errorNotice}>{formError}</div> : null}
      <div className={styles.actions}><button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void publishMarketplaceListing()}>{draft.marketplaceStatus === 'live' ? 'Update listing' : 'List on Marketplace'}</button>{draft.marketplaceStatus === 'live' ? <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => void action({ action: 'marketplace-remove' }, 'Marketplace listing removed.')}>Remove listing</button> : null}</div>
    </section>
  );
}

function MaintenanceSection({ records, action, busy }: { records: Maintenance[]; action: (body: Record<string, unknown>, message: string) => Promise<void>; busy: boolean }) {
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    await action({ action: 'maintenance-create', maintenanceType: 'service', triggerType: 'date', status: 'upcoming', alertBeforeValue: 7, alertBeforeUnit: 'days', ...data }, 'Maintenance item created.');
    form.reset();
  }
  return (
    <section className={styles.section}>
      <div className={`${styles.sectionHeader} ${styles.editorHeader}`}><div><h2>Maintenance</h2><p>Schedule and manage maintenance.</p></div></div>
      <div className={styles.recordList}>{records.length ? records.map((record) => <article className={styles.record} key={record.id}><div className={styles.recordHeader}><h3>{record.title}</h3><span className={styles.recordStatus}>{record.computedStatusLabel}</span></div><p>{[record.maintenanceType, record.dueDate || (record.dueUsage !== null ? `${record.dueUsage} ${record.usageMetric || ''}` : ''), record.notes].filter(Boolean).join(' · ')}</p><div className={styles.actions}>{record.status === 'upcoming' ? <><button type="button" className={styles.smallButton} disabled={busy} onClick={() => void action({ action: 'maintenance-complete', maintenanceId: record.id }, 'Maintenance marked complete.')}>Complete</button><button type="button" className={styles.smallButton} disabled={busy} onClick={() => void action({ action: 'maintenance-cancel', maintenanceId: record.id }, 'Maintenance cancelled.')}>Cancel</button></> : record.status === 'done' ? <button type="button" className={styles.smallButton} disabled={busy} onClick={() => void action({ action: 'maintenance-reopen', maintenanceId: record.id }, 'Maintenance reopened.')}>Reopen</button> : null}</div></article>) : <p>No maintenance records yet.</p>}</div>
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
