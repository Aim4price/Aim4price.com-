'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import { openAssetSheetPrint, type ReportMethodCard } from '../../lib/report-print';
import assetStyles from '../asset-register/page.module.css';
import sharedStyles from '../shared-access/page.module.css';
import styles from './page.module.css';

type LeadType = 'finance' | 'insurance' | 'replacement_quote';
type LeadStatus = 'sent' | 'viewed' | 'accepted' | 'quoted' | 'declined' | 'closed';
type NoticeTone = 'success' | 'error';
type LeadStatusFilter = 'all' | 'new' | 'saved' | 'quoted';
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

function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronUpIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m18 15-6-6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
      <path d="M5 19.2 6 16.1a7.7 7.7 0 1 1 2.1 2.1L5 19.2Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.3 8.8c.2-.4.4-.5.7-.5h.5c.2 0 .4.1.5.4l.6 1.4c.1.3.1.5-.1.7l-.4.5c.7 1.2 1.5 2 2.7 2.7l.5-.4c.2-.2.5-.2.7-.1l1.4.6c.3.1.4.3.4.5v.5c0 .3-.1.6-.5.7-.6.3-1.2.4-1.9.2-2.5-.6-5.7-3.8-6.3-6.3-.1-.7 0-1.3.2-1.9Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
  if (value === 'accepted') return 'Saved';
  if (value === 'quoted') return 'Quoted';
  if (value === 'declined') return 'Deleted';
  return 'Closed';
}

function isNewLeadStatus(value: LeadStatus): boolean {
  return value === 'sent' || value === 'viewed';
}

function isSavedLeadStatus(value: LeadStatus): boolean {
  return value === 'accepted' || value === 'quoted' || value === 'closed';
}

function canSaveLead(value: LeadStatus): boolean {
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
  return asText(lead.assetSnapshot.title) || 'Shared asset';
}

function assetDescription(lead: AssetLead): string {
  return [
    lead.assetSnapshot.yearModel ? String(lead.assetSnapshot.yearModel) : '',
    asText(lead.assetSnapshot.brandName),
    asText(lead.assetSnapshot.modelName) || asText(lead.assetSnapshot.typedModelName),
  ]
    .filter(Boolean)
    .join(' ') || asText(lead.assetSnapshot.equipmentFamilyLabel) || asText(lead.assetSnapshot.kind) || 'Asset';
}

function assetValue(lead: AssetLead): number {
  return asNumber(lead.assetSnapshot.value ?? lead.assetSnapshot.selectedValueExVat ?? lead.assetSnapshot.aim4priceValueExVat ?? lead.assetSnapshot.marketMidExVat) ?? 0;
}

