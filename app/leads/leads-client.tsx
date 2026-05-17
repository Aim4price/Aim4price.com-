'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import { openAssetRegisterSummaryPrint, openAssetSheetPrint, type ReportMethodCard } from '../../lib/report-print';
import assetStyles from '../asset-register/page.module.css';
import styles from './page.module.css';

type LeadType = 'finance' | 'insurance' | 'replacement_quote';
type LeadStatus = 'sent' | 'viewed' | 'accepted' | 'quoted' | 'declined' | 'closed';
type NoticeTone = 'success' | 'error';
type LeadStatusFilter = 'all' | 'new' | 'open';
type AssetStatusChoice = 'yes' | 'no' | 'unknown' | 'not_applicable';

type IconProps = {
  className?: string;
};

type AssetLead = {
  id: string;
  ownerUserId: string;
  partnerUserId: string;
  assetRegisterItemId: string;
  leadType: LeadType;
  status: LeadStatus;
  assetSnapshot: Record<string, unknown>;
  includedSections: Record<string, unknown>;
  ownerMessage: string;
  ownerContactName: string;
  ownerContactPhone: string;
  ownerContactEmail: string;
  ownerName: string;
  ownerBusinessName: string;
  ownerPhone: string;
  ownerProvince: string;
  ownerTownCity: string;
  partnerName: string;
  partnerBusinessName: string;
  partnerPhone: string;
  partnerProvince: string;
  partnerTownCity: string;
  createdAtIso: string;
  viewedAtIso: string | null;
  acceptedAtIso: string | null;
  quotedAtIso: string | null;
  declinedAtIso: string | null;
  closedAtIso: string | null;
  updatedAtIso: string;
};

type LeadsResponse = {
  ok: boolean;
  leads?: AssetLead[];
  lead?: AssetLead;
  error?: string;
};

type PartnerNoteResponse = {
  ok: boolean;
  note?: {
    id: string;
    noteText: string;
    createdAtIso: string;
  };
  error?: string;
};

type SessionResponse = {
  ok: boolean;
  signedIn: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
};

const MONTH_OPTIONS = [
  { value: 'all', label: 'All months' },
  { value: '0', label: 'January' },
  { value: '1', label: 'February' },
  { value: '2', label: 'March' },
  { value: '3', label: 'April' },
  { value: '4', label: 'May' },
  { value: '5', label: 'June' },
  { value: '6', label: 'July' },
  { value: '7', label: 'August' },
  { value: '8', label: 'September' },
  { value: '9', label: 'October' },
  { value: '10', label: 'November' },
  { value: '11', label: 'December' },
];

function NoteIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4.4L19.7 8.7a2.2 2.2 0 0 0 0-3.1l-1.3-1.3a2.2 2.2 0 0 0-3.1 0L4 15.6V20Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m13.8 5.8 4.4 4.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ManageIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05a2.2 2.2 0 0 1-3.11 3.11l-.05-.05a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.09 1.65V21.5a2.2 2.2 0 0 1-4.4 0v-.12a1.8 1.8 0 0 0-1.09-1.65 1.8 1.8 0 0 0-1.98.36l-.05.05a2.2 2.2 0 1 1-3.11-3.11l.05-.05A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.65-1.09H2.83a2.2 2.2 0 0 1 0-4.4h.12A1.8 1.8 0 0 0 4.6 8.42a1.8 1.8 0 0 0-.36-1.98l-.05-.05a2.2 2.2 0 1 1 3.11-3.11l.05.05a1.8 1.8 0 0 0 1.98.36A1.8 1.8 0 0 0 10.42 2h.12a2.2 2.2 0 0 1 4.4 0v.12a1.8 1.8 0 0 0 1.09 1.65 1.8 1.8 0 0 0 1.98-.36l.05-.05a2.2 2.2 0 1 1 3.11 3.11l-.05.05a1.8 1.8 0 0 0-.36 1.98c.28.66.93 1.09 1.65 1.09h.12a2.2 2.2 0 0 1 0 4.4h-.12A1.8 1.8 0 0 0 19.4 15Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 20h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function EmailIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6.5h16v11H4v-11Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m5 8 7 5 7-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.2 5.2 6.7 6.7c-.8.8-.9 2.1-.3 3.3 1.4 2.7 4.9 6.2 7.6 7.6 1.2.6 2.5.5 3.3-.3l1.5-1.5-3.3-3.3-1.4 1.4c-1.7-.9-3.1-2.3-4-4l1.4-1.4-3.3-3.3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.25a8.55 8.55 0 0 0-7.26 13.05l-1.06 3.9 4.04-1.02A8.55 8.55 0 1 0 12 3.25Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.55 7.65c.22-.48.45-.5.68-.5h.6c.2 0 .43.05.57.38l.78 1.82c.1.27.08.5-.08.72l-.42.53c-.1.12-.13.28-.05.43.48.9 1.35 1.78 2.34 2.34.15.08.3.05.43-.05l.53-.42c.22-.17.45-.2.72-.08l1.82.78c.33.13.38.37.38.57v.6c0 .23-.02.47-.5.68-.5.22-1.14.34-1.9.24-2.28-.32-5.83-3.86-6.15-6.15-.1-.76.02-1.4.25-1.9Z" fill="currentColor" />
    </svg>
  );
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18" strokeLinecap="round" />
      <path d="M8 6V4h8v2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m6 6 1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 10v6M14 10v6" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function FilterIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}

function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatCurrency(value: unknown): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value) || 0));
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

function formatLeadType(value: LeadType): string {
  if (value === 'finance') return 'Finance lead';
  if (value === 'insurance') return 'Insurance lead';
  return 'Dealer lead';
}

function formatStatus(value: LeadStatus): string {
  if (value === 'sent' || value === 'viewed') return 'New';
  if (value === 'accepted') return 'Open';
  if (value === 'quoted') return 'Quoted';
  if (value === 'declined') return 'Deleted';
  return 'Closed';
}

function isNewLeadStatus(value: LeadStatus): boolean {
  return value === 'sent' || value === 'viewed';
}
function leadDateParts(lead: AssetLead): { month: string; year: string } | null {
  const parsed = new Date(lead.createdAtIso);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    month: String(parsed.getMonth()),
    year: String(parsed.getFullYear()),
  };
}


function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asBoolean(value: unknown): boolean {
  return value === true || String(value ?? '').trim().toLowerCase() === 'true';
}

function registerLeadSnapshot(lead: AssetLead): Record<string, unknown> | null {
  return asRecord(lead.includedSections.registerSnapshot) ?? asRecord(lead.assetSnapshot.registerSnapshot);
}

function isFullRegisterLead(lead: AssetLead): boolean {
  return (
    asBoolean(lead.includedSections.registerLead) ||
    asText(lead.includedSections.source) === 'full_asset_register' ||
    asText(lead.assetSnapshot.snapshotType) === 'full_asset_register' ||
    Boolean(registerLeadSnapshot(lead))
  );
}

function registerLeadAssets(lead: AssetLead): Record<string, unknown>[] {
  const snapshot = registerLeadSnapshot(lead);
  const assets = snapshot?.assets;

  if (!Array.isArray(assets)) {
    return [];
  }

  return assets.map((asset) => asRecord(asset)).filter((asset): asset is Record<string, unknown> => Boolean(asset));
}

function registerLeadCount(lead: AssetLead): number {
  const snapshot = registerLeadSnapshot(lead);
  const directCount = asNumber(snapshot?.assetCount ?? snapshot?.totalAssets);

  if (directCount !== null) return Math.round(directCount);
  return registerLeadAssets(lead).length;
}

function registerLeadLabel(lead: AssetLead): string {
  const snapshot = registerLeadSnapshot(lead);
  const label = asText(snapshot?.leadLabel);

  if (label) return label;
  if (lead.leadType === 'finance') return 'Full refinance quote';
  if (lead.leadType === 'insurance') return 'Full insurance quote';
  return 'Full register lead';
}

