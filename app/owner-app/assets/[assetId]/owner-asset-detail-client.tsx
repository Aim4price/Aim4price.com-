'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import DealerMaintenanceAccessSettings from '../../../../components/DealerMaintenanceAccessSettings';
import GroupedCurrencyInput, { parseCurrencyInput } from '../../../../components/GroupedCurrencyInput';
import SaleabilityModal from '../../../../components/SaleabilityModal';
import { formatResolvedAssetUsage, resolveAssetUsage, type AssetUsageMetric } from '../../../../lib/asset-usage';
import type { DealerMaintenanceAccessSummary } from '../../../../lib/dealer-maintenance-tracker';
import type { DealerAssetCorrectionRequest } from '../../../../lib/dealer-asset-corrections';
import { buildAssetSheetReportHtml, type AssetSheetPayload } from '../../../../lib/report-print';
import type { GeneralSaleabilityInput } from '../../../../lib/saleability';
import BalancedHeadingText from '../../balanced-heading';
import OwnerAppNav from '../../owner-app-nav';
import styles from '../../owner-app.module.css';
import OwnerAssetOptionsClient from './owner-asset-options-client';
import OwnerAssetReportPicker from './owner-asset-report-picker';

declare global {
  interface Window { L?: any }
}

type Document = { id: string; url: string; fileName: string; contentType: string; byteSize: number; uploadedAtIso: string };
type Asset = {
  id: string; registerId: string | null; kind: string; title: string; value: number; replacementPriceExVat: number | null;
  valuationRunId: number | null; selectedMethod: string;
  brandName: string; modelName: string; typedModelName: string; yearModel: number | null; hours: number | null;
  lifeWorkedPercent: number | null; maxLifetimeHours: number | null; condition: string; note: string; serialNumber: string; isFinanced: boolean;
  lifeRemainingPercent?: number | null;
  financeNote: string; isInsured: boolean; insuredValueExVat: number | null; isLicensed: boolean;
  licenseRegistrationNumber: string; specsJson: Record<string, unknown>; photos: string[]; documents: Document[];
  marketplaceStatus: string; marketplacePriceExVat: number | null; marketplaceNotes: string; sellerPhone: string;
  marketplaceSellerName: string; marketplaceSellerCompany: string; marketplaceSellerEmail: string;
  marketplaceProvince: string; marketplaceArea: string; lastScannedAtIso: string | null; lastKnownLat: number | null;
  lastKnownLng: number | null; lastKnownLocationText: string; createdAtIso: string; updatedAtIso: string;
  dealerAssetCorrection?: DealerAssetCorrectionRequest | null;
};
type Register = { id: string; businessName: string };
type OwnerContext = {
  businessName: string; contactName: string; phone: string; email: string; province: string; area: string;
  address: string; reportLogoUrl: string;
};
type Maintenance = {
  id: string; maintenanceType: 'service' | 'checkup'; status: string; computedStatusLabel: string; title: string;
  notes: string; triggerType: string; dueDate: string | null; dueUsage: number | null; usageMetric: string | null;
  recurringEnabled: boolean; generatedFromMaintenanceId: string | null;
};
type ActivityItem = {
  id: string; kind: 'work' | 'fuel' | 'maintenance' | 'lifecycle'; title: string; detail: string;
  actorName: string; occurredAtIso: string;
};
type DetailResponse = {
  ok: boolean; item?: Asset; register?: Register | null; registers?: Register[]; maintenance?: Maintenance[];
  ownerContext?: OwnerContext;
  error?: string; requiresUsageConfirmation?: boolean;
};
type UploadResponse = { ok: boolean; uploads?: Array<{ uploadId: string; url: string; fileName: string; contentType: string; byteSize: number }>; error?: string };
type DisposalReason = 'sold' | 'traded_in' | 'scrapped' | 'written_off' | 'mistake_duplicate' | 'other';
type OutcomeInfluence = 'yes' | 'no' | 'unsure';
type TransferAction = 'archive' | 'claim_code';
type DisposalWizardStep = 1 | 2 | 3 | 4;
type DisposalDraft = {
  reason: DisposalReason | '';
  disposalDate: string;
  disposalAmountExVat: string;
  note: string;
  aim4priceOutcomeInfluence: OutcomeInfluence | '';
  transferAction: TransferAction | '';
};
type TransferReceipt = {
  id: string;
  assetId: string;
  assetTitle: string;
  assetIdentifier: string;
  assetIdentifierLabel: 'Serial / VIN' | 'Asset ID';
  transferCode: string;
  expiresAtIso: string;
};

export type OwnerAssetView = 'summary' | 'details' | 'options' | 'manage' | 'section';
export type OwnerAssetManageSection = 'details' | 'activity' | 'reports' | 'pricing' | 'finance' | 'insurance' | 'licence' | 'location' | 'media' | 'marketplace' | 'maintenance' | 'dealer-tracking' | 'delete';
export type OwnerAssetPricingMode = 'landing' | 'recalculate' | 'future' | 'saleability';
type OwnerAssetManageGroup = 'asset' | 'records' | 'selling' | 'removal';