function assetPhotos(lead: AssetLead): string[] {
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

function downloadLeadAsset(lead: AssetLead): boolean {
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
    statusLabel: `${formatLeadType(lead.leadType)} · ${formatStatus(lead.status)}`,
    issuerName: ownerDisplayName(lead),
    issuerAddress: ownerLocation(lead),
    issuerPhone: ownerPhone(lead) || '—',
    issuerEmail: ownerEmail(lead) || '—',
    clientRows: buildClientRows(lead),
    summaryItems: [
      { label: 'Lead type', value: formatLeadType(lead.leadType) },
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
    formatLeadType(lead.leadType),
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
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [managedLead, setManagedLead] = useState<AssetLead | null>(null);
  const [noteLead, setNoteLead] = useState<AssetLead | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
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
      if (statusFilter === 'saved' && !isSavedLeadStatus(lead.status)) return false;
      if (statusFilter === 'quoted' && lead.status !== 'quoted') return false;

      if (!query) return true;
      return searchTextForLead(lead).includes(query);
    });
  }, [periodLeads, searchTerm, statusFilter]);

  const newLeadCount = useMemo(() => periodLeads.filter((lead) => isNewLeadStatus(lead.status)).length, [periodLeads]);
  const savedLeadCount = useMemo(() => periodLeads.filter((lead) => isSavedLeadStatus(lead.status)).length, [periodLeads]);

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

  async function updateLeadStatus(leadId: string, status: 'accepted' | 'declined') {
    try {
      const response = await fetch(`/api/asset-leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as LeadsResponse;

      if (!response.ok || !data.ok || !data.lead) {
        throw new Error(data.error ?? 'Failed to update lead.');
      }

      setLeads((current) => current.map((lead) => (lead.id === leadId ? (data.lead as AssetLead) : lead)));
      setManagedLead((current) => (current?.id === leadId ? (data.lead as AssetLead) : current));
      setNotice({ tone: 'success', message: status === 'accepted' ? 'Lead saved. It will stay in your saved leads.' : 'Lead updated.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to update lead.' });
    }
  }

  async function deleteLead(leadToDelete: AssetLead) {
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
      setNotice({ tone: 'success', message: 'Lead deleted.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to delete lead.' });
    }
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

    const message = encodeURIComponent(`Good day ${ownerDisplayName(lead)}, I received your Aim4price ${formatLeadType(lead.leadType).toLowerCase()} for ${assetTitle(lead)}.`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer');
  }

  function openEmail(lead: AssetLead) {
    const email = ownerEmail(lead);
    if (!email) {
      setNotice({ tone: 'error', message: 'No client email address is saved on this lead.' });
      return;
    }

    const subject = encodeURIComponent(`Aim4price lead: ${assetTitle(lead)}`);
    const body = encodeURIComponent(`Good day ${ownerDisplayName(lead)},\n\nI received your Aim4price ${formatLeadType(lead.leadType).toLowerCase()} for ${assetTitle(lead)}.\n\nKind regards`);
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

  function renderLeadDetails(lead: AssetLead) {
    const photo = assetPhotos(lead)[0] ?? '';
    const familyLabel = asText(lead.assetSnapshot.equipmentFamilyLabel) || asText(lead.assetSnapshot.kind) || 'Asset';
    const licenseStatus = readLeadLicenseStatusChoice(lead);
    const licenseRegistrationNumber = readLeadLicenseRegistrationNumber(lead);

    return (
      <div className={`${assetStyles.assetBody} ${styles.leadAssetBody}`} id={`lead-panel-${lead.id}`}>
        <div className={assetStyles.previewWrap}>
          <div className={assetStyles.previewStage}>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={assetTitle(lead)} className={assetStyles.previewImage} />
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
    <main className={sharedStyles.page}>
      <AppHeader active="leads" />

      <section className={sharedStyles.shell}>
        <div className={sharedStyles.hero}>
          <div>
            <h1>Leads</h1>
            <p>Review received asset leads, save the useful ones and contact the owner from the asset card.</p>
          </div>
        </div>

        {notice ? (
          <div className={`${sharedStyles.notice} ${notice.tone === 'success' ? sharedStyles.noticeSuccess : sharedStyles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <div className={sharedStyles.statGrid}>
          <div className={sharedStyles.statCard}>
            <span>Total leads</span>
            <strong>{periodLeads.length}</strong>
          </div>
          <div className={sharedStyles.statCard}>
            <span>Saved</span>
            <strong>{savedLeadCount}</strong>
          </div>
          <div className={sharedStyles.statCard}>
            <span>New</span>
            <strong>{newLeadCount}</strong>
          </div>
        </div>

        <section className={sharedStyles.card}>
          <div className={sharedStyles.cardHeader}>
            <div>
              <h2>Received leads</h2>
              <p>Save leads you want to work on. Delete irrelevant leads to keep the inbox clean.</p>
            </div>
          </div>

          <div className={`${sharedStyles.partnerAssetToolbar} ${styles.leadToolbar}`}>
            <label className={sharedStyles.field}>
              <span>Search</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search asset, owner, contact details..."
              />
            </label>
            <label className={sharedStyles.field}>
              <span>Month</span>
              <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
                {MONTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className={sharedStyles.field}>
              <span>Year</span>
              <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                <option value="all">All years</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
            <label className={sharedStyles.field}>
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LeadStatusFilter)}>
                <option value="all">All leads</option>
                <option value="new">New leads</option>
                <option value="saved">Saved leads</option>
                <option value="quoted">Quoted leads</option>
              </select>
            </label>
          </div>

          {isLoading ? <div className={sharedStyles.emptyState}>Loading leads...</div> : null}

          {!isLoading && !filteredLeads.length ? (
            <div className={sharedStyles.emptyState}>No leads match this search or filter.</div>
          ) : null}

          {!isLoading && filteredLeads.length ? (
            <div className={styles.leadStack}>
              {filteredLeads.map((lead) => {
                const isExpanded = expandedLeadId === lead.id;

                return (
                  <article key={lead.id} className={styles.leadThread}>
                    <div className={styles.clientPanel}>
                      <div className={styles.clientPanelHeader}>
                        <div className={styles.clientIdentity}>
                          <span className={styles.clientKicker}>{formatLeadType(lead.leadType)} · Received {formatDate(lead.createdAtIso)}</span>
                          <h3>{lead.ownerBusinessName || ownerDisplayName(lead)}</h3>
                          <div className={styles.clientInlineMeta}>
                            <span>{lead.ownerName || ownerDisplayName(lead)}</span>
                            {ownerPhone(lead) ? <span>{ownerPhone(lead)}</span> : null}
                            {ownerEmail(lead) ? <span>{ownerEmail(lead)}</span> : null}
                            <span>{ownerLocation(lead)}</span>
                          </div>
                        </div>

                        <div className={styles.clientDecisionArea}>
                          <div className={styles.clientActionRow}>
                            {canSaveLead(lead.status) ? (
                              <button type="button" className={sharedStyles.primaryButton} onClick={() => void updateLeadStatus(lead.id, 'accepted')}>
                                Save lead
                              </button>
                            ) : null}
                            <button type="button" className={sharedStyles.dangerButton} onClick={() => void deleteLead(lead)}>
                              Delete lead
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>

                    <div className={`${assetStyles.assetCard} ${styles.leadAssetCard} ${isExpanded ? assetStyles.assetCardExpanded : ''}`}>
                      <div className={assetStyles.assetHeader}>
                        <div className={assetStyles.assetTitleBlock}>
                          <h2>{assetTitle(lead)}</h2>
                          <p>{leadAssetMeta(lead)}</p>
                          <div className={assetStyles.assetMetaRow}>
                            <span className={assetStyles.assetValueMethodLabel}>{methodLabel(lead.assetSnapshot.selectedMethod)} value</span>
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

                            <button
                              type="button"
                              className={assetStyles.expandButton}
                              onClick={() => setExpandedLeadId((current) => (current === lead.id ? null : lead.id))}
                              aria-expanded={isExpanded}
                              aria-controls={`lead-panel-${lead.id}`}
                            >
                              {isExpanded ? <ChevronUpIcon className={assetStyles.buttonIcon} /> : <ChevronDownIcon className={assetStyles.buttonIcon} />}
                              <span>{isExpanded ? 'Hide details' : 'View details'}</span>
                            </button>

                            <button type="button" className={assetStyles.optionsButton} onClick={() => setManagedLead(lead)}>
                              <ManageIcon className={assetStyles.buttonIcon} />
                              <span>Manage</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {isExpanded ? renderLeadDetails(lead) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </section>

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
                  <button type="button" className={`${assetStyles.optionActionButton} ${assetStyles.optionFeaturedButton}`} onClick={() => openWhatsApp(managedLead)}>
                    <WhatsAppIcon className={assetStyles.buttonIcon} />
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
