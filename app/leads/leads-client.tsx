'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import { openAssetRegisterSummaryPrint, openAssetSheetPrint, type ReportKeyValue, type ReportMethodCard } from '../../lib/report-print';
import assetStyles from '../asset-register/page.module.css';
import styles from './page.module.css';

type LeadType = 'finance' | 'insurance' | 'replacement_quote';
type LeadStatus = 'sent' | 'viewed' | 'accepted' | 'quoted' | 'declined' | 'closed';
type NoticeTone = 'success' | 'error';
type LeadStatusFilter = 'all' | 'new' | 'opened';
type FilterDropdownKey = 'month' | 'year' | 'status';
type AssetStatusChoice = 'yes' | 'no' | 'unknown' | 'not_applicable';
type LeadReportStep = 'format' | 'pdf-report';
type PdfReportKind = 'full' | 'financed' | 'insured' | 'licensed' | 'not-financed' | 'not-insured' | 'not-licensed';

type PdfReportOption = {
  value: PdfReportKind;
  label: string;
  description: string;
  intro: string;
  sectionTitle: string;
  emptyLabel: string;
};

type LeadFilterOption = {
  value: string;
  label: string;
};

type IconProps = {
  className?: string;
};

type ExportGraphicProps = {
  src: string;
  alt: string;
  icon: JSX.Element;
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
  ownerEmail: string;
  ownerPhone: string;
  ownerProvince: string;
  ownerTownCity: string;
  partnerName: string;
  partnerBusinessName: string;
  partnerPhone: string;
  partnerProvince: string;
  partnerTownCity: string;
  partnerNoteAttachmentCount?: number;
  latestPartnerNoteAttachmentFileName?: string;
  latestPartnerNoteAttachmentByteSize?: number | null;
  latestPartnerNoteAttachmentCreatedAtIso?: string | null;
  partnerNotes?: LeadPartnerNote[];
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

type LeadNoteAttachment = {
  fileName: string;
  contentType: string;
  byteSize: number;
  url: string;
};

type LeadPartnerNote = {
  id: string;
  noteText: string;
  status?: string;
  partnerType?: string | null;
  partnerName?: string;
  partnerBusinessName?: string;
  attachment?: LeadNoteAttachment | null;
  createdAtIso: string;
  notedAtIso?: string | null;
  updatedAtIso?: string;
};

type PartnerNoteResponse = {
  ok: boolean;
  note?: LeadPartnerNote;
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

type AccountProfileResponse = {
  ok: boolean;
  profile?: {
    businessName: string;
    displayName: string;
    name: string;
    email: string;
  };
  error?: string;
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

const MAX_LEAD_NOTE_PDF_BYTES = 12 * 1024 * 1024;
const LEADS_PER_PAGE = 10;
const PAGINATION_WINDOW = 5;

const STATUS_FILTER_OPTIONS: LeadFilterOption[] = [
  { value: 'all', label: 'All leads' },
  { value: 'new', label: 'New leads' },
  { value: 'opened', label: 'Opened leads' },
];

const PDF_REPORT_OPTIONS: PdfReportOption[] = [
  {
    value: 'full',
    label: 'Full Asset Register',
    description: 'All saved register assets with full register totals.',
    intro: 'Complete saved asset register snapshot.',
    sectionTitle: 'Asset Register',
    emptyLabel: 'No saved assets are currently available for this report.',
  },
  {
    value: 'financed',
    label: 'Financed',
    description: 'Only assets marked as financed.',
    intro: 'Filtered asset register snapshot showing only financed assets.',
    sectionTitle: 'Financed Assets',
    emptyLabel: 'No financed assets are currently saved in this register.',
  },
  {
    value: 'insured',
    label: 'Insured',
    description: 'Only assets marked as insured.',
    intro: 'Filtered asset register snapshot showing only insured assets.',
    sectionTitle: 'Insured Assets',
    emptyLabel: 'No insured assets are currently saved in this register.',
  },
  {
    value: 'licensed',
    label: 'Licensed',
    description: 'Only assets marked as licensed.',
    intro: 'Filtered asset register snapshot showing only licensed assets.',
    sectionTitle: 'Licensed Assets',
    emptyLabel: 'No licensed assets are currently saved in this register.',
  },
  {
    value: 'not-financed',
    label: 'Not Financed',
    description: 'Only assets not marked as financed.',
    intro: 'Filtered asset register snapshot showing only assets not marked as financed.',
    sectionTitle: 'Not Financed Assets',
    emptyLabel: 'No assets without finance are currently saved in this register.',
  },
  {
    value: 'not-insured',
    label: 'Not Insured',
    description: 'Only assets not marked as insured.',
    intro: 'Filtered asset register snapshot showing only assets not marked as insured.',
    sectionTitle: 'Not Insured Assets',
    emptyLabel: 'No assets without insurance are currently saved in this register.',
  },
  {
    value: 'not-licensed',
    label: 'Not Licensed',
    description: 'Only assets not marked as licensed.',
    intro: 'Filtered asset register snapshot showing only assets not marked as licensed.',
    sectionTitle: 'Not Licensed Assets',
    emptyLabel: 'No assets without licensing are currently saved in this register.',
  },
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

function PdfIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M9 15h6" />
      <path d="M9 18h5" />
    </svg>
  );
}

function ExportGraphic({ src, alt, icon }: ExportGraphicProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <span className={assetStyles.exportGraphicFallback}>{icon}</span>;
  }

  return <img src={src} alt={alt} className={assetStyles.exportGraphicImage} onError={() => setHasError(true)} />;
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

function RefreshIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M20 11a8 8 0 0 0-14.7-4.3L4 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 4v4h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 13a8 8 0 0 0 14.7 4.3L20 16" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 20v-4h-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" className={className} aria-hidden="true">
      <path d="m5 12.5 4.2 4.2L19 7" strokeLinecap="round" strokeLinejoin="round" />
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

type LeadFilterDropdownProps = {
  label: string;
  dropdownKey: FilterDropdownKey;
  value: string;
  options: LeadFilterOption[];
  openDropdown: FilterDropdownKey | null;
  onOpenChange: (key: FilterDropdownKey | null) => void;
  onChange: (value: string) => void;
};

function LeadFilterDropdown({
  label,
  dropdownKey,
  value,
  options,
  openDropdown,
  onOpenChange,
  onChange,
}: LeadFilterDropdownProps) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const isOpen = openDropdown === dropdownKey;

  return (
    <label className={`${assetStyles.field} ${styles.leadFilterField}`}>
      <span>{label}</span>
      <div className={styles.leadFilterDropdown}>
        <button
          type="button"
          className={`${styles.leadFilterSelectButton} ${isOpen ? styles.leadFilterSelectButtonOpen : ''}`}
          onClick={() => onOpenChange(isOpen ? null : dropdownKey)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span>{selectedOption?.label ?? 'Choose option'}</span>
          <ChevronDownIcon className={styles.leadFilterSelectIcon} />
        </button>

        {isOpen ? (
          <div className={styles.leadFilterSelectMenu} role="listbox" aria-label={label}>
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  type="button"
                  key={`${dropdownKey}-${option.value}`}
                  className={`${styles.leadFilterSelectOption} ${isSelected ? styles.leadFilterSelectOptionActive : ''}`}
                  onClick={() => {
                    onChange(option.value);
                    onOpenChange(null);
                  }}
                  role="option"
                  aria-selected={isSelected}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </label>
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

function formatByteSize(value: unknown): string {
  const bytes = Math.max(0, Math.round(Number(value) || 0));

  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

function isPdfFile(file: File): boolean {
  const contentType = String(file.type ?? '').trim().toLowerCase();
  return contentType === 'application/pdf' || file.name.trim().toLowerCase().endsWith('.pdf');
}

function formatLeadType(value: LeadType): string {
  if (value === 'finance') return 'Finance lead';
  if (value === 'insurance') return 'Insurance lead';
  return 'Dealer lead';
}

function formatStatus(value: LeadStatus): string {
  if (value === 'sent') return 'New';
  if (value === 'viewed' || value === 'accepted') return 'Opened';
  if (value === 'quoted') return 'Done';
  if (value === 'declined') return 'Deleted';
  return 'Closed';
}

function isNewLead(lead: AssetLead): boolean {
  return lead.status === 'sent' && !lead.viewedAtIso;
}

function isCompletedLead(lead: AssetLead): boolean {
  return lead.status === 'quoted' || lead.status === 'closed';
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

function formatInboxTitle(value: unknown): string {
  const title = asText(value);
  return title ? title.toUpperCase() : 'LEADS INBOX LOADING...';
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const entries: string[] = [];

  value.forEach((entry) => {
    const text = asText(entry);
    if (!text || seen.has(text)) return;
    seen.add(text);
    entries.push(text);
  });

  return entries;
}

function leadPartnerNotes(lead: AssetLead): LeadPartnerNote[] {
  return Array.isArray(lead.partnerNotes)
    ? lead.partnerNotes.filter((note) => asText(note.noteText) || note.attachment)
    : [];
}

function leadPartnerPdfAttachmentCount(lead: AssetLead): number {
  const savedCount = Math.round(Number(lead.partnerNoteAttachmentCount ?? 0) || 0);
  const noteAttachmentCount = leadPartnerNotes(lead).filter((note) => Boolean(note.attachment)).length;

  return Math.max(0, savedCount, noteAttachmentCount);
}

function leadResponseDocumentAttachedValue(lead: AssetLead): 'Yes' | 'No' {
  return leadPartnerPdfAttachmentCount(lead) > 0 ? 'Yes' : 'No';
}

function leadResponseDocumentRowValue(lead: AssetLead): string {
  return `Response document: ${leadResponseDocumentAttachedValue(lead)}`;
}

function leadResponseDocumentDetail(lead: AssetLead): string {
  const attachmentCount = leadPartnerPdfAttachmentCount(lead);

  if (!attachmentCount) {
    return 'No';
  }

  const latestNoteAttachment = leadPartnerNotes(lead).find((note) => note.attachment)?.attachment ?? null;
  const fileName = asText(lead.latestPartnerNoteAttachmentFileName) || asText(latestNoteAttachment?.fileName);
  const byteSize = asNumber(lead.latestPartnerNoteAttachmentByteSize) ?? asNumber(latestNoteAttachment?.byteSize);
  const countLabel = attachmentCount === 1 ? '1 response document' : `${attachmentCount} response documents`;
  const fileLabel = fileName
    ? `Latest: ${fileName}${byteSize !== null && byteSize > 0 ? ` (${formatByteSize(byteSize)})` : ''}`
    : '';

  return ['Yes', countLabel, fileLabel].filter(Boolean).join(' · ');
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
  if (lead.leadType === 'finance') return 'Full finance quote';
  if (lead.leadType === 'insurance') return 'Full insurance quote';
  return 'Full register lead';
}

function formatLeadDisplayType(lead: AssetLead): string {
  if (isFullRegisterLead(lead)) {
    if (lead.leadType === 'finance') return 'Full finance lead';
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

  return asStringArray(lead.assetSnapshot.photos);
}

function leadSharedPhotoUrls(lead: AssetLead): string[] {
  return asStringArray(lead.includedSections.sharePhotoUrls)
    .concat(asStringArray(lead.includedSections.ownerSharePhotoUrls))
    .concat(asStringArray(lead.assetSnapshot.sharePhotoUrls))
    .concat(asStringArray(lead.assetSnapshot.ownerSharePhotoUrls))
    .filter((url, index, urls) => urls.indexOf(url) === index)
    .slice(0, 3);
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
  return lead.ownerContactEmail || lead.ownerEmail || '';
}

function leadEmailRecipient(lead: AssetLead): string {
  const rawEmail = ownerEmail(lead);
  const firstAddress = rawEmail.split(/[;,]/)[0]?.trim() ?? '';
  const bracketMatch = firstAddress.match(/<([^>]+)>/);
  const email = (bracketMatch?.[1] ?? firstAddress).replace(/\s+/g, '');

  return email.includes('@') ? email : '';
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

function isPdfReportKind(value: string): value is PdfReportKind {
  return PDF_REPORT_OPTIONS.some((option) => option.value === value);
}

function getPdfReportOption(reportKind: PdfReportKind): PdfReportOption {
  return PDF_REPORT_OPTIONS.find((option) => option.value === reportKind) ?? PDF_REPORT_OPTIONS[0];
}

function snapshotAssetValue(asset: Record<string, unknown>): number {
  return Math.round(asNumber(asset.value ?? asset.selectedValueExVat ?? asset.aim4priceValueExVat ?? asset.marketMidExVat) ?? 0);
}

const SNAPSHOT_REPLACEMENT_PRICE_KEYS = [
  'replacementPriceExVat',
  'replacement_price_ex_vat',
  'replacementPriceUsedExVat',
  'replacement_price_used_ex_vat',
  'userReplacementPriceExVat',
  'user_replacement_price_ex_vat',
  'officialReplacementPriceExVat',
  'official_replacement_price_ex_vat',
  'replacementPrice',
  'replacement_price',
];

function snapshotReplacementPrice(asset: Record<string, unknown>): number | null {
  for (const key of SNAPSHOT_REPLACEMENT_PRICE_KEYS) {
    const value = asNumber(asset[key]);
    if (value !== null && value > 0) return Math.round(value);
  }

  const specs = asRecord(asset.specsJson) ?? asRecord(asset.specs) ?? asRecord(asset.specAnswers);
  for (const key of SNAPSHOT_REPLACEMENT_PRICE_KEYS) {
    const value = asNumber(specs?.[key]);
    if (value !== null && value > 0) return Math.round(value);
  }

  return null;
}

function sumSnapshotReplacementValues(assets: Record<string, unknown>[]): number {
  return assets.reduce((sum, asset) => sum + Math.round(snapshotReplacementPrice(asset) ?? 0), 0);
}

function sumSnapshotAssetValues(assets: Record<string, unknown>[]): number {
  return assets.reduce((sum, asset) => sum + snapshotAssetValue(asset), 0);
}

function filterRegisterLeadAssetsByPdfReportKind(assets: Record<string, unknown>[], reportKind: PdfReportKind): Record<string, unknown>[] {
  switch (reportKind) {
    case 'financed':
      return assets.filter((asset) => asBoolean(asset.isFinanced));
    case 'insured':
      return assets.filter((asset) => asBoolean(asset.isInsured));
    case 'licensed':
      return assets.filter((asset) => asBoolean(asset.isLicensed));
    case 'not-financed':
      return assets.filter((asset) => !asBoolean(asset.isFinanced));
    case 'not-insured':
      return assets.filter((asset) => !asBoolean(asset.isInsured));
    case 'not-licensed':
      return assets.filter((asset) => !asBoolean(asset.isLicensed));
    case 'full':
    default:
      return assets;
  }
}

function calculateRegisterLeadStats(assets: Record<string, unknown>[], predicate?: (asset: Record<string, unknown>) => boolean): { count: number; value: number } {
  const matchingAssets = predicate ? assets.filter(predicate) : assets;
  return {
    count: matchingAssets.length,
    value: sumSnapshotAssetValues(matchingAssets),
  };
}

function formatPartnerNoteType(value: unknown): string {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'dealer') return 'Dealer';
  if (normalized === 'finance') return 'Finance';
  if (normalized === 'insurance') return 'Insurance';
  return 'Partner';
}

function partnerNoteAuthor(note: LeadPartnerNote): string {
  return asText(note.partnerBusinessName) || asText(note.partnerName) || 'Aim4price partner';
}

function partnerNoteLabel(note: LeadPartnerNote, index: number): string {
  const type = formatPartnerNoteType(note.partnerType);
  const author = partnerNoteAuthor(note);
  return `${type} note ${index + 1} · ${author}`;
}

function partnerNoteValue(note: LeadPartnerNote): string {
  const attachment = note.attachment ?? null;
  const attachmentLabel = attachment
    ? `Attached PDF: ${attachment.fileName}${attachment.byteSize ? ` (${formatByteSize(attachment.byteSize)})` : ''}`
    : '';
  const sentLabel = note.createdAtIso ? `Sent: ${formatDate(note.createdAtIso)}` : '';

  return [asText(note.noteText), attachmentLabel, sentLabel].filter(Boolean).join('\n');
}

function buildLeadPartnerNoteRows(lead: AssetLead): ReportKeyValue[] {
  return leadPartnerNotes(lead).map((note, index) => ({
    label: partnerNoteLabel(note, index),
    value: partnerNoteValue(note),
  }));
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
    { label: 'Business email', value: ownerEmail(lead) || '—' },
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

function downloadFullRegisterLead(lead: AssetLead, reportKind: PdfReportKind = 'full'): boolean {
  const snapshot = registerLeadSnapshot(lead);
  const allRegisterAssets = registerLeadAssets(lead);
  const reportAssets = filterRegisterLeadAssetsByPdfReportKind(allRegisterAssets, reportKind);
  const reportOption = getPdfReportOption(reportKind);
  const isFullReport = reportKind === 'full';
  const snapshotRegisterValue = assetValue(lead);
  const reportValue = isFullReport ? snapshotRegisterValue : sumSnapshotAssetValues(reportAssets);
  const reportValueInclVat = isFullReport
    ? asNumber(snapshot?.totalValueInclVat) ?? Math.round(reportValue * 1.15)
    : Math.round(reportValue * 1.15);
  const snapshotReplacementValue = asNumber(snapshot?.totalReplacementValue ?? snapshot?.replacementValue);
  const reportReplacementValue = isFullReport && snapshotReplacementValue !== null
    ? Math.round(snapshotReplacementValue)
    : sumSnapshotReplacementValues(reportAssets);
  const reportReplacementValueInclVat = isFullReport
    ? asNumber(snapshot?.totalReplacementValueInclVat ?? snapshot?.replacementValueInclVat) ?? Math.round(reportReplacementValue * 1.15)
    : Math.round(reportReplacementValue * 1.15);
  const aim4priceStats = calculateRegisterLeadStats(
    reportAssets,
    (asset) => asText(asset.selectedMethod) === 'aim4price' || asNumber(asset.aim4priceValueExVat) !== null,
  );
  const manualAssetStats = calculateRegisterLeadStats(reportAssets, (asset) => asText(asset.selectedMethod) === 'manual');
  const financedStats = calculateRegisterLeadStats(reportAssets, (asset) => asBoolean(asset.isFinanced));
  const insuredStats = calculateRegisterLeadStats(reportAssets, (asset) => asBoolean(asset.isInsured));
  const licensedStats = calculateRegisterLeadStats(reportAssets, (asset) => asBoolean(asset.isLicensed));

  const rows = reportAssets.map((asset) => {
    const value = snapshotAssetValue(asset);
    const replacementPrice = snapshotReplacementPrice(asset);
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
      replacementPrice: replacementPrice === null ? '—' : formatCurrency(replacementPrice),
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
      documents: leadResponseDocumentRowValue(lead),
      updated: updated !== '—' ? `Updated ${updated}` : '—',
      photoUrl: asText(asset.photoUrl) || null,
    };
  });

  return openAssetRegisterSummaryPrint({
    logoUrl: asText(snapshot?.logoUrl),
    generatedAt: formatDate(new Date().toISOString()),
    reportTitle: `${reportOption.label} Report`,
    reportSubtitle: 'Aim4price full asset register lead',
    valueLabel: isFullReport ? 'Register Value' : 'Filtered Register Value',
    assetSectionTitle: reportOption.sectionTitle,
    emptyStateMessage: reportOption.emptyLabel,
    ownerName: lead.ownerBusinessName || ownerDisplayName(lead),
    ownerMeta: [ownerDisplayName(lead), ownerPhone(lead), ownerEmail(lead), ownerLocation(lead)].filter(Boolean).join(' • '),
    intro: reportOption.intro,
    registerValue: formatCurrency(reportValue),
    registerValueNote: `VAT excluded · ${formatCurrency(reportValueInclVat)} incl. VAT`,
    ownerRows: [
      { label: 'Business', value: lead.ownerBusinessName || '—' },
      { label: 'Contact', value: ownerDisplayName(lead) },
      { label: 'Phone', value: ownerPhone(lead) || '—' },
      { label: 'Business email', value: ownerEmail(lead) || '—' },
      { label: 'Location', value: ownerLocation(lead) },
      ...(lead.ownerMessage ? [{ label: 'Owner message', value: lead.ownerMessage }] : []),
      { label: 'Response document attached', value: leadResponseDocumentDetail(lead) },
    ],
    notes: buildLeadPartnerNoteRows(lead),
    stats: [
      { label: 'Assets', value: String(reportAssets.length), note: isFullReport ? 'Saved register items.' : reportOption.description },
      { label: 'Value ex VAT', value: formatCurrency(reportValue), note: 'Filtered report total excluding VAT.' },
      { label: 'Value incl VAT', value: formatCurrency(reportValueInclVat), note: 'Filtered report total including 15% VAT.' },
      { label: 'Replacement ex VAT', value: formatCurrency(reportReplacementValue), note: `${formatCurrency(reportReplacementValueInclVat)} incl. VAT.` },
      { label: 'Aim4price values', value: String(aim4priceStats.count), note: `${formatCurrency(aim4priceStats.value)} total value.` },
      { label: 'Manual assets', value: String(manualAssetStats.count), note: `${formatCurrency(manualAssetStats.value)} entered manually.` },
      { label: 'Insured assets', value: String(insuredStats.count), note: `${formatCurrency(insuredStats.value)} marked insured.` },
      { label: 'Financed assets', value: String(financedStats.count), note: `${formatCurrency(financedStats.value)} marked financed.` },
      { label: 'Licensed assets', value: String(licensedStats.count), note: `${formatCurrency(licensedStats.value)} marked licensed.` },
    ],
    rows,
    footerNote: "This PDF is generated from a once-off full-register lead snapshot. It does not provide live access to the owner's asset register.",
  });
}

function downloadLeadAsset(lead: AssetLead, reportKind: PdfReportKind = 'full'): boolean {
  if (isFullRegisterLead(lead)) {
    return downloadFullRegisterLead(lead, reportKind);
  }

  const value = assetValue(lead);
  const replacementPrice = snapshotReplacementPrice(lead.assetSnapshot);
  const photos = assetPhotos(lead);
  const leadReportNotes: ReportKeyValue[] = [
    ...(lead.ownerMessage ? [{ label: 'Owner message', value: lead.ownerMessage }] : []),
    ...buildLeadPartnerNoteRows(lead),
    { label: 'Response document attached', value: leadResponseDocumentDetail(lead) },
  ];
  const didOpen = openAssetSheetPrint({
    logoUrl: asText(lead.assetSnapshot.logoUrl),
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
      { label: 'Replacement price', value: replacementPrice === null ? '—' : formatCurrency(replacementPrice) },
      { label: 'Serial number', value: asText(lead.assetSnapshot.serialNumber) || '—' },
      { label: 'Financed', value: asBoolean(lead.assetSnapshot.isFinanced) ? 'Yes' : 'No' },
      { label: 'Insured', value: asBoolean(lead.assetSnapshot.isInsured) ? 'Yes' : 'No' },
      { label: 'Response document attached', value: leadResponseDocumentAttachedValue(lead) },
    ],
    notes: leadReportNotes,
    methodCards: buildMethodCards(lead),
    contactRows: [
      { label: 'Owner', value: ownerDisplayName(lead) },
      { label: 'Phone', value: ownerPhone(lead) || '—' },
      { label: 'Business email', value: ownerEmail(lead) || '—' },
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
    formatDate(lead.createdAtIso),
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
  const [accountInboxTitle, setAccountInboxTitle] = useState('LEADS INBOX LOADING...');
  const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [openFilterDropdown, setOpenFilterDropdown] = useState<FilterDropdownKey | null>(null);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [leadPhotoIndexes, setLeadPhotoIndexes] = useState<Record<string, number>>({});
  const [managedLead, setManagedLead] = useState<AssetLead | null>(null);
  const [emailLead, setEmailLead] = useState<AssetLead | null>(null);
  const [emailSubjectDraft, setEmailSubjectDraft] = useState('');
  const [emailBodyDraft, setEmailBodyDraft] = useState('');
  const [isEmailDraftCopied, setIsEmailDraftCopied] = useState(false);
  const [reportLead, setReportLead] = useState<AssetLead | null>(null);
  const [leadReportStep, setLeadReportStep] = useState<LeadReportStep>('format');
  const [leadPdfReportSelection, setLeadPdfReportSelection] = useState<PdfReportKind | ''>('');
  const [isDownloadingLeadReport, setIsDownloadingLeadReport] = useState(false);
  const [noteLead, setNoteLead] = useState<AssetLead | null>(null);
  const [deleteLeadTarget, setDeleteLeadTarget] = useState<AssetLead | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteAttachmentFile, setNoteAttachmentFile] = useState<File | null>(null);
  const [isNoteAttachmentDragging, setIsNoteAttachmentDragging] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isDeletingLead, setIsDeletingLead] = useState(false);
  const [markingLeadDoneId, setMarkingLeadDoneId] = useState<string | null>(null);
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

  const yearFilterOptions = useMemo<LeadFilterOption[]>(
    () => [
      { value: 'all', label: 'All years' },
      ...availableYears.map((year) => ({ value: year, label: year })),
    ],
    [availableYears],
  );

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
      if (statusFilter === 'new' && !isNewLead(lead)) return false;
      if (statusFilter === 'opened' && isNewLead(lead)) return false;

      if (!query) return true;
      return searchTextForLead(lead).includes(query);
    });
  }, [periodLeads, searchTerm, statusFilter]);

  const newLeadCount = useMemo(() => filteredLeads.filter((lead) => isNewLead(lead)).length, [filteredLeads]);
  const totalLeadPages = Math.max(1, Math.ceil(filteredLeads.length / LEADS_PER_PAGE));
  const visibleLeadPage = Math.min(Math.max(currentPage, 1), totalLeadPages);
  const paginatedLeads = useMemo(() => {
    const startIndex = (visibleLeadPage - 1) * LEADS_PER_PAGE;
    return filteredLeads.slice(startIndex, startIndex + LEADS_PER_PAGE);
  }, [filteredLeads, visibleLeadPage]);
  const leadRangeStart = filteredLeads.length ? (visibleLeadPage - 1) * LEADS_PER_PAGE + 1 : 0;
  const leadRangeEnd = Math.min(visibleLeadPage * LEADS_PER_PAGE, filteredLeads.length);
  const leadPaginationPages = useMemo(() => {
    const maxButtons = Math.min(PAGINATION_WINDOW, totalLeadPages);
    const halfWindow = Math.floor(maxButtons / 2);
    let startPage = Math.max(1, visibleLeadPage - halfWindow);
    const endOverflow = startPage + maxButtons - 1 - totalLeadPages;

    if (endOverflow > 0) {
      startPage = Math.max(1, startPage - endOverflow);
    }

    return Array.from({ length: maxButtons }, (_item, index) => startPage + index);
  }, [totalLeadPages, visibleLeadPage]);
  const hasActiveLeadFilter = monthFilter !== 'all' || yearFilter !== 'all' || statusFilter !== 'all';
  const activeLeadFilterLabel = useMemo(() => {
    const labels: string[] = [];
    const selectedMonth = MONTH_OPTIONS.find((option) => option.value === monthFilter);

    if (selectedMonth && selectedMonth.value !== 'all') labels.push(selectedMonth.label);
    if (yearFilter !== 'all') labels.push(yearFilter);
    if (statusFilter === 'new') labels.push('New leads');
    if (statusFilter === 'opened') labels.push('Opened leads');

    if (!labels.length) return 'Filter';
    if (labels.length === 1) return labels[0];
    return `${labels.length} filters`;
  }, [monthFilter, statusFilter, yearFilter]);

  const loadData = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);

    try {
      const [sessionResponse, leadsResponse, profileResponse] = await Promise.all([
        fetch('/api/me', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/asset-leads', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/account-profile', { cache: 'no-store', credentials: 'include' }),
      ]);

      const sessionData = (await sessionResponse.json()) as SessionResponse;
      const leadsData = (await leadsResponse.json()) as LeadsResponse;
      const profileData = profileResponse.ok ? ((await profileResponse.json()) as AccountProfileResponse) : null;

      if (!sessionResponse.ok || !sessionData.signedIn || !sessionData.user) {
        throw new Error('You must be signed in.');
      }

      if (!leadsResponse.ok || !leadsData.ok || !leadsData.leads) {
        throw new Error(leadsData.error ?? 'Failed to load leads.');
      }

      const profile = profileData?.profile;
      const accountTitle = profile?.businessName || profile?.displayName || profile?.name || sessionData.user.name;

      setSessionUserId(sessionData.user.id);
      setAccountInboxTitle(formatInboxTitle(accountTitle));
      setLeads(leadsData.leads);
      return true;
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load leads.' });
      return false;
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

  useEffect(() => {
    setCurrentPage(1);
  }, [monthFilter, searchTerm, statusFilter, yearFilter]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(Math.max(page, 1), totalLeadPages));
  }, [totalLeadPages]);

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

  async function openLead(leadToOpen: AssetLead) {
    setNotice(null);
    setOpenLeadId(leadToOpen.id);

    if (!isNewLead(leadToOpen)) return;

    const viewedAtIso = new Date().toISOString();

    setLeads((current) =>
      current.map((lead) =>
        lead.id === leadToOpen.id
          ? {
              ...lead,
              status: 'viewed',
              viewedAtIso: lead.viewedAtIso ?? viewedAtIso,
              updatedAtIso: viewedAtIso,
            }
          : lead,
      ),
    );

    try {
      const response = await fetch(`/api/asset-leads/${encodeURIComponent(leadToOpen.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'viewed' }),
      });
      const data = (await response.json()) as LeadsResponse;

      if (!response.ok || !data.ok || !data.lead) {
        throw new Error(data.error ?? 'Failed to mark lead as opened.');
      }

      const updatedLead = data.lead;
      setLeads((current) => current.map((lead) => (lead.id === updatedLead.id ? updatedLead : lead)));
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Lead opened, but it could not be marked as opened.',
      });
    }
  }

  async function refreshLeads() {
    if (isLoading) return;

    setNotice(null);
    const didRefresh = await loadData();

    if (didRefresh) {
      setNotice({ tone: 'success', message: 'Leads refreshed.' });
    }
  }

  async function toggleLeadDone(leadToToggle: AssetLead) {
    if (markingLeadDoneId) return;

    const isCurrentlyDone = isCompletedLead(leadToToggle);
    const nextStatus: LeadStatus = isCurrentlyDone ? 'viewed' : 'quoted';
    const updatedAtIso = new Date().toISOString();
    const optimisticLead: AssetLead = {
      ...leadToToggle,
      status: nextStatus,
      viewedAtIso: leadToToggle.viewedAtIso ?? updatedAtIso,
      updatedAtIso,
      ...(nextStatus === 'quoted' ? { quotedAtIso: leadToToggle.quotedAtIso ?? updatedAtIso } : {}),
    };

    setNotice(null);
    setMarkingLeadDoneId(leadToToggle.id);
    setLeads((current) => current.map((lead) => (lead.id === leadToToggle.id ? optimisticLead : lead)));

    try {
      const response = await fetch(`/api/asset-leads/${encodeURIComponent(leadToToggle.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = (await response.json()) as LeadsResponse;

      if (!response.ok || !data.ok || !data.lead) {
        throw new Error(data.error ?? (isCurrentlyDone ? 'Failed to mark lead as not done.' : 'Failed to mark lead as done.'));
      }

      const updatedLead = data.lead;
      setLeads((current) => current.map((lead) => (lead.id === updatedLead.id ? updatedLead : lead)));
      setNotice({ tone: 'success', message: isCurrentlyDone ? 'Lead moved back to Mark done.' : 'Lead marked done.' });
    } catch (error) {
      setLeads((current) => current.map((lead) => (lead.id === leadToToggle.id ? leadToToggle : lead)));
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : isCurrentlyDone ? 'Failed to mark lead as not done.' : 'Failed to mark lead as done.',
      });
    } finally {
      setMarkingLeadDoneId((current) => (current === leadToToggle.id ? null : current));
    }
  }

  function resetLeadFilters() {
    setMonthFilter('all');
    setYearFilter('all');
    setStatusFilter('all');
    setOpenFilterDropdown(null);
  }

  function openLeadFilterModal() {
    setOpenFilterDropdown(null);
    setIsFilterModalOpen(true);
  }

  function closeLeadFilterModal() {
    setOpenFilterDropdown(null);
    setIsFilterModalOpen(false);
  }

  function handleDownloadLead(lead: AssetLead, reportKind: PdfReportKind = 'full'): boolean {
    const didOpen = downloadLeadAsset(lead, reportKind);
    if (!didOpen) {
      setNotice({ tone: 'error', message: 'Enable pop-ups to download or print the lead report PDF.' });
    }

    return didOpen;
  }

  function openLeadReportModal(lead: AssetLead) {
    setNotice(null);
    setReportLead(null);
    setLeadReportStep('format');
    setLeadPdfReportSelection('');
    setManagedLead(null);
    void handleLeadPdfReportDownload(lead, 'full');
  }

  function closeLeadReportModal() {
    if (isDownloadingLeadReport) return;
    setReportLead(null);
    setLeadReportStep('format');
    setLeadPdfReportSelection('');
  }

  function closeLeadPdfReportChooser() {
    if (isDownloadingLeadReport) return;
    setLeadReportStep('format');
    setLeadPdfReportSelection('');
  }

  function handleLeadPdfReportSelectionChange(event: ChangeEvent<HTMLSelectElement>) {
    if (!reportLead) return;

    const nextReportKind = event.target.value;
    if (!isPdfReportKind(nextReportKind)) return;

    setLeadPdfReportSelection(nextReportKind);
    void handleLeadPdfReportDownload(reportLead, nextReportKind);
  }

  async function handleLeadPdfReportDownload(lead: AssetLead, reportKind: PdfReportKind = 'full') {
    if (isDownloadingLeadReport) return;

    const reportOption = getPdfReportOption(reportKind);
    const didOpen = handleDownloadLead(lead, reportKind);

    if (didOpen) {
      setReportLead(null);
      setLeadReportStep('format');
      setLeadPdfReportSelection('');
      setNotice({ tone: 'success', message: `${reportOption.label} PDF opened.` });
    } else {
      setLeadPdfReportSelection('');
    }
  }

  async function handleConfirmLeadReportDownload() {
    if (!reportLead || isDownloadingLeadReport) return;

    if (isFullRegisterLead(reportLead)) {
      setLeadReportStep('pdf-report');
      setLeadPdfReportSelection('');
      return;
    }

    await handleLeadPdfReportDownload(reportLead, 'full');
  }

  function resetLeadNoteDraft() {
    setNoteDraft('');
    setNoteAttachmentFile(null);
    setIsNoteAttachmentDragging(false);
  }

  function openNoteModal(lead: AssetLead) {
    setNotice(null);
    setNoteLead(lead);
    resetLeadNoteDraft();
  }

  function closeNoteModal() {
    if (isSavingNote) return;
    setNoteLead(null);
    resetLeadNoteDraft();
  }

  function handleLeadNotePdfFile(file: File | null) {
    if (!file) return;

    if (!isPdfFile(file)) {
      setNoteAttachmentFile(null);
      setNotice({ tone: 'error', message: 'Only PDF quote files can be attached to a lead note.' });
      return;
    }

    if (file.size > MAX_LEAD_NOTE_PDF_BYTES) {
      setNoteAttachmentFile(null);
      setNotice({ tone: 'error', message: 'The PDF quote must be 12 MB or smaller.' });
      return;
    }

    setNotice(null);
    setNoteAttachmentFile(file);
  }

  function handleLeadNoteAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    handleLeadNotePdfFile(event.target.files?.item(0) ?? null);
    event.target.value = '';
  }

  function handleLeadNoteAttachmentDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsNoteAttachmentDragging(false);
    handleLeadNotePdfFile(event.dataTransfer.files.item(0) ?? null);
  }

  async function submitLeadNote() {
    if (!noteLead) return;

    const noteText = noteDraft.trim();
    if (!noteText && !noteAttachmentFile) {
      setNotice({ tone: 'error', message: 'Write a note or attach a PDF quote before saving.' });
      return;
    }

    const formData = new FormData();
    formData.append('note', noteText);

    if (noteAttachmentFile) {
      formData.append('attachment', noteAttachmentFile);
    }

    setIsSavingNote(true);

    try {
      const response = await fetch(`/api/asset-leads/${encodeURIComponent(noteLead.id)}/notes`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = (await response.json()) as PartnerNoteResponse;

      if (!response.ok || !data.ok || !data.note) {
        throw new Error(data.error ?? 'Failed to save note.');
      }

      const savedNote = data.note;
      const attachment = savedNote.attachment ?? null;
      const hasAttachment = Boolean(attachment ?? noteAttachmentFile);

      setLeads((current) =>
        current.map((lead) => {
          if (lead.id !== noteLead.id) return lead;

          const currentNotes = leadPartnerNotes(lead).filter((note) => note.id !== savedNote.id);

          return {
            ...lead,
            partnerNotes: [savedNote, ...currentNotes],
            ...(attachment
              ? {
                  partnerNoteAttachmentCount: leadPartnerPdfAttachmentCount(lead) + 1,
                  latestPartnerNoteAttachmentFileName: attachment.fileName,
                  latestPartnerNoteAttachmentByteSize: attachment.byteSize,
                  latestPartnerNoteAttachmentCreatedAtIso: savedNote.createdAtIso ?? new Date().toISOString(),
                }
              : {}),
          };
        }),
      );

      setNotice({ tone: 'success', message: hasAttachment ? 'Note and PDF quote saved on the lead asset.' : 'Note saved on the lead asset.' });
      setNoteLead(null);
      resetLeadNoteDraft();
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

  function buildLeadEmailSubject(lead: AssetLead): string {
    return `Aim4price lead: ${leadFollowUpSubject(lead)}`;
  }

  function buildLeadEmailBody(lead: AssetLead): string {
    return `Good day ${ownerDisplayName(lead)},\n\nI received your Aim4price ${formatLeadDisplayType(lead).toLowerCase()} for ${leadFollowUpSubject(lead)}.\n\nKind regards`;
  }

  function openEmail(lead: AssetLead) {
    const email = leadEmailRecipient(lead);
    if (!email) {
      setNotice({ tone: 'error', message: 'No client email address is saved on this lead.' });
      return;
    }

    setNotice(null);
    setEmailLead(lead);
    setEmailSubjectDraft(buildLeadEmailSubject(lead));
    setEmailBodyDraft(buildLeadEmailBody(lead));
    setIsEmailDraftCopied(false);
    setManagedLead(null);
  }

  function closeEmailModal() {
    setEmailLead(null);
    setEmailSubjectDraft('');
    setEmailBodyDraft('');
    setIsEmailDraftCopied(false);
  }

  function activeEmailRecipient(): string {
    return emailLead ? leadEmailRecipient(emailLead) : '';
  }

  function activeMailtoUrl(): string {
    const email = activeEmailRecipient();
    if (!email) return '';

    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(emailSubjectDraft)}&body=${encodeURIComponent(emailBodyDraft)}`;
  }

  function activeGmailComposeUrl(): string {
    const email = activeEmailRecipient();
    if (!email) return '';

    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(emailSubjectDraft)}&body=${encodeURIComponent(emailBodyDraft)}`;
  }

  function activeEmailDraftText(): string {
    const email = activeEmailRecipient();
    return [`To: ${email}`, `Subject: ${emailSubjectDraft}`, '', emailBodyDraft].join('\n');
  }

  function openDefaultEmailClient() {
    const mailtoUrl = activeMailtoUrl();
    if (!mailtoUrl) {
      setNotice({ tone: 'error', message: 'No client email address is saved on this lead.' });
      return;
    }

    window.location.href = mailtoUrl;
  }

  function openGmailCompose() {
    const gmailUrl = activeGmailComposeUrl();
    if (!gmailUrl) {
      setNotice({ tone: 'error', message: 'No client email address is saved on this lead.' });
      return;
    }

    const popup = window.open(gmailUrl, 'aim4priceLeadEmail', 'width=980,height=720');
    if (!popup) {
      setNotice({ tone: 'error', message: 'Allow pop-ups, or copy the email draft and paste it into your email app.' });
      return;
    }

    popup.opener = null;
    popup.focus();
  }

  async function copyEmailDraft() {
    const draftText = activeEmailDraftText();

    try {
      await navigator.clipboard.writeText(draftText);
      setIsEmailDraftCopied(true);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = draftText;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand('copy');
        setIsEmailDraftCopied(true);
      } finally {
        document.body.removeChild(textarea);
      }
    }
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

  function renderOwnerMessageBlock(lead: AssetLead) {
    const sharedPhotos = leadSharedPhotoUrls(lead);

    if (!lead.ownerMessage && !sharedPhotos.length) return null;

    return (
      <div className={assetStyles.noteStack}>
        <div className={`${assetStyles.note} ${sharedPhotos.length ? styles.ownerSharedPhotoNote : ''}`}>
          <strong>{lead.ownerMessage ? 'Owner message' : 'Attached photos'}</strong>
          {lead.ownerMessage ? <p>{lead.ownerMessage}</p> : null}

          {sharedPhotos.length ? (
            <div className={styles.ownerSharedPhotoGrid} aria-label="Attached owner photos">
              {sharedPhotos.map((url, index) => (
                <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className={styles.ownerSharedPhotoLink}>
                  <img src={url} alt={`Owner attached photo ${index + 1}`} />
                </a>
              ))}
            </div>
          ) : null}
        </div>
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
    const replacementValue = asNumber(snapshot?.totalReplacementValue ?? snapshot?.replacementValue) ?? sumSnapshotReplacementValues(registerAssets);

    return (
      <div className={`${assetStyles.assetBody} ${styles.fullRegisterLeadBody}`} id={`lead-panel-${lead.id}`}>
        <button type="button" className={styles.fullRegisterPdfPanel} onClick={() => openLeadReportModal(lead)}>
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
            {renderRegisterStatRow('Replacement value', formatCurrency(replacementValue))}
            {renderRegisterStatRow('Assets licensed', licensedCount)}
            {renderRegisterStatRow('Assets financed', financedCount)}
            {renderRegisterStatRow('Aim4price assets', aim4priceCount)}
            {renderRegisterStatRow('Assets insured', insuredCount)}
            {renderRegisterStatRow('Manual assets', manualAssetCount)}
          </div>
        </div>

        {renderOwnerMessageBlock(lead)}
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
    const replacementPrice = snapshotReplacementPrice(lead.assetSnapshot);

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

          <div className={assetStyles.assetReplacementPriceBubble}>
            <span>Replacement Price</span>
            <strong>{replacementPrice === null ? 'Not set' : formatCurrency(replacementPrice)}</strong>
            <small>Excl. VAT</small>
          </div>

          {renderOwnerMessageBlock(lead)}
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
            <div className={`${assetStyles.registerTitleBlock} ${styles.leadsHeroTitleBlock}`}>
              <h1>{accountInboxTitle}</h1>
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
                placeholder="Search by business, asset or lead date"
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

            <div className={styles.leadToolbarActions}>
              <button
                type="button"
                className={`${assetStyles.secondaryButton} ${assetStyles.filterTriggerButton} ${styles.leadFilterButton} ${hasActiveLeadFilter ? assetStyles.filterTriggerButtonActive : ''}`}
                onClick={openLeadFilterModal}
                disabled={isLoading}
              >
                <FilterIcon className={assetStyles.buttonIcon} />
                <span>{activeLeadFilterLabel}</span>
                <ChevronDownIcon className={assetStyles.filterChevron} />
              </button>

              <button
                type="button"
                className={`${assetStyles.secondaryButton} ${styles.leadRefreshButton}`}
                onClick={() => void refreshLeads()}
                disabled={isLoading}
              >
                <RefreshIcon className={`${assetStyles.buttonIcon} ${isLoading ? styles.leadRefreshIconActive : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>


          {!isLoading && !filteredLeads.length ? (
            <div className={assetStyles.emptyState}>No leads match this search or filter.</div>
          ) : null}

          {!isLoading && filteredLeads.length ? (
            <div className={styles.leadStack}>
              {paginatedLeads.map((lead) => {
                const isLeadOpen = openLeadId === lead.id;
                const isLeadNew = isNewLead(lead);
                const isLeadDone = isCompletedLead(lead);
                const isMarkingThisLeadDone = markingLeadDoneId === lead.id;

                return (
                  <article key={lead.id} className={`${styles.leadThread} ${isLeadNew ? styles.leadThreadNew : ''} ${isLeadDone ? styles.leadThreadDone : ''} ${isLeadOpen ? styles.leadThreadOpen : ''}`}>
                    <div className={styles.clientPanel}>
                      <div className={styles.clientPanelHeader}>
                        <div className={styles.clientIdentity}>
                          <span className={styles.clientKicker}>Received {formatDate(lead.createdAtIso)}</span>
                          <div className={styles.leadCardTitleRow}>
                            <h3>{lead.ownerBusinessName || ownerDisplayName(lead)}</h3>
                            {isLeadNew ? <span className={`${styles.leadStatusBadge} ${styles.leadStatusBadgeNew}`}>New</span> : null}
                            {isLeadDone ? <span className={`${styles.leadStatusBadge} ${styles.leadStatusBadgeDone}`}>Done</span> : null}
                          </div>
                        </div>

                        <div className={styles.clientDecisionArea}>
                          <div className={styles.clientActionRow}>
                            <button
                              type="button"
                              className={`${assetStyles.secondaryButton} ${isLeadDone ? styles.doneLeadPill : styles.markDoneLeadButton}`}
                              onClick={() => void toggleLeadDone(lead)}
                              disabled={Boolean(markingLeadDoneId)}
                              aria-pressed={isLeadDone}
                              title={isLeadDone ? 'Click to move this lead back to Mark done' : 'Mark this lead as done'}
                            >
                              <CheckIcon className={assetStyles.buttonIcon} />
                              <span>{isMarkingThisLeadDone ? 'Updating...' : isLeadDone ? 'Done' : 'Mark done'}</span>
                            </button>

                            {isLeadOpen ? (
                              <button
                                type="button"
                                className={`${assetStyles.secondaryButton} ${styles.closeLeadButton}`}
                                onClick={() => {
                                  setOpenLeadId(null);
                                }}
                              >
                                Close
                              </button>
                            ) : (
                              <>
                                <button type="button" className={`${assetStyles.secondaryButton} ${styles.deleteLeadButton}`} onClick={() => setDeleteLeadTarget(lead)}>
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  className={`${assetStyles.primaryButton} ${styles.openLeadButton}`}
                                  onClick={() => {
                                    void openLead(lead);
                                  }}
                                >
                                  Open
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {isLeadOpen ? (
                      <div className={`${assetStyles.assetCard} ${styles.leadAssetCard} ${isFullRegisterLead(lead) ? styles.fullRegisterLeadCard : ''} ${assetStyles.assetCardExpanded}`}>
                        <div className={`${assetStyles.assetHeader} ${styles.leadAssetHeader}`}>
                          <div className={assetStyles.assetTitleBlock}>
                            <h2>{assetTitle(lead)}</h2>
                            <p>{leadAssetMeta(lead)}</p>
                            <div className={assetStyles.assetMetaRow}>
                              <span className={assetStyles.assetValueMethodLabel}>{isFullRegisterLead(lead) ? 'Register' : methodLabel(lead.assetSnapshot.selectedMethod)} value</span>
                              <span className={assetStyles.assetSavedDateLabel}>Updated {formatDate(asText(lead.assetSnapshot.updatedAtIso) || lead.updatedAtIso)}</span>
                            </div>
                          </div>

                          <div className={`${assetStyles.assetHeaderAside} ${styles.leadAssetHeaderAside}`}>
                            <div className={`${assetStyles.valueBlock} ${styles.leadValueBlock}`}>
                              <strong>{formatCurrency(assetValue(lead))}</strong>
                              <span>Excl. VAT</span>
                            </div>

                            <div className={`${assetStyles.assetHeaderActions} ${styles.leadAssetHeaderActions}`}>
                              <button type="button" className={`${assetStyles.optionsButton} ${assetStyles.sharedNoteActionButton}`} onClick={() => openNoteModal(lead)}>
                                <NoteIcon className={assetStyles.buttonIcon} />
                                <span>Leave note</span>
                              </button>

                              <button type="button" className={`${assetStyles.optionsButton} ${styles.leadManageButton}`} onClick={() => setManagedLead(lead)}>
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

          {!isLoading && filteredLeads.length > LEADS_PER_PAGE ? (
            <nav className={styles.leadPagination} aria-label="Lead pagination">
              <div className={styles.leadPaginationSummary}>
                Showing <strong>{leadRangeStart}</strong>-<strong>{leadRangeEnd}</strong> of <strong>{filteredLeads.length}</strong> leads
              </div>

              <div className={styles.leadPaginationControls}>
                <button
                  type="button"
                  className={styles.leadPaginationButton}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={visibleLeadPage <= 1}
                  aria-label="Show previous leads page"
                >
                  <ChevronLeftIcon className={assetStyles.buttonIcon} />
                  <span>Previous</span>
                </button>

                <div className={styles.leadPaginationPages}>
                  {leadPaginationPages.map((page) => (
                    <button
                      type="button"
                      key={`lead-page-${page}`}
                      className={`${styles.leadPaginationPageButton} ${page === visibleLeadPage ? styles.leadPaginationPageButtonActive : ''}`}
                      onClick={() => setCurrentPage(page)}
                      aria-current={page === visibleLeadPage ? 'page' : undefined}
                      aria-label={`Show leads page ${page}`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className={styles.leadPaginationButton}
                  onClick={() => setCurrentPage((page) => Math.min(totalLeadPages, page + 1))}
                  disabled={visibleLeadPage >= totalLeadPages}
                  aria-label="Show next leads page"
                >
                  <span>Next</span>
                  <ChevronRightIcon className={assetStyles.buttonIcon} />
                </button>
              </div>
            </nav>
          ) : null}
        </section>
      </section>

      {isFilterModalOpen ? (
        <div className={assetStyles.modalOverlay}>
          <div className={assetStyles.modalBackdrop} onClick={closeLeadFilterModal} />

          <div className={`${assetStyles.modalCard} ${styles.leadFilterModal}`} role="dialog" aria-modal="true" aria-labelledby="lead-filter-title">
            <div className={assetStyles.modalHeader}>
              <div className={assetStyles.modalHeaderText}>
                <h3 id="lead-filter-title">Choose which leads to show.</h3>
                <p className={styles.leadFilterIntro}>Filter your inbox by the date the lead was received and the current lead status.</p>
              </div>

              <button type="button" className={assetStyles.modalCloseButton} onClick={closeLeadFilterModal} aria-label="Close filter modal">
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={styles.leadFilterForm}>
              <LeadFilterDropdown
                label="Month"
                dropdownKey="month"
                value={monthFilter}
                options={MONTH_OPTIONS}
                openDropdown={openFilterDropdown}
                onOpenChange={setOpenFilterDropdown}
                onChange={setMonthFilter}
              />

              <LeadFilterDropdown
                label="Year"
                dropdownKey="year"
                value={yearFilter}
                options={yearFilterOptions}
                openDropdown={openFilterDropdown}
                onOpenChange={setOpenFilterDropdown}
                onChange={setYearFilter}
              />

              <LeadFilterDropdown
                label="Status"
                dropdownKey="status"
                value={statusFilter}
                options={STATUS_FILTER_OPTIONS}
                openDropdown={openFilterDropdown}
                onOpenChange={setOpenFilterDropdown}
                onChange={(value) => setStatusFilter(value as LeadStatusFilter)}
              />
            </div>

            <div className={`${assetStyles.formActions} ${styles.leadFilterActions}`}>
              <button type="button" className={assetStyles.secondaryButton} onClick={resetLeadFilters} disabled={!hasActiveLeadFilter}>
                Reset filters
              </button>
              <button type="button" className={assetStyles.primaryButton} onClick={closeLeadFilterModal}>
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

                  <button type="button" className={assetStyles.optionActionButton} onClick={() => openLeadReportModal(managedLead)}>
                    <DownloadIcon className={assetStyles.buttonIcon} />
                    <span>
                      <strong>Download Report</strong>
                      <small>Download a PDF report for this lead.</small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={assetStyles.optionActionButton}
                    onClick={() => openEmail(managedLead)}
                    disabled={!leadEmailRecipient(managedLead)}
                    title={!leadEmailRecipient(managedLead) ? 'No client email address is saved on this lead.' : undefined}
                  >
                    <EmailIcon className={assetStyles.buttonIcon} />
                    <span>
                      <strong>Email client</strong>
                      <small>{leadEmailRecipient(managedLead) ? 'Open an email draft with asset context.' : 'No client email address saved.'}</small>
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

      {emailLead ? (
        <div className={assetStyles.modalOverlay}>
          <div className={assetStyles.modalBackdrop} onClick={closeEmailModal} />

          <div className={`${assetStyles.modalCard} ${styles.leadEmailModal}`} role="dialog" aria-modal="true" aria-labelledby="lead-email-title">
            <div className={assetStyles.modalHeader}>
              <div className={assetStyles.modalHeaderText}>
                <h3 id="lead-email-title">Email client</h3>
                <p>{assetTitle(emailLead)} · {ownerDisplayName(emailLead)}</p>
              </div>

              <button type="button" className={assetStyles.modalCloseButton} onClick={closeEmailModal} aria-label="Close email draft">
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={styles.leadEmailDraftPanel}>
              <div className={styles.leadEmailRecipientCard}>
                <span>To</span>
                <strong>{activeEmailRecipient()}</strong>
              </div>

              <label className={`${assetStyles.field} ${styles.leadEmailField}`}>
                <span>Subject</span>
                <input value={emailSubjectDraft} onChange={(event) => setEmailSubjectDraft(event.target.value)} autoFocus />
              </label>

              <label className={`${assetStyles.field} ${styles.leadEmailField}`}>
                <span>Message</span>
                <textarea value={emailBodyDraft} onChange={(event) => setEmailBodyDraft(event.target.value)} />
              </label>
            </div>

            <div className={styles.leadEmailActions}>
              <button type="button" className={assetStyles.secondaryButton} onClick={closeEmailModal}>
                Cancel
              </button>
              <button type="button" className={assetStyles.secondaryButton} onClick={() => void copyEmailDraft()}>
                {isEmailDraftCopied ? 'Copied' : 'Copy draft'}
              </button>
              <button type="button" className={assetStyles.secondaryButton} onClick={openDefaultEmailClient}>
                Open email app
              </button>
              <button type="button" className={assetStyles.primaryButton} onClick={openGmailCompose}>
                Open Gmail
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reportLead ? (
        <div className={assetStyles.modalOverlay}>
          <div className={assetStyles.modalBackdrop} onClick={closeLeadReportModal} />

          <div className={`${assetStyles.modalCard} ${assetStyles.exportModal} ${styles.leadReportModal}`} role="dialog" aria-modal="true" aria-labelledby="lead-report-export-title">
            <div className={`${assetStyles.modalHeader} ${assetStyles.exportModalHeader}`}>
              <div className={assetStyles.modalHeaderText}>
                <h3 id="lead-report-export-title">Download lead report</h3>
              </div>

              <button type="button" className={assetStyles.modalCloseButton} onClick={closeLeadReportModal} aria-label="Close report download options" disabled={isDownloadingLeadReport}>
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={`${assetStyles.modalScrollBody} ${assetStyles.exportModalScrollBody}`}>
              <div className={assetStyles.exportModalBody}>
                {leadReportStep === 'format' ? (
                  <>
                    <div className={assetStyles.exportChoices}>
                      <div className={`${assetStyles.exportOption} ${assetStyles.exportOptionActive}`}>
                        <div className={assetStyles.exportOptionTop}>
                          <span className={assetStyles.exportGraphic}>
                            <ExportGraphic src="/brand/pdf.png" alt="PDF export" icon={<PdfIcon className={assetStyles.exportOptionIcon} />} />
                          </span>

                          <div className={assetStyles.exportOptionTitleBlock}>
                            <strong>PDF summary</strong>
                            <span className={assetStyles.exportOptionStatus}>Only available format</span>
                          </div>
                        </div>

                        <ul className={assetStyles.exportFeatureList}>
                          <li>PDF report for this lead only</li>
                          <li>No XLSX lead export</li>
                          <li>No full-register spreadsheet handover</li>
                        </ul>
                      </div>
                    </div>

                    <div className={`${assetStyles.formActions} ${assetStyles.exportActions}`}>
                      <button type="button" className={assetStyles.primaryButton} onClick={() => void handleConfirmLeadReportDownload()} disabled={isDownloadingLeadReport}>
                        <ChevronRightIcon className={assetStyles.buttonIcon} />
                        <span>{isDownloadingLeadReport ? 'Preparing PDF...' : isFullRegisterLead(reportLead) ? 'Choose PDF report' : 'Open PDF'}</span>
                      </button>

                      <button type="button" className={assetStyles.secondaryButton} onClick={closeLeadReportModal} disabled={isDownloadingLeadReport}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={assetStyles.pdfReportDropdownPanel}>
                      <select
                        className={assetStyles.pdfReportDropdown}
                        value={leadPdfReportSelection}
                        onChange={handleLeadPdfReportSelectionChange}
                        disabled={isDownloadingLeadReport}
                        aria-label="Choose PDF summary option"
                      >
                        <option value="" disabled>Choose option</option>
                        {PDF_REPORT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDownIcon className={assetStyles.pdfReportDropdownIcon} />
                    </div>

                    <div className={`${assetStyles.formActions} ${assetStyles.exportActions}`}>
                      <button type="button" className={assetStyles.secondaryButton} onClick={closeLeadPdfReportChooser} disabled={isDownloadingLeadReport}>
                        Back
                      </button>

                      <button type="button" className={assetStyles.secondaryButton} onClick={closeLeadReportModal} disabled={isDownloadingLeadReport}>
                        Cancel
                      </button>
                    </div>
                  </>
                )}
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
            <div className={`${assetStyles.deleteConfirmContent} ${styles.leadDeleteContent}`}>
              <div className={`${assetStyles.deleteConfirmHeader} ${styles.leadDeleteHeader}`}>
                <div>
                  <h3 id="delete-lead-confirm-title">Delete lead?</h3>
                  <p id="delete-lead-confirm-copy">This removes the lead from your leads inbox.</p>
                </div>

                <button
                  type="button"
                  className={`${assetStyles.modalCloseButton} ${styles.leadDeleteCloseButton}`}
                  onClick={closeDeleteLeadModal}
                  aria-label="Close delete confirmation"
                  disabled={isDeletingLead}
                >
                  <CloseIcon className={assetStyles.buttonIcon} />
                </button>
              </div>

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
                placeholder="Example: Please find the attached quote PDF for this asset."
                autoFocus
              />
            </label>

            <label
              className={`${styles.leadNoteAttachmentDropzone} ${isNoteAttachmentDragging ? styles.leadNoteAttachmentDropzoneDragging : ''}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsNoteAttachmentDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsNoteAttachmentDragging(true);
              }}
              onDragLeave={() => setIsNoteAttachmentDragging(false)}
              onDrop={handleLeadNoteAttachmentDrop}
            >
              <input
                className={styles.leadNoteAttachmentInput}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleLeadNoteAttachmentChange}
                disabled={isSavingNote}
              />
              <span className={styles.leadNoteAttachmentEyebrow}>Optional PDF quote</span>
              <strong>Drop quote PDF here or click to upload</strong>
              <small>PDF only · maximum {formatByteSize(MAX_LEAD_NOTE_PDF_BYTES)}. The owner can open it from their Asset Register.</small>
            </label>

            {noteAttachmentFile ? (
              <div className={styles.leadNoteAttachmentPreview}>
                <div>
                  <strong>{noteAttachmentFile.name}</strong>
                  <span>{formatByteSize(noteAttachmentFile.size)}</span>
                </div>
                <button type="button" onClick={() => setNoteAttachmentFile(null)} disabled={isSavingNote}>
                  Remove PDF
                </button>
              </div>
            ) : null}

            <div className={`${assetStyles.formActions} ${assetStyles.sharedNoteActions} ${styles.leadNoteActions}`}>
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