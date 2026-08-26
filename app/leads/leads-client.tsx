'use client';

import DropdownOverlay from '../../components/DropdownOverlay';
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import AppHeader from '../../components/AppHeader';
import {
  WorkspaceTitlePanel,
  workspaceStyles,
} from '../../components/WorkspacePrimitives';
import { openAssetRegisterSummaryPrint, openAssetSheetPrint, type ReportKeyValue, type ReportMethodCard } from '../../lib/report-print';
import assetStyles from '../asset-register/page.module.css';
import styles from './page.module.css';
import dealerStyles from '../dealer/dealer.module.css';
import type { DealerAssetCorrectionRequest } from '../../lib/dealer-asset-corrections';

const AccountantRegisterReportsModal = dynamic(
  () => import('../../components/AccountantRegisterReportsModal'),
  { ssr: false },
);
const DealerAssetCorrectionEditor = dynamic(
  () => import('../../components/DealerAssetCorrectionEditor'),
  { ssr: false },
);
const DealerCostOfOwnershipReportModal = dynamic(
  () => import('../../components/DealerCostOfOwnershipReportModal'),
  { ssr: false },
);
const DealerMaintenanceReportModal = dynamic(
  () => import('../../components/DealerMaintenanceReportModal'),
  { ssr: false },
);
const DealerMaintenanceScheduleModal = dynamic(
  () => import('../../components/DealerMaintenanceScheduleModal'),
  { ssr: false },
);

type LeadType = 'finance' | 'insurance' | 'replacement_quote' | 'license_renewal';
type LeadStatus = 'sent' | 'viewed' | 'accepted' | 'quoted' | 'declined' | 'closed';
type NoticeTone = 'success' | 'error';
type LeadStatusFilter = 'all' | 'new' | 'open' | 'completed' | 'tracking';
type FilterDropdownKey = 'month' | 'year' | 'status';
type AssetStatusChoice = 'yes' | 'no' | 'unknown' | 'not_applicable';
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
  dealerCorrection?: DealerAssetCorrectionRequest | null;
  maintenanceAccess?: {
    accessId: string;
    ownerUserId: string;
    dealerUserId: string;
    assetId: string;
    isActive: true;
    hasMaintenanceRecords: boolean;
    permissions: {
      canViewLoggedProblems: boolean;
      canViewMaintenanceReports: boolean;
      canViewCostOfOwnership: boolean;
      canCreateMaintenanceSchedules: boolean;
      canUpdateSerial: boolean;
      canUpdateReplacementPrice: boolean;
    };
  } | null;
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

type PhotoModalState = {
  leadId: string;
  urls: string[];
  index: number;
  title: string;
};

type LeadAssetMedia = {
  id: string;
  title: string;
  publicAssetCode: string;
  photos: string[];
};

type LeadAssetMediaResponse = {
  ok: boolean;
  asset?: LeadAssetMedia;
  error?: string;
};

type LeadQrModalState = LeadAssetMedia & {
  leadId: string;
};

type PendingLeadPhoto = {
  id: string;
  file: File;
  previewUrl: string;
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
const MAX_LEAD_ASSET_PHOTOS = 12;
const MAX_LEAD_ASSET_PHOTO_BYTES = 5 * 1024 * 1024;
const LEAD_ASSET_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const LEADS_PER_PAGE = 10;
const PAGINATION_WINDOW = 5;

const STATUS_FILTER_OPTIONS: LeadFilterOption[] = [
  { value: 'all', label: 'All leads' },
  { value: 'new', label: 'New leads' },
  { value: 'open', label: 'Open leads' },
  { value: 'completed', label: 'Handled leads' },
  { value: 'tracking', label: 'Tracking requests' },
];

const ACCOUNTANT_STATUS_FILTER_OPTIONS: LeadFilterOption[] = [
  { value: 'all', label: 'All clients' },
  { value: 'new', label: 'New clients' },
  { value: 'open', label: 'Open clients' },
  { value: 'completed', label: 'Handled clients' },
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
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
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


function QrCodeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M14 14h2v2h-2v-2Zm4 0h2v4h-2v-4Zm-4 4h4v2h-4v-2Z" fill="currentColor" />
    </svg>
  );
}

function PhotosIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
      <path d="m5 17 4.5-4 3 2.5 2.5-2 4 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function PrintIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 14h10v6H7z" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function CostIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M9 8h6M9 12h6M9 16h3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

function DocumentIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 13h6M10 17h6" />
    </svg>
  );
}

function DeleteIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v5M14 11v5" strokeLinecap="round" />
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 5h16M7 12h10M10 19h4" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
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

function MaintenanceTrackingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M6.5 3v3M17.5 3v3M4 8.5h16" strokeLinecap="round" />
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="m8.5 14 2.1 2.1 4.9-5" strokeLinecap="round" strokeLinejoin="round" />
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
  nativeSelect?: boolean;
};

function LeadFilterDropdown({
  label,
  dropdownKey,
  value,
  options,
  openDropdown,
  onOpenChange,
  onChange,
  nativeSelect = false,
}: LeadFilterDropdownProps) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const isOpen = openDropdown === dropdownKey;

  if (nativeSelect) {
    return (
      <label className={`${assetStyles.field} ${styles.leadFilterField} ${styles.leadFilterNativeField}`}>
        <span>{label}</span>
        <select
          className={styles.leadFilterNativeSelect}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            onOpenChange(null);
          }}
          aria-label={label}
        >
          {options.map((option) => (
            <option key={`${dropdownKey}-native-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className={`${assetStyles.field} ${styles.leadFilterField} ${isOpen ? styles.leadFilterFieldOpen : ''}`}>
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
          <DropdownOverlay className={styles.leadFilterSelectMenu} role="listbox" aria-label={label}>
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
          </DropdownOverlay>
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

function formatMonthYear(value?: string | null): string {
  if (!value) return 'Not saved';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not saved';
  return new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric' }).format(parsed);
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
  if (value === 'license_renewal') return 'Licence renewal';
  return 'Dealer lead';
}

function formatStatus(value: LeadStatus): string {
  if (value === 'sent') return 'New';
  if (value === 'viewed' || value === 'accepted') return 'Opened';
  if (value === 'quoted') return 'Handled';
  if (value === 'declined') return 'Deleted';
  return 'Closed';
}

function isNewLead(lead: AssetLead): boolean {
  return lead.status === 'sent' && !lead.viewedAtIso;
}

function isCompletedLead(lead: AssetLead): boolean {
  return lead.status === 'quoted' || lead.status === 'closed';
}

function isTrackingLead(lead: AssetLead): boolean {
  const source = [
    asText(lead.includedSections.source),
    asText(lead.assetSnapshot.source),
    asText(lead.assetSnapshot.sharePurpose),
  ].join(' ').toLowerCase();

  return (
    asBoolean(lead.includedSections.maintenanceTrackingEnabled) ||
    asBoolean(lead.assetSnapshot.maintenanceTrackingEnabled) ||
    source.includes('tracking')
  );
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

function replacementSnapshotPatch(value: number): Record<string, number> {
  return {
    replacementPriceExVat: value,
    replacement_price_ex_vat: value,
    replacementPriceUsedExVat: value,
    replacement_price_used_ex_vat: value,
    userReplacementPriceExVat: value,
    user_replacement_price_ex_vat: value,
    officialReplacementPriceExVat: value,
    official_replacement_price_ex_vat: value,
    replacementPrice: value,
    replacement_price: value,
  };
}

function leadWithDealerCorrection(lead: AssetLead, correction: DealerAssetCorrectionRequest): AssetLead {
  const assetSnapshot = { ...lead.assetSnapshot };

  if (correction.serialNumberChanged && correction.proposedSerialNumber) {
    assetSnapshot.serialNumber = correction.proposedSerialNumber;
  }

  if (correction.replacementPriceChanged && correction.proposedReplacementPriceExVat !== null) {
    const replacementPatch = replacementSnapshotPatch(correction.proposedReplacementPriceExVat);
    Object.assign(assetSnapshot, replacementPatch);
    assetSnapshot.specsJson = {
      ...(asRecord(assetSnapshot.specsJson) ?? {}),
      ...replacementPatch,
    };
  }

  if (correction.licenseRenewalDateChanged && correction.proposedLicenseRenewalDate) {
    const renewalPatch = {
      licenseRenewalDate: correction.proposedLicenseRenewalDate,
      license_renewal_date: correction.proposedLicenseRenewalDate,
      licenceRenewalDate: correction.proposedLicenseRenewalDate,
      licence_renewal_date: correction.proposedLicenseRenewalDate,
    };
    Object.assign(assetSnapshot, renewalPatch);
    assetSnapshot.specsJson = {
      ...(asRecord(assetSnapshot.specsJson) ?? {}),
      ...renewalPatch,
    };
  }

  assetSnapshot.dealerCorrectionPending = true;
  assetSnapshot.dealerCorrectionUpdatedAtIso = correction.updatedAtIso;
  return {
    ...lead,
    assetSnapshot,
    dealerCorrection: correction,
  };
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

function normalizeLeadPhotoUrl(value: unknown): string {
  const url = asText(value).slice(0, 2000);

  if (!url) {
    return '';
  }

  if (url.startsWith('/api/asset-register/uploads/')) {
    return url.split('?')[0] ?? url;
  }

  if (url.startsWith('/') || /^https?:\/\//i.test(url)) {
    return url;
  }

  return '';
}

function leadPhotoUrlsFromArray(value: unknown): string[] {
  return asStringArray(value).map(normalizeLeadPhotoUrl).filter(Boolean);
}

function leadPhotoUrlsFromAttachments(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      const attachment = asRecord(entry);
      return normalizeLeadPhotoUrl(
        attachment?.url ?? attachment?.photoUrl ?? attachment?.photo_url ?? attachment?.href ?? entry,
      );
    })
    .filter(Boolean);
}

function mergeLeadPhotoUrls(photoUrlGroups: string[][], maxCount = 3): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const group of photoUrlGroups) {
    for (const url of group) {
      const normalizedUrl = normalizeLeadPhotoUrl(url);

      if (!normalizedUrl || seen.has(normalizedUrl)) {
        continue;
      }

      seen.add(normalizedUrl);
      urls.push(normalizedUrl);

      if (urls.length >= maxCount) {
        return urls;
      }
    }
  }

  return urls;
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
  if (isTrackingLead(lead)) return 'Asset tracking request';

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

  return asNumber(lead.assetSnapshot.value ?? lead.assetSnapshot.selectedValueExVat ?? lead.assetSnapshot.aim4priceValueExVat) ?? 0;
}

function leadSharedPhotoUrls(lead: AssetLead): string[] {
  return mergeLeadPhotoUrls([
    leadPhotoUrlsFromArray(lead.includedSections.ownerMessagePhotoUrls),
    leadPhotoUrlsFromArray(lead.includedSections.messageAttachmentPhotoUrls),
    leadPhotoUrlsFromArray(lead.includedSections.ownerSharePhotoUrls),
    leadPhotoUrlsFromArray(lead.includedSections.sharePhotoUrls),
    leadPhotoUrlsFromAttachments(lead.includedSections.ownerMessageAttachments),
    leadPhotoUrlsFromAttachments(lead.includedSections.messageAttachments),
    leadPhotoUrlsFromArray(lead.assetSnapshot.ownerMessagePhotoUrls),
    leadPhotoUrlsFromArray(lead.assetSnapshot.messageAttachmentPhotoUrls),
    leadPhotoUrlsFromArray(lead.assetSnapshot.ownerSharePhotoUrls),
    leadPhotoUrlsFromArray(lead.assetSnapshot.sharePhotoUrls),
    leadPhotoUrlsFromAttachments(lead.assetSnapshot.ownerMessageAttachments),
    leadPhotoUrlsFromAttachments(lead.assetSnapshot.messageAttachments),
  ]);
}

function assetPhotos(lead: AssetLead): string[] {
  if (isFullRegisterLead(lead)) {
    return [];
  }

  const sharedPhotoSet = new Set(leadSharedPhotoUrls(lead).map(normalizeLeadPhotoUrl));
  return asStringArray(lead.assetSnapshot.photos)
    .filter((url) => !sharedPhotoSet.has(normalizeLeadPhotoUrl(url)))
    .filter((url, index, urls) => urls.indexOf(url) === index);
}

function assetSpecs(lead: AssetLead): Record<string, unknown> | null {
  return asRecord(lead.assetSnapshot.specsJson) ?? asRecord(lead.assetSnapshot.specs) ?? asRecord(lead.assetSnapshot.specAnswers);
}

function leadLicenceRenewalDate(lead: AssetLead): string {
  const specs = assetSpecs(lead);
  return asText(
    lead.assetSnapshot.licenseRenewalDate ??
      lead.assetSnapshot.license_renewal_date ??
      lead.assetSnapshot.licenceRenewalDate ??
      lead.assetSnapshot.licence_renewal_date ??
      specs?.licenseRenewalDate ??
      specs?.license_renewal_date ??
      specs?.licenceRenewalDate ??
      specs?.licence_renewal_date,
  );
}

function leadLicenceRenewalDisplay(lead: AssetLead): string {
  const exactDate = leadLicenceRenewalDate(lead);
  if (exactDate) return formatMonthYear(exactDate);
  return asText(lead.assetSnapshot.renewalWindow) || 'Not saved';
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
  if (normalized === 'market') return 'Aim4price';
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
  return Math.round(asNumber(asset.value ?? asset.selectedValueExVat ?? asset.aim4priceValueExVat) ?? 0);
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

function snapshotInsuranceStatusChoice(asset: Record<string, unknown>): AssetStatusChoice {
  const specs = asRecord(asset.specsJson) ?? asRecord(asset.specs) ?? asRecord(asset.specAnswers);
  const explicitStatus =
    specs?.insuranceStatus ??
    specs?.insurance_status ??
    asset.insuranceStatus ??
    asset.insurance_status;

  if (explicitStatus !== undefined && explicitStatus !== null && String(explicitStatus).trim()) {
    return normalizeAssetStatusChoice(explicitStatus);
  }

  // Older full-register snapshots reduced the four-state insurance field to a
  // boolean. `true` is still conclusive, while `false` may mean No, Not sure or
  // Not applicable and must therefore remain unknown.
  return asset.isInsured === true ? 'yes' : 'unknown';
}

function snapshotInsuranceStatusLabel(asset: Record<string, unknown>): string {
  return {
    yes: 'Yes',
    no: 'No',
    unknown: 'Not sure',
    not_applicable: 'N/A',
  }[snapshotInsuranceStatusChoice(asset)];
}

function filterRegisterLeadAssetsByPdfReportKind(assets: Record<string, unknown>[], reportKind: PdfReportKind): Record<string, unknown>[] {
  switch (reportKind) {
    case 'financed':
      return assets.filter((asset) => asBoolean(asset.isFinanced));
    case 'insured':
      return assets.filter((asset) => snapshotInsuranceStatusChoice(asset) === 'yes');
    case 'licensed':
      return assets.filter((asset) => asBoolean(asset.isLicensed));
    case 'not-financed':
      return assets.filter((asset) => !asBoolean(asset.isFinanced));
    case 'not-insured':
      return assets.filter((asset) => snapshotInsuranceStatusChoice(asset) === 'no');
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
  const selected = asText(lead.assetSnapshot.selectedMethod).toLowerCase() || 'aim4price';
  const cards: ReportMethodCard[] = [];
  const aim4priceValue = asNumber(lead.assetSnapshot.aim4priceValueExVat);
  const selectedValue = assetValue(lead);

  if (aim4priceValue !== null) {
    cards.push({
      label: 'Aim4price value',
      value: formatCurrency(aim4priceValue),
      note: 'Calculated platform value excluding VAT.',
      selected: selected === 'aim4price' || selected === 'market',
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
  const insuredStats = calculateRegisterLeadStats(reportAssets, (asset) => snapshotInsuranceStatusChoice(asset) === 'yes');
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
      insured: snapshotInsuranceStatusLabel(asset),
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
      ...(lead.ownerMessage || leadSharedPhotoUrls(lead).length
        ? [{ label: 'Owner message', value: lead.ownerMessage, photoUrls: leadSharedPhotoUrls(lead) }]
        : []),
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
  const ownerMessagePhotoUrls = leadSharedPhotoUrls(lead);
  const leadReportNotes: ReportKeyValue[] = [
    ...(lead.ownerMessage || ownerMessagePhotoUrls.length
      ? [{ label: 'Owner message', value: lead.ownerMessage, photoUrls: ownerMessagePhotoUrls }]
      : []),
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

function searchableAssetSnapshotText(snapshot: Record<string, unknown>): string {
  const specs = asRecord(snapshot.specsJson) ?? asRecord(snapshot.specs) ?? {};
  const serialNumber =
    firstTextFromRecord(snapshot, ['serialNumber', 'serial_number']) ||
    firstTextFromRecord(specs, ['serialNumber', 'serial_number']);
  const registrationNumber =
    firstTextFromRecord(snapshot, [
      'licenseRegistrationNumber',
      'license_registration_number',
      'licenceRegistrationNumber',
      'licence_registration_number',
      'registrationNumber',
      'registration_number',
      'numberPlate',
      'number_plate',
    ]) ||
    firstTextFromRecord(specs, [
      'licenseRegistrationNumber',
      'license_registration_number',
      'licenceRegistrationNumber',
      'licence_registration_number',
      'registrationNumber',
      'registration_number',
      'numberPlate',
      'number_plate',
    ]);

  return [
    snapshotTitle(snapshot),
    snapshot.brandName,
    snapshot.modelName,
    snapshot.typedModelName,
    snapshot.equipmentFamilyLabel,
    snapshot.kind,
    serialNumber,
    registrationNumber,
  ]
    .filter(Boolean)
    .join(' ');
}

function searchTextForLead(lead: AssetLead): string {
  return [
    assetTitle(lead),
    assetDescription(lead),
    leadAssetMeta(lead),
    searchableAssetSnapshotText(lead.assetSnapshot),
    ...registerLeadAssets(lead).map(searchableAssetSnapshotText),
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

function leadMatchesSearch(lead: AssetLead, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  const searchText = searchTextForLead(lead);
  if (searchText.includes(query)) return true;
  const compactQuery = query.replace(/[^a-z0-9]/g, '');
  return compactQuery.length > 1 && searchText.replace(/[^a-z0-9]/g, '').includes(compactQuery);
}

type LeadsClientProps = {
  accountantWorkspaceMode?: boolean;
  dealerAppMode?: boolean;
  dealerWorkspaceMode?: boolean;
  licensingWorkspaceMode?: boolean;
  initialLeads?: AssetLead[];
  initialLeadsHaveMore?: boolean;
  initialSessionUserId?: string;
};

export default function LeadsClient({
  accountantWorkspaceMode = false,
  dealerAppMode = false,
  dealerWorkspaceMode,
  licensingWorkspaceMode = false,
  initialLeads = [],
  initialLeadsHaveMore = false,
  initialSessionUserId = '',
}: LeadsClientProps = {}) {
  const useDealerWorkspaceStyles = licensingWorkspaceMode || accountantWorkspaceMode || (dealerWorkspaceMode ?? dealerAppMode);
  const isDealerLeadsMode = Boolean(dealerAppMode || dealerWorkspaceMode);
  const canAddDealerCosts = isDealerLeadsMode;
  const dealerWorkspaceClass = (...classNames: string[]) =>
    useDealerWorkspaceStyles ? classNames.join(' ') : '';
  const [sessionUserId, setSessionUserId] = useState(initialSessionUserId);
  const [leads, setLeads] = useState<AssetLead[]>(initialLeads);
  const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [openFilterDropdown, setOpenFilterDropdown] = useState<FilterDropdownKey | null>(null);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [leadPhotoIndexes, setLeadPhotoIndexes] = useState<Record<string, number>>({});
  const [assetPhotoModal, setAssetPhotoModal] = useState<PhotoModalState | null>(null);
  const [sentPhotoModal, setSentPhotoModal] = useState<PhotoModalState | null>(null);
  const [managedLead, setManagedLead] = useState<AssetLead | null>(null);
  const [qrLeadAsset, setQrLeadAsset] = useState<LeadQrModalState | null>(null);
  const [copiedQrLeadId, setCopiedQrLeadId] = useState<string | null>(null);
  const [photoUploadLead, setPhotoUploadLead] = useState<AssetLead | null>(null);
  const [pendingLeadPhotos, setPendingLeadPhotos] = useState<PendingLeadPhoto[]>([]);
  const [isLeadPhotoDragging, setIsLeadPhotoDragging] = useState(false);
  const [isUploadingLeadPhotos, setIsUploadingLeadPhotos] = useState(false);
  const [accountantReportLead, setAccountantReportLead] = useState<AssetLead | null>(null);
  const [emailLead, setEmailLead] = useState<AssetLead | null>(null);
  const [emailSubjectDraft, setEmailSubjectDraft] = useState('');
  const [emailBodyDraft, setEmailBodyDraft] = useState('');
  const [isEmailDraftCopied, setIsEmailDraftCopied] = useState(false);
  const [reportLead, setReportLead] = useState<AssetLead | null>(null);
  const [maintenanceReportAccessId, setMaintenanceReportAccessId] = useState<string | null>(null);
  const [costReportLead, setCostReportLead] = useState<AssetLead | null>(null);
  const [maintenanceScheduleLead, setMaintenanceScheduleLead] = useState<AssetLead | null>(null);
  const [isDownloadingLeadReport, setIsDownloadingLeadReport] = useState(false);
  const [noteLead, setNoteLead] = useState<AssetLead | null>(null);
  const [deleteLeadTarget, setDeleteLeadTarget] = useState<AssetLead | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteAttachmentFile, setNoteAttachmentFile] = useState<File | null>(null);
  const [isNoteAttachmentDragging, setIsNoteAttachmentDragging] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isDeletingLead, setIsDeletingLead] = useState(false);
  const [markingLeadDoneId, setMarkingLeadDoneId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialSessionUserId);
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
      if (statusFilter === 'open' && (isNewLead(lead) || isCompletedLead(lead))) return false;
      if (statusFilter === 'completed' && !isCompletedLead(lead)) return false;
      if (statusFilter === 'tracking' && !isTrackingLead(lead)) return false;

      return leadMatchesSearch(lead, query);
    });
  }, [periodLeads, searchTerm, statusFilter]);

  const summaryLeads = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return query ? periodLeads.filter((lead) => leadMatchesSearch(lead, query)) : periodLeads;
  }, [periodLeads, searchTerm]);
  const newLeadCount = useMemo(() => summaryLeads.filter((lead) => isNewLead(lead)).length, [summaryLeads]);
  const activeLeadCount = useMemo(
    () => summaryLeads.filter((lead) => !isNewLead(lead) && !isCompletedLead(lead)).length,
    [summaryLeads],
  );
  const completedLeadCount = useMemo(
    () => summaryLeads.filter((lead) => isCompletedLead(lead)).length,
    [summaryLeads],
  );
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
    if (statusFilter === 'open') labels.push('Open leads');
    if (statusFilter === 'completed') labels.push('Handled leads');
    if (statusFilter === 'tracking') labels.push('Tracking requests');

    if (!labels.length) return 'Filter';
    if (labels.length === 1) return labels[0];
    return `${labels.length} filters`;
  }, [monthFilter, statusFilter, yearFilter]);

  const loadData = useCallback(async (includeIdentity = true, background = false): Promise<boolean> => {
    if (!background) setIsLoading(true);

    try {
      if (!includeIdentity) {
        const response = await fetch('/api/asset-leads', { cache: 'no-store', credentials: 'include' });
        const data = (await response.json()) as LeadsResponse;

        if (!response.ok || !data.ok || !data.leads) {
          throw new Error(data.error ?? 'Failed to load leads.');
        }

        setLeads(data.leads);
        return true;
      }

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
      return true;
    } catch (error) {
      if (!background) {
        setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load leads.' });
      }
      return false;
    } finally {
      if (!background) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSessionUserId) return;
    void loadData(true);
  }, [initialSessionUserId, loadData]);

  useEffect(() => {
    if (!initialSessionUserId || !initialLeadsHaveMore) return undefined;
    const timeout = window.setTimeout(() => void loadData(false, true), 0);
    return () => window.clearTimeout(timeout);
  }, [initialLeadsHaveMore, initialSessionUserId, loadData]);

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

  const hasOpenLeadModal = Boolean(
    isFilterModalOpen
    || managedLead
    || accountantReportLead
    || emailLead
    || reportLead
    || maintenanceReportAccessId
    || costReportLead
    || maintenanceScheduleLead
    || deleteLeadTarget
    || assetPhotoModal
    || sentPhotoModal
    || qrLeadAsset
    || photoUploadLead
    || noteLead,
  );

  useEffect(() => {
    if (!hasOpenLeadModal) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleEscape(event: KeyboardEvent) {
      if (assetPhotoModal && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        setAssetPhotoModal((current) => {
          if (!current || current.urls.length <= 1) return current;

          return {
            ...current,
            index: (current.index + direction + current.urls.length) % current.urls.length,
          };
        });
        return;
      }

      if (sentPhotoModal && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        setSentPhotoModal((current) => {
          if (!current || current.urls.length <= 1) return current;

          return {
            ...current,
            index: (current.index + direction + current.urls.length) % current.urls.length,
          };
        });
        return;
      }

      if (event.key !== 'Escape' || isDeletingLead || isSavingNote || isDownloadingLeadReport || isUploadingLeadPhotos) return;

      if (assetPhotoModal) setAssetPhotoModal(null);
      else if (sentPhotoModal) setSentPhotoModal(null);
      else if (qrLeadAsset) closeLeadQrModal();
      else if (photoUploadLead) closeLeadPhotoUploadModal();
      else if (deleteLeadTarget) setDeleteLeadTarget(null);
      else if (noteLead) closeNoteModal();
      else if (maintenanceScheduleLead) setMaintenanceScheduleLead(null);
      else if (costReportLead) setCostReportLead(null);
      else if (maintenanceReportAccessId) setMaintenanceReportAccessId(null);
      else if (reportLead) closeLeadReportModal();
      else if (accountantReportLead) setAccountantReportLead(null);
      else if (emailLead) closeEmailModal();
      else if (managedLead) setManagedLead(null);
      else setIsFilterModalOpen(false);
    }

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [
    assetPhotoModal,
    accountantReportLead,
    deleteLeadTarget,
    emailLead,
    hasOpenLeadModal,
    isDeletingLead,
    isDownloadingLeadReport,
    isSavingNote,
    isUploadingLeadPhotos,
    managedLead,
    costReportLead,
    maintenanceReportAccessId,
    maintenanceScheduleLead,
    noteLead,
    reportLead,
    sentPhotoModal,
    qrLeadAsset,
    photoUploadLead,
    pendingLeadPhotos,
    useDealerWorkspaceStyles,
  ]);

  async function deleteLead(leadToDelete: AssetLead): Promise<boolean> {
    try {
      if (accountantWorkspaceMode && isFullRegisterLead(leadToDelete)) {
        const response = await fetch(`/api/accountant/registers/${encodeURIComponent(leadToDelete.id)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const data = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !data.ok) throw new Error(data.error ?? 'Failed to remove Asset Register access.');

        setLeads((current) => current.filter((lead) => lead.id !== leadToDelete.id));
        setManagedLead((current) => (current?.id === leadToDelete.id ? null : current));
        setOpenLeadId((current) => (current === leadToDelete.id ? null : current));
        setNotice({ tone: 'success', message: 'Asset Register access removed from My Clients. The owner’s register was not deleted.' });
        return true;
      }

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

  async function markLeadViewed(leadToOpen: AssetLead) {
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

  async function openLead(leadToOpen: AssetLead) {
    setNotice(null);
    await markLeadViewed(leadToOpen);

    if (accountantWorkspaceMode && isFullRegisterLead(leadToOpen)) {
      window.location.assign(`/accountant/registers/${encodeURIComponent(leadToOpen.id)}`);
      return;
    }

    setOpenLeadId(leadToOpen.id);
  }

  function openTracking(leadToOpen: AssetLead) {
    const trackingBasePath = dealerAppMode ? '/dealer/maintenance' : '/tracking';
    const accessId = asText(leadToOpen.maintenanceAccess?.accessId);
    const trackingPath = accessId
      ? `${trackingBasePath}?open=${encodeURIComponent(accessId)}`
      : trackingBasePath;

    window.location.assign(trackingPath);
  }

  async function refreshLeads() {
    if (isLoading) return;

    setNotice(null);
    const didRefresh = await loadData(false);

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
        throw new Error(data.error ?? (isCurrentlyDone ? 'Failed to return the lead to Open.' : 'Failed to mark the lead as handled.'));
      }

      const updatedLead = data.lead;
      setLeads((current) => current.map((lead) => (lead.id === updatedLead.id ? updatedLead : lead)));
      setNotice({ tone: 'success', message: isCurrentlyDone ? 'Lead returned to Open.' : 'Lead marked as handled.' });
    } catch (error) {
      setLeads((current) => current.map((lead) => (lead.id === leadToToggle.id ? leadToToggle : lead)));
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : isCurrentlyDone ? 'Failed to return the lead to Open.' : 'Failed to mark the lead as handled.',
      });
    } finally {
      setMarkingLeadDoneId((current) => (current === leadToToggle.id ? null : current));
    }
  }

  function handleDealerCorrectionSaved(correction: DealerAssetCorrectionRequest) {
    setLeads((current) => current.map((lead) => (
      lead.assetRegisterItemId === correction.assetId
        ? leadWithDealerCorrection(lead, correction)
        : lead
    )));
    setManagedLead((current) => (
      current && current.assetRegisterItemId === correction.assetId
        ? leadWithDealerCorrection(current, correction)
        : current
    ));
    setNotice({
      tone: 'success',
      message: correction.licenseRenewalDateChanged
        ? 'Renewal date sent to the owner for approval.'
        : 'Dealer correction sent to the owner for approval.',
    });
  }

  function resetLeadFilters() {
    setMonthFilter('all');
    setYearFilter('all');
    setStatusFilter('all');
    setOpenFilterDropdown(null);
  }

  function chooseLeadStatusFilter(nextFilter: LeadStatusFilter) {
    setStatusFilter(nextFilter);
    setCurrentPage(1);
    setOpenLeadId(null);
  }

  function openLeadFilterModal() {
    setOpenFilterDropdown(null);
    setIsFilterModalOpen(true);
  }

  function closeLeadFilterModal() {
    setOpenFilterDropdown(null);
    setIsFilterModalOpen(false);
  }


  function mergeLeadAssetMedia(lead: AssetLead, asset: LeadAssetMedia): AssetLead {
    const updatedLead = {
      ...lead,
      assetSnapshot: {
        ...lead.assetSnapshot,
        id: asset.id,
        title: asset.title,
        publicAssetCode: asset.publicAssetCode,
        photos: [...asset.photos],
      },
    };

    setLeads((current) => current.map((item) => (item.id === lead.id ? updatedLead : item)));
    setLeadPhotoIndex(lead.id, 0);
    return updatedLead;
  }

  async function loadLeadAssetMedia(lead: AssetLead): Promise<{ lead: AssetLead; asset: LeadAssetMedia }> {
    const response = await fetch(`/api/asset-leads/${encodeURIComponent(lead.id)}/media`, {
      cache: 'no-store',
      credentials: 'include',
    });
    const data = (await response.json()) as LeadAssetMediaResponse;

    if (!response.ok || !data.ok || !data.asset) {
      throw new Error(data.error ?? 'Failed to load this asset.');
    }

    return {
      asset: data.asset,
      lead: mergeLeadAssetMedia(lead, data.asset),
    };
  }

  async function openLeadQrModal(lead: AssetLead) {
    setNotice(null);
    setManagedLead(null);

    try {
      const { asset } = await loadLeadAssetMedia(lead);
      setQrLeadAsset({ ...asset, leadId: lead.id });
      setCopiedQrLeadId(null);
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to open this asset QR code.',
      });
    }
  }

  function closeLeadQrModal() {
    setQrLeadAsset(null);
    setCopiedQrLeadId(null);
  }

  function buildLeadQrUrl(asset: LeadQrModalState, format: 'svg' | 'png' | 'print', download = false): string {
    const params = new URLSearchParams({
      assetId: asset.id,
      leadId: asset.leadId,
      format,
    });
    if (download) params.set('download', '1');
    return `/api/asset-register/qr?${params.toString()}`;
  }

  async function copyLeadScanLink(asset: LeadQrModalState) {
    if (!asset.publicAssetCode) {
      setNotice({ tone: 'error', message: 'This asset does not have a scan link yet.' });
      return;
    }

    const scanUrl = `${window.location.origin}/scan/${encodeURIComponent(asset.publicAssetCode)}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(scanUrl);
      } else {
        window.prompt('Copy this asset scan link', scanUrl);
      }

      setCopiedQrLeadId(asset.leadId);
      window.setTimeout(() => {
        setCopiedQrLeadId((current) => (current === asset.leadId ? null : current));
      }, 2200);
      setNotice({ tone: 'success', message: 'Scan link copied.' });
    } catch (error) {
      setCopiedQrLeadId(null);
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to copy the scan link.',
      });
    }
  }

  function printLeadQr(asset: LeadQrModalState) {
    const opened = window.open(buildLeadQrUrl(asset, 'print'), '_blank', 'noopener,noreferrer');
    setNotice(opened
      ? { tone: 'success', message: 'QR print sheet opened in a new tab.' }
      : { tone: 'error', message: 'Unable to open the QR print page. Please allow pop-ups and try again.' });
  }

  async function downloadLeadQr(asset: LeadQrModalState) {
    try {
      const response = await fetch(buildLeadQrUrl(asset, 'png', true), {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error ?? 'Failed to download the asset QR image.');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const slug = asset.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'asset';
      anchor.href = objectUrl;
      anchor.download = `${slug}-qr.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setNotice({ tone: 'success', message: 'Asset QR image downloaded.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to download the asset QR image.',
      });
    }
  }

  async function openLeadPhotoUploadModal(lead: AssetLead) {
    setNotice(null);
    setManagedLead(null);

    try {
      const { lead: hydratedLead } = await loadLeadAssetMedia(lead);
      setPendingLeadPhotos([]);
      setIsLeadPhotoDragging(false);
      setPhotoUploadLead(hydratedLead);
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to open asset photos.',
      });
    }
  }

  function closeLeadPhotoUploadModal() {
    if (isUploadingLeadPhotos) return;
    pendingLeadPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    setPendingLeadPhotos([]);
    setIsLeadPhotoDragging(false);
    setPhotoUploadLead(null);
  }

  function queueLeadPhotoFiles(files: File[]) {
    if (!photoUploadLead || !files.length) return;

    const invalidType = files.find((file) => !LEAD_ASSET_PHOTO_TYPES.has(String(file.type ?? '').toLowerCase()));
    if (invalidType) {
      setNotice({ tone: 'error', message: 'Only JPG, PNG and WEBP photos are allowed.' });
      return;
    }

    const oversized = files.find((file) => !file.size || file.size > MAX_LEAD_ASSET_PHOTO_BYTES);
    if (oversized) {
      setNotice({ tone: 'error', message: 'Each photo must be 5 MB or smaller.' });
      return;
    }

    const availableSlots = MAX_LEAD_ASSET_PHOTOS - assetPhotos(photoUploadLead).length - pendingLeadPhotos.length;
    if (availableSlots <= 0 || files.length > availableSlots) {
      setNotice({
        tone: 'error',
        message: `This asset can have up to ${MAX_LEAD_ASSET_PHOTOS} photos. You can add ${Math.max(0, availableSlots)} more.`,
      });
      return;
    }

    const queued = files.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPendingLeadPhotos((current) => [...current, ...queued]);
    setNotice(null);
  }

  function handleLeadPhotoInput(event: ChangeEvent<HTMLInputElement>) {
    queueLeadPhotoFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  function handleLeadPhotoDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsLeadPhotoDragging(false);
    queueLeadPhotoFiles(Array.from(event.dataTransfer.files ?? []));
  }

  function removePendingLeadPhoto(photoId: string) {
    setPendingLeadPhotos((current) => {
      const removed = current.find((photo) => photo.id === photoId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((photo) => photo.id !== photoId);
    });
  }

  async function uploadLeadPhotos() {
    if (!photoUploadLead || !pendingLeadPhotos.length || isUploadingLeadPhotos) return;

    setIsUploadingLeadPhotos(true);
    setNotice(null);

    try {
      const formData = new FormData();
      pendingLeadPhotos.forEach((photo) => formData.append('files', photo.file));
      const response = await fetch(`/api/asset-leads/${encodeURIComponent(photoUploadLead.id)}/media`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = (await response.json()) as LeadAssetMediaResponse;
      if (!response.ok || !data.ok || !data.asset) {
        throw new Error(data.error ?? 'Failed to upload asset photos.');
      }

      mergeLeadAssetMedia(photoUploadLead, data.asset);
      pendingLeadPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      setPendingLeadPhotos([]);
      setPhotoUploadLead(null);
      setNotice({
        tone: 'success',
        message: `${pendingLeadPhotos.length} ${pendingLeadPhotos.length === 1 ? 'photo' : 'photos'} added to the asset.`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload asset photos.',
      });
    } finally {
      setIsUploadingLeadPhotos(false);
    }
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
    setManagedLead(null);
    setReportLead(lead);
  }

  function openAccountantReportModal(lead: AssetLead) {
    setNotice(null);
    setManagedLead(null);
    setAccountantReportLead(lead);
  }

  function openMaintenanceReport(lead: AssetLead) {
    const access = lead.maintenanceAccess;
    if (!access?.isActive) {
      setNotice({ tone: 'error', message: 'This Maintenance Tracker share is no longer active.' });
      return;
    }
    if (!access.permissions.canViewMaintenanceReports) {
      setNotice({ tone: 'error', message: 'The asset owner has not enabled maintenance report access.' });
      return;
    }
    setManagedLead(null);
    setReportLead(null);
    setMaintenanceReportAccessId(access.accessId);
  }

  function openCostOfOwnershipReport(lead: AssetLead) {
    const access = lead.maintenanceAccess;
    if (!access?.isActive) {
      setNotice({ tone: 'error', message: 'This Maintenance Tracker share is no longer active.' });
      return;
    }
    if (!access.permissions.canViewCostOfOwnership) {
      setNotice({ tone: 'error', message: 'The asset owner has not enabled Cost of Ownership access.' });
      return;
    }
    setManagedLead(null);
    setReportLead(null);
    setCostReportLead(lead);
  }

  function openMaintenanceSchedule(lead: AssetLead) {
    const access = lead.maintenanceAccess;
    if (!access?.isActive) {
      setNotice({ tone: 'error', message: 'This Maintenance Tracker share is no longer active.' });
      return;
    }
    if (!access.permissions.canCreateMaintenanceSchedules) {
      setNotice({ tone: 'error', message: 'The asset owner has not enabled dealer-created maintenance schedules.' });
      return;
    }
    setManagedLead(null);
    setMaintenanceScheduleLead(lead);
  }

  function openDealerCost(lead: AssetLead) {
    if (isFullRegisterLead(lead)) return;
    setManagedLead(null);
    const costPath = dealerAppMode ? '/dealer/cost' : '/dealer-costs';
    window.location.href = `${costPath}?assetId=${encodeURIComponent(lead.assetRegisterItemId)}&add=1`;
  }

  function closeLeadReportModal() {
    if (isDownloadingLeadReport) return;
    setReportLead(null);
  }

  async function handleLeadPdfReportDownload(lead: AssetLead, reportKind: PdfReportKind = 'full') {
    if (isDownloadingLeadReport) return;

    const reportOption = getPdfReportOption(reportKind);
    const didOpen = handleDownloadLead(lead, reportKind);

    if (didOpen) {
      setReportLead(null);
      setNotice({ tone: 'success', message: `${reportOption.label} PDF opened.` });
    }
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

    if (dealerAppMode) {
      const subject = buildLeadEmailSubject(lead);
      const body = buildLeadEmailBody(lead);
      setManagedLead(null);
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      return;
    }

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

  function openAssetPhotoModal(lead: AssetLead, urls: string[], index: number) {
    if (!urls.length) return;

    setSentPhotoModal(null);
    setAssetPhotoModal({
      leadId: lead.id,
      urls: [...urls],
      index: Math.min(Math.max(index, 0), urls.length - 1),
      title: assetTitle(lead),
    });
  }

  function closeAssetPhotoModal() {
    setAssetPhotoModal(null);
  }

  function cycleAssetPhotoModal(direction: -1 | 1) {
    setAssetPhotoModal((current) => {
      if (!current || current.urls.length <= 1) return current;

      return {
        ...current,
        index: (current.index + direction + current.urls.length) % current.urls.length,
      };
    });
  }

  function selectAssetPhoto(index: number) {
    setAssetPhotoModal((current) => (
      current
        ? { ...current, index: Math.min(Math.max(index, 0), current.urls.length - 1) }
        : current
    ));
  }

  function openSentPhotoModal(lead: AssetLead, urls: string[], index: number) {
    if (!urls.length) return;

    setAssetPhotoModal(null);
    setSentPhotoModal({
      leadId: lead.id,
      urls: [...urls],
      index: Math.min(Math.max(index, 0), urls.length - 1),
      title: assetTitle(lead),
    });
  }

  function closeSentPhotoModal() {
    setSentPhotoModal(null);
  }

  function cycleSentPhotoModal(direction: -1 | 1) {
    setSentPhotoModal((current) => {
      if (!current || current.urls.length <= 1) return current;

      return {
        ...current,
        index: (current.index + direction + current.urls.length) % current.urls.length,
      };
    });
  }

  function selectSentPhoto(index: number) {
    setSentPhotoModal((current) => (
      current
        ? { ...current, index: Math.min(Math.max(index, 0), current.urls.length - 1) }
        : current
    ));
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
          <strong>Owner message</strong>
          {lead.ownerMessage ? <p>{lead.ownerMessage}</p> : <p>Photo attachments sent from the QR share button.</p>}

          {sharedPhotos.length ? (
            <div className={styles.ownerSharedPhotoGrid} aria-label="Attached owner photos">
              {sharedPhotos.map((url, index) => (
                <button
                  type="button"
                  key={`${url}-${index}`}
                  className={styles.ownerSharedPhotoLink}
                  onClick={() => openSentPhotoModal(lead, sharedPhotos, index)}
                  aria-label={`Open owner attached photo ${index + 1}`}
                >
                  <img src={url} alt={`Owner attached photo ${index + 1}`} />
                  <span className={styles.ownerSharedPhotoOpenLabel}>Open</span>
                </button>
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
    const insuredCount = asNumber(snapshot?.insuredAssetCount) ?? registerAssets.filter((asset) => snapshotInsuranceStatusChoice(asset) === 'yes').length;
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
    const isLicenceRenewal = licensingWorkspaceMode || lead.leadType === 'license_renewal';
    const licenceRenewalDate = leadLicenceRenewalDate(lead);
    const licenceDocuments = Array.isArray(lead.assetSnapshot.documents)
      ? lead.assetSnapshot.documents
          .map((document) => asRecord(document))
          .filter((document): document is Record<string, unknown> => Boolean(document))
      : [];

    return (
      <div className={`${assetStyles.assetBody} ${styles.leadAssetBody}`} id={`lead-panel-${lead.id}`}>
        <div className={`${assetStyles.previewWrap} ${styles.leadPreviewWrap}`}>
          <div className={`${assetStyles.previewStage} ${styles.leadPreviewStage}`}>
            {photo ? (
              <>
                <button
                  type="button"
                  className={styles.leadPreviewOpenButton}
                  onClick={() => openAssetPhotoModal(lead, photos, photoIndex)}
                  aria-label={`Open ${assetTitle(lead)} photo ${photoIndex + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt={`${assetTitle(lead)} photo ${photoIndex + 1}`} className={`${assetStyles.previewImage} ${styles.leadPreviewImage}`} />
                  <span className={styles.leadPreviewOpenLabel}>Open photo</span>
                </button>

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
              <div className={`${assetStyles.previewPlaceholder} ${styles.leadPreviewPlaceholder}`}>
                <div className={assetStyles.previewPlaceholderBadges}>
                  <span className={`${assetStyles.badge} ${assetStyles.badgeNeutral} ${assetStyles.previewPlaceholderBadge}`}>
                    {familyLabel}
                  </span>
                </div>
              </div>
            )}
          </div>

          {hasMultiplePhotos ? (
            <div className={`${assetStyles.previewThumbRow} ${styles.leadPreviewThumbRow}`}>
              {photos.map((thumbnail, index) => {
                const isActivePhoto = index === photoIndex;

                return (
                  <button
                    type="button"
                    key={`${lead.id}-lead-photo-${index}`}
                    className={`${assetStyles.previewThumbButton} ${styles.leadPreviewThumbButton} ${isActivePhoto ? assetStyles.previewThumbButtonActive : ''}`}
                    onClick={() => {
                      setLeadPhotoIndex(lead.id, index);
                      openAssetPhotoModal(lead, photos, index);
                    }}
                    aria-label={`Open photo ${index + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbnail} alt={`${assetTitle(lead)} thumbnail ${index + 1}`} className={`${assetStyles.previewThumbImage} ${styles.leadPreviewThumbImage}`} />
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
                <span>{isLicenceRenewal ? 'Registration' : 'Serial'}</span>
                <strong>{isLicenceRenewal ? licenseRegistrationNumber || '—' : asText(lead.assetSnapshot.serialNumber) || '—'}</strong>
              </div>
              <div className={assetStyles.assetDetailRow}>
                <span>{isLicenceRenewal ? 'Renewal date' : asText(lead.assetSnapshot.kind).toLowerCase() === 'property' ? 'Year Built' : 'Year'}</span>
                <strong>{isLicenceRenewal ? formatDate(licenceRenewalDate) : lead.assetSnapshot.yearModel ? String(lead.assetSnapshot.yearModel) : '—'}</strong>
              </div>
              <div className={assetStyles.assetDetailRow}>
                <span>{isLicenceRenewal ? 'Year' : 'Usage'}</span>
                <strong>{isLicenceRenewal ? lead.assetSnapshot.yearModel ? String(lead.assetSnapshot.yearModel) : '—' : assetUsageValue(lead)}</strong>
              </div>
              <div className={assetStyles.assetDetailRow}>
                <span>{isLicenceRenewal ? 'Asset type' : 'Condition'}</span>
                <strong>{isLicenceRenewal ? familyLabel : conditionLabel(lead.assetSnapshot.condition)}</strong>
              </div>
            </div>

            <div className={assetStyles.assetStatusDetails}>
              {!isLicenceRenewal ? (
                <>
                  <div className={assetStyles.assetStatusRow}>
                    <span>Financed</span>
                    {renderLeadAssetStatusMark(readLeadFinanceStatusChoice(lead))}
                  </div>
                  <div className={assetStyles.assetStatusRow}>
                    <span>Insured</span>
                    {renderLeadAssetStatusMark(readLeadInsuranceStatusChoice(lead))}
                  </div>
                </>
              ) : null}
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

          {isLicenceRenewal ? (
            <div className={assetStyles.assetReplacementPriceBubble}>
              <span>Licence documents</span>
              <strong>{licenceDocuments.length}</strong>
              <small>{licenceDocuments.length === 1 ? 'document shared' : 'documents shared'}</small>
              {licenceDocuments.map((document, index) => {
                const url = asText(document.url);
                return url ? (
                  <a key={`${lead.id}-licence-document-${index}`} href={url} target="_blank" rel="noreferrer">
                    {asText(document.fileName) || `Licence document ${index + 1}`}
                  </a>
                ) : null;
              })}
            </div>
          ) : (
            <div className={assetStyles.assetReplacementPriceBubble}>
              <span>Replacement Price</span>
              <strong>{replacementPrice === null ? 'Not set' : formatCurrency(replacementPrice)}</strong>
              <small>Excl. VAT</small>
            </div>
          )}

          {renderOwnerMessageBlock(lead)}
        </div>
      </div>
    );
  }

  const assetPhotoModalIndex = assetPhotoModal
    ? Math.min(Math.max(assetPhotoModal.index, 0), assetPhotoModal.urls.length - 1)
    : 0;
  const assetPhotoModalUrl = assetPhotoModal?.urls[assetPhotoModalIndex] ?? '';
  const hasMultipleAssetPhotos = Boolean(assetPhotoModal && assetPhotoModal.urls.length > 1);
  const sentPhotoModalIndex = sentPhotoModal
    ? Math.min(Math.max(sentPhotoModal.index, 0), sentPhotoModal.urls.length - 1)
    : 0;
  const sentPhotoModalUrl = sentPhotoModal?.urls[sentPhotoModalIndex] ?? '';
  const hasMultipleSentPhotos = Boolean(sentPhotoModal && sentPhotoModal.urls.length > 1);

  return (
    <main className={`${assetStyles.page} ${useDealerWorkspaceStyles ? workspaceStyles.page : ''} ${styles.leadsPage} ${useDealerWorkspaceStyles ? styles.dealerOwnerParity : ''} ${licensingWorkspaceMode ? styles.licensingLeadsPage : ''} ${dealerAppMode ? `${styles.dealerAppLeads} ${dealerStyles.dealerLeadsSurface}` : ''} ${dealerWorkspaceMode && !accountantWorkspaceMode ? styles.dealerDesktopLeads : ''}`}>
      {!dealerAppMode ? <AppHeader active="leads" /> : null}

      <section className={`${assetStyles.shell} ${useDealerWorkspaceStyles ? workspaceStyles.shell : ''}`}>
        {notice ? (
          <div className={`${assetStyles.notice} ${notice.tone === 'success' ? assetStyles.noticeSuccess : assetStyles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <section className={`${assetStyles.registerPanel} ${styles.leadsRegisterPanel}`}>
          {useDealerWorkspaceStyles ? (
            <WorkspaceTitlePanel
              title={licensingWorkspaceMode ? 'LICENCE RENEWAL LEADS' : accountantWorkspaceMode ? 'CLIENT MANAGEMENT SYSTEM' : dealerAppMode ? 'LEADS SYSTEM' : 'LEAD MANAGEMENT SYSTEM'}
              className={dealerAppMode ? styles.leadsTitlePanel : undefined}
            />
          ) : (
            <div className={`${assetStyles.registerHeader} ${styles.leadsRegisterHeader}`}>
              <div className={`${assetStyles.registerTitleBlock} ${styles.leadsHeroTitleBlock}`}>
                <h1>{licensingWorkspaceMode ? 'LICENCE RENEWAL LEADS' : 'LEAD MANAGEMENT SYSTEM'}</h1>
              </div>
            </div>
          )}

          {useDealerWorkspaceStyles ? (
            <section className={`${assetStyles.summaryRow} ${assetStyles.heroSummaryRow} ${styles.leadSummaryRow}`} aria-label="Lead summary">
              <button type="button" className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${styles.leadOwnerSummaryCard} ${styles.leadOwnerSummaryCardNew} ${styles.leadSummaryFilterButton} ${statusFilter === 'new' ? styles.leadSummaryFilterButtonActive : ''}`} onClick={() => chooseLeadStatusFilter('new')} aria-pressed={statusFilter === 'new'}>
                <span className={assetStyles.heroSummaryHead}>
                  <span className={`${assetStyles.heroSummaryTitle} ${styles.leadOwnerSummaryText}`}>New</span>
                </span>
                <span className={assetStyles.heroSummaryValueRow}>
                  <strong className={`${assetStyles.heroSummaryValue} ${styles.leadOwnerSummaryText}`}>{newLeadCount}</strong>
                </span>
                <span className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${styles.leadOwnerSummaryFooter}`}>
                  <small className={styles.leadOwnerSummaryText}>Show requests not yet opened.</small>
                </span>
              </button>

              <button type="button" className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${styles.leadOwnerSummaryCard} ${styles.leadOwnerSummaryCardOpen} ${styles.leadSummaryFilterButton} ${statusFilter === 'open' ? styles.leadSummaryFilterButtonActive : ''}`} onClick={() => chooseLeadStatusFilter('open')} aria-pressed={statusFilter === 'open'}>
                <span className={assetStyles.heroSummaryHead}>
                  <span className={`${assetStyles.heroSummaryTitle} ${styles.leadOwnerSummaryText}`}>Open</span>
                </span>
                <span className={assetStyles.heroSummaryValueRow}>
                  <strong className={`${assetStyles.heroSummaryValue} ${styles.leadOwnerSummaryText}`}>{activeLeadCount}</strong>
                </span>
                <span className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${styles.leadOwnerSummaryFooter}`}>
                  <small className={styles.leadOwnerSummaryText}>Show requests being actioned.</small>
                </span>
              </button>

              <button type="button" className={`${assetStyles.summaryTile} ${assetStyles.metricSummaryTile} ${assetStyles.heroSummaryTile} ${styles.leadOwnerSummaryCard} ${styles.leadOwnerSummaryCardDone} ${styles.leadSummaryFilterButton} ${statusFilter === 'completed' ? styles.leadSummaryFilterButtonActive : ''}`} onClick={() => chooseLeadStatusFilter('completed')} aria-pressed={statusFilter === 'completed'}>
                <span className={assetStyles.heroSummaryHead}>
                  <span className={`${assetStyles.heroSummaryTitle} ${styles.leadOwnerSummaryText}`}>Handled</span>
                </span>
                <span className={assetStyles.heroSummaryValueRow}>
                  <strong className={`${assetStyles.heroSummaryValue} ${styles.leadOwnerSummaryText}`}>{completedLeadCount}</strong>
                </span>
                <span className={`${assetStyles.heroSummaryFooter} ${assetStyles.heroTotalFooter} ${styles.leadOwnerSummaryFooter}`}>
                  <small className={styles.leadOwnerSummaryText}>Show requests that need no further action.</small>
                </span>
              </button>
            </section>
          ) : !useDealerWorkspaceStyles ? (
            <div className={`${styles.leadSummaryRow} ${dealerAppMode ? dealerStyles.dealerHidden : ''}`}>
              <article className={`${styles.leadSummaryCard} ${styles.leadSummaryCardNew}`}>
                <span>New</span>
                <strong>{newLeadCount}</strong>
                <small>Not yet opened or actioned.</small>
              </article>

              <article className={`${styles.leadSummaryCard} ${styles.leadSummaryCardActive}`}>
                <span>Open</span>
                <strong>{activeLeadCount}</strong>
                <small>Currently being reviewed or actioned.</small>
              </article>

              <article className={`${styles.leadSummaryCard} ${styles.leadSummaryCardDone}`}>
                <span>Handled</span>
                <strong>{completedLeadCount}</strong>
                <small>Reviewed and handed off outside Aim4price.</small>
              </article>
            </div>
          ) : null}

          <div className={`${assetStyles.toolbar} ${useDealerWorkspaceStyles ? workspaceStyles.controlsRow : ''} ${styles.leadSearchToolbar}`}>
            <label className={`${assetStyles.searchWrap} ${useDealerWorkspaceStyles ? workspaceStyles.searchField : ''}`}>
              <SearchIcon className={assetStyles.searchIcon} />
              <input
                className={assetStyles.searchInput}
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search business, asset, serial or registration"
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
                className={`${assetStyles.secondaryButton} ${useDealerWorkspaceStyles ? `${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral}` : ''} ${styles.leadRefreshButton}`}
                onClick={() => void refreshLeads()}
                disabled={isLoading}
              >
                <RefreshIcon className={`${assetStyles.buttonIcon} ${isLoading ? styles.leadRefreshIconActive : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                className={`${assetStyles.secondaryButton} ${assetStyles.filterTriggerButton} ${useDealerWorkspaceStyles ? `${workspaceStyles.actionButton} ${workspaceStyles.actionMint}` : ''} ${styles.leadFilterButton} ${hasActiveLeadFilter ? assetStyles.filterTriggerButtonActive : ''}`}
                onClick={openLeadFilterModal}
                disabled={isLoading}
              >
                <FilterIcon className={assetStyles.buttonIcon} />
                <span>{activeLeadFilterLabel}</span>
              </button>
            </div>
          </div>

          {!isLoading ? (
            <div className={`${styles.leadResultSummary} ${useDealerWorkspaceStyles ? styles.leadResultSummaryDealer : ''}`}>
              <span>Showing</span>
              <strong>{filteredLeads.length}</strong>
              <span>of {periodLeads.length} leads for the selected period</span>
            </div>
          ) : null}


          {!isLoading && !filteredLeads.length ? (
            <div className={`${assetStyles.emptyState} ${useDealerWorkspaceStyles ? workspaceStyles.emptyState : ''}`}>No leads match this search or filter.</div>
          ) : null}

          {!isLoading && filteredLeads.length ? (
            <div className={styles.leadStack}>
              {paginatedLeads.map((lead) => {
                const isLeadOpen = openLeadId === lead.id;
                const isLeadNew = isNewLead(lead);
                const isLeadDone = isCompletedLead(lead);
                const isLeadActive = !isLeadNew && !isLeadDone;
                const isTrackingRequest = isTrackingLead(lead);
                const isMarkingThisLeadDone = markingLeadDoneId === lead.id;

                return (
                  <article key={lead.id} className={`${useDealerWorkspaceStyles ? workspaceStyles.card : ''} ${styles.leadThread} ${licensingWorkspaceMode ? styles.licensingLeadThread : ''} ${isLeadNew ? styles.leadThreadNew : ''} ${isLeadActive ? styles.leadThreadActive : ''} ${isLeadDone ? styles.leadThreadDone : ''} ${isTrackingRequest ? styles.leadThreadTracking : ''} ${isLeadOpen ? styles.leadThreadOpen : ''} ${openLeadId && !isLeadOpen ? styles.leadThreadMuted : ''}`}>
                    <div className={styles.clientPanel}>
                      <div className={`${styles.clientPanelHeader} ${licensingWorkspaceMode ? styles.licensingLeadHeader : ''}`}>
                        <div className={`${styles.clientIdentity} ${licensingWorkspaceMode ? styles.licensingLeadIdentity : ''} ${isTrackingRequest ? styles.trackingLeadIdentity : ''}`}>
                          <div className={styles.leadCardTitleRow}>
                            <h3>{lead.ownerBusinessName || ownerDisplayName(lead)}</h3>
                          </div>
                          <strong className={styles.leadAssetName}>{assetTitle(lead)}</strong>
                          <span className={styles.clientKicker}>{formatLeadDisplayType(lead)} · Received {formatDate(lead.createdAtIso)}</span>
                          {licensingWorkspaceMode ? (
                            <span className={styles.licenceRenewalMeta}>
                              <span className={styles.licenceRenewalMetaIcon} aria-hidden="true">
                                <DocumentIcon className={assetStyles.buttonIcon} />
                              </span>
                              <span className={styles.licenceRenewalMetaCopy}>
                                <strong>Renewal due {leadLicenceRenewalDisplay(lead)}</strong>
                                <small>{readLeadLicenseRegistrationNumber(lead) || 'Registration not supplied'}</small>
                              </span>
                            </span>
                          ) : null}
                          {isTrackingRequest ? (
                            <span className={styles.trackingLeadPurpose}>
                              <span className={styles.trackingLeadPurposeIcon} aria-hidden="true">
                                <MaintenanceTrackingIcon className={styles.trackingLeadPurposeIconGraphic} />
                              </span>
                              <span className={styles.trackingLeadPurposeCopy}>
                                <strong>Asset sent for tracking</strong>
                                <small>Maintenance tracking access was shared with your dealership.</small>
                              </span>
                            </span>
                          ) : null}
                        </div>

                        <div className={styles.clientDecisionArea}>
                          <div
                            className={`${styles.clientActionRow} ${
                              isTrackingRequest
                                ? `${styles.trackingLeadActions} ${
                                    isLeadOpen ? styles.trackingLeadActionsOpen : styles.trackingLeadActionsClosed
                                  } ${lead.maintenanceAccess?.hasMaintenanceRecords ? '' : styles.trackingLeadActionsSingle}`
                                : ''
                            }`}
                          >
                            {licensingWorkspaceMode ? (
                              <>
                                <button
                                  type="button"
                                  className={`${isLeadOpen ? assetStyles.secondaryButton : assetStyles.primaryButton} ${workspaceStyles.actionButton} ${isLeadOpen ? workspaceStyles.actionNeutral : workspaceStyles.actionGreen} ${styles.openLeadButton}`}
                                  onClick={() => {
                                    if (isLeadOpen) setOpenLeadId(null);
                                    else void openLead(lead);
                                  }}
                                >
                                  {isLeadOpen ? 'Close' : 'Open'}
                                </button>
                              </>
                            ) : accountantWorkspaceMode ? (
                              <>
                                <button
                                  type="button"
                                  className={`${assetStyles.secondaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionMint} ${isLeadDone ? styles.doneLeadPill : styles.markDoneLeadButton}`}
                                  onClick={() => void toggleLeadDone(lead)}
                                  disabled={Boolean(markingLeadDoneId)}
                                  aria-pressed={isLeadDone}
                                  title={isLeadDone ? 'Return this client to Open' : 'Mark this client as handled'}
                                >
                                  <CheckIcon className={assetStyles.buttonIcon} />
                                  <span>{isMarkingThisLeadDone ? 'Updating...' : isLeadDone ? 'Handled' : 'Mark handled'}</span>
                                </button>

                                <button
                                  type="button"
                                  className={`${assetStyles.primaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionGreen} ${styles.openLeadButton}`}
                                  onClick={() => {
                                    setManagedLead(lead);
                                    void markLeadViewed(lead);
                                  }}
                                >
                                  Manage
                                </button>
                              </>
                            ) : isTrackingRequest ? (
                              <>
                                {isLeadOpen ? (
                                  <button
                                    type="button"
                                    className={`${assetStyles.secondaryButton} ${useDealerWorkspaceStyles ? `${workspaceStyles.actionButton} ${workspaceStyles.actionDanger}` : ''} ${styles.deleteLeadButton}`}
                                    onClick={() => setDeleteLeadTarget(lead)}
                                  >
                                    Delete
                                  </button>
                                ) : null}
                                {lead.maintenanceAccess?.hasMaintenanceRecords ? (
                                  <button
                                    type="button"
                                    className={`${assetStyles.secondaryButton} ${useDealerWorkspaceStyles ? `${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral}` : ''} ${styles.trackingOpenButton}`}
                                    onClick={() => openTracking(lead)}
                                  >
                                    Tracking
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className={`${isLeadOpen ? assetStyles.secondaryButton : assetStyles.primaryButton} ${useDealerWorkspaceStyles ? `${workspaceStyles.actionButton} ${isLeadOpen ? workspaceStyles.actionNeutral : workspaceStyles.actionGreen}` : ''} ${isLeadOpen ? styles.trackingCloseButton : styles.openLeadButton}`}
                                  onClick={() => {
                                    if (isLeadOpen) {
                                      setOpenLeadId(null);
                                    } else {
                                      void openLead(lead);
                                    }
                                  }}
                                >
                                  {isLeadOpen ? 'Close' : 'Open'}
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className={`${assetStyles.secondaryButton} ${useDealerWorkspaceStyles ? `${workspaceStyles.actionButton} ${workspaceStyles.actionMint}` : ''} ${isLeadDone ? styles.doneLeadPill : styles.markDoneLeadButton}`}
                                  onClick={() => void toggleLeadDone(lead)}
                                  disabled={Boolean(markingLeadDoneId)}
                                  aria-pressed={isLeadDone}
                                  title={isLeadDone ? 'Return this lead to Open' : 'Mark this lead as handled'}
                                >
                                  <CheckIcon className={assetStyles.buttonIcon} />
                                  <span>{isMarkingThisLeadDone ? 'Updating...' : isLeadDone ? 'Handled' : 'Mark handled'}</span>
                                </button>

                                {isLeadOpen ? (
                                  <>
                                    <button type="button" className={`${assetStyles.secondaryButton} ${useDealerWorkspaceStyles ? `${workspaceStyles.actionButton} ${workspaceStyles.actionDanger}` : ''} ${styles.deleteLeadButton}`} onClick={() => setDeleteLeadTarget(lead)}>
                                      Delete
                                    </button>
                                    <button
                                      type="button"
                                      className={`${assetStyles.secondaryButton} ${useDealerWorkspaceStyles ? `${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral}` : ''} ${styles.closeLeadButton}`}
                                      onClick={() => {
                                        setOpenLeadId(null);
                                      }}
                                    >
                                      Close
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className={`${assetStyles.primaryButton} ${useDealerWorkspaceStyles ? `${workspaceStyles.actionButton} ${workspaceStyles.actionGreen}` : ''} ${styles.openLeadButton}`}
                                    onClick={() => {
                                      void openLead(lead);
                                    }}
                                  >
                                    Open
                                  </button>
                                )}
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
                              <span className={assetStyles.assetValueMethodLabel}>{licensingWorkspaceMode ? 'Licence renewal' : isFullRegisterLead(lead) ? 'Register' : `${methodLabel(lead.assetSnapshot.selectedMethod)} value`}</span>
                              <span className={assetStyles.assetSavedDateLabel}>Updated {formatDate(asText(lead.assetSnapshot.updatedAtIso) || lead.updatedAtIso)}</span>
                            </div>
                          </div>

                          <div className={`${assetStyles.assetHeaderAside} ${styles.leadAssetHeaderAside}`}>
                            {!licensingWorkspaceMode ? (
                              <div className={`${assetStyles.valueBlock} ${styles.leadValueBlock}`}>
                                <strong>{formatCurrency(assetValue(lead))}</strong>
                                <span>Excl. VAT</span>
                              </div>
                            ) : null}

                            <div className={`${assetStyles.assetHeaderActions} ${styles.leadAssetHeaderActions}`}>
                              <button
                                type="button"
                                className={`${assetStyles.optionsButton} ${assetStyles.sharedNoteActionButton} ${styles.leadQuickActionButton}`}
                                onClick={() => openNoteModal(lead)}
                                title="Send a note or quote"
                                aria-label="Send a note or quote"
                              >
                                <NoteIcon className={assetStyles.buttonIcon} />
                                <span>Send</span>
                              </button>

                              <button
                                type="button"
                                className={`${assetStyles.optionsButton} ${styles.leadManageButton} ${styles.leadQuickActionButton}`}
                                onClick={() => setManagedLead(lead)}
                                aria-label="Manage lead"
                              >
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
            <nav className={`${useDealerWorkspaceStyles ? workspaceStyles.pagination : ''} ${styles.leadPagination}`} aria-label="Lead pagination">
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

      {maintenanceReportAccessId ? (
        <DealerMaintenanceReportModal
          accessId={maintenanceReportAccessId}
          pdfOnly={dealerAppMode}
          onClose={() => setMaintenanceReportAccessId(null)}
          onBack={() => {
            const lead = leads.find((entry) => entry.maintenanceAccess?.accessId === maintenanceReportAccessId);
            setMaintenanceReportAccessId(null);
            if (lead) setReportLead(lead);
          }}
          onError={(message) => setNotice({ tone: 'error', message })}
        />
      ) : null}

      {costReportLead?.maintenanceAccess?.isActive ? (
        <DealerCostOfOwnershipReportModal
          accessId={costReportLead.maintenanceAccess.accessId}
          assetTitle={assetTitle(costReportLead)}
          assetMeta={leadAssetMeta(costReportLead)}
          createdAtIso={costReportLead.createdAtIso}
          updatedAtIso={costReportLead.updatedAtIso}
          pdfOnly={dealerAppMode}
          onClose={() => setCostReportLead(null)}
          onBack={() => {
            setReportLead(costReportLead);
            setCostReportLead(null);
          }}
          onError={(message) => setNotice({ tone: 'error', message })}
        />
      ) : null}

      {maintenanceScheduleLead?.maintenanceAccess?.isActive ? (
        <DealerMaintenanceScheduleModal
          accessId={maintenanceScheduleLead.maintenanceAccess.accessId}
          leadId={maintenanceScheduleLead.id}
          onClose={() => setMaintenanceScheduleLead(null)}
          onCreated={() => setNotice({
            tone: 'success',
            message: 'Proposed schedule sent to the owner for approval.',
          })}
          onError={(message) => setNotice({ tone: 'error', message })}
        />
      ) : null}

      {isFilterModalOpen ? (
        <div className={`${assetStyles.modalOverlay} ${dealerWorkspaceClass(workspaceStyles.modalOverlay)}`}>
          <div className={assetStyles.modalBackdrop} onClick={closeLeadFilterModal} />

          <div
            className={`${assetStyles.modalCard} ${dealerWorkspaceClass(workspaceStyles.modal)} ${styles.leadFilterModal} ${accountantWorkspaceMode ? styles.accountantFilterModal : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-filter-title"
          >
            <div className={`${assetStyles.modalHeader} ${dealerWorkspaceClass(workspaceStyles.modalHeader)} ${styles.leadFilterHeader}`}>
              <div className={assetStyles.modalHeaderText}>
                <h3 id="lead-filter-title">{accountantWorkspaceMode ? 'Filter clients' : licensingWorkspaceMode ? 'Filter renewals' : 'Filter leads'}</h3>
                <p className={styles.leadFilterIntro}>
                  {accountantWorkspaceMode
                    ? 'Choose a received date or client status.'
                    : licensingWorkspaceMode
                      ? 'Choose a received date or lead status.'
                      : 'Choose a received date, lead status, or show only asset tracking requests.'}
                </p>
              </div>

              <button type="button" className={`${assetStyles.modalCloseButton} ${dealerWorkspaceClass(workspaceStyles.modalClose)}`} onClick={closeLeadFilterModal} aria-label="Close filter modal">
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={`${dealerWorkspaceClass(workspaceStyles.modalBody)} ${styles.leadFilterForm}`}>
              <LeadFilterDropdown
                label="Month"
                dropdownKey="month"
                value={monthFilter}
                options={MONTH_OPTIONS}
                openDropdown={openFilterDropdown}
                onOpenChange={setOpenFilterDropdown}
                onChange={setMonthFilter}
                nativeSelect={dealerAppMode}
              />

              <LeadFilterDropdown
                label="Year"
                dropdownKey="year"
                value={yearFilter}
                options={yearFilterOptions}
                openDropdown={openFilterDropdown}
                onOpenChange={setOpenFilterDropdown}
                onChange={setYearFilter}
                nativeSelect={dealerAppMode}
              />

              <LeadFilterDropdown
                label="Status"
                dropdownKey="status"
                value={statusFilter}
                options={accountantWorkspaceMode
                  ? ACCOUNTANT_STATUS_FILTER_OPTIONS
                  : STATUS_FILTER_OPTIONS}
                openDropdown={openFilterDropdown}
                onOpenChange={setOpenFilterDropdown}
                onChange={(value) => setStatusFilter(value as LeadStatusFilter)}
                nativeSelect={dealerAppMode}
              />
            </div>

            <div className={`${assetStyles.formActions} ${dealerWorkspaceClass(workspaceStyles.modalFooter)} ${styles.leadFilterActions}`}>
              <button type="button" className={assetStyles.secondaryButton} onClick={resetLeadFilters} disabled={!hasActiveLeadFilter}>
                Reset
              </button>
              <button type="button" className={assetStyles.primaryButton} onClick={closeLeadFilterModal}>
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {managedLead ? (
        <div className={`${assetStyles.modalOverlay} ${dealerWorkspaceClass(workspaceStyles.modalOverlay)} ${styles.leadManageOverlay}`}>
          <div className={assetStyles.modalBackdrop} onClick={() => setManagedLead(null)} />

          <div className={`${assetStyles.optionsModal} ${dealerWorkspaceClass(workspaceStyles.modal)} ${styles.leadManageModal} ${licensingWorkspaceMode ? styles.licensingManageModal : ''}`} role="dialog" aria-modal="true" aria-labelledby="lead-manage-title">
            <div className={`${assetStyles.modalHeader} ${assetStyles.optionsModalHeader} ${dealerWorkspaceClass(workspaceStyles.modalHeader)}`}>
              <div className={assetStyles.modalHeaderText}>
                <h3 id="lead-manage-title">{assetTitle(managedLead)}</h3>
                <p>{leadAssetMeta(managedLead)}</p>
              </div>

              <button type="button" className={`${assetStyles.modalCloseButton} ${dealerWorkspaceClass(workspaceStyles.modalClose)}`} onClick={() => setManagedLead(null)} aria-label="Close lead management">
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={`${assetStyles.modalScrollBody} ${assetStyles.optionsScrollBody} ${dealerWorkspaceClass(workspaceStyles.modalBody)} ${styles.leadManageScrollBody}`}>
              <div className={assetStyles.optionsContent}>
                <div className={`${assetStyles.optionsGrid} ${assetStyles.assetOptionsGrid} ${styles.manageOptionsGrid}`}>
                  {accountantWorkspaceMode ? (
                    <>
                      <button
                        type="button"
                        className={`${assetStyles.optionActionButton} ${assetStyles.optionFeaturedButton}`}
                        onClick={() => void openLead(managedLead)}
                      >
                        <DocumentIcon className={assetStyles.buttonIcon} />
                        <span>
                          <strong>Open asset register</strong>
                          <small className={styles.accountantManageDescription}>Open the client’s shared Asset Register.</small>
                        </span>
                      </button>

                      <button type="button" className={assetStyles.optionActionButton} onClick={() => openAccountantReportModal(managedLead)}>
                        <DownloadIcon className={assetStyles.buttonIcon} />
                        <span>
                          <strong>Download reports</strong>
                          <small className={styles.accountantManageDescription}>Choose an accountant-ready report.</small>
                        </span>
                      </button>

                      <button
                        type="button"
                        className={assetStyles.optionActionButton}
                        onClick={() => openEmail(managedLead)}
                        disabled={!leadEmailRecipient(managedLead)}
                        title={!leadEmailRecipient(managedLead) ? 'No client email address is saved on this client.' : undefined}
                      >
                        <EmailIcon className={assetStyles.buttonIcon} />
                        <span>
                          <strong>Email client</strong>
                          <small className={styles.accountantManageDescription}>
                            {leadEmailRecipient(managedLead) ? 'Email the client about this register.' : 'No client email saved.'}
                          </small>
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`${assetStyles.optionActionButton} ${styles.accountantDeleteAction}`}
                        onClick={() => {
                          setManagedLead(null);
                          setDeleteLeadTarget(managedLead);
                        }}
                      >
                        <DeleteIcon className={assetStyles.buttonIcon} />
                        <span>
                          <strong>Delete client</strong>
                          <small className={styles.accountantManageDescription}>Remove this register from My Clients.</small>
                        </span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className={`${assetStyles.optionActionButton} ${assetStyles.optionFeaturedButton} ${styles.whatsAppActionButton}`} onClick={() => openWhatsApp(managedLead)}>
                        <WhatsAppIcon className={`${assetStyles.buttonIcon} ${styles.whatsAppIcon}`} />
                        <span>
                          <strong>WhatsApp client</strong>
                          <small>Open a WhatsApp message to the owner.</small>
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

                      {!licensingWorkspaceMode ? (
                        <button type="button" className={assetStyles.optionActionButton} onClick={() => openLeadReportModal(managedLead)}>
                          <DownloadIcon className={assetStyles.buttonIcon} />
                          <span>
                            <strong>Reports</strong>
                            <small>Choose a report.</small>
                          </span>
                        </button>
                      ) : null}


                      {isDealerLeadsMode ? (
                        <button type="button" className={assetStyles.optionActionButton} onClick={() => void openLeadQrModal(managedLead)}>
                          <QrCodeIcon className={assetStyles.buttonIcon} />
                          <span>
                            <strong>QR code</strong>
                            <small>Copy, download or print the asset QR label.</small>
                          </span>
                        </button>
                      ) : null}

                      {isDealerLeadsMode ? (
                        <button type="button" className={assetStyles.optionActionButton} onClick={() => void openLeadPhotoUploadModal(managedLead)}>
                          <PhotosIcon className={assetStyles.buttonIcon} />
                          <span>
                            <strong>Photos</strong>
                            <small>Add photos of this asset.</small>
                          </span>
                        </button>
                      ) : null}

                      {isTrackingLead(managedLead) && managedLead.maintenanceAccess?.isActive ? (
                        <button
                          type="button"
                          className={assetStyles.optionActionButton}
                          onClick={() => openMaintenanceSchedule(managedLead)}
                          disabled={!managedLead.maintenanceAccess.permissions.canCreateMaintenanceSchedules}
                          title={!managedLead.maintenanceAccess.permissions.canCreateMaintenanceSchedules
                            ? 'The asset owner has not enabled dealer-created schedules.'
                            : undefined}
                        >
                          <MaintenanceTrackingIcon className={assetStyles.buttonIcon} />
                          <span>
                            <strong>Schedule maintenance</strong>
                            <small>
                              {managedLead.maintenanceAccess.permissions.canCreateMaintenanceSchedules
                                ? 'Send a schedule for the owner to approve.'
                                : 'Owner permission is required.'}
                            </small>
                          </span>
                        </button>
                      ) : null}

                      {canAddDealerCosts && !isFullRegisterLead(managedLead) ? (
                        <DealerAssetCorrectionEditor
                          assetTitle={assetTitle(managedLead)}
                          sourceType="lead"
                          sourceId={managedLead.id}
                          serialNumber={asText(managedLead.assetSnapshot.serialNumber)}
                          replacementPriceExVat={snapshotReplacementPrice(managedLead.assetSnapshot)}
                          correction={managedLead.dealerCorrection}
                          actionClassName={assetStyles.optionActionButton}
                          iconClassName={assetStyles.buttonIcon}
                          onSaved={handleDealerCorrectionSaved}
                        />
                      ) : null}

                      {licensingWorkspaceMode && managedLead.leadType === 'license_renewal' && !isFullRegisterLead(managedLead) ? (
                        <DealerAssetCorrectionEditor
                          assetTitle={assetTitle(managedLead)}
                          sourceType="lead"
                          sourceId={managedLead.id}
                          serialNumber={asText(managedLead.assetSnapshot.serialNumber)}
                          replacementPriceExVat={snapshotReplacementPrice(managedLead.assetSnapshot)}
                          licenseRenewalDate={leadLicenceRenewalDate(managedLead)}
                          correction={managedLead.dealerCorrection}
                          canUpdateSerial={false}
                          canUpdateReplacementPrice={false}
                          canUpdateLicenseRenewalDate
                          actionClassName={assetStyles.optionActionButton}
                          iconClassName={assetStyles.buttonIcon}
                          onSaved={handleDealerCorrectionSaved}
                        />
                      ) : null}

                      {canAddDealerCosts && !isFullRegisterLead(managedLead) ? (
                        <button
                          type="button"
                          className={assetStyles.optionActionButton}
                          onClick={() => openDealerCost(managedLead)}
                        >
                          <CostIcon className={assetStyles.buttonIcon} />
                          <span>
                            <strong>Add asset cost</strong>
                            <small>Upload an invoice or enter a cost manually.</small>
                          </span>
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}


      {qrLeadAsset ? (
        <div className={`${assetStyles.modalOverlay} ${assetStyles.subModalOverlay}`}>
          <div className={assetStyles.modalBackdrop} onClick={closeLeadQrModal} />

          <div className={`${assetStyles.modalCard} ${assetStyles.qrModal}`} role="dialog" aria-modal="true" aria-labelledby="lead-asset-qr-title">
            <div className={`${assetStyles.modalHeader} ${assetStyles.qrModalHeader}`}>
              <div className={assetStyles.modalHeaderText}>
                <h3 id="lead-asset-qr-title">{qrLeadAsset.title}</h3>
                <p>Use this permanent QR for scan access. Public QR scans always ask for the farm PIN.</p>
              </div>

              <button type="button" className={assetStyles.modalCloseButton} onClick={closeLeadQrModal} aria-label="Close QR code">
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={`${assetStyles.modalScrollBody} ${assetStyles.qrModalScrollBody}`}>
              <div className={assetStyles.qrModalBody}>
                <div className={assetStyles.qrPreviewCard}>
                  <span className={assetStyles.qrPreviewEyebrow}>Permanent asset QR</span>
                  <div className={assetStyles.qrPreviewFrame}>
                    {qrLeadAsset.publicAssetCode ? (
                      <img src={buildLeadQrUrl(qrLeadAsset, 'svg')} alt={`QR code for ${qrLeadAsset.title}`} />
                    ) : (
                      <p className={assetStyles.qrPreviewFallback}>QR artwork is not ready for this asset yet.</p>
                    )}
                  </div>
                </div>

                <div className={assetStyles.qrPrimaryActionsCard}>
                  <button
                    type="button"
                    className={`${assetStyles.qrPrimaryActionButton} ${copiedQrLeadId === qrLeadAsset.leadId ? assetStyles.qrCopiedButton : ''}`}
                    onClick={() => void copyLeadScanLink(qrLeadAsset)}
                  >
                    <CopyIcon className={assetStyles.buttonIcon} />
                    <span>{copiedQrLeadId === qrLeadAsset.leadId ? 'Copied' : 'Copy scan link'}</span>
                  </button>

                  <button type="button" className={assetStyles.qrPrimaryActionButton} onClick={() => printLeadQr(qrLeadAsset)}>
                    <PrintIcon className={assetStyles.buttonIcon} />
                    <span>Print QR label</span>
                  </button>

                  <button type="button" className={assetStyles.qrPrimaryActionButton} onClick={() => void downloadLeadQr(qrLeadAsset)}>
                    <QrCodeIcon className={assetStyles.buttonIcon} />
                    <span>Download QR</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {photoUploadLead ? (
        <div className={`${assetStyles.modalOverlay} ${dealerWorkspaceClass(workspaceStyles.modalOverlay)} ${styles.leadPhotoUploadOverlay}`}>
          <div className={assetStyles.modalBackdrop} onClick={closeLeadPhotoUploadModal} />

          <div className={`${assetStyles.modalCard} ${dealerWorkspaceClass(workspaceStyles.modal)} ${styles.leadPhotoUploadModal}`} role="dialog" aria-modal="true" aria-labelledby="lead-photo-upload-title">
            <div className={`${assetStyles.modalHeader} ${dealerWorkspaceClass(workspaceStyles.modalHeader)}`}>
              <div className={assetStyles.modalHeaderText}>
                <h3 id="lead-photo-upload-title">Photos</h3>
                <p>{assetTitle(photoUploadLead)} · {assetPhotos(photoUploadLead).length} of {MAX_LEAD_ASSET_PHOTOS} photos saved</p>
              </div>

              <button type="button" className={`${assetStyles.modalCloseButton} ${dealerWorkspaceClass(workspaceStyles.modalClose)}`} onClick={closeLeadPhotoUploadModal} aria-label="Close photos" disabled={isUploadingLeadPhotos}>
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={`${assetStyles.modalScrollBody} ${dealerWorkspaceClass(workspaceStyles.modalBody)} ${styles.leadPhotoUploadBody}`}>
              {assetPhotos(photoUploadLead).length ? (
                <section className={styles.leadSavedPhotos} aria-label="Saved asset photos">
                  <div className={styles.leadPhotoSectionHeading}>
                    <strong>Saved photos</strong>
                    <span>{assetPhotos(photoUploadLead).length}</span>
                  </div>
                  <div className={styles.leadPhotoPreviewGrid}>
                    {assetPhotos(photoUploadLead).map((url, index) => (
                      <button type="button" key={url} onClick={() => openAssetPhotoModal(photoUploadLead, assetPhotos(photoUploadLead), index)}>
                        <img src={normalizeLeadPhotoUrl(url)} alt={`${assetTitle(photoUploadLead)} photo ${index + 1}`} />
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <label
                className={`${styles.leadPhotoDropzone} ${isLeadPhotoDragging ? styles.leadPhotoDropzoneActive : ''}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsLeadPhotoDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setIsLeadPhotoDragging(false)}
                onDrop={handleLeadPhotoDrop}
              >
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleLeadPhotoInput} disabled={isUploadingLeadPhotos} />
                <PhotosIcon className={styles.leadPhotoDropzoneIcon} />
                <span>Add photos</span>
                <strong>Drop photos here or click to choose</strong>
                <small>JPG, PNG or WEBP · up to 5 MB each · {Math.max(0, MAX_LEAD_ASSET_PHOTOS - assetPhotos(photoUploadLead).length - pendingLeadPhotos.length)} spaces available</small>
              </label>

              {pendingLeadPhotos.length ? (
                <section className={styles.leadPendingPhotos} aria-label="Photos ready to upload">
                  <div className={styles.leadPhotoSectionHeading}>
                    <strong>Ready to upload</strong>
                    <span>{pendingLeadPhotos.length}</span>
                  </div>
                  <div className={styles.leadPhotoPreviewGrid}>
                    {pendingLeadPhotos.map((photo) => (
                      <div key={photo.id} className={styles.leadPendingPhoto}>
                        <img src={photo.previewUrl} alt={photo.file.name} />
                        <button type="button" onClick={() => removePendingLeadPhoto(photo.id)} disabled={isUploadingLeadPhotos} aria-label={`Remove ${photo.file.name}`}>
                          ×
                        </button>
                        <span title={photo.file.name}>{photo.file.name}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <div className={`${assetStyles.formActions} ${dealerWorkspaceClass(workspaceStyles.modalFooter)} ${styles.leadPhotoUploadActions}`}>
              <button type="button" className={assetStyles.secondaryButton} onClick={closeLeadPhotoUploadModal} disabled={isUploadingLeadPhotos}>
                Cancel
              </button>
              <button type="button" className={assetStyles.primaryButton} onClick={() => void uploadLeadPhotos()} disabled={!pendingLeadPhotos.length || isUploadingLeadPhotos}>
                {isUploadingLeadPhotos ? 'Uploading...' : `Add ${pendingLeadPhotos.length || ''} ${pendingLeadPhotos.length === 1 ? 'photo' : 'photos'}`.replace(/\s+/g, ' ').trim()}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {accountantReportLead ? (
        <AccountantRegisterReportsModal
          shareId={accountantReportLead.id}
          registerName={accountantReportLead.ownerBusinessName || ownerDisplayName(accountantReportLead)}
          includeFuelLedger={asBoolean(accountantReportLead.includedSections.includeFuelLedger)}
          includeCostLedger={asBoolean(accountantReportLead.includedSections.includeCostLedger)}
          workspaceMode
          onClose={() => setAccountantReportLead(null)}
        />
      ) : null}

      {emailLead ? (
        <div className={`${assetStyles.modalOverlay} ${dealerWorkspaceClass(workspaceStyles.modalOverlay)}`}>
          <div className={assetStyles.modalBackdrop} onClick={closeEmailModal} />

          <div className={`${assetStyles.modalCard} ${dealerWorkspaceClass(workspaceStyles.modal)} ${styles.leadEmailModal}`} role="dialog" aria-modal="true" aria-labelledby="lead-email-title">
            <div className={`${assetStyles.modalHeader} ${dealerWorkspaceClass(workspaceStyles.modalHeader)} ${styles.leadEmailHeader}`}>
              <div className={`${assetStyles.modalHeaderText} ${styles.leadModalTitleGroup}`}>
                <h3 id="lead-email-title">Email client</h3>
                <p>{assetTitle(emailLead)} · {ownerDisplayName(emailLead)}</p>
              </div>

              <button type="button" className={`${assetStyles.modalCloseButton} ${dealerWorkspaceClass(workspaceStyles.modalClose)}`} onClick={closeEmailModal} aria-label="Close email draft">
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={`${dealerWorkspaceClass(workspaceStyles.modalBody)} ${styles.leadEmailDraftPanel}`}>
              <div className={styles.leadEmailRecipientCard}>
                <div>
                  <span>To</span>
                  <strong>{activeEmailRecipient()}</strong>
                </div>
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

            <div className={`${dealerWorkspaceClass(workspaceStyles.modalFooter)} ${styles.leadEmailActions}`}>
              <button type="button" className={`${assetStyles.secondaryButton} ${styles.leadModalCancelButton}`} onClick={closeEmailModal}>
                Cancel
              </button>
              <div className={styles.leadEmailActionGroup}>
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
        </div>
      ) : null}

      {reportLead ? (
        <div className={`${assetStyles.modalOverlay} ${assetStyles.subModalOverlay}`}>
          <div className={assetStyles.modalBackdrop} onClick={closeLeadReportModal} />

          <div
            className={`${assetStyles.modalCard} ${assetStyles.assetReportModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-report-title"
          >
            <div className={`${assetStyles.modalHeader} ${assetStyles.assetReportModalHeader}`}>
              <div className={assetStyles.modalHeaderText}>
                <h3 id="lead-report-title">{assetTitle(reportLead)}</h3>
                <p>{leadAssetMeta(reportLead)}</p>
              </div>

              <button
                type="button"
                className={assetStyles.modalCloseButton}
                onClick={closeLeadReportModal}
                aria-label="Close PDF reports"
                disabled={isDownloadingLeadReport}
              >
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={`${assetStyles.modalScrollBody} ${assetStyles.assetReportModalBody}`}>
              <div className={assetStyles.assetReportOptionsGrid}>
                <button
                  type="button"
                  className={assetStyles.assetReportOptionButton}
                  onClick={() => void handleLeadPdfReportDownload(reportLead, 'full')}
                  disabled={isDownloadingLeadReport}
                >
                  <PdfIcon className={assetStyles.buttonIcon} />
                  <span>
                    <strong>{dealerAppMode ? 'Asset valuation' : 'Download asset valuation'}</strong>
                    {dealerAppMode ? null : <small>PDF value summary with the shared asset details.</small>}
                  </span>
                </button>

                {isTrackingLead(reportLead) && reportLead.maintenanceAccess?.isActive ? (
                  <>
                    <button
                      type="button"
                      className={assetStyles.assetReportOptionButton}
                      onClick={() => openMaintenanceReport(reportLead)}
                      disabled={!reportLead.maintenanceAccess.permissions.canViewMaintenanceReports}
                      title={!reportLead.maintenanceAccess.permissions.canViewMaintenanceReports
                        ? 'The asset owner has not enabled maintenance report access.'
                        : undefined}
                    >
                      <DocumentIcon className={assetStyles.buttonIcon} />
                      <span>
                        <strong>{dealerAppMode ? 'Maintenance report' : 'Download maintenance report'}</strong>
                        {dealerAppMode ? null : (
                          <small>
                            {reportLead.maintenanceAccess.permissions.canViewMaintenanceReports
                              ? 'PDF or Excel maintenance history.'
                              : 'Owner permission is required.'}
                          </small>
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      className={assetStyles.assetReportOptionButton}
                      onClick={() => openCostOfOwnershipReport(reportLead)}
                      disabled={!reportLead.maintenanceAccess.permissions.canViewCostOfOwnership}
                      title={!reportLead.maintenanceAccess.permissions.canViewCostOfOwnership
                        ? 'The asset owner has not enabled Cost of Ownership access.'
                        : undefined}
                    >
                      <DocumentIcon className={assetStyles.buttonIcon} />
                      <span>
                        <strong>{dealerAppMode ? 'Cost of ownership' : 'Download cost of ownership'}</strong>
                        {dealerAppMode ? null : (
                          <small>
                            {reportLead.maintenanceAccess.permissions.canViewCostOfOwnership
                              ? 'PDF or Excel ownership costs and VAT.'
                              : 'Owner permission is required.'}
                          </small>
                        )}
                      </span>
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteLeadTarget ? (
        <div className={`${assetStyles.modalOverlay} ${assetStyles.confirmDeleteOverlay} ${dealerWorkspaceClass(workspaceStyles.modalOverlay)}`}>
          <div className={assetStyles.modalBackdrop} onClick={closeDeleteLeadModal} />

          <div
            className={`${assetStyles.deleteConfirmModal} ${dealerWorkspaceClass(workspaceStyles.modal)} ${styles.leadDeleteModal}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-lead-confirm-title"
            aria-describedby="delete-lead-confirm-copy"
          >
            <div className={`${assetStyles.deleteConfirmContent} ${styles.leadDeleteContent}`}>
              <div className={`${assetStyles.deleteConfirmHeader} ${dealerWorkspaceClass(workspaceStyles.modalHeader)} ${styles.leadDeleteHeader}`}>
                <div>
                  <h3 id="delete-lead-confirm-title">{accountantWorkspaceMode && isFullRegisterLead(deleteLeadTarget) ? 'Remove Asset Register?' : 'Delete lead?'}</h3>
                  <p id="delete-lead-confirm-copy">{accountantWorkspaceMode && isFullRegisterLead(deleteLeadTarget) ? 'This removes your access and the client from My Clients. It does not delete the owner’s Asset Register.' : 'This permanently removes the lead from your My Leads inbox.'}</p>
                </div>

                <button
                  type="button"
                  className={`${assetStyles.modalCloseButton} ${dealerWorkspaceClass(workspaceStyles.modalClose)} ${styles.leadDeleteCloseButton}`}
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

              <div className={styles.leadDeleteWarning}>
                <strong>{accountantWorkspaceMode && isFullRegisterLead(deleteLeadTarget) ? 'Only accountant access is removed.' : isTrackingLead(deleteLeadTarget) ? 'Maintenance tracking will remain active.' : 'This action cannot be undone.'}</strong>
                <span>
                  {accountantWorkspaceMode && isFullRegisterLead(deleteLeadTarget)
                    ? 'The owner can share the register with your accountant account again later.'
                    : isTrackingLead(deleteLeadTarget)
                    ? 'Delete the asset separately from Tracking if you also want to stop maintenance tracking access.'
                    : 'The owner will need to send a new lead if you need this information again.'}
                </span>
              </div>

              <div className={`${assetStyles.deleteConfirmActions} ${dealerWorkspaceClass(workspaceStyles.modalFooter)} ${styles.leadDeleteActions}`}>
                <button type="button" className={assetStyles.secondaryButton} onClick={closeDeleteLeadModal} disabled={isDeletingLead}>
                  Cancel
                </button>

                <button
                  type="button"
                  className={`${assetStyles.primaryButton} ${assetStyles.deleteConfirmButton} ${styles.leadDeleteConfirmButton}`}
                  onClick={() => void confirmDeleteLead()}
                  disabled={isDeletingLead}
                >
                  <span>{isDeletingLead ? 'Deleting...' : accountantWorkspaceMode ? 'Delete client' : 'Delete lead'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {typeof document !== 'undefined' && assetPhotoModal && assetPhotoModalUrl
        ? createPortal(
          <div className={`${assetStyles.modalOverlay} ${dealerWorkspaceClass(workspaceStyles.modalOverlay)} ${styles.leadPhotoModalOverlay} ${styles.assetPhotoModalOverlay}`}>
          <div className={assetStyles.modalBackdrop} onClick={closeAssetPhotoModal} />

          <div className={`${styles.leadPhotoModal} ${styles.assetPhotoModal}`} role="dialog" aria-modal="true" aria-labelledby="asset-photo-modal-title">
            <div className={styles.leadPhotoModalHeader}>
              <div>
                <strong id="asset-photo-modal-title">Asset photos</strong>
                <span>{assetPhotoModal.title} · {assetPhotoModalIndex + 1} of {assetPhotoModal.urls.length}</span>
              </div>

              <button type="button" className={styles.leadPhotoModalCloseButton} onClick={closeAssetPhotoModal} aria-label="Close asset photos">
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={styles.leadPhotoModalBody}>
              <div className={styles.leadPhotoModalFrame}>
                <img src={assetPhotoModalUrl} alt={`${assetPhotoModal.title} asset photo ${assetPhotoModalIndex + 1}`} />

                {hasMultipleAssetPhotos ? (
                  <>
                    <button
                      type="button"
                      className={`${styles.leadPhotoModalNavButton} ${styles.leadPhotoModalNavPrevious}`}
                      onClick={() => cycleAssetPhotoModal(-1)}
                      aria-label="Show previous asset photo"
                    >
                      <ChevronLeftIcon className={assetStyles.buttonIcon} />
                    </button>

                    <button
                      type="button"
                      className={`${styles.leadPhotoModalNavButton} ${styles.leadPhotoModalNavNext}`}
                      onClick={() => cycleAssetPhotoModal(1)}
                      aria-label="Show next asset photo"
                    >
                      <ChevronRightIcon className={assetStyles.buttonIcon} />
                    </button>
                  </>
                ) : null}
              </div>

              {hasMultipleAssetPhotos ? (
                <div className={styles.leadPhotoModalThumbRow} aria-label="Asset photo thumbnails">
                  {assetPhotoModal.urls.map((url, index) => (
                    <button
                      type="button"
                      key={`${assetPhotoModal.leadId}-asset-photo-${index}`}
                      className={`${styles.leadPhotoModalThumbButton} ${index === assetPhotoModalIndex ? styles.leadPhotoModalThumbButtonActive : ''}`}
                      onClick={() => selectAssetPhoto(index)}
                      aria-label={`Show asset photo ${index + 1}`}
                      aria-current={index === assetPhotoModalIndex ? 'true' : undefined}
                    >
                      <img src={url} alt="" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          </div>,
          document.body,
        )
        : null}

      {typeof document !== 'undefined' && sentPhotoModal && sentPhotoModalUrl
        ? createPortal(
          <div className={`${assetStyles.modalOverlay} ${dealerWorkspaceClass(workspaceStyles.modalOverlay)} ${styles.leadPhotoModalOverlay} ${styles.sentPhotoModalOverlay}`}>
          <div className={assetStyles.modalBackdrop} onClick={closeSentPhotoModal} />

          <div className={`${styles.leadPhotoModal} ${styles.sentPhotoModal}`} role="dialog" aria-modal="true" aria-labelledby="sent-photo-modal-title">
            <div className={styles.leadPhotoModalHeader}>
              <div>
                <strong id="sent-photo-modal-title">Sent photos</strong>
                <span>{sentPhotoModal.title} · {sentPhotoModalIndex + 1} of {sentPhotoModal.urls.length}</span>
              </div>

              <button type="button" className={styles.leadPhotoModalCloseButton} onClick={closeSentPhotoModal} aria-label="Close sent photos">
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={styles.leadPhotoModalBody}>
              <div className={`${styles.leadPhotoModalFrame} ${styles.sentPhotoModalFrame}`}>
                <img src={sentPhotoModalUrl} alt={`${sentPhotoModal.title} sent photo ${sentPhotoModalIndex + 1}`} />

                {hasMultipleSentPhotos ? (
                  <>
                    <button
                      type="button"
                      className={`${styles.leadPhotoModalNavButton} ${styles.leadPhotoModalNavPrevious}`}
                      onClick={() => cycleSentPhotoModal(-1)}
                      aria-label="Show previous sent photo"
                    >
                      <ChevronLeftIcon className={assetStyles.buttonIcon} />
                    </button>

                    <button
                      type="button"
                      className={`${styles.leadPhotoModalNavButton} ${styles.leadPhotoModalNavNext}`}
                      onClick={() => cycleSentPhotoModal(1)}
                      aria-label="Show next sent photo"
                    >
                      <ChevronRightIcon className={assetStyles.buttonIcon} />
                    </button>
                  </>
                ) : null}
              </div>

              {hasMultipleSentPhotos ? (
                <div className={styles.leadPhotoModalThumbRow} aria-label="Sent photo thumbnails">
                  {sentPhotoModal.urls.map((url, index) => (
                    <button
                      type="button"
                      key={`${sentPhotoModal.leadId}-sent-photo-${index}`}
                      className={`${styles.leadPhotoModalThumbButton} ${index === sentPhotoModalIndex ? styles.leadPhotoModalThumbButtonActive : ''}`}
                      onClick={() => selectSentPhoto(index)}
                      aria-label={`Show sent photo ${index + 1}`}
                      aria-current={index === sentPhotoModalIndex ? 'true' : undefined}
                    >
                      <img src={url} alt="" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          </div>,
          document.body,
        )
        : null}

      {noteLead ? (
        <div className={`${assetStyles.modalOverlay} ${dealerWorkspaceClass(workspaceStyles.modalOverlay)} ${styles.leadNoteOverlay}`}>
          <div className={assetStyles.modalBackdrop} onClick={closeNoteModal} />

          <div className={`${assetStyles.modalCard} ${assetStyles.sharedNoteModal} ${dealerWorkspaceClass(workspaceStyles.modal)} ${styles.leadNoteModal}`} role="dialog" aria-modal="true" aria-labelledby="lead-note-title">
            <div className={`${assetStyles.modalHeader} ${dealerWorkspaceClass(workspaceStyles.modalHeader)} ${styles.leadNoteHeader}`}>
              <div className={`${assetStyles.modalHeaderText} ${styles.leadModalTitleGroup}`}>
                <h3 id="lead-note-title">Send note or quote</h3>
                <p>{assetTitle(noteLead)} · {ownerDisplayName(noteLead)}</p>
              </div>

              <button type="button" className={`${assetStyles.modalCloseButton} ${dealerWorkspaceClass(workspaceStyles.modalClose)}`} onClick={closeNoteModal} aria-label="Close note modal" disabled={isSavingNote}>
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={styles.leadNoteBody}>
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
                <PdfIcon className={styles.leadNoteAttachmentIcon} />
                <span className={styles.leadNoteAttachmentEyebrow}>Attach quote PDF — optional</span>
                <strong>Drop quote PDF here or click to upload</strong>
                <small>PDF only · maximum {formatByteSize(MAX_LEAD_NOTE_PDF_BYTES)}.</small>
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

              <p className={styles.leadNoteDeliveryHint}>This note and any attached quote will appear in the owner&apos;s Asset Register.</p>
            </div>

            <div className={`${assetStyles.formActions} ${assetStyles.sharedNoteActions} ${dealerWorkspaceClass(workspaceStyles.modalFooter)} ${styles.leadNoteActions}`}>
              <button type="button" className={`${assetStyles.secondaryButton} ${styles.leadModalCancelButton}`} onClick={closeNoteModal} disabled={isSavingNote}>
                Cancel
              </button>
              <button type="button" className={assetStyles.primaryButton} onClick={() => void submitLeadNote()} disabled={isSavingNote}>
                {isSavingNote ? 'Sending...' : 'Send note'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