function formatLeadDisplayType(lead: AssetLead): string {
  if (isFullRegisterLead(lead)) {
    if (lead.leadType === 'finance') return 'Full refinance lead';
    if (lead.leadType === 'insurance') return 'Full insurance lead';
    return 'Full register lead';
  }

  return formatLeadType(lead.leadType);
}

function snapshotUsageValue(snapshot: Record<string, unknown>): string {
  const specs = asRecord(snapshot.specsJson) ?? asRecord(snapshot.specs) ?? {};
  const hours = asNumber(snapshot.hours);
  const percent = firstNumberFromRecord(snapshot, ['lifeWorkedPercent', 'percentWorked', 'usagePercent']) ?? firstNumberFromRecord(specs, ['lifeWorkedPercent', 'percentWorked', 'usagePercent']);
  const usageMetric = firstTextFromRecord(snapshot, ['usageMetric', 'usage_metric']) || firstTextFromRecord(specs, ['usageMetric', 'usage_metric']);
  const unit = usageMetric.toLowerCase() === 'km' || usageMetric.toLowerCase() === 'kilometres' || usageMetric.toLowerCase() === 'kilometers' ? 'km' : 'hours';

  if (hours !== null && hours > 0) {
    return `${Math.round(hours).toLocaleString('en-ZA')} ${unit}`;
  }

  if (percent !== null) {
    return formatUsagePercent(Math.min(100, Math.max(0, percent)));
  }

  return '—';
}

function snapshotTitle(snapshot: Record<string, unknown>): string {
  return asText(snapshot.title) || [asText(snapshot.brandName), asText(snapshot.modelName) || asText(snapshot.typedModelName)].filter(Boolean).join(' ') || 'Asset';
}

function normalizeAssetStatusChoice(value: unknown, fallback: AssetStatusChoice = 'unknown'): AssetStatusChoice {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (['yes', 'y', 'true', 'financed', 'insured', 'licensed', 'licenced', 'is_financed', 'is_insured', 'is_licensed'].includes(normalized)) {
    return 'yes';
  }

  if (['no', 'n', 'false', 'not_financed', 'not_insured', 'not_licensed', 'not_licenced', 'unfinanced', 'uninsured', 'unlicensed', 'unlicenced'].includes(normalized)) {
    return 'no';
  }

  if (['na', 'n_a', 'not_applicable', 'not_aplicable', 'not_relevant', 'does_not_apply'].includes(normalized)) {
    return 'not_applicable';
  }

  if (['unknown', 'not_sure', 'unsure', 'maybe', ''].includes(normalized)) {
    return normalized ? 'unknown' : fallback;
  }

  return fallback;
}

function firstTextFromRecord(record: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!record) return '';

  for (const key of keys) {
    const value = asText(record[key]);
    if (value) return value;
  }

  return '';
}

function firstNumberFromRecord(record: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!record) return null;

  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value !== null) return value;
  }

  return null;
}

function formatUsagePercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const formatted = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${formatted}% worked`;
}

function conditionLabel(value: unknown): string {
  const normalized = asText(value).toLowerCase();
  return (
    {
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      used: 'Used',
      serious: 'Requires attention',
    }[normalized] ?? asText(value) ?? '—'
  );
}

function assetTitle(lead: AssetLead): string {
  if (isFullRegisterLead(lead)) {
    return asText(registerLeadSnapshot(lead)?.title) || 'Full Asset Register';
  }

  return asText(lead.assetSnapshot.title) || 'Shared asset';
}

function assetDescription(lead: AssetLead): string {
  if (isFullRegisterLead(lead)) {
    return `${registerLeadCount(lead)} ${registerLeadCount(lead) === 1 ? 'asset' : 'assets'} · ${registerLeadLabel(lead)}`;
  }

  return [
    lead.assetSnapshot.yearModel ? String(lead.assetSnapshot.yearModel) : '',
    asText(lead.assetSnapshot.brandName),
    asText(lead.assetSnapshot.modelName) || asText(lead.assetSnapshot.typedModelName),
  ]
    .filter(Boolean)
    .join(' ') || asText(lead.assetSnapshot.equipmentFamilyLabel) || asText(lead.assetSnapshot.kind) || 'Asset';
}

function assetValue(lead: AssetLead): number {
  if (isFullRegisterLead(lead)) {
    const snapshot = registerLeadSnapshot(lead);
    return asNumber(snapshot?.totalValue ?? snapshot?.registerValue ?? snapshot?.value) ?? 0;
  }

  return asNumber(lead.assetSnapshot.value ?? lead.assetSnapshot.selectedValueExVat ?? lead.assetSnapshot.aim4priceValueExVat ?? lead.assetSnapshot.marketMidExVat) ?? 0;
}

function assetPhotos(lead: AssetLead): string[] {
  if (isFullRegisterLead(lead)) {
    return [];
  }

  return Array.isArray(lead.assetSnapshot.photos)
    ? lead.assetSnapshot.photos.map((photo) => String(photo ?? '').trim()).filter(Boolean)
    : [];
}

function assetSpecs(lead: AssetLead): Record<string, unknown> | null {
  return asRecord(lead.assetSnapshot.specsJson) ?? asRecord(lead.assetSnapshot.specs) ?? asRecord(lead.assetSnapshot.specAnswers);
}

function getLeadLifeWorkedPercent(lead: AssetLead): number | null {
  const snapshot = lead.assetSnapshot;
  const specs = assetSpecs(lead);
  const directValue = firstNumberFromRecord(snapshot, [
    'lifeWorkedPercent',
    'life_worked_percent',
    'percentWorked',
    'percent_worked',
    'workedPercent',
    'worked_percent',
    'usagePercent',
    'usage_percent',
    'lifetimeWorkedPercent',
    'lifetime_worked_percent',
  ]);

  if (directValue !== null) return Math.min(100, Math.max(0, directValue));

  const specsValue = firstNumberFromRecord(specs, [
    'lifeWorkedPercent',
    'life_worked_percent',
    'percentWorked',
    'percent_worked',
    'workedPercent',
    'worked_percent',
    'usagePercent',
    'usage_percent',
    'lifetimeWorkedPercent',
    'lifetime_worked_percent',
    'lifetime_used_percent',
    'worked_percent_estimate',
  ]);

  return specsValue === null ? null : Math.min(100, Math.max(0, specsValue));
}

function assetUsageValue(lead: AssetLead): string {
  const snapshot = lead.assetSnapshot;
  const specs = assetSpecs(lead);
  const hours = asNumber(snapshot.hours);
  const hasHours = hours !== null && hours > 0;
  const percent = getLeadLifeWorkedPercent(lead);
  const depreciationMethod = asText(snapshot.depreciationMethodUsed ?? snapshot.depreciationMethod).toLowerCase();
  const usageMetric = firstTextFromRecord(snapshot, ['usageMetric', 'usage_metric', 'usageMetricType', 'usage_metric_type']) || firstTextFromRecord(specs, ['usageMetric', 'usage_metric', 'usageMetricType', 'usage_metric_type']);
  const unit = usageMetric.toLowerCase() === 'km' || usageMetric.toLowerCase() === 'kilometres' || usageMetric.toLowerCase() === 'kilometers' ? 'km' : 'hours';
  const prefersPercent = depreciationMethod === 'semi_depreciation' || depreciationMethod === 'percentage_depreciation' || (!hasHours && percent !== null);

  if (percent !== null && prefersPercent) {
    return formatUsagePercent(percent);
  }

  if (hasHours) {
    return `${Math.round(hours).toLocaleString('en-ZA')} ${unit}`;
  }

  if (percent !== null) {
    return formatUsagePercent(percent);
  }

  return '—';
}

function leadAssetMeta(lead: AssetLead): string {
  if (isFullRegisterLead(lead)) {
    return `${registerLeadCount(lead)} ${registerLeadCount(lead) === 1 ? 'asset' : 'assets'} • Register value: ${formatCurrency(assetValue(lead))} excl. VAT`;
  }

  const usageValue = assetUsageValue(lead);
  const condition = asText(lead.assetSnapshot.condition);
  const kind = asText(lead.assetSnapshot.kind).toLowerCase();
  const yearLabel = kind === 'property' ? 'Year Built' : 'Year Model';
  const parts = [
    lead.assetSnapshot.yearModel ? `${yearLabel}: ${lead.assetSnapshot.yearModel}` : '',
    usageValue !== '—' ? `Usage: ${usageValue}` : '',
    condition ? `Condition: ${conditionLabel(condition)}` : '',
  ].filter(Boolean);

  return parts.join(' • ') || assetDescription(lead);
}

function methodLabel(value: unknown): string {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'aim4price') return 'Aim4price';
  if (normalized === 'market') return 'Market';
  if (normalized === 'manual') return 'Manual';
  if (normalized === 'department') return 'Department';
  return 'Saved';
}

function ownerDisplayName(lead: AssetLead): string {
  return lead.ownerContactName || lead.ownerBusinessName || lead.ownerName || 'Aim4price owner';
}

function ownerPhone(lead: AssetLead): string {
  return lead.ownerContactPhone || lead.ownerPhone || '';
}

function ownerEmail(lead: AssetLead): string {
  return lead.ownerContactEmail || '';
}

function ownerLocation(lead: AssetLead): string {
  return [lead.ownerTownCity, lead.ownerProvince].filter(Boolean).join(', ') || '—';
}

function cleanPhoneForTel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const prefix = trimmed.startsWith('+') ? '+' : '';
  return `${prefix}${trimmed.replace(/\D/g, '')}`;
}

function cleanPhoneForWhatsApp(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('27')) return digits;
  if (digits.startsWith('0') && digits.length >= 10) return `27${digits.slice(1)}`;
  return digits;
}

function leadFollowUpSubject(lead: AssetLead): string {
  return isFullRegisterLead(lead) ? 'your full Aim4price asset register' : assetTitle(lead);
}

function buildClientRows(lead: AssetLead): Array<{ label: string; value: string }> {
  return [
    { label: 'Owner full name', value: lead.ownerName || ownerDisplayName(lead) },
    { label: 'Business name', value: lead.ownerBusinessName || '—' },
    { label: 'Contact person', value: lead.ownerContactName || ownerDisplayName(lead) },
    { label: 'Contact number', value: ownerPhone(lead) || '—' },
    { label: 'Email', value: ownerEmail(lead) || '—' },
    { label: 'Location', value: ownerLocation(lead) },
  ];
}

function buildMethodCards(lead: AssetLead): ReportMethodCard[] {
  const selected = asText(lead.assetSnapshot.selectedMethod) || 'aim4price';
  const cards: ReportMethodCard[] = [];
  const aim4priceValue = asNumber(lead.assetSnapshot.aim4priceValueExVat);
  const marketValue = asNumber(lead.assetSnapshot.marketMidExVat);
  const selectedValue = assetValue(lead);

  if (aim4priceValue !== null) {
    cards.push({
      label: 'Aim4price value',
      value: formatCurrency(aim4priceValue),
      note: 'Calculated platform value excluding VAT.',
      selected: selected === 'aim4price',
    });
  }

  if (marketValue !== null) {
    cards.push({
      label: 'Market value',
      value: formatCurrency(marketValue),
      note: 'Market comparison midpoint excluding VAT.',
      selected: selected === 'market',
    });
  }

  if (!cards.length) {
    cards.push({
      label: 'Saved value',
      value: formatCurrency(selectedValue),
      note: 'Saved asset register value excluding VAT.',
      selected: true,
    });
  }

  return cards;
}

function downloadFullRegisterLead(lead: AssetLead): boolean {
  const snapshot = registerLeadSnapshot(lead);
  const registerAssets = registerLeadAssets(lead);
  const registerValue = assetValue(lead);
  const registerValueInclVat = asNumber(snapshot?.totalValueInclVat) ?? Math.round(registerValue * 1.15);
  const aim4priceCount = asNumber(snapshot?.aim4priceAssetCount) ?? registerAssets.filter((asset) => asText(asset.selectedMethod) === 'aim4price' || asNumber(asset.aim4priceValueExVat) !== null).length;
  const manualAssetCount = asNumber(snapshot?.manualAssetCount) ?? registerAssets.filter((asset) => asText(asset.selectedMethod) === 'manual').length;
  const financedCount = asNumber(snapshot?.financedAssetCount) ?? registerAssets.filter((asset) => asBoolean(asset.isFinanced)).length;
  const insuredCount = asNumber(snapshot?.insuredAssetCount) ?? registerAssets.filter((asset) => asBoolean(asset.isInsured)).length;
  const licensedCount = asNumber(snapshot?.licensedAssetCount) ?? registerAssets.filter((asset) => asBoolean(asset.isLicensed)).length;

  const rows = registerAssets.map((asset) => {
    const value = asNumber(asset.value ?? asset.selectedValueExVat) ?? 0;
    const family = asText(asset.equipmentFamilyLabel) || asText(asset.kind) || 'Asset';
    const brand = asText(asset.brandName);
    const model = asText(asset.modelName) || asText(asset.typedModelName);
    const year = asset.yearModel ? String(asset.yearModel) : '—';
    const usage = snapshotUsageValue(asset);
    const condition = asText(asset.condition) ? conditionLabel(asset.condition) : '—';
    const serial = asText(asset.serialNumber) || '—';
    const updated = formatDate(asText(asset.updatedAtIso) || asText(asset.createdAtIso));

    return {
      asset: snapshotTitle(asset),
      type: family,
      method: methodLabel(asset.selectedMethod),
      detail: [year !== '—' ? `Year: ${year}` : '', usage !== '—' ? `Usage: ${usage}` : '', condition !== '—' ? `Condition: ${condition}` : '', serial !== '—' ? `Serial: ${serial}` : ''].filter(Boolean).join(' • '),
      value: formatCurrency(value),
      status: updated !== '—' ? `Updated ${updated}` : 'Saved asset',
      brand: brand || '—',
      model: model || '—',
      year,
      usage,
      condition,
      serial,
      insured: asBoolean(asset.isInsured) ? 'Yes' : 'No',
      financed: asBoolean(asset.isFinanced) ? 'Yes' : 'No',
      licensed: asBoolean(asset.isLicensed) ? 'Yes' : 'No',
      licenseRegistrationNumber: asText(asset.licenseRegistrationNumber) || undefined,
      documents: 'Not shared',
      updated: updated !== '—' ? `Updated ${updated}` : '—',
      photoUrl: asText(asset.photoUrl) || null,
    };
  });

  return openAssetRegisterSummaryPrint({
    logoUrl: '/brand/aim4price-mark-black.png',
    generatedAt: formatDate(new Date().toISOString()),
    reportTitle: `${formatLeadDisplayType(lead)} Report`,
    reportSubtitle: 'Aim4price full asset register lead',
    valueLabel: 'Register Value',
    assetSectionTitle: 'Full Asset Register',
    emptyStateMessage: 'No asset rows were included in this full-register lead snapshot.',
    ownerName: lead.ownerBusinessName || ownerDisplayName(lead),
    ownerMeta: [ownerDisplayName(lead), ownerPhone(lead), ownerEmail(lead), ownerLocation(lead)].filter(Boolean).join(' • '),
    intro: 'Full asset register snapshot shared as an Aim4price lead.',
    registerValue: formatCurrency(registerValue),
    registerValueNote: `${formatCurrency(registerValueInclVat)} incl. VAT`,
    ownerRows: [
      { label: 'Business', value: lead.ownerBusinessName || '—' },
      { label: 'Contact', value: ownerDisplayName(lead) },
      { label: 'Phone', value: ownerPhone(lead) || '—' },
      { label: 'Email', value: ownerEmail(lead) || '—' },
      { label: 'Location', value: ownerLocation(lead) },
    ],
    stats: [
      { label: 'Total assets', value: String(registerLeadCount(lead)), note: 'Assets included in the register snapshot.' },
      { label: 'Register value', value: formatCurrency(registerValue), note: 'Saved register total excluding VAT.' },
      { label: 'Aim4price assets', value: String(aim4priceCount), note: 'Assets valued through Aim4price.' },
      { label: 'Manual assets', value: String(manualAssetCount), note: 'Assets entered manually.' },
      { label: 'Financed assets', value: String(financedCount), note: 'Marked as financed.' },
      { label: 'Insured assets', value: String(insuredCount), note: 'Marked as insured.' },
      { label: 'Licensed assets', value: String(licensedCount), note: 'Marked as licensed.' },
    ],
    rows,
    footerNote: "This PDF is generated from a once-off full-register lead snapshot. It does not provide live access to the owner's asset register.",
  });
}

function downloadLeadAsset(lead: AssetLead): boolean {
  if (isFullRegisterLead(lead)) {
    return downloadFullRegisterLead(lead);
  }

  const value = assetValue(lead);
  const photos = assetPhotos(lead);
  const didOpen = openAssetSheetPrint({
    logoUrl: '/brand/aim4price-mark-black.png',
    generatedAt: formatDate(new Date().toISOString()),
    assetBadge: asText(lead.assetSnapshot.equipmentFamilyLabel) || asText(lead.assetSnapshot.kind) || 'Asset',
    heroTitle: assetTitle(lead),
    heroMeta: leadAssetMeta(lead),
    valueLabel: 'Asset value',
    value: formatCurrency(value),
    valueNote: `${formatCurrency(Math.round(value * 1.15))} incl. VAT`,
    statusLabel: `${formatLeadDisplayType(lead)} · ${formatStatus(lead.status)}`,
    issuerName: ownerDisplayName(lead),
    issuerAddress: ownerLocation(lead),
    issuerPhone: ownerPhone(lead) || '—',
    issuerEmail: ownerEmail(lead) || '—',
    clientRows: buildClientRows(lead),
    summaryItems: [
      { label: 'Lead type', value: formatLeadDisplayType(lead) },
      { label: 'Lead status', value: formatStatus(lead.status) },
      { label: 'Created', value: formatDate(lead.createdAtIso) },
    ],
    photoUrl: photos[0] || null,
    photoUrls: photos,
    qrUrl: null,
    scanUrl: null,
    facts: [
      { label: 'Family', value: asText(lead.assetSnapshot.equipmentFamilyLabel) || asText(lead.assetSnapshot.kind) || '—' },
      { label: 'Brand', value: asText(lead.assetSnapshot.brandName) || '—' },
      { label: 'Model', value: asText(lead.assetSnapshot.modelName) || asText(lead.assetSnapshot.typedModelName) || '—' },
      { label: 'Year', value: lead.assetSnapshot.yearModel ? String(lead.assetSnapshot.yearModel) : '—' },
      { label: 'Usage', value: assetUsageValue(lead) },
      { label: 'Condition', value: asText(lead.assetSnapshot.condition) || '—' },
      { label: 'Serial number', value: asText(lead.assetSnapshot.serialNumber) || '—' },
      { label: 'Financed', value: asBoolean(lead.assetSnapshot.isFinanced) ? 'Yes' : 'No' },
      { label: 'Insured', value: asBoolean(lead.assetSnapshot.isInsured) ? 'Yes' : 'No' },
    ],
    notes: [
      { label: 'Owner message', value: lead.ownerMessage || '—' },
      { label: 'Partner handling', value: 'Contact the owner privately. Do not place quotes back on Aim4price.' },
    ],
    methodCards: buildMethodCards(lead),
    contactRows: [
      { label: 'Owner', value: ownerDisplayName(lead) },
      { label: 'Phone', value: ownerPhone(lead) || '—' },
      { label: 'Email', value: ownerEmail(lead) || '—' },
    ],
    footerNote: 'Lead asset valuation PDF. This lead is for private partner follow-up outside Aim4price.',
  });

  return Boolean(didOpen);
}

function searchTextForLead(lead: AssetLead): string {
  return [
    assetTitle(lead),
    assetDescription(lead),
    leadAssetMeta(lead),
    formatLeadDisplayType(lead),
    ownerDisplayName(lead),
    ownerPhone(lead),
    ownerEmail(lead),
    lead.ownerBusinessName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function LeadsClient() {
  const [sessionUserId, setSessionUserId] = useState('');
  const [leads, setLeads] = useState<AssetLead[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [leadPhotoIndexes, setLeadPhotoIndexes] = useState<Record<string, number>>({});
  const [managedLead, setManagedLead] = useState<AssetLead | null>(null);
  const [noteLead, setNoteLead] = useState<AssetLead | null>(null);
  const [deleteLeadTarget, setDeleteLeadTarget] = useState<AssetLead | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isDeletingLead, setIsDeletingLead] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);

  const receivedLeads = useMemo(
    () => leads.filter((lead) => lead.partnerUserId === sessionUserId),
    [leads, sessionUserId],
  );

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    receivedLeads.forEach((lead) => {
      const parts = leadDateParts(lead);
      if (parts?.year) years.add(parts.year);
    });

    return Array.from(years).sort((left, right) => Number(right) - Number(left));
  }, [receivedLeads]);

  const periodLeads = useMemo(() => {
    return receivedLeads.filter((lead) => {
      const parts = leadDateParts(lead);
      if (monthFilter !== 'all' && parts?.month !== monthFilter) return false;
      if (yearFilter !== 'all' && parts?.year !== yearFilter) return false;
      return true;
    });
  }, [monthFilter, receivedLeads, yearFilter]);

  const filteredLeads = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return periodLeads.filter((lead) => {
      if (statusFilter === 'new' && !isNewLeadStatus(lead.status)) return false;
      if (statusFilter === 'open' && isNewLeadStatus(lead.status)) return false;

      if (!query) return true;
      return searchTextForLead(lead).includes(query);
    });
  }, [periodLeads, searchTerm, statusFilter]);

  const newLeadCount = useMemo(() => periodLeads.filter((lead) => isNewLeadStatus(lead.status)).length, [periodLeads]);
  const hasActiveLeadFilter = monthFilter !== 'all' || yearFilter !== 'all' || statusFilter !== 'all';
  const activeLeadFilterLabel = useMemo(() => {
    const labels: string[] = [];
    const selectedMonth = MONTH_OPTIONS.find((option) => option.value === monthFilter);

    if (selectedMonth && selectedMonth.value !== 'all') labels.push(selectedMonth.label);
    if (yearFilter !== 'all') labels.push(yearFilter);
    if (statusFilter === 'new') labels.push('New leads');
    if (statusFilter === 'open') labels.push('Open leads');

    if (!labels.length) return 'Filter';
    if (labels.length === 1) return labels[0];
    return `${labels.length} filters`;
  }, [monthFilter, statusFilter, yearFilter]);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    try {
      const [sessionResponse, leadsResponse] = await Promise.all([
        fetch('/api/me', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/asset-leads', { cache: 'no-store', credentials: 'include' }),
      ]);

      const sessionData = (await sessionResponse.json()) as SessionResponse;
      const leadsData = (await leadsResponse.json()) as LeadsResponse;

      if (!sessionResponse.ok || !sessionData.signedIn || !sessionData.user) {
        throw new Error('You must be signed in.');
      }

      if (!leadsResponse.ok || !leadsData.ok || !leadsData.leads) {
        throw new Error(leadsData.error ?? 'Failed to load leads.');
      }

      setSessionUserId(sessionData.user.id);
      setLeads(leadsData.leads);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load leads.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function deleteLead(leadToDelete: AssetLead): Promise<boolean> {
    try {
      if (leadToDelete.status !== 'declined') {
        const declineResponse = await fetch(`/api/asset-leads/${encodeURIComponent(leadToDelete.id)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'declined' }),
        });
        const declineData = (await declineResponse.json()) as LeadsResponse;

        if (!declineResponse.ok || !declineData.ok) {
          throw new Error(declineData.error ?? 'Failed to prepare lead for deletion.');
        }
      }

      const response = await fetch(`/api/asset-leads/${encodeURIComponent(leadToDelete.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to delete lead.');
      }

      setLeads((current) => current.filter((lead) => lead.id !== leadToDelete.id));
      setManagedLead((current) => (current?.id === leadToDelete.id ? null : current));
      setOpenLeadId((current) => (current === leadToDelete.id ? null : current));
      setLeadPhotoIndexes((current) => {
        const next = { ...current };
        delete next[leadToDelete.id];
        return next;
      });
      setNotice({ tone: 'success', message: 'Lead deleted.' });
      return true;
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to delete lead.' });
      return false;
    }
  }

  async function confirmDeleteLead() {
    if (!deleteLeadTarget) return;

    setIsDeletingLead(true);
    const didDelete = await deleteLead(deleteLeadTarget);
    setIsDeletingLead(false);

    if (didDelete) {
      setDeleteLeadTarget(null);
    }
  }

  function closeDeleteLeadModal() {
    if (isDeletingLead) return;
    setDeleteLeadTarget(null);
  }

  function resetLeadFilters() {
    setMonthFilter('all');
    setYearFilter('all');
    setStatusFilter('all');
  }

  function handleDownloadLead(lead: AssetLead) {
    const didOpen = downloadLeadAsset(lead);
    if (!didOpen) {
      setNotice({ tone: 'error', message: 'Enable pop-ups to download or print the asset valuation PDF.' });
    }
  }

  function openNoteModal(lead: AssetLead) {
    setNotice(null);
    setNoteLead(lead);
    setNoteDraft('');
  }

  function closeNoteModal() {
    if (isSavingNote) return;
    setNoteLead(null);
    setNoteDraft('');
  }

  async function submitLeadNote() {
    if (!noteLead) return;

    const noteText = noteDraft.trim();
    if (!noteText) {
      setNotice({ tone: 'error', message: 'Write a note before saving it.' });
      return;
    }

    setIsSavingNote(true);

    try {
      const response = await fetch(`/api/asset-leads/${encodeURIComponent(noteLead.id)}/notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText }),
      });
      const data = (await response.json()) as PartnerNoteResponse;

      if (!response.ok || !data.ok || !data.note) {
        throw new Error(data.error ?? 'Failed to save note.');
      }

      setNotice({ tone: 'success', message: 'Note saved on the lead asset.' });
      setNoteLead(null);
      setNoteDraft('');
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to save note.' });
    } finally {
      setIsSavingNote(false);
    }
  }

  function openWhatsApp(lead: AssetLead) {
    const phone = cleanPhoneForWhatsApp(ownerPhone(lead));
    if (!phone) {
      setNotice({ tone: 'error', message: 'No client cellphone number is saved on this lead.' });
      return;
    }

    const message = encodeURIComponent(`Good day ${ownerDisplayName(lead)}, I received your Aim4price ${formatLeadDisplayType(lead).toLowerCase()} for ${leadFollowUpSubject(lead)}.`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer');
  }

  function openEmail(lead: AssetLead) {
    const email = ownerEmail(lead);
    if (!email) {
      setNotice({ tone: 'error', message: 'No client email address is saved on this lead.' });
      return;
    }

    const subject = encodeURIComponent(`Aim4price lead: ${leadFollowUpSubject(lead)}`);
    const body = encodeURIComponent(`Good day ${ownerDisplayName(lead)},\n\nI received your Aim4price ${formatLeadDisplayType(lead).toLowerCase()} for ${leadFollowUpSubject(lead)}.\n\nKind regards`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  }

  function callClient(lead: AssetLead) {
    const phone = cleanPhoneForTel(ownerPhone(lead));
    if (!phone) {
      setNotice({ tone: 'error', message: 'No client contact number is saved on this lead.' });
      return;
    }

    window.location.href = `tel:${phone}`;
  }

  function readLeadFinanceStatusChoice(lead: AssetLead): AssetStatusChoice {
    const specs = assetSpecs(lead) ?? {};

    return normalizeAssetStatusChoice(
      specs.financeStatus ??
        specs.finance_status ??
        specs.financedStatus ??
        specs.financed_status ??
        lead.assetSnapshot.financeStatus ??
        lead.assetSnapshot.finance_status ??
        lead.assetSnapshot.financedStatus ??
        lead.assetSnapshot.financed_status,
      asBoolean(lead.assetSnapshot.isFinanced) ? 'yes' : 'no',
    );
  }

  function readLeadInsuranceStatusChoice(lead: AssetLead): AssetStatusChoice {
    const specs = assetSpecs(lead) ?? {};

    return normalizeAssetStatusChoice(
      specs.insuranceStatus ??
        specs.insurance_status ??
        specs.insuredStatus ??
        specs.insured_status ??
        lead.assetSnapshot.insuranceStatus ??
        lead.assetSnapshot.insurance_status ??
        lead.assetSnapshot.insuredStatus ??
        lead.assetSnapshot.insured_status,
      asBoolean(lead.assetSnapshot.isInsured) ? 'yes' : 'no',
    );
  }

  function readLeadLicenseStatusChoice(lead: AssetLead): AssetStatusChoice {
    const specs = assetSpecs(lead) ?? {};

    return normalizeAssetStatusChoice(
      specs.licenseStatus ??
        specs.license_status ??
        specs.licensedStatus ??
        specs.licensed_status ??
        specs.licenceStatus ??
        specs.licence_status ??
        specs.licencedStatus ??
        specs.licenced_status ??
        lead.assetSnapshot.licenseStatus ??
        lead.assetSnapshot.license_status ??
        lead.assetSnapshot.licensedStatus ??
        lead.assetSnapshot.licensed_status ??
        lead.assetSnapshot.licenceStatus ??
        lead.assetSnapshot.licence_status ??
        lead.assetSnapshot.licencedStatus ??
        lead.assetSnapshot.licenced_status,
      asBoolean(lead.assetSnapshot.isLicensed) ? 'yes' : 'no',
    );
  }

  function readLeadLicenseRegistrationNumber(lead: AssetLead): string {
    const specs = assetSpecs(lead) ?? {};

    return String(
      lead.assetSnapshot.licenseRegistrationNumber ??
        lead.assetSnapshot.license_registration_number ??
        lead.assetSnapshot.licenceRegistrationNumber ??
        lead.assetSnapshot.licence_registration_number ??
        specs.licenseRegistrationNumber ??
        specs.license_registration_number ??
        specs.licenceRegistrationNumber ??
        specs.licence_registration_number ??
        specs.licenseRegistration ??
        specs.license_registration ??
        specs.licenceRegistration ??
        specs.licence_registration ??
        specs.registrationNumber ??
        specs.registration_number ??
        specs.numberPlate ??
        specs.number_plate ??
        specs.numberplate ??
        '',
    )
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function setLeadPhotoIndex(leadId: string, index: number) {
    setLeadPhotoIndexes((current) => ({
      ...current,
      [leadId]: Math.max(0, index),
    }));
  }

  function getLeadPhotoIndex(lead: AssetLead): number {
    const photos = assetPhotos(lead);
    const storedIndex = leadPhotoIndexes[lead.id] ?? 0;

    if (!photos.length) return 0;
    return Math.min(Math.max(storedIndex, 0), photos.length - 1);
  }

  function cycleLeadPhoto(lead: AssetLead, direction: -1 | 1) {
    const photos = assetPhotos(lead);
    if (photos.length <= 1) return;

    const currentIndex = getLeadPhotoIndex(lead);
    const nextIndex = (currentIndex + direction + photos.length) % photos.length;
    setLeadPhotoIndex(lead.id, nextIndex);
  }

  function renderLeadAssetStatusMark(value: AssetStatusChoice) {
    const status = normalizeAssetStatusChoice(value);
    const config = {
      yes: { label: '✓', className: assetStyles.statusMarkYes, title: 'Yes' },
      no: { label: '×', className: assetStyles.statusMarkNo, title: 'No' },
      unknown: { label: '?', className: assetStyles.statusMarkUnknown, title: 'Not sure' },
      not_applicable: { label: 'N/A', className: assetStyles.statusMarkNotApplicable, title: 'Not applicable' },
    }[status];

    return (
      <strong className={`${assetStyles.assetStatusMark} ${config.className}`} aria-label={config.title} title={config.title}>
        {config.label}
      </strong>
    );
  }

  function renderRegisterStatRow(label: string, value: string | number) {
    return (
      <div className={styles.fullRegisterStatRow}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    );
  }

  function renderFullRegisterLeadDetails(lead: AssetLead) {
    const snapshot = registerLeadSnapshot(lead);
    const registerAssets = registerLeadAssets(lead);
    const assetCount = registerLeadCount(lead);
    const aim4priceCount = asNumber(snapshot?.aim4priceAssetCount) ?? registerAssets.filter((asset) => asText(asset.selectedMethod) === 'aim4price' || asNumber(asset.aim4priceValueExVat) !== null).length;
    const manualAssetCount = asNumber(snapshot?.manualAssetCount) ?? registerAssets.filter((asset) => asText(asset.selectedMethod) === 'manual').length;
    const financedCount = asNumber(snapshot?.financedAssetCount) ?? registerAssets.filter((asset) => asBoolean(asset.isFinanced)).length;
    const insuredCount = asNumber(snapshot?.insuredAssetCount) ?? registerAssets.filter((asset) => asBoolean(asset.isInsured)).length;
    const licensedCount = asNumber(snapshot?.licensedAssetCount) ?? registerAssets.filter((asset) => asBoolean(asset.isLicensed)).length;

    return (
      <div className={`${assetStyles.assetBody} ${styles.fullRegisterLeadBody}`} id={`lead-panel-${lead.id}`}>
        <button type="button" className={styles.fullRegisterPdfPanel} onClick={() => handleDownloadLead(lead)}>
          <span className={styles.fullRegisterPdfIcon}>
            <DownloadIcon className={assetStyles.buttonIcon} />
          </span>
          <span>
            <strong>Full Asset Register</strong>
            <small>Download the register snapshot PDF.</small>
          </span>
        </button>

        <div className={styles.fullRegisterStatsPanel}>
          <div className={styles.fullRegisterStatsGrid}>
            {renderRegisterStatRow('Total assets', assetCount)}
            {renderRegisterStatRow('Assets licensed', licensedCount)}
            {renderRegisterStatRow('Assets financed', financedCount)}
            {renderRegisterStatRow('Aim4price assets', aim4priceCount)}
            {renderRegisterStatRow('Assets insured', insuredCount)}
            {renderRegisterStatRow('Manual assets', manualAssetCount)}
          </div>
        </div>

        {lead.ownerMessage ? (
          <div className={assetStyles.noteStack}>
            <div className={assetStyles.note}>
              <strong>Owner message</strong>
              <p>{lead.ownerMessage}</p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderLeadDetails(lead: AssetLead) {
    if (isFullRegisterLead(lead)) {
      return renderFullRegisterLeadDetails(lead);
    }

    const photos = assetPhotos(lead);
    const photoIndex = getLeadPhotoIndex(lead);
    const photo = photos[photoIndex] ?? '';
    const hasMultiplePhotos = photos.length > 1;
    const familyLabel = asText(lead.assetSnapshot.equipmentFamilyLabel) || asText(lead.assetSnapshot.kind) || 'Asset';
    const licenseStatus = readLeadLicenseStatusChoice(lead);
    const licenseRegistrationNumber = readLeadLicenseRegistrationNumber(lead);

    return (
      <div className={`${assetStyles.assetBody} ${styles.leadAssetBody}`} id={`lead-panel-${lead.id}`}>
        <div className={assetStyles.previewWrap}>
          <div className={assetStyles.previewStage}>
            {photo ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={`${assetTitle(lead)} photo ${photoIndex + 1}`} className={assetStyles.previewImage} />

                {hasMultiplePhotos ? (
                  <>
                    <button
                      type="button"
                      className={`${assetStyles.previewNavButton} ${assetStyles.previewNavPrev}`}
                      onClick={() => cycleLeadPhoto(lead, -1)}
                      aria-label="Show previous photo"
                    >
                      <ChevronLeftIcon className={assetStyles.buttonIcon} />
                    </button>

                    <button
                      type="button"
                      className={`${assetStyles.previewNavButton} ${assetStyles.previewNavNext}`}
                      onClick={() => cycleLeadPhoto(lead, 1)}
                      aria-label="Show next photo"
                    >
                      <ChevronRightIcon className={assetStyles.buttonIcon} />
                    </button>

                    <div className={assetStyles.previewCounter}>
                      {photoIndex + 1} / {photos.length}
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <div className={assetStyles.previewPlaceholder}>
                <div className={assetStyles.previewPlaceholderBadges}>
                  <span className={`${assetStyles.badge} ${assetStyles.badgeNeutral} ${assetStyles.previewPlaceholderBadge}`}>
                    {familyLabel}
                  </span>
                </div>
              </div>
            )}
          </div>

          {hasMultiplePhotos ? (
            <div className={assetStyles.previewThumbRow}>
              {photos.map((thumbnail, index) => {
                const isActivePhoto = index === photoIndex;

                return (
                  <button
                    type="button"
                    key={`${lead.id}-lead-photo-${index}`}
                    className={`${assetStyles.previewThumbButton} ${isActivePhoto ? assetStyles.previewThumbButtonActive : ''}`}
                    onClick={() => setLeadPhotoIndex(lead.id, index)}
                    aria-label={`View photo ${index + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbnail} alt={`${assetTitle(lead)} thumbnail ${index + 1}`} className={assetStyles.previewThumbImage} />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className={assetStyles.assetDetailDivider} aria-hidden="true" />

        <div className={assetStyles.assetDetailsPanel}>
          <div className={assetStyles.assetDetailsGrid}>
            <div className={assetStyles.assetPrimaryDetails}>
              <div className={assetStyles.assetDetailRow}>
                <span>Serial</span>
                <strong>{asText(lead.assetSnapshot.serialNumber) || '—'}</strong>
              </div>
              <div className={assetStyles.assetDetailRow}>
                <span>{asText(lead.assetSnapshot.kind).toLowerCase() === 'property' ? 'Year Built' : 'Year'}</span>
                <strong>{lead.assetSnapshot.yearModel ? String(lead.assetSnapshot.yearModel) : '—'}</strong>
              </div>
              <div className={assetStyles.assetDetailRow}>
                <span>Usage</span>
                <strong>{assetUsageValue(lead)}</strong>
              </div>
              <div className={assetStyles.assetDetailRow}>
                <span>Condition</span>
                <strong>{conditionLabel(lead.assetSnapshot.condition)}</strong>
              </div>
            </div>

            <div className={assetStyles.assetStatusDetails}>
              <div className={assetStyles.assetStatusRow}>
                <span>Financed</span>
                {renderLeadAssetStatusMark(readLeadFinanceStatusChoice(lead))}
              </div>
              <div className={assetStyles.assetStatusRow}>
                <span>Insured</span>
                {renderLeadAssetStatusMark(readLeadInsuranceStatusChoice(lead))}
              </div>
              <div className={assetStyles.assetStatusRow}>
                <span>Licensed</span>
                {renderLeadAssetStatusMark(licenseStatus)}
              </div>
              {licenseStatus === 'yes' && licenseRegistrationNumber ? (
                <div className={`${assetStyles.assetStatusRow} ${assetStyles.assetRegistrationRow}`}>
                  <strong>{licenseRegistrationNumber}</strong>
                </div>
              ) : null}
            </div>
          </div>

          {lead.ownerMessage ? (
            <div className={assetStyles.noteStack}>
              <div className={assetStyles.note}>
                <strong>Owner message</strong>
                <p>{lead.ownerMessage}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <main className={`${assetStyles.page} ${styles.leadsPage}`}>
      <AppHeader active="leads" />

      <section className={assetStyles.shell}>
        {notice ? (
          <div className={`${assetStyles.notice} ${notice.tone === 'success' ? assetStyles.noticeSuccess : assetStyles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <section className={`${assetStyles.registerPanel} ${styles.leadsRegisterPanel}`}>
          <div className={`${assetStyles.registerHeader} ${styles.leadsRegisterHeader}`}>
            <div className={`${assetStyles.registerTitleBlock} ${styles.leadsTitleBlock}`}>
              <h1>Lead inbox</h1>
              <p>Open one lead at a time. The owner details, asset value and action buttons stay together.</p>
            </div>

            <div className={`${assetStyles.headerActions} ${styles.leadHeaderActions}`}>
              <button
                type="button"
                className={`${assetStyles.secondaryButton} ${assetStyles.filterTriggerButton} ${styles.leadFilterButton} ${hasActiveLeadFilter ? assetStyles.filterTriggerButtonActive : ''}`}
                onClick={() => setIsFilterModalOpen(true)}
                disabled={isLoading}
              >
                <FilterIcon className={assetStyles.buttonIcon} />
                <span>{activeLeadFilterLabel}</span>
                <ChevronDownIcon className={assetStyles.filterChevron} />
              </button>
            </div>
          </div>

          <div className={`${assetStyles.summaryRow} ${assetStyles.heroSummaryRow} ${styles.leadSummaryRow}`}>
            <div className={`${assetStyles.summaryTile} ${assetStyles.registerValueTile} ${assetStyles.heroSummaryTile} ${assetStyles.heroRegisterTile}`}>
              <div className={assetStyles.heroSummaryHead}>
                <span className={assetStyles.heroSummaryTitle}>Lead overview</span>
              </div>

              <div className={assetStyles.heroSummaryValueRow}>
                <strong className={assetStyles.heroSummaryValue}>{filteredLeads.length}</strong>
              </div>

              <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter}`}>
                <small>Showing leads after search and filters.</small>
              </div>
            </div>

            <div className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile}`}>
              <div className={assetStyles.heroSummaryHead}>
                <span className={assetStyles.heroSummaryTitle}>Total leads</span>
              </div>

              <div className={assetStyles.heroSummaryValueRow}>
                <strong className={assetStyles.heroSummaryValue}>{periodLeads.length}</strong>
              </div>

              <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter}`}>
                <small>For the selected month and year.</small>
              </div>
            </div>

            <div className={`${assetStyles.summaryTile} ${assetStyles.totalAssetsTile} ${assetStyles.heroSummaryTile}`}>
              <div className={assetStyles.heroSummaryHead}>
                <span className={assetStyles.heroSummaryTitle}>New leads</span>
              </div>

              <div className={assetStyles.heroSummaryValueRow}>
                <strong className={assetStyles.heroSummaryValue}>{newLeadCount}</strong>
              </div>

              <div className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter}`}>
                <small>Not yet opened or actioned.</small>
              </div>
            </div>
          </div>

          <div className={`${assetStyles.toolbar} ${styles.leadSearchToolbar}`}>
            <label className={assetStyles.searchWrap}>
              <SearchIcon className={assetStyles.searchIcon} />
              <input
                className={assetStyles.searchInput}
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by asset, owner, contact details"
                aria-label="Search leads"
              />

              {searchTerm ? (
                <button
                  type="button"
                  className={assetStyles.clearSearchButton}
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                >
                  <CloseIcon className={assetStyles.buttonIcon} />
                </button>
              ) : null}
            </label>
          </div>

          {isLoading ? <div className={assetStyles.emptyState}>Loading leads...</div> : null}

          {!isLoading && !filteredLeads.length ? (
            <div className={assetStyles.emptyState}>No leads match this search or filter.</div>
          ) : null}

          {!isLoading && filteredLeads.length ? (
            <div className={styles.leadStack}>
              {filteredLeads.map((lead) => {
                return (
                  <article key={lead.id} className={`${styles.leadThread} ${openLeadId === lead.id ? styles.leadThreadOpen : ''}`}>
                    <div className={styles.clientPanel}>
                      <div className={styles.clientPanelHeader}>
                        <div className={styles.clientIdentity}>
                          <span className={styles.clientKicker}>{formatLeadDisplayType(lead)} · Received {formatDate(lead.createdAtIso)}</span>
                          <h3>{lead.ownerBusinessName || ownerDisplayName(lead)}</h3>
                          <div className={styles.clientInlineMeta}>
                            <span>{lead.ownerName || ownerDisplayName(lead)}</span>
                            {ownerPhone(lead) ? <span>{ownerPhone(lead)}</span> : null}
                            {ownerEmail(lead) ? <span>{ownerEmail(lead)}</span> : null}
                            <span>{ownerLocation(lead)}</span>
                          </div>
                          <div className={styles.leadPreviewMeta}>
                            <span>{assetTitle(lead)}</span>
                            <strong>{formatCurrency(assetValue(lead))} excl. VAT</strong>
                          </div>
                        </div>

                        <div className={styles.clientDecisionArea}>
                          {openLeadId === lead.id ? (
                            <div className={styles.clientActionRow}>
                              <button
                                type="button"
                                className={`${assetStyles.secondaryButton} ${styles.closeLeadButton}`}
                                onClick={() => {
                                  setOpenLeadId(null);
                                }}
                              >
                                Close
                              </button>
                              <button type="button" className={`${assetStyles.secondaryButton} ${styles.deleteLeadButton}`} onClick={() => setDeleteLeadTarget(lead)}>
                                Delete
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className={assetStyles.primaryButton}
                              onClick={() => {
                                setOpenLeadId(lead.id);
                              }}
                            >
                              Open lead
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {openLeadId === lead.id ? (
                      <div className={`${assetStyles.assetCard} ${styles.leadAssetCard} ${isFullRegisterLead(lead) ? styles.fullRegisterLeadCard : ''} ${assetStyles.assetCardExpanded}`}>
                        <div className={assetStyles.assetHeader}>
                          <div className={assetStyles.assetTitleBlock}>
                            <h2>{assetTitle(lead)}</h2>
                            <p>{leadAssetMeta(lead)}</p>
                            <div className={assetStyles.assetMetaRow}>
                              <span className={assetStyles.assetValueMethodLabel}>{isFullRegisterLead(lead) ? 'Register' : methodLabel(lead.assetSnapshot.selectedMethod)} value</span>
                              <span className={assetStyles.assetSavedDateLabel}>Updated {formatDate(asText(lead.assetSnapshot.updatedAtIso) || lead.updatedAtIso)}</span>
                            </div>
                          </div>

                          <div className={assetStyles.assetHeaderAside}>
                            <div className={assetStyles.valueBlock}>
                              <strong>{formatCurrency(assetValue(lead))}</strong>
                              <span>Excl. VAT</span>
                            </div>

                            <div className={assetStyles.assetHeaderActions}>
                              <button type="button" className={`${assetStyles.optionsButton} ${assetStyles.sharedNoteActionButton}`} onClick={() => openNoteModal(lead)}>
                                <NoteIcon className={assetStyles.buttonIcon} />
                                <span>Leave note</span>
                              </button>

                              <button type="button" className={assetStyles.optionsButton} onClick={() => setManagedLead(lead)}>
                                <ManageIcon className={assetStyles.buttonIcon} />
                                <span>Manage</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {renderLeadDetails(lead)}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </section>

      {isFilterModalOpen ? (
        <div className={assetStyles.modalOverlay}>
          <div className={assetStyles.modalBackdrop} onClick={() => setIsFilterModalOpen(false)} />

          <div className={`${assetStyles.modalCard} ${styles.leadFilterModal}`} role="dialog" aria-modal="true" aria-labelledby="lead-filter-title">
            <div className={assetStyles.modalHeader}>
              <div className={assetStyles.modalHeaderText}>
                <h3 id="lead-filter-title">Choose which leads to show.</h3>
                <p className={styles.leadFilterIntro}>Filter your inbox by the date the lead was received and the current lead status.</p>
              </div>

              <button type="button" className={assetStyles.modalCloseButton} onClick={() => setIsFilterModalOpen(false)} aria-label="Close filter modal">
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={styles.leadFilterForm}>
              <label className={`${assetStyles.field} ${styles.leadFilterField}`}>
                <span>Month</span>
                <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
                  {MONTH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className={`${assetStyles.field} ${styles.leadFilterField}`}>
                <span>Year</span>
                <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                  <option value="all">All years</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </label>

              <label className={`${assetStyles.field} ${styles.leadFilterField}`}>
                <span>Status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LeadStatusFilter)}>
                  <option value="all">All leads</option>
                  <option value="new">New leads</option>
                  <option value="open">Open leads</option>
                </select>
              </label>
            </div>

            <div className={`${assetStyles.formActions} ${styles.leadFilterActions}`}>
              <button type="button" className={assetStyles.secondaryButton} onClick={resetLeadFilters} disabled={!hasActiveLeadFilter}>
                Reset filters
              </button>
              <button type="button" className={assetStyles.primaryButton} onClick={() => setIsFilterModalOpen(false)}>
                Apply filters
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {managedLead ? (
        <div className={assetStyles.modalOverlay}>
          <div className={assetStyles.modalBackdrop} onClick={() => setManagedLead(null)} />

          <div className={assetStyles.optionsModal} role="dialog" aria-modal="true" aria-labelledby="lead-manage-title">
            <div className={`${assetStyles.modalHeader} ${assetStyles.optionsModalHeader}`}>
              <div className={assetStyles.modalHeaderText}>
                <h3 id="lead-manage-title">{assetTitle(managedLead)}</h3>
                <p>{leadAssetMeta(managedLead)}</p>
              </div>

              <button type="button" className={assetStyles.modalCloseButton} onClick={() => setManagedLead(null)} aria-label="Close lead management">
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={`${assetStyles.modalScrollBody} ${assetStyles.optionsScrollBody}`}>
              <div className={assetStyles.optionsContent}>
                <div className={`${assetStyles.optionsGrid} ${assetStyles.assetOptionsGrid} ${styles.manageOptionsGrid}`}>
                  <button type="button" className={`${assetStyles.optionActionButton} ${assetStyles.optionFeaturedButton} ${styles.whatsAppActionButton}`} onClick={() => openWhatsApp(managedLead)}>
                    <WhatsAppIcon className={`${assetStyles.buttonIcon} ${styles.whatsAppIcon}`} />
                    <span>
                      <strong>WhatsApp client</strong>
                      <small>Open a WhatsApp message to the owner.</small>
                    </span>
                  </button>

                  <button type="button" className={assetStyles.optionActionButton} onClick={() => handleDownloadLead(managedLead)}>
                    <DownloadIcon className={assetStyles.buttonIcon} />
                    <span>
                      <strong>Download PDF report</strong>
                      <small>Download the asset valuation PDF.</small>
                    </span>
                  </button>

                  <button type="button" className={assetStyles.optionActionButton} onClick={() => openEmail(managedLead)}>
                    <EmailIcon className={assetStyles.buttonIcon} />
                    <span>
                      <strong>Email client</strong>
                      <small>Open an email draft with asset context.</small>
                    </span>
                  </button>

                  <button type="button" className={assetStyles.optionActionButton} onClick={() => callClient(managedLead)}>
                    <PhoneIcon className={assetStyles.buttonIcon} />
                    <span>
                      <strong>Call client</strong>
                      <small>Start a phone call from the saved number.</small>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteLeadTarget ? (
        <div className={`${assetStyles.modalOverlay} ${assetStyles.confirmDeleteOverlay}`}>
          <div className={assetStyles.modalBackdrop} onClick={closeDeleteLeadModal} />

          <div
            className={`${assetStyles.deleteConfirmModal} ${styles.leadDeleteModal}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-lead-confirm-title"
            aria-describedby="delete-lead-confirm-copy"
          >
            <div className={`${assetStyles.deleteConfirmIcon} ${styles.leadDeleteIcon}`}>
              <TrashIcon className={assetStyles.buttonIcon} />
            </div>

            <div className={`${assetStyles.deleteConfirmContent} ${styles.leadDeleteContent}`}>
              <h3 id="delete-lead-confirm-title">Are you sure you want to delete this lead?</h3>
              <p id="delete-lead-confirm-copy">This removes the lead from your leads inbox.</p>

              <div className={`${assetStyles.deleteConfirmAsset} ${styles.leadDeleteSummary}`}>
                <span>Selected lead</span>
                <strong>{deleteLeadTarget.ownerBusinessName || ownerDisplayName(deleteLeadTarget)}</strong>
                <small>{assetTitle(deleteLeadTarget)} · {formatCurrency(assetValue(deleteLeadTarget))} excl. VAT</small>
              </div>

              <div className={`${assetStyles.deleteConfirmActions} ${styles.leadDeleteActions}`}>
                <button type="button" className={assetStyles.secondaryButton} onClick={closeDeleteLeadModal} disabled={isDeletingLead}>
                  Close
                </button>

                <button
                  type="button"
                  className={`${assetStyles.primaryButton} ${assetStyles.deleteConfirmButton} ${styles.leadDeleteConfirmButton}`}
                  onClick={() => void confirmDeleteLead()}
                  disabled={isDeletingLead}
                >
                  <TrashIcon className={assetStyles.buttonIcon} />
                  <span>{isDeletingLead ? 'Deleting...' : 'Yes, delete lead'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {noteLead ? (
        <div className={assetStyles.modalOverlay}>
          <div className={assetStyles.modalBackdrop} onClick={closeNoteModal} />

          <div className={`${assetStyles.modalCard} ${assetStyles.sharedNoteModal}`} role="dialog" aria-modal="true" aria-labelledby="lead-note-title">
            <div className={assetStyles.modalHeader}>
              <div className={assetStyles.modalHeaderText}>
                <h3 id="lead-note-title">Leave note</h3>
                <p>{assetTitle(noteLead)} · {ownerDisplayName(noteLead)}</p>
              </div>

              <button type="button" className={assetStyles.modalCloseButton} onClick={closeNoteModal} aria-label="Close note modal" disabled={isSavingNote}>
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <label className={`${assetStyles.field} ${assetStyles.sharedNoteField}`}>
              <span>Note to asset owner</span>
              <textarea
                className={assetStyles.sharedNoteTextarea}
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Example: Please confirm the latest hours before we process this asset."
                autoFocus
              />
            </label>

            <div className={`${assetStyles.formActions} ${assetStyles.sharedNoteActions}`}>
              <button type="button" className={assetStyles.secondaryButton} onClick={closeNoteModal} disabled={isSavingNote}>
                Cancel
              </button>
              <button type="button" className={assetStyles.primaryButton} onClick={() => void submitLeadNote()} disabled={isSavingNote}>
                {isSavingNote ? 'Saving...' : 'Save note'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
