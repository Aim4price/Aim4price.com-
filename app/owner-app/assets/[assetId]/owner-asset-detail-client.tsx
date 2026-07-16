'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { formatResolvedAssetUsage, resolveAssetUsage, type AssetUsageMetric } from '../../../../lib/asset-usage';
import BalancedHeadingText from '../../balanced-heading';
import styles from '../../owner-app.module.css';
import OwnerAssetOptionsClient from './owner-asset-options-client';

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
type DetailResponse = {
  ok: boolean; item?: Asset; register?: Register | null; registers?: Register[]; maintenance?: Maintenance[];
  error?: string; requiresUsageConfirmation?: boolean;
};
type UploadResponse = { ok: boolean; uploads?: Array<{ uploadId: string; url: string; fileName: string; contentType: string; byteSize: number }>; error?: string };

export type OwnerAssetView = 'summary' | 'details' | 'options' | 'manage' | 'section';
export type OwnerAssetManageSection = 'details' | 'finance' | 'insurance' | 'licence' | 'location' | 'media' | 'marketplace' | 'maintenance' | 'delete';

const STATUS_OPTIONS = [
  { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Unknown' }, { value: 'not_applicable', label: 'Not applicable' },
];

const MANAGE_SECTIONS: Array<{ id: OwnerAssetManageSection; title: string; description: string; tone?: 'featured' | 'danger' }> = [
  { id: 'details', title: 'Update asset', description: 'Edit the asset details, usage and values.', tone: 'featured' },
  { id: 'finance', title: 'Finance', description: 'Manage finance status and information.' },
  { id: 'insurance', title: 'Insurance', description: 'Manage insurance status and cover.' },
  { id: 'licence', title: 'Licence', description: 'Manage licence and registration details.' },
  { id: 'location', title: 'Location & flags', description: 'Update the location or flag the asset.' },
  { id: 'media', title: 'Photos & documents', description: 'Add or remove saved files.' },
  { id: 'marketplace', title: 'Marketplace', description: 'Create or update the marketplace listing.' },
  { id: 'maintenance', title: 'Maintenance', description: 'Schedule and manage maintenance.' },
  { id: 'delete', title: 'Delete asset', description: 'Permanently remove this saved asset.', tone: 'danger' },
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

export default function OwnerAssetDetailClient({ assetId, view = 'summary', section }: {
  assetId: string;
  view?: OwnerAssetView;
  section?: OwnerAssetManageSection;
}) {
  const [draft, setDraft] = useState<Asset | null>(null);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [registerName, setRegisterName] = useState('');
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
  const flagged = Boolean(draft?.specsJson.assetFlagged ?? draft?.specsJson.asset_flagged ?? draft?.specsJson.flagged);
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
                    <small>{licenceRenewalDate ? 'Open licence ›' : 'Add renewal date ›'}</small>
                  </Link>
                  <Link href={`${manageBase}/maintenance`} prefetch={false}><span>Maintenance</span><strong>{upcomingMaintenance ? upcomingMaintenance.computedStatusLabel : 'Nothing upcoming'}</strong><small>Open ›</small></Link>
                  {hasMappedLocation ? (
                    <a href={mapHref} target="_blank" rel="noreferrer"><span>Location</span><strong>Mapped</strong><small>Open map ›</small></a>
                  ) : (
                    <Link href={`${manageBase}/location`} prefetch={false}><span>Location</span><strong>Not saved</strong><small>Add location ›</small></Link>
                  )}
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
    return (
      <div className={styles.wideContent}>
        <section className={styles.manageAssetIdentity}>
          <span>Manage asset</span>
          <h1><BalancedHeadingText text={draft.title} /></h1>
          {manageMeta ? <p>{manageMeta}</p> : null}
          <Link href={`/owner-app/assets/${encodeURIComponent(assetId)}/details`} prefetch={false}>View asset details</Link>
        </section>

        <section className={`${styles.section} ${styles.manageSection}`}>
          <div className={styles.manageIntro}><h2><BalancedHeadingText text="What would you like to manage?" /></h2><p>Choose one task to continue on its own page.</p></div>
          <div className={styles.manageGrid}>
            {MANAGE_SECTIONS.map((item) => (
              <Link
                key={item.id}
                href={`/owner-app/assets/${encodeURIComponent(assetId)}/manage/${item.id}`}
                prefetch={false}
                className={`${styles.manageButton} ${item.tone === 'featured' ? styles.manageButtonFeatured : ''} ${item.tone === 'danger' ? styles.manageButtonDanger : ''}`}
              >
                <span className={styles.manageButtonCopy}><strong>{item.title}</strong><small>{item.description}</small></span>
                <span className={styles.manageButtonArrow} aria-hidden="true">›</span>
              </Link>
            ))}
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
          {extraInput('internalReference', 'Internal reference', { fallbackKeys: ['internal_reference'] })}
          <label className={styles.field}><span>Condition</span><select value={draft.condition} onChange={(event) => update('condition', event.target.value)}><option value="">Not saved</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="used">Used</option><option value="serious">Serious</option></select></label>
          <label className={styles.field}><span>Usage type</span><select value={usageMetric} onChange={(event) => updateUsageMetric(event.target.value as AssetUsageMetric)}><option value="hours">Hours</option><option value="km">Kilometres</option><option value="percentage">Percentage worked</option></select></label>
          {usageMetric === 'percentage' ? <label className={styles.field}><span>Percentage worked</span><input inputMode="decimal" value={draft.lifeWorkedPercent ?? ''} onChange={(event) => update('lifeWorkedPercent', event.target.value ? Number(event.target.value) : null)} /></label> : <label className={styles.field}><span>Current usage</span><input inputMode="decimal" value={draft.hours ?? ''} onChange={(event) => update('hours', event.target.value ? Number(event.target.value) : null)} /></label>}
          <label className={styles.field}><span>Current Aim4price value excl. VAT</span><input inputMode="decimal" value={draft.value || ''} onChange={(event) => update('value', Number(event.target.value) || 0)} /></label>
          <label className={styles.field}><span>Replacement price excl. VAT</span><input inputMode="decimal" value={draft.replacementPriceExVat ?? ''} onChange={(event) => update('replacementPriceExVat', event.target.value ? Number(event.target.value) : null)} /></label>
          <label className={`${styles.field} ${styles.fieldFull}`}><span>Notes</span><textarea value={draft.note} onChange={(event) => update('note', event.target.value)} /></label>
        </div>
        <div className={styles.actions}><button type="button" className={styles.primaryButton} onClick={() => void saveAsset()} disabled={saving || Boolean(actionBusy)}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </section> : null}

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

      {section === 'location' ? <section className={`${styles.section} ${styles.editorSection}`}>
        {editorHeader('Location, scan and flags', 'Update the saved location or flag this asset.')}
        <p>Last scanned: {dateTime(draft.lastScannedAtIso)}</p>
        <div className={styles.formGrid}><label className={`${styles.field} ${styles.fieldFull}`}><span>Location description</span><input value={location.locationText} onChange={(event) => setLocation((current) => ({ ...current, locationText: event.target.value }))} /></label><label className={styles.field}><span>Latitude</span><input inputMode="decimal" value={location.latitude} onChange={(event) => setLocation((current) => ({ ...current, latitude: event.target.value }))} /></label><label className={styles.field}><span>Longitude</span><input inputMode="decimal" value={location.longitude} onChange={(event) => setLocation((current) => ({ ...current, longitude: event.target.value }))} /></label></div>
        <div className={styles.actions}><button type="button" className={styles.primaryButton} disabled={Boolean(actionBusy)} onClick={() => void action({ action: 'location', ...location }, 'Location updated.')}>Save location</button><button type="button" className={styles.secondaryButton} disabled={Boolean(actionBusy)} onClick={() => void action({ action: 'flag', isFlagged: !flagged }, flagged ? 'Flag removed.' : 'Asset flagged.')}>{flagged ? 'Remove flag' : 'Flag asset'}</button></div>
      </section> : null}

      {section === 'media' ? <section className={`${styles.section} ${styles.editorSection}`}>
        {editorHeader('Photos and documents', 'Add, open or remove saved files.')}
        <div className={styles.mediaGrid}>{draft.photos.map((url) => <div className={styles.mediaItem} key={url}><img src={url} alt="Asset" /><button type="button" onClick={() => update('photos', draft.photos.filter((photo) => photo !== url))}>×</button></div>)}{draft.documents.map((document) => <div className={styles.mediaItem} key={document.id}><a href={document.url} target="_blank" rel="noreferrer">{document.fileName}</a><button type="button" onClick={() => update('documents', draft.documents.filter((entry) => entry.id !== document.id))}>×</button></div>)}</div>
        <label className={styles.fileInput}>Add photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => void uploadFiles('photo', event.target.files)} disabled={Boolean(actionBusy)} /></label><label className={styles.fileInput}>Add documents<input type="file" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => void uploadFiles('document', event.target.files)} disabled={Boolean(actionBusy)} /></label>
        <div className={styles.actions}><button type="button" className={styles.primaryButton} onClick={() => void saveAsset()} disabled={saving || Boolean(actionBusy)}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </section> : null}

      {section === 'marketplace' ? <MarketplaceSection draft={draft} action={action} busy={Boolean(actionBusy)} /> : null}
      {section === 'maintenance' ? <MaintenanceSection records={maintenance} action={action} busy={Boolean(actionBusy)} /> : null}
      {section === 'delete' ? <section className={`${styles.section} ${styles.deleteSection}`}>
        {editorHeader('Delete asset', 'Permanently remove this asset and its saved Owner App record.')}
        <p>This cannot be undone. Only continue if you are certain that this asset must be removed.</p>
        <button type="button" className={styles.dangerButton} onClick={() => void deleteAsset()} disabled={Boolean(actionBusy)}>{actionBusy === 'delete' ? 'Deleting asset…' : 'Delete asset permanently'}</button>
      </section> : null}
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
      <div className={`${styles.sectionHeader} ${styles.editorHeader}`}><div><h2>Marketplace</h2><p>Status: {draft.marketplaceStatus === 'live' ? 'Live' : 'Not listed'}</p></div></div>
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