const STATUS_OPTIONS = [
  { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Unknown' }, { value: 'not_applicable', label: 'Not applicable' },
];

const DISPOSAL_REASONS: Array<{ value: DisposalReason; label: string }> = [
  { value: 'sold', label: 'Sold' },
  { value: 'traded_in', label: 'Traded in' },
  { value: 'scrapped', label: 'Scrapped' },
  { value: 'written_off', label: 'Written off' },
  { value: 'mistake_duplicate', label: 'Added by mistake' },
  { value: 'other', label: 'Other' },
];

function createDisposalDraft(): DisposalDraft {
  return {
    reason: '',
    disposalDate: new Date().toISOString().slice(0, 10),
    disposalAmountExVat: '',
    note: '',
    aim4priceOutcomeInfluence: '',
    transferAction: '',
  };
}

const DISPOSAL_WIZARD_STEPS = ['Outcome', 'Details', 'Aim4price impact', 'Information'] as const;

function disposalImpactRequired(reason: DisposalDraft['reason']): boolean {
  return reason === 'sold' || reason === 'traded_in' || reason === 'scrapped';
}

function disposalReasonLabel(reason: DisposalDraft['reason']): string {
  return DISPOSAL_REASONS.find((item) => item.value === reason)?.label || 'Not selected';
}

function disposalAmountLabel(reason: DisposalDraft['reason']): string {
  if (reason === 'sold') return 'Sale amount';
  if (reason === 'traded_in') return 'Trade-in allowance';
  if (reason === 'scrapped') return 'Scrap proceeds';
  if (reason === 'written_off') return 'Recovery amount';
  return 'Disposal amount';
}

const MANAGE_SECTIONS: Array<{ id: OwnerAssetManageSection; group: OwnerAssetManageGroup; title: string; tone?: 'danger' }> = [
  { id: 'details', group: 'asset', title: 'Update asset' },
  { id: 'pricing', group: 'asset', title: 'Manage pricing' },
  { id: 'location', group: 'asset', title: 'Location' },
  { id: 'media', group: 'asset', title: 'Photos & documents' },
  { id: 'reports', group: 'records', title: 'Reports' },
  { id: 'activity', group: 'records', title: 'Activity' },
  { id: 'maintenance', group: 'records', title: 'Schedule maintenance' },
  { id: 'dealer-tracking', group: 'records', title: 'Dealer tracking' },
  { id: 'finance', group: 'records', title: 'Finance' },
  { id: 'insurance', group: 'records', title: 'Insurance' },
  { id: 'licence', group: 'records', title: 'Licence' },
  { id: 'marketplace', group: 'selling', title: 'Marketplace' },
  { id: 'delete', group: 'removal', title: 'Delete asset', tone: 'danger' },
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
function maintenanceDueLabel(record: Maintenance) {
  if (record.triggerType === 'date' && record.dueDate) return dateOnly(record.dueDate);
  if (record.triggerType === 'usage' && record.dueUsage !== null) {
    const unit = record.usageMetric === 'km' ? 'km' : record.usageMetric === 'percentage' ? '%' : 'hours';
    return `${new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 2 }).format(record.dueUsage)} ${unit}`;
  }
  return record.computedStatusLabel;
}
function hasRecurringMaintenance(record: Maintenance) {
  return Boolean(record.recurringEnabled || record.generatedFromMaintenanceId);
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

function buildOwnerValuationReportPayload(asset: Asset, ownerContext: OwnerContext | null): AssetSheetPayload {
  const usage = formatResolvedAssetUsage(resolveAssetUsage({
    kind: asset.kind,
    hours: asset.hours,
    lifeWorkedPercent: asset.lifeWorkedPercent,
    specsJson: asset.specsJson,
  }), 'Not saved');
  const methodLabel = asset.selectedMethod === 'manual' ? 'Manual value' : 'Aim4price value';

  return {
    logoUrl: ownerContext?.reportLogoUrl || '/brand/aim4price-mark-black.png',
    generatedAt: dateOnly(new Date().toISOString()),
    assetBadge: asset.kind === 'property' ? 'Property / Buildings' : asset.kind.charAt(0).toUpperCase() + asset.kind.slice(1),
    heroTitle: asset.title,
    heroMeta: [asset.yearModel, asset.brandName, asset.modelName].filter(Boolean).join(' · '),
    valueLabel: 'Estimated Value',
    value: money(asset.value),
    valueNote: methodLabel,
    statusLabel: dateOnly(asset.updatedAtIso),
    issuerName: 'Aim4price',
    issuerAddress: 'Saved asset register data',
    issuerEmail: 'aim4price@gmail.com',
    clientRows: [
      { label: 'Business Name', value: ownerContext?.businessName || 'Aim4price client' },
      { label: 'Contact Details', value: ownerContext?.phone || '—' },
      { label: 'Business Email', value: ownerContext?.email || '—' },
      { label: 'Location / Address', value: ownerContext?.address || ownerContext?.area || '—' },
    ],
    photoUrl: asset.photos[0] || null,
    photoUrls: asset.photos,
    facts: [
      { label: 'Category', value: asset.kind === 'property' ? 'Property / Buildings' : asset.kind },
      { label: 'Brand', value: asset.brandName || '—' },
      { label: 'Model', value: asset.modelName || asset.typedModelName || '—' },
      { label: 'Year', value: asset.yearModel ? String(asset.yearModel) : '—' },
      { label: 'Usage', value: usage },
      { label: 'Condition', value: conditionLabel(asset.condition) },
      { label: 'Replacement Price', value: asset.replacementPriceExVat ? `${money(asset.replacementPriceExVat)} excl. VAT` : 'Not saved' },
      { label: 'Serial Number', value: asset.serialNumber || '—' },
      { label: 'Insured', value: statusVisual(statusValue(asset, 'insurance')).title },
      { label: 'Insured Value', value: asset.insuredValueExVat ? `${money(asset.insuredValueExVat)} excl. VAT` : 'Not saved' },
      { label: 'Financed', value: statusVisual(statusValue(asset, 'finance')).title },
      { label: 'Licensed', value: statusVisual(statusValue(asset, 'license')).title },
      { label: 'Documents', value: asset.documents.length ? `${asset.documents.length} saved` : 'None' },
      { label: 'Last Updated', value: dateOnly(asset.updatedAtIso) },
    ],
    notes: [],
    methodCards: [{ label: methodLabel, value: money(asset.value), note: 'Saved value excluding VAT', selected: true }],
    footerNote: 'Values are indicative estimates based on saved asset-register information and available pricing inputs. This is not a certified valuation, inspection report or guarantee of selling price.',
  };
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

function estimateNeedsAutomaticUpdate(asset: Pick<Asset, 'valuationRunId' | 'selectedMethod' | 'specsJson'>): boolean {
  if (asset.valuationRunId === null || asset.selectedMethod === 'manual') return false;
  const value = asset.specsJson.valuationNeedsUpdate ?? asset.specsJson.valuation_needs_update;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['true', '1', 'yes'].includes(String(value ?? '').trim().toLowerCase());
}

const EXPECTED_LIFETIME_SPEC_KEYS = [
  'maxLifetimeHours', 'max_lifetime_hours', 'expectedLifetimeHours', 'expected_lifetime_hours',
  'lifetimeHours', 'lifetime_hours', 'designLifeHours', 'design_life_hours', 'usefulLifeHours', 'useful_life_hours',
  'maxLifetimeKm', 'max_lifetime_km', 'expectedLifetimeKm', 'expected_lifetime_km',
  'lifetimeKm', 'lifetime_km', 'designLifeKm', 'design_life_km', 'usefulLifeKm', 'useful_life_km',
] as const;

function readExpectedLifetime(asset: Pick<Asset, 'maxLifetimeHours' | 'specsJson'>): number | null {
  const direct = Number(asset.maxLifetimeHours);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
  for (const key of EXPECTED_LIFETIME_SPEC_KEYS) {
    const value = Number(asset.specsJson[key]);
    if (Number.isFinite(value) && value > 0) return Math.round(value);
  }
  return null;
}

function formatWholeNumberInput(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('en-ZA').replace(/,/g, ' ') : '';
}

function parseWholeNumberInput(value: string): number | null {
  const parsed = Number(value.replace(/\D/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function moneyDifference(value: number): string {
  if (!Number.isFinite(value) || value === 0) return 'R 0';
  return `${value > 0 ? '+' : '−'}R ${Math.abs(Math.round(value)).toLocaleString('en-ZA')}`;
}

function asOptionalRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asOptionalNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildAssetSaleabilityInput(asset: Asset): GeneralSaleabilityInput {
  const saved = asOptionalRecord(asset.specsJson.aim4priceSaleabilityInputs)
    ?? asOptionalRecord(asset.specsJson.aim4price_saleability_inputs);

  return {
    lifeRemainingPercent: asset.lifeRemainingPercent ?? null,
    usageAmount: asset.hours,
    maxLifetimeUsage: asset.maxLifetimeHours,
    lifeWorkedPercent: asset.lifeWorkedPercent,
    condition: asset.condition,
    conditionFactorPercent: asOptionalNumber(saved?.conditionFactorPercent ?? saved?.condition_factor_percent),
    popularityStars: asOptionalNumber(saved?.popularityStars ?? saved?.popularity_stars),
  };
}

export default function OwnerAssetDetailClient({ assetId, view = 'summary', section, pricingMode = 'landing' }: {
  assetId: string;
  view?: OwnerAssetView;
  section?: OwnerAssetManageSection;
  pricingMode?: OwnerAssetPricingMode;
}) {
  const [draft, setDraft] = useState<Asset | null>(null);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [registerName, setRegisterName] = useState('');
  const [ownerContext, setOwnerContext] = useState<OwnerContext | null>(null);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [dealerTrackingAccess, setDealerTrackingAccess] = useState<DealerMaintenanceAccessSummary[]>([]);
  const [dealerTrackingLoading, setDealerTrackingLoading] = useState(false);
  const [dealerTrackingError, setDealerTrackingError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [location, setLocation] = useState({ locationText: '', latitude: '', longitude: '' });
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [disposalDraft, setDisposalDraft] = useState<DisposalDraft>(createDisposalDraft);
  const [disposalWizardStep, setDisposalWizardStep] = useState<DisposalWizardStep>(1);
  const [transferReceipt, setTransferReceipt] = useState<TransferReceipt | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const photoCount = draft?.photos.length ?? 0;
  const safePhotoIndex = photoCount ? Math.min(photoIndex, photoCount - 1) : 0;
  const primaryPhoto = draft?.photos[safePhotoIndex] || '';
  const financeStatus = draft ? statusValue(draft, 'finance') : 'unknown';
  const insuranceStatus = draft ? statusValue(draft, 'insurance') : 'unknown';
  const licenseStatus = draft ? statusValue(draft, 'license') : 'unknown';
  const upcomingMaintenance = useMemo(() => maintenance.find((record) => record.status === 'upcoming') ?? null, [maintenance]);

  useEffect(() => { void loadDetail(); }, [assetId]);

  useEffect(() => {
    void fetch('/api/owner-app/session', { credentials: 'include', cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => setPermissions(Array.isArray(payload?.session?.permissions) ? payload.session.permissions : []))
      .catch(() => setPermissions([]));
  }, []);

  useEffect(() => {
    if (view !== 'manage' && section !== 'dealer-tracking') return undefined;

    const controller = new AbortController();
    setDealerTrackingAccess([]);
    setDealerTrackingError('');
    setDealerTrackingLoading(true);

    async function loadDealerTrackingAccess() {
      try {
        const response = await fetch(`/api/dealer-maintenance-access?assetId=${encodeURIComponent(assetId)}`, {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as {
          ok?: boolean;
          trackingAccess?: DealerMaintenanceAccessSummary[];
          error?: string;
        } | null;
        if (response.status === 401) {
          window.location.replace('/owner-app/login');
          return;
        }
        if (!response.ok || !payload?.ok || !Array.isArray(payload.trackingAccess)) {
          throw new Error(payload?.error || 'Failed to load dealer tracking settings.');
        }
        if (!controller.signal.aborted) setDealerTrackingAccess(payload.trackingAccess);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setDealerTrackingAccess([]);
        setDealerTrackingError(cause instanceof Error ? cause.message : 'Failed to load dealer tracking settings.');
      } finally {
        if (!controller.signal.aborted) setDealerTrackingLoading(false);
      }
    }

    void loadDealerTrackingAccess();
    return () => controller.abort();
  }, [assetId, section, view]);

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

  async function decideRenewalUpdate(decision: 'accept' | 'reject') {
    const correction = draft?.dealerAssetCorrection;
    if (!draft || !correction || actionBusy) return;
    setActionBusy('renewal-decision');
    setNotice(null);
    try {
      const response = await fetch(`/api/asset-corrections/${encodeURIComponent(correction.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        message?: string;
        asset?: Asset | null;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Failed to save your decision.');
      setDraft((current) => current ? {
        ...current,
        ...(payload.asset ?? {}),
        dealerAssetCorrection: null,
      } : current);
      setNotice({
        tone: 'success',
        message: payload.message || (decision === 'accept' ? 'Renewal date accepted and saved.' : 'Renewal date declined.'),
      });
    } catch (cause) {
      setNotice({ tone: 'error', message: cause instanceof Error ? cause.message : 'Failed to save your decision.' });
    } finally {
      setActionBusy('');
    }
  }

  async function updateEstimateNow() {
    if (!draft || actionBusy) return;
    setActionBusy('update-estimate');
    setNotice(null);
    try {
      const response = await fetch('/api/asset-register/revalue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: draft.id, selectedMethod: 'aim4price' }),
      });
      const data = await response.json().catch(() => null) as RevalueResponse | null;
      if (response.status === 401) { window.location.replace('/owner-app/login'); return; }
      if (!response.ok || !data?.ok || !data.item) {
        throw new Error(data?.error || 'The Aim4price estimate could not be updated.');
      }
      setDraft(data.item);
      setNotice({ tone: 'success', message: `Estimate updated to ${money(data.item.value)}.` });
    } catch (cause) {
      setNotice({ tone: 'error', message: cause instanceof Error ? cause.message : 'The Aim4price estimate could not be updated.' });
    } finally {
      setActionBusy('');
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
            usageApplicable: true,
            usage_applicable: true,
          },
        };
      }

      if (metric === 'not_applicable') {
        return {
          ...current,
          hours: null,
          lifeWorkedPercent: null,
          specsJson: {
            ...current.specsJson,
            usageMetric: 'not_applicable',
            usage_metric: 'not_applicable',
            usageUnit: 'not_applicable',
            usage_unit: 'not_applicable',
            usageMode: 'not_applicable',
            usage_mode: 'not_applicable',
            usageBasis: 'not_applicable',
            usage_basis: 'not_applicable',
            selectedUsageMode: 'not_applicable',
            selected_usage_mode: 'not_applicable',
            usageApplicable: false,
            usage_applicable: false,
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
          usageApplicable: true,
          usage_applicable: true,
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

  function advanceDisposalWizard() {
    if (disposalWizardStep === 1 && !disposalDraft.reason) {
      setNotice({ tone: 'error', message: 'Choose what happened to the asset.' });
      return;
    }
    if (disposalWizardStep === 2 && disposalDraft.reason !== 'mistake_duplicate' && !disposalDraft.disposalDate) {
      setNotice({ tone: 'error', message: 'Choose the date this happened.' });
      return;
    }
    if (disposalWizardStep === 3 && disposalImpactRequired(disposalDraft.reason) && !disposalDraft.aim4priceOutcomeInfluence) {
      setNotice({ tone: 'error', message: 'Tell us whether Aim4price helped with this outcome.' });
      return;
    }
    setNotice(null);
    setDisposalWizardStep((current) => Math.min(4, current + 1) as DisposalWizardStep);
  }

  async function deleteAsset() {
    if (!draft || !disposalDraft.reason) {
      setNotice({ tone: 'error', message: 'Choose what happened to the asset before continuing.' });
      return;
    }
    if (disposalImpactRequired(disposalDraft.reason) && !disposalDraft.aim4priceOutcomeInfluence) {
      setNotice({ tone: 'error', message: 'Tell us whether Aim4price helped with this outcome.' });
      return;
    }
    if (disposalDraft.reason === 'sold' && !disposalDraft.transferAction) {
      setNotice({ tone: 'error', message: 'Choose whether to archive the asset or send it to another Aim4price account.' });
      return;
    }
    setActionBusy('delete');
    setNotice(null);
    try {
      const response = await fetch(`/api/owner-app/assets/${encodeURIComponent(assetId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(disposalDraft),
      });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        mode?: 'disposed' | 'deleted' | 'transfer_pending';
        transfer?: TransferReceipt;
        redirectTo?: string;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Failed to delete this asset.');
      if (payload.mode === 'transfer_pending' && payload.transfer) {
        setTransferReceipt(payload.transfer);
        setActionBusy('');
        return;
      }
      window.location.assign(payload.redirectTo || '/owner-app/assets');
    } catch (cause) {
      setNotice({ tone: 'error', message: cause instanceof Error ? cause.message : 'Failed to delete this asset.' });
      setActionBusy('');
    }
  }

  async function copyTransferDetails() {
    if (!transferReceipt) return;
    const message = [
      `Aim4price asset transfer: ${transferReceipt.assetTitle}`,
      `${transferReceipt.assetIdentifierLabel}: ${transferReceipt.assetIdentifier}`,
      `Transfer code: ${transferReceipt.transferCode}`,
      'Open Account → Asset transfers in Aim4price and choose Claim an asset.',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(message);
      setNotice({ tone: 'success', message: 'Transfer details copied.' });
    } catch {
      setNotice({ tone: 'error', message: 'Copy failed. Select the identifier and code manually.' });
    }
  }

  if (loading) return (
    <>
      {view === 'options' ? <OwnerAppNav backHref={`/owner-app/assets/${encodeURIComponent(assetId)}`} backLabel="Asset" /> : null}
      <div className={`${styles.wideContent} ${styles.loading}`}>Loading asset…</div>
    </>
  );
  if (!draft) return (
    <>
      {view === 'options' ? <OwnerAppNav backHref={`/owner-app/assets/${encodeURIComponent(assetId)}`} backLabel="Asset" /> : null}
      <div className={styles.wideContent}><div className={styles.errorNotice}>{notice?.message || 'Asset not found.'}</div></div>
    </>
  );

  const extra = (key: string, ...fallbackKeys: string[]) => specValue(draft.specsJson, key, ...fallbackKeys);
  const resolvedUsage = resolveAssetUsage({
    kind: draft.kind,
    hours: draft.hours,
    lifeWorkedPercent: draft.lifeWorkedPercent,
    specsJson: draft.specsJson,
  });
  const usageMetric = resolvedUsage.metric;
  const usageText = formatResolvedAssetUsage(resolvedUsage, 'Not saved');
  const estimateNeedsUpdate = estimateNeedsAutomaticUpdate(draft);
  const renderEstimateUpdateAction = () => estimateNeedsUpdate ? (
    <button
      type="button"
      className={`${styles.detailValueUpdateButton} ${styles.detailValueUpdateButtonAttention}`}
      onClick={() => void updateEstimateNow()}
      disabled={Boolean(actionBusy)}
    >
      {actionBusy === 'update-estimate' ? 'Updating…' : 'Update estimate'}
    </button>
  ) : null;
  const extraInput = (key: string, label: string, options: { type?: string; inputMode?: 'text' | 'decimal' | 'numeric'; fallbackKeys?: string[]; currency?: boolean } = {}) => {
    const value = extra(key, ...(options.fallbackKeys ?? []));
    const input = options.currency
      ? <GroupedCurrencyInput value={value} onValueChange={(nextValue) => updateSpec(key, nextValue)} />
      : <input type={options.type} inputMode={options.inputMode} value={value} onChange={(event) => updateSpec(key, event.target.value)} />;
    return <label className={styles.field}><span>{label}</span>{options.currency ? <span className={styles.currencyInput}><span aria-hidden="true">R</span>{input}</span> : input}</label>;
  };
  const editorHeader = (title: string, description: string) => (
    <p className={styles.editorIntro} aria-label={title}>{description}</p>
  );
  const renewalUpdate = draft.dealerAssetCorrection?.licenseRenewalDateChanged
    ? draft.dealerAssetCorrection
    : null;
  const renewalUpdateBanner = renewalUpdate ? (
    <section className={`${styles.section} ${styles.ownerRenewalApproval}`} role="status">
      <div>
        <strong>Licence renewal awaiting approval</strong>
        <p>
          {renewalUpdate.dealerName || 'Your licence expert'} changed the renewal date from{' '}
          {dateOnly(renewalUpdate.currentLicenseRenewalDate)} to {dateOnly(renewalUpdate.proposedLicenseRenewalDate)}.
        </p>
      </div>
      <div className={styles.notificationCorrectionActions}>
        <button type="button" className={styles.notificationCorrectionDecline} onClick={() => void decideRenewalUpdate('reject')} disabled={Boolean(actionBusy) || !permissions.includes('manage_assets')}>
          {actionBusy === 'renewal-decision' ? 'Saving…' : 'Decline'}
        </button>
        <button type="button" className={styles.notificationCorrectionAccept} onClick={() => void decideRenewalUpdate('accept')} disabled={Boolean(actionBusy) || !permissions.includes('manage_assets')}>
          {actionBusy === 'renewal-decision' ? 'Saving…' : 'Accept update'}
        </button>
      </div>
    </section>
  ) : null;

  if (view === 'summary') {
    return (
      <div className={styles.wideContent}>
        {notice ? <div className={notice.tone === 'success' ? styles.successNotice : styles.errorNotice}>{notice.message}</div> : null}
        {renewalUpdateBanner}
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
              {renderEstimateUpdateAction()}
            </div>

            <div className={styles.assetMirrorActions} aria-label="Asset actions">
              <Link
                className={`${styles.assetMirrorAction} ${styles.assetMirrorOptionsAction}`}
                href={`/owner-app/assets/${encodeURIComponent(assetId)}/options`}
                prefetch={false}
              >
                Share
              </Link>
              <Link
                className={`${styles.assetMirrorAction} ${styles.assetMirrorViewAction}`}
                href={`/owner-app/assets/${encodeURIComponent(assetId)}/details`}
                prefetch={false}
              >
                View details
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
        {renewalUpdateBanner}

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
              {renderEstimateUpdateAction()}
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
                  <Link href={`/owner-app/assets/${encodeURIComponent(assetId)}/maintenance`} prefetch={false}><span>Maintenance</span><strong>{upcomingMaintenance ? hasRecurringMaintenance(upcomingMaintenance) ? 'Recurring schedule active' : 'Maintenance scheduled' : 'Nothing upcoming'}</strong><small>{upcomingMaintenance ? `Next: ${maintenanceDueLabel(upcomingMaintenance)} ›` : 'Schedule ›'}</small></Link>
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
    return (
      <OwnerAssetOptionsClient
        assetId={assetId}
        asset={{
          title: draft.title,
          serialNumber: draft.serialNumber,
          yearModel: draft.yearModel,
          usage: usageText,
          condition: conditionLabel(draft.condition),
          replacementPriceExVat: draft.replacementPriceExVat,
          valueExVat: draft.value,
          photoUrls: draft.photos,
          publicUrl: null,
        }}
        reportAsset={draft}
        valuationReportHtml={buildAssetSheetReportHtml(buildOwnerValuationReportPayload(draft, ownerContext))}
        assetKind={draft.kind}
        assetIsLicensed={licenseStatus === 'yes'}
        licenceRenewalDate={extra('licenseRenewalDate', 'license_renewal_date', 'licenceRenewalDate', 'licence_renewal_date')}
      />
    );
  }

  if (view === 'manage') {
    const manageMeta = [draft.serialNumber ? `Serial: ${draft.serialNumber}` : '', draft.yearModel ? `Year: ${draft.yearModel}` : '', usageText !== 'Not saved' ? `Usage: ${usageText}` : ''].filter(Boolean).join(' · ');
    const availableManageSections = MANAGE_SECTIONS.filter((item) => (
      (item.id !== 'marketplace' || draft.kind !== 'property')
      && (item.id !== 'dealer-tracking' || dealerTrackingAccess.length > 0)
      && (permissions.includes('manage_assets')
        || (permissions.includes('operate') && ['activity', 'reports', 'location', 'media', 'maintenance'].includes(item.id))
        || (!permissions.includes('operate') && ['activity', 'reports'].includes(item.id)))
    ));
    return (
      <div className={styles.wideContent}>
        {notice ? <div className={notice.tone === 'success' ? styles.successNotice : styles.errorNotice}>{notice.message}</div> : null}
        {renewalUpdateBanner}
        <section className={styles.manageAssetIdentity}>
          <div className={styles.manageAssetIdentityCopy}>
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
                        href={item.id === 'maintenance'
                          ? `/owner-app/assets/${encodeURIComponent(assetId)}/maintenance`
                          : `/owner-app/assets/${encodeURIComponent(assetId)}/manage/${item.id}`}
                        prefetch={false}
                        className={`${styles.manageButton} ${item.tone === 'danger' ? styles.manageButtonDanger : ''}`}
                      >
                        <span className={styles.manageButtonCopy}>
                          <strong>{item.id === 'maintenance' && upcomingMaintenance
                            ? hasRecurringMaintenance(upcomingMaintenance) ? 'Recurring schedule active' : 'Maintenance scheduled'
                            : item.title}</strong>
                          {item.id === 'maintenance' && upcomingMaintenance
                            ? <small>Next: {upcomingMaintenance.title} · {maintenanceDueLabel(upcomingMaintenance)}</small>
                            : null}
                        </span>
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
        <h1><BalancedHeadingText text={section === 'pricing' && pricingMode === 'recalculate'
          ? 'Recalculate Value'
          : section === 'pricing' && pricingMode === 'future'
            ? 'Future Price'
            : section === 'pricing' && pricingMode === 'saleability'
              ? 'Saleability'
            : MANAGE_SECTIONS.find((item) => item.id === section)?.title || 'Manage asset'} /></h1>
        <strong><BalancedHeadingText text={draft.title} /></strong>
        <p>{draft.serialNumber ? `Serial: ${draft.serialNumber}` : registerName}</p>
      </section>

      {notice ? <div className={notice.tone === 'success' ? styles.successNotice : styles.errorNotice}>{notice.message}</div> : null}

      {section === 'details' ? <section className={`${styles.section} ${styles.editorSection}`}>
        {editorHeader('Update asset', 'Edit the asset details, usage and values.')}
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.fieldFull}`}><span>Asset name</span><input value={draft.title} onChange={(event) => update('title', event.target.value)} /></label>
          <label className={styles.field}><span>Register</span><select value={draft.registerId ?? ''} onChange={(event) => update('registerId', event.target.value)}>{registers.map((register) => <option key={register.id} value={register.id}>{register.businessName}</option>)}</select></label>
          <label className={styles.field}><span>Asset type</span><select value={draft.kind} onChange={(event) => update('kind', event.target.value)}><option value="tractor">Tractor</option><option value="equipment">Equipment</option><option value="vehicle">Vehicle</option><option value="property">Property / Land / Building</option><option value="tools">Tools</option><option value="stock">Stock</option><option value="manual">Furniture, appliances &amp; electronics</option></select></label>
          <label className={styles.field}><span>Make</span><input value={draft.brandName} onChange={(event) => update('brandName', event.target.value)} /></label>
          <label className={styles.field}><span>Model</span><input value={draft.modelName} onChange={(event) => update('modelName', event.target.value)} /></label>
          <label className={styles.field}><span>Year model / year built</span><input inputMode="numeric" value={draft.yearModel ?? ''} onChange={(event) => update('yearModel', event.target.value ? Number(event.target.value) : null)} /></label>
          <label className={styles.field}><span>Serial / VIN / chassis</span><input value={draft.serialNumber} onChange={(event) => update('serialNumber', event.target.value)} /></label>
          <label className={styles.field}><span>Condition</span><select value={draft.condition} onChange={(event) => update('condition', event.target.value)}><option value="">Not saved</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="used">Used</option><option value="serious">Serious</option></select></label>
          <label className={styles.field}><span>Usage type</span><select value={usageMetric} onChange={(event) => updateUsageMetric(event.target.value as AssetUsageMetric)}><option value="hours">Hours</option><option value="km">Kilometres</option><option value="percentage">% worked</option><option value="not_applicable">Not applicable</option></select></label>
          {usageMetric === 'percentage' ? <label className={styles.field}><span>Percentage worked</span><input inputMode="decimal" value={draft.lifeWorkedPercent ?? ''} onChange={(event) => update('lifeWorkedPercent', event.target.value ? Number(event.target.value) : null)} /></label> : usageMetric === 'not_applicable' ? <label className={styles.field}><span>Current usage</span><input value="Not applicable" disabled readOnly /></label> : <label className={styles.field}><span>Current usage</span><input inputMode="decimal" value={draft.hours ?? ''} onChange={(event) => update('hours', event.target.value ? Number(event.target.value) : null)} /></label>}
          <label className={styles.field}><span>Current Aim4price value excl. VAT</span><span className={styles.currencyInput}><span aria-hidden="true">R</span><GroupedCurrencyInput value={draft.value || ''} onValueChange={(value) => update('value', parseCurrencyInput(value) ?? 0)} /></span></label>
          <label className={styles.field}><span>Replacement price excl. VAT</span><span className={styles.currencyInput}><span aria-hidden="true">R</span><GroupedCurrencyInput value={draft.replacementPriceExVat ?? ''} onValueChange={(value) => update('replacementPriceExVat', parseCurrencyInput(value))} /></span></label>
          <label className={`${styles.field} ${styles.fieldFull}`}><span>Notes</span><textarea value={draft.note} onChange={(event) => update('note', event.target.value)} /></label>
        </div>
        <div className={styles.actions}><button type="button" className={styles.primaryButton} onClick={() => void saveAsset()} disabled={saving || Boolean(actionBusy)}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </section> : null}

      {section === 'reports' ? (
        <OwnerAssetReportPicker
          asset={draft}
          valuationReportHtml={buildAssetSheetReportHtml(buildOwnerValuationReportPayload(draft, ownerContext))}
        />
      ) : null}

      {section === 'activity' ? <ActivitySection assetId={assetId} /> : null}

      {section === 'pricing' ? <PricingSection assetId={assetId} mode={pricingMode} draft={draft} reload={() => loadDetail(true)} setNotice={setNotice} /> : null}

      {section === 'finance' ? <section className={`${styles.section} ${styles.editorSection}`}>
        {editorHeader('Finance', 'Manage finance status and information.')}
        <div className={styles.formGrid}>
          <label className={styles.field}><span>Finance status</span><select value={financeStatus} onChange={(event) => updateStatus('finance', event.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {financeStatus === 'yes' ? <>
            <label className={styles.field}><span>Finance type</span><select value={extra('financeType', 'finance_type')} onChange={(event) => updateSpec('financeType', event.target.value)}><option value="">Not saved</option><option value="asset_specific">Asset-specific finance</option><option value="bulk_group">Bulk / group finance</option></select></label>
            {extraInput('financierName', 'Financier', { fallbackKeys: ['financier_name'] })}{extraInput('financeCurrentOutstandingExVat', 'Current outstanding excl. VAT', { inputMode: 'decimal', fallbackKeys: ['finance_current_outstanding_ex_vat'], currency: true })}{extraInput('financeBoughtWhen', 'Bought when', { type: 'date', fallbackKeys: ['finance_bought_when'] })}{extraInput('financeBoughtForExVat', 'Bought for excl. VAT', { inputMode: 'decimal', fallbackKeys: ['finance_bought_for_ex_vat'], currency: true })}{extraInput('financeOriginalAmountExVat', 'Original financed amount', { inputMode: 'decimal', fallbackKeys: ['finance_original_amount_ex_vat'], currency: true })}{extraInput('financeMonthlyPaymentExVat', 'Monthly payment', { inputMode: 'decimal', fallbackKeys: ['finance_monthly_payment_ex_vat'], currency: true })}{extraInput('financeInterestRatePercent', 'Interest rate %', { inputMode: 'decimal', fallbackKeys: ['finance_interest_rate_percent'] })}{extraInput('financeTermMonths', 'Term months', { inputMode: 'numeric', fallbackKeys: ['finance_term_months'] })}{extraInput('financeBalloonPaymentExVat', 'Balloon payment', { inputMode: 'decimal', fallbackKeys: ['finance_balloon_payment_ex_vat'], currency: true })}{extraInput('financeSettlementDate', 'Settlement date', { type: 'date', fallbackKeys: ['finance_settlement_date'] })}{extraInput('financeReferenceNumber', 'Finance reference', { fallbackKeys: ['finance_reference_number'] })}
            <label className={`${styles.field} ${styles.fieldFull}`}><span>Finance notes</span><textarea value={draft.financeNote} onChange={(event) => update('financeNote', event.target.value)} /></label>
          </> : null}
        </div>
        <div className={styles.actions}><button type="button" className={styles.primaryButton} onClick={() => void saveAsset()} disabled={saving || Boolean(actionBusy)}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </section> : null}

      {section === 'insurance' ? <section className={`${styles.section} ${styles.editorSection}`}>
        {editorHeader('Insurance', 'Manage insurance status and cover.')}
        <div className={styles.formGrid}>
          <label className={styles.field}><span>Insurance status</span><select value={insuranceStatus} onChange={(event) => updateStatus('insurance', event.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {insuranceStatus === 'yes' ? <><label className={styles.field}><span>Insured value excl. VAT</span><span className={styles.currencyInput}><span aria-hidden="true">R</span><GroupedCurrencyInput value={draft.insuredValueExVat ?? ''} onValueChange={(value) => update('insuredValueExVat', parseCurrencyInput(value))} /></span></label>{extraInput('insuranceInsurerName', 'Insurer / broker', { fallbackKeys: ['insurance_insurer_name'] })}{extraInput('insurancePolicyNumber', 'Policy number', { fallbackKeys: ['insurance_policy_number'] })}{extraInput('insuranceRenewalDate', 'Renewal date', { type: 'date', fallbackKeys: ['insurance_renewal_date'] })}<label className={`${styles.field} ${styles.fieldFull}`}><span>Insurance notes</span><textarea value={extra('insuranceNote', 'insurance_note')} onChange={(event) => updateSpec('insuranceNote', event.target.value)} /></label></> : null}
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
        <div className={styles.manageMediaUploadActions}><label className={styles.detailUploadButton}><span>{actionBusy === 'upload-photo' ? 'Uploading photos…' : 'Add photos'}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => void uploadFiles('photo', event.target.files)} disabled={Boolean(actionBusy)} /></label><label className={`${styles.detailUploadButton} ${styles.detailDocumentUploadButton}`}><span>{actionBusy === 'upload-document' ? 'Uploading documents…' : 'Add documents'}</span><input type="file" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => void uploadFiles('document', event.target.files)} disabled={Boolean(actionBusy)} /></label></div>
        <div className={styles.actions}><button type="button" className={styles.primaryButton} onClick={() => void saveAsset()} disabled={saving || Boolean(actionBusy)}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </section> : null}

      {section === 'marketplace' ? <MarketplaceSection draft={draft} ownerContext={ownerContext} action={action} busy={Boolean(actionBusy)} /> : null}
      {section === 'maintenance' ? <MaintenanceSection assetId={assetId} records={maintenance} action={action} busy={Boolean(actionBusy)} /> : null}
      {section === 'dealer-tracking' ? <section className={`${styles.section} ${styles.editorSection}`}>
        {editorHeader('Dealer tracking', 'Control what each dealer can see or update for this asset.')}
        {dealerTrackingLoading ? <p className={styles.ownerOptionsEmpty}>Loading dealer tracking settings…</p> : dealerTrackingError ? (
          <div className={styles.errorNotice}>{dealerTrackingError}</div>
        ) : (
          <DealerMaintenanceAccessSettings
            assetId={assetId}
            entries={dealerTrackingAccess}
            mutationUrl="/api/dealer-maintenance-access"
            onEntriesChange={setDealerTrackingAccess}
          />
        )}
      </section> : null}
      {section === 'delete' ? <section className={`${styles.section} ${styles.deleteSection}`}>
        {editorHeader('Sell or remove asset', 'Complete one clear step at a time. Genuine disposals remain in reports and history; only a record added by mistake leaves the active register without a disposal.')}
        <ol className={styles.disposalProgress} aria-label={`Step ${disposalWizardStep} of 4`}>{DISPOSAL_WIZARD_STEPS.map((label, index) => <li key={label} className={index + 1 === disposalWizardStep ? styles.disposalProgressCurrent : index + 1 < disposalWizardStep ? styles.disposalProgressComplete : ''}><span>{index + 1}</span><small>{label}</small></li>)}</ol>

        {disposalWizardStep === 1 ? <div className={styles.disposalStep}>
          <div className={styles.disposalStepHeader}><strong>What happened to this asset?</strong><span>Choose the closest outcome.</span></div>
          <div className={styles.choiceRow} role="group" aria-label="What happened to this asset?">{DISPOSAL_REASONS.map((reason) => <button key={reason.value} type="button" className={disposalDraft.reason === reason.value ? styles.choiceActive : ''} aria-pressed={disposalDraft.reason === reason.value} onClick={() => setDisposalDraft((current) => ({ ...current, reason: reason.value, aim4priceOutcomeInfluence: disposalImpactRequired(reason.value) ? current.aim4priceOutcomeInfluence : '', transferAction: reason.value === 'sold' ? current.transferAction : '' }))} disabled={Boolean(actionBusy)}>{reason.label}</button>)}</div>
        </div> : null}

        {disposalWizardStep === 2 ? <div className={styles.disposalStep}>
          <div className={styles.disposalStepHeader}><strong>Add the {disposalReasonLabel(disposalDraft.reason).toLowerCase()} details</strong><span>Save what happened and when. The amount and reference are optional.</span></div>
          {disposalDraft.reason === 'mistake_duplicate' ? <div className={styles.disposalInformation}><strong>No disposal details are needed</strong><p>The final step will confirm the duplicate removal and retained audit.</p></div> : <div className={styles.formGrid}>
            <label className={styles.field}><span>Effective date</span><input type="date" value={disposalDraft.disposalDate} onChange={(event) => setDisposalDraft((current) => ({ ...current, disposalDate: event.target.value }))} disabled={Boolean(actionBusy)} /></label>
            <label className={styles.field}><span>{disposalAmountLabel(disposalDraft.reason)} excl. VAT (optional)</span><span className={styles.currencyInput}><span aria-hidden="true">R</span><GroupedCurrencyInput value={disposalDraft.disposalAmountExVat} onValueChange={(value) => setDisposalDraft((current) => ({ ...current, disposalAmountExVat: value }))} /></span></label>
            <label className={`${styles.field} ${styles.fieldFull}`}><span>Reference or note (optional)</span><textarea value={disposalDraft.note} onChange={(event) => setDisposalDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Buyer, dealer, insurer or other useful reference" disabled={Boolean(actionBusy)} /></label>
          </div>}
        </div> : null}

        {disposalWizardStep === 3 ? <div className={styles.disposalStep}>
          {disposalImpactRequired(disposalDraft.reason) ? <section className={styles.saleQuestion} aria-labelledby="aim4price-outcome-impact-title">
            <div className={styles.saleQuestionHeader}><strong id="aim4price-outcome-impact-title">Did Aim4price help with this outcome in any way?</strong><span>Pricing, reports, history, Marketplace or another feature may have helped you decide, negotiate or complete the outcome.</span></div>
            <div className={styles.choiceRow} role="group" aria-label="Did Aim4price help with this outcome in any way?">{([{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Not sure' }] as const).map((choice) => <button key={choice.value} type="button" className={disposalDraft.aim4priceOutcomeInfluence === choice.value ? styles.choiceActive : ''} aria-pressed={disposalDraft.aim4priceOutcomeInfluence === choice.value} onClick={() => setDisposalDraft((current) => ({ ...current, aim4priceOutcomeInfluence: choice.value }))} disabled={Boolean(actionBusy)}>{choice.label}</button>)}</div>
          </section> : <div className={styles.disposalInformation}><strong>No Aim4price impact answer is needed</strong><p>This question is only required for sold, traded-in and scrapped assets.</p></div>}
        </div> : null}

        {disposalWizardStep === 4 ? <div className={styles.disposalStep}>
          <div className={styles.disposalStepHeader}><strong>What should happen to the asset information?</strong><span>Review the outcome before saving. Private account information is never sent with an asset.</span></div>
          <dl className={styles.disposalSummary}><div><dt>Outcome</dt><dd>{disposalReasonLabel(disposalDraft.reason)}</dd></div>{disposalDraft.reason !== 'mistake_duplicate' ? <><div><dt>Date</dt><dd>{disposalDraft.disposalDate}</dd></div><div><dt>Amount</dt><dd>{disposalDraft.disposalAmountExVat ? `R ${disposalDraft.disposalAmountExVat}` : 'Not recorded'}</dd></div></> : null}{disposalImpactRequired(disposalDraft.reason) ? <div><dt>Aim4price helped</dt><dd>{disposalDraft.aim4priceOutcomeInfluence === 'yes' ? 'Yes' : disposalDraft.aim4priceOutcomeInfluence === 'no' ? 'No' : 'Not sure'}</dd></div> : null}</dl>
          {disposalDraft.reason === 'sold' ? <section className={styles.saleQuestion} aria-labelledby="asset-transfer-choice-title">
            <div className={styles.saleQuestionHeader}><strong id="asset-transfer-choice-title">Where should the portable asset record go?</strong><span>Archive it here, or create a secure one-time claim code for the buyer.</span></div>
            <div className={styles.transferChoiceGrid} role="group" aria-label="Choose what happens to the sold asset record"><button type="button" className={disposalDraft.transferAction === 'archive' ? styles.transferChoiceActive : ''} aria-pressed={disposalDraft.transferAction === 'archive'} onClick={() => setDisposalDraft((current) => ({ ...current, transferAction: 'archive' }))} disabled={Boolean(actionBusy)}><strong>Archive after sale</strong><span>The buyer does not use Aim4price, or no transfer is needed.</span></button><button type="button" className={disposalDraft.transferAction === 'claim_code' ? styles.transferChoiceActive : ''} aria-pressed={disposalDraft.transferAction === 'claim_code'} onClick={() => setDisposalDraft((current) => ({ ...current, transferAction: 'claim_code' }))} disabled={Boolean(actionBusy)}><strong>Send to buyer</strong><span>Create a one-time code so the buyer can claim the asset.</span></button></div>
            {disposalDraft.transferAction === 'claim_code' ? <div className={styles.transferExplainer}><strong>What moves with the asset</strong><p>Asset details, valuation and maintenance history, scan history, photos and saved asset documents move to the buyer. Your private invoices, finance, insurance and dealer access stay on your account.</p>{!draft.serialNumber ? <p><strong>Tip:</strong> this asset has no saved serial number, so its Aim4price Asset ID will be used with the code.</p> : null}</div> : null}
          </section> : disposalDraft.reason === 'traded_in' ? <div className={styles.disposalInformation}><strong>Archive after trade-in</strong><p>The portable history remains available. Temporary dealer custody should use controlled dealer access instead of changing ownership.</p></div> : disposalDraft.reason === 'mistake_duplicate' ? <div className={styles.disposalInformationDanger}><strong>Remove duplicate from the active register</strong><p>Aim4price retains the final snapshot and deletion audit.</p></div> : <div className={styles.disposalInformation}><strong>Archive and retain history</strong><p>The asset leaves active totals while its lifecycle and reporting history remain available.</p></div>}
        </div> : null}

        <div className={styles.actions}>{disposalWizardStep > 1 ? <button type="button" className={styles.secondaryButton} onClick={() => setDisposalWizardStep((current) => Math.max(1, current - 1) as DisposalWizardStep)} disabled={Boolean(actionBusy)}>Back</button> : null}{disposalWizardStep < 4 ? <button type="button" className={styles.primaryButton} onClick={advanceDisposalWizard} disabled={Boolean(actionBusy) || (disposalWizardStep === 1 && !disposalDraft.reason) || (disposalWizardStep === 3 && disposalImpactRequired(disposalDraft.reason) && !disposalDraft.aim4priceOutcomeInfluence)}>Next</button> : <button type="button" className={styles.dangerButton} onClick={() => void deleteAsset()} disabled={Boolean(actionBusy) || (disposalDraft.reason === 'sold' && !disposalDraft.transferAction)}>{actionBusy === 'delete' ? 'Saving…' : disposalDraft.reason === 'mistake_duplicate' ? 'Delete duplicate' : disposalDraft.reason === 'sold' && disposalDraft.transferAction === 'claim_code' ? 'Save sale & create code' : disposalDraft.reason === 'sold' ? 'Save sale' : 'Save disposal'}</button>}</div>
      </section> : null}

      {transferReceipt ? <div className={styles.reportFilterDialog} role="dialog" aria-modal="true" aria-labelledby="asset-transfer-ready-title">
        <button type="button" className={styles.reportFilterBackdrop} onClick={() => window.location.assign('/owner-app/assets')} aria-label="Close transfer details" />
        <section className={`${styles.reportFilterModal} ${styles.transferReceiptModal}`}>
          <header className={styles.reportFilterModalHeader}>
            <div><h2 id="asset-transfer-ready-title">Asset ready to send</h2><p>Share both details below with the buyer. The code works once and expires in 30 days.</p></div>
            <button type="button" onClick={() => window.location.assign('/owner-app/assets')} aria-label="Close transfer details">×</button>
          </header>
          <div className={styles.transferReceiptDetails}>
            <div><span>{transferReceipt.assetIdentifierLabel}</span><strong>{transferReceipt.assetIdentifier}</strong></div>
            <div><span>Transfer code</span><strong className={styles.transferReceiptCode}>{transferReceipt.transferCode}</strong></div>
          </div>
          <div className={styles.transferExplainer}>
            <strong>Buyer instructions</strong>
            <p>Sign in to Aim4price, open Account → Asset transfers, and enter the identifier with this code.</p>
          </div>
          <div className={styles.transferReceiptActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => void copyTransferDetails()}>Copy details</button>
            <Link className={styles.primaryButton} href="/account/asset-transfers">Manage transfers</Link>
          </div>
        </section>
      </div> : null}
    </div>
  );
}

function ActivitySection({ assetId }: { assetId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void fetch(`/api/owner-app/assets/${encodeURIComponent(assetId)}/activity`, {
      credentials: 'include', cache: 'no-store', signal: controller.signal,
    }).then(async (response) => {
      const payload = await response.json().catch(() => null) as { ok?: boolean; items?: ActivityItem[]; error?: string } | null;
      if (!response.ok || !payload?.ok || !Array.isArray(payload.items)) {
        throw new Error(payload?.error || 'Asset activity could not be loaded.');
      }
      setItems(payload.items);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Asset activity could not be loaded.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [assetId]);

  return (
    <section className={styles.section}>
      <p className={styles.editorIntro}>A simple history of work, fuel and important asset changes.</p>
      {loading ? <p className={styles.maintenanceEmpty}>Loading activity…</p> : null}
      {error ? <div className={styles.errorNotice}>{error}</div> : null}
      {!loading && !error ? <div className={styles.recordList}>
        {items.length ? items.map((item) => <article className={styles.record} key={item.id}>
          <div className={styles.recordHeader}><h3>{item.title}</h3><span className={styles.recordStatus}>{dateTime(item.occurredAtIso)}</span></div>
          {item.detail ? <p>{item.detail}</p> : null}
          {item.actorName ? <p>By {item.actorName}</p> : null}
        </article>) : <p className={styles.maintenanceEmpty}>No activity recorded yet.</p>}
      </div> : null}
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

function PricingSection({ assetId, mode, draft, reload, setNotice }: {
  assetId: string;
  mode: OwnerAssetPricingMode;
  draft: Asset;
  reload: () => Promise<void>;
  setNotice: Dispatch<SetStateAction<{ tone: 'success' | 'error'; message: string } | null>>;
}) {
  const usage = resolveAssetUsage({ kind: draft.kind, hours: draft.hours, lifeWorkedPercent: draft.lifeWorkedPercent, specsJson: draft.specsJson });
  const canRecalculate = draft.valuationRunId !== null && draft.selectedMethod !== 'manual';
  const usesPercentUsage = usage.metric === 'percentage';
  const lifetimeUnit = usage.metric === 'km' ? 'km' : 'hours';
  const [replacementMode, setReplacementMode] = useState<'saved' | 'custom'>('saved');
  const [replacementPrice, setReplacementPrice] = useState(String(draft.replacementPriceExVat ?? ''));
  const [saveReplacementPrice, setSaveReplacementPrice] = useState(false);
  const [expectedLifetime, setExpectedLifetime] = useState(formatWholeNumberInput(readExpectedLifetime(draft) ?? ''));
  const [preview, setPreview] = useState<RevalueResponse | null>(null);
  const [pricingBusy, setPricingBusy] = useState('');
  const [pricingError, setPricingError] = useState('');
  const [targetYear, setTargetYear] = useState(String(new Date().getFullYear() + 1));
  const [inflationRatePct, setInflationRatePct] = useState('8');
  const [extraUsage, setExtraUsage] = useState('0');
  const [targetPercent, setTargetPercent] = useState(String(draft.lifeWorkedPercent ?? ''));
  const [projection, setProjection] = useState<ProjectionResponse['projection'] | null>(null);
  const [saleabilityOpen, setSaleabilityOpen] = useState(mode === 'saleability');

  if (mode === 'landing') {
    const pricingBase = `/owner-app/assets/${encodeURIComponent(assetId)}/manage/pricing`;
    return (
      <section className={`${styles.addChoiceGrid} ${styles.pricingChoiceGrid}`} aria-label="Pricing options">
        <Link className={`${styles.addChoiceCard} ${styles.addChoiceCardValue}`} href={`${pricingBase}/recalculate`} prefetch={false}>
          <strong>Recalculate Value</strong>
        </Link>
        <Link className={`${styles.addChoiceCard} ${styles.addChoiceCardManual}`} href={`${pricingBase}/future`} prefetch={false}>
          <strong>Future Price</strong>
        </Link>
        <Link className={`${styles.addChoiceCard} ${styles.addChoiceCardValue}`} href={`${pricingBase}/saleability`} prefetch={false}>
          <strong>Saleability</strong>
        </Link>
      </section>
    );
  }

  async function requestRevalue(previewOnly: boolean) {
    if (!canRecalculate || pricingBusy) return;
    const customPrice = Number(replacementPrice.replace(/[^0-9.]/g, ''));
    const lifetime = usesPercentUsage ? null : parseWholeNumberInput(expectedLifetime);
    if (replacementMode === 'saved' && (!draft.replacementPriceExVat || draft.replacementPriceExVat <= 0)) {
      setPricingError('This asset does not have a saved replacement price. Enter an updated price to continue.');
      return;
    }
    if (replacementMode === 'custom' && (!Number.isFinite(customPrice) || customPrice <= 0)) {
      setPricingError('Enter a valid replacement price excluding VAT.');
      return;
    }
    if (!usesPercentUsage && lifetime === null) {
      setPricingError(`Enter an expected lifetime in ${lifetimeUnit}.`);
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
          ...(replacementMode === 'custom' ? { replacementPriceExVat: customPrice, saveReplacementPrice: !previewOnly && saveReplacementPrice } : {}),
          ...(!usesPercentUsage && lifetime !== null ? { advancedAssumptions: { maxLifetimeUsage: lifetime } } : {}),
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

  if (mode === 'recalculate') return (
    <section className={`${styles.section} ${styles.editorSection}`}>
      <p className={styles.editorIntro}>Refresh the saved Aim4price estimate using the latest asset information.</p>
      <div className={styles.pricingSummaryGrid}>
        <div><span>Aim4price value</span><strong>{money(draft.value)}</strong><small>Excl. VAT</small></div>
        <div><span>Replacement price</span><strong>{money(draft.replacementPriceExVat)}</strong><small>Excl. VAT</small></div>
      </div>
      <div className={styles.pricingPanel}>
        <div className={styles.pricingPanelHeader}><strong>Recalculate value</strong><small>Refresh the saved Aim4price estimate using current asset information.</small></div>
        {canRecalculate ? <>
          <div className={styles.choiceRow}>
            <button type="button" disabled={!draft.replacementPriceExVat} className={replacementMode === 'saved' ? styles.choiceActive : ''} onClick={() => { setReplacementMode('saved'); setSaveReplacementPrice(false); setPreview(null); setPricingError(''); }}>Use saved replacement price</button>
            <button type="button" className={replacementMode === 'custom' ? styles.choiceActive : ''} onClick={() => { setReplacementMode('custom'); setPreview(null); setPricingError(''); }}>Enter updated price</button>
          </div>
          {replacementMode === 'custom' ? <div className={styles.revalueInputCard}>
            <label className={styles.field}><span>Replacement price excl. VAT</span><span className={styles.currencyInput}><span aria-hidden="true">R</span><GroupedCurrencyInput value={replacementPrice} onValueChange={(value) => { setReplacementPrice(value); setPreview(null); setPricingError(''); }} /></span></label>
            <label className={styles.revalueSaveToggle}><input type="checkbox" checked={saveReplacementPrice} onChange={(event) => setSaveReplacementPrice(event.target.checked)} /><span>Save this as the replacement price on this asset</span></label>
            <p>Leave unticked to use this price for this calculation only.</p>
          </div> : null}
          {!usesPercentUsage ? <label className={styles.field}><span>Expected lifetime ({lifetimeUnit})</span><input inputMode="numeric" value={expectedLifetime} placeholder={usage.metric === 'km' ? 'Example: 350 000' : 'Example: 12 000'} onChange={(event) => { setExpectedLifetime(formatWholeNumberInput(event.target.value)); setPreview(null); setPricingError(''); }} /></label> : null}
          {preview?.item ? <div className={styles.pricingResult}>
            <span>New Aim4price value</span>
            <strong>{money(preview.newValueExVat ?? preview.item.value)}</strong>
            <div className={styles.pricingCompareGrid}>
              <div><small>Current value</small><b>{money(preview.oldValueExVat ?? draft.value)}</b></div>
              <div><small>Difference</small><b>{moneyDifference((preview.newValueExVat ?? preview.item.value) - (preview.oldValueExVat ?? draft.value))}</b></div>
            </div>
            <div className={styles.pricingResultDetails}>
              <div><small>Replacement price used</small><b>{money(preview.replacementPriceUsedExVat ?? (replacementMode === 'custom' ? Number(replacementPrice.replace(/[^0-9.]/g, '')) : draft.replacementPriceExVat))}</b></div>
              {!usesPercentUsage ? <div><small>Expected lifetime used</small><b>{expectedLifetime} {lifetimeUnit}</b></div> : null}
              {replacementMode === 'custom' ? <div><small>Replacement price action</small><b>{saveReplacementPrice ? 'New price will also be saved' : 'Used for this calculation only'}</b></div> : null}
            </div>
          </div> : null}
          <div className={styles.revalueActions}>
            <button type="button" className={styles.secondaryButton} disabled={Boolean(pricingBusy)} onClick={() => void requestRevalue(true)}>{pricingBusy === 'preview' ? 'Calculating…' : 'Preview new value'}</button>
            {preview?.item ? <button type="button" className={styles.primaryButton} disabled={Boolean(pricingBusy)} onClick={() => void requestRevalue(false)}>{pricingBusy === 'save' ? 'Saving…' : 'Save new value'}</button> : null}
          </div>
        </> : <p className={styles.infoNotice}>Automatic recalculation is available for assets saved from an Aim4price valuation.</p>}
      </div>
      {pricingError ? <div className={styles.errorNotice}>{pricingError}</div> : null}
    </section>
  );

  if (mode === 'saleability') return (
    <section className={`${styles.section} ${styles.editorSection}`}>
      <p className={styles.editorIntro}>See how easily this asset may sell, then build a separate selling-price plan.</p>
      <div className={styles.pricingSummaryGrid}>
        <div><span>Aim4price value</span><strong>{money(draft.value)}</strong><small>Excl. VAT · remains unchanged</small></div>
        <div><span>Current usage</span><strong>{formatResolvedAssetUsage(usage, 'Not saved')}</strong><small>Used for remaining useful life</small></div>
      </div>
      <div className={styles.pricingPanel}>
        <div className={styles.pricingPanelHeader}>
          <strong>Refine Saleability</strong>
          <small>Answer seven plain questions about buyers, demand and your selling goal. Your Aim4price value is never changed.</small>
        </div>
        <button type="button" className={styles.primaryButton} onClick={() => setSaleabilityOpen(true)}>Open Saleability</button>
      </div>
      <SaleabilityModal
        open={saleabilityOpen}
        onClose={() => setSaleabilityOpen(false)}
        assetTitle={draft.title}
        valuationExVat={draft.value}
        input={buildAssetSaleabilityInput(draft)}
        storageKey={`aim4price-saleability:asset:${draft.id}`}
      />
    </section>
  );

  return (
    <section className={`${styles.section} ${styles.editorSection}`}>
      <p className={styles.editorIntro}>Estimate what this asset could be worth in a future year.</p>
      <div className={styles.pricingSummaryGrid}>
        <div><span>Current value</span><strong>{money(draft.value)}</strong><small>Excl. VAT</small></div>
        <div><span>Current usage</span><strong>{formatResolvedAssetUsage(usage, 'Not saved')}</strong><small>Saved reading</small></div>
      </div>
      <div className={styles.pricingPanel}>
        <div className={styles.pricingPanelHeader}><strong>Calculate future price</strong><small>Estimate a future value using inflation and expected usage.</small></div>
        <div className={styles.formGrid}>
          <label className={styles.field}><span>Target year</span><input inputMode="numeric" value={targetYear} onChange={(event) => setTargetYear(event.target.value)} /></label>
          <label className={styles.field}><span>Inflation % per year</span><input inputMode="decimal" value={inflationRatePct} onChange={(event) => setInflationRatePct(event.target.value)} /></label>
          {usage.metric === 'percentage' ? <label className={`${styles.field} ${styles.fieldFull}`}><span>Expected worked percentage</span><input inputMode="decimal" value={targetPercent} onChange={(event) => setTargetPercent(event.target.value)} /></label> : <label className={`${styles.field} ${styles.fieldFull}`}><span>Extra {usage.metric === 'km' ? 'kilometres' : 'hours'}</span><input inputMode="decimal" value={extraUsage} onChange={(event) => setExtraUsage(event.target.value)} /></label>}
        </div>
        <button type="button" className={styles.primaryButton} disabled={Boolean(pricingBusy)} onClick={() => void calculateProjection()}>{pricingBusy === 'projection' ? 'Calculating…' : 'Calculate future price'}</button>
        {projection ? <div className={styles.pricingResult}><span>Estimated {projection.targetYear} value</span><strong>{money(projection.projected.retailExVat)}</strong><small>{projection.inflationRatePct}% annual inflation · excl. VAT</small></div> : null}
      </div>
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
      <p className={styles.editorIntro}>Save this asset’s position from the device, GPS coordinates or the map.</p>
      <div className={styles.locationCurrentCard}>
        <span>Saved location</span>
        <strong>{hasCoordinates ? `${location.latitude}, ${location.longitude}` : 'No GPS coordinates saved'}</strong>
        <small>Last scanned: {dateTime(draft.lastScannedAtIso)}</small>
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
      <p className={styles.editorIntro}>Status: {draft.marketplaceStatus === 'live' ? 'Live' : 'Not listed'} · Asset and seller information is filled in automatically.</p>
      <section className={styles.marketplaceTitlePanel}>
        <span>Listing title</span>
        <strong>{listingTitle}</strong>
        <small>Year model, usage and condition are included automatically.</small>
      </section>

      <section className={styles.marketplacePricePanel}>
        <label className={styles.field}><span>Asking price excl. VAT</span><span className={styles.currencyInput}><span aria-hidden="true">R</span><GroupedCurrencyInput value={form.askingPriceExVat} onValueChange={(value) => setForm((current) => ({ ...current, askingPriceExVat: value }))} /></span></label>
      </section>

      <section className={styles.marketplacePhotosPanel}>
        <div className={styles.marketplacePanelHeading}>
          <div><span>Photos</span><small>{draft.photos.length ? `${draft.photos.length} saved photo${draft.photos.length === 1 ? '' : 's'} will be shown on the listing.` : 'No photos are saved for this asset yet.'}</small></div>
          <Link href={`/owner-app/assets/${encodeURIComponent(draft.id)}/manage/media`} prefetch={false}>Manage photos</Link>
        </div>
        {draft.photos.length ? <>
          <img className={styles.marketplaceMainPhoto} src={draft.photos[0]} alt={`${listingTitle} main marketplace photo`} />
          {draft.photos.length > 1 ? <div className={styles.marketplacePhotoStrip} aria-label="Marketplace listing photos">
            {draft.photos.slice(0, 6).map((photoUrl, index) => <img key={`${photoUrl}-${index}`} src={photoUrl} alt={`${draft.title} marketplace photo ${index + 1}`} />)}
            {draft.photos.length > 6 ? <span>+{draft.photos.length - 6}</span> : null}
          </div> : null}
        </> : <div className={styles.marketplaceNoPhotos}><strong>No photos uploaded</strong><span>Add photos before publishing to show buyers the real asset.</span></div>}
      </section>

      <label className={`${styles.field} ${styles.marketplaceDescriptionField}`}><span>Listing description</span><textarea value={form.marketplaceNotes} onChange={(event) => setForm((current) => ({ ...current, marketplaceNotes: event.target.value }))} placeholder="Add important buyer notes, extras, service history, condition or known issues." /></label>

      <section className={styles.marketplaceSellerPanel}>
        <div className={styles.marketplacePanelHeading}><div><span>Seller details</span><small>These details will be shown with the listing.</small></div></div>
        <div className={styles.formGrid}>
          {Object.entries({ sellerName: 'Contact name', sellerCompany: 'Business name', sellerPhone: 'Phone', sellerEmail: 'Business email', province: 'Province', area: 'Area' }).map(([key, label]) => <label className={styles.field} key={key}><span>{label}</span><input value={form[key as keyof typeof form]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
        </div>
      </section>
      {formError ? <div className={styles.errorNotice}>{formError}</div> : null}
      <div className={styles.actions}><button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void publishMarketplaceListing()}>{draft.marketplaceStatus === 'live' ? 'Update listing' : 'List on Marketplace'}</button>{draft.marketplaceStatus === 'live' ? <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => void action({ action: 'marketplace-remove' }, 'Marketplace listing removed.')}>Remove listing</button> : null}</div>
    </section>
  );
}

function MaintenanceSection({ assetId, records, action, busy }: { assetId: string; records: Maintenance[]; action: (body: Record<string, unknown>, message: string) => Promise<void>; busy: boolean }) {
  const upcomingMaintenance = records.find((record) => record.status === 'upcoming') ?? null;
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    await action({ action: 'maintenance-create', maintenanceType: 'service', triggerType: 'date', status: 'upcoming', alertBeforeValue: 7, alertBeforeUnit: 'days', ...data }, 'Maintenance item created.');
    form.reset();
  }
  return (
    <section className={styles.section}>
      <p className={styles.editorIntro}>{upcomingMaintenance
        ? hasRecurringMaintenance(upcomingMaintenance)
          ? 'A recurring schedule is already in place. Complete the physical work below to move to the next schedule.'
          : 'Maintenance is already scheduled. Complete the physical work below before adding another schedule.'
        : 'Schedule and manage maintenance.'}</p>
      {upcomingMaintenance ? (
        <div className={styles.recordList}>
          <article className={styles.record}>
            <div className={styles.recordHeader}>
              <h3>{hasRecurringMaintenance(upcomingMaintenance) ? 'Recurring schedule already in place' : 'Maintenance already scheduled'}</h3>
              <span className={styles.recordStatus}>{upcomingMaintenance.computedStatusLabel}</span>
            </div>
            <p>Next: {upcomingMaintenance.title} · {maintenanceDueLabel(upcomingMaintenance)}</p>
          </article>
        </div>
      ) : (
        <form className={styles.formGrid} onSubmit={(event) => void create(event)}>
          <label className={styles.field}><span>Type</span><select name="maintenanceType"><option value="service">Service</option><option value="checkup">Checkup</option></select></label>
          <label className={styles.field}><span>Due date</span><input name="dueDate" type="date" required /></label>
          <label className={`${styles.field} ${styles.fieldFull}`}><span>Title</span><input name="title" required placeholder="Next service" /></label>
          <label className={`${styles.field} ${styles.fieldFull}`}><span>Notes</span><textarea name="notes" /></label>
          <button className={`${styles.maintenanceAddButton} ${styles.fieldFull}`} type="submit" disabled={busy}>Add maintenance</button>
        </form>
      )}
      <div className={styles.maintenanceRecordsBlock}>
        <h2>Maintenance records</h2>
        <div className={styles.recordList}>{records.length ? records.map((record) => <article className={styles.record} key={record.id}><div className={styles.recordHeader}><h3>{record.title}</h3><span className={styles.recordStatus}>{record.computedStatusLabel}</span></div><p>{[record.maintenanceType, record.dueDate || (record.dueUsage !== null ? `${record.dueUsage} ${record.usageMetric || ''}` : ''), record.notes].filter(Boolean).join(' · ')}</p><div className={styles.actions}>{record.status === 'upcoming' ? <><Link className={styles.smallButton} href={`/owner-app/operations/maintenance/${encodeURIComponent(assetId)}?maintenanceId=${encodeURIComponent(record.id)}&maintenanceType=${record.maintenanceType}&returnTo=${encodeURIComponent(`/owner-app/assets/${assetId}/maintenance`)}`} prefetch={false}>Record work</Link><button type="button" className={styles.smallButton} disabled={busy} onClick={() => void action({ action: 'maintenance-cancel', maintenanceId: record.id }, 'Maintenance cancelled.')}>Cancel</button></> : record.status === 'done' ? <button type="button" className={styles.smallButton} disabled={busy} onClick={() => void action({ action: 'maintenance-reopen', maintenanceId: record.id }, 'Maintenance reopened.')}>Reopen</button> : null}</div></article>) : <p className={styles.maintenanceEmpty}>No maintenance records yet.</p>}</div>
      </div>
    </section>
  );
}
