'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type ContactRequestStatus = 'pending' | 'approved' | 'temporarily_denied' | 'permanently_denied';
type ContactDecisionStatus = 'approved' | 'denied';
type UsersMode = 'directory' | 'requests';
type ContactAccessFilter = 'all' | 'unlocked' | 'locked' | 'pending' | 'temporarily_denied' | 'permanently_denied';
type NoticeTone = 'success' | 'error';
type FilterDropdownKey = 'province' | 'contactAccess';
type SendModalStep = 'choice' | 'message' | 'ad';

type OwnerDirectoryEntry = {
  ownerUserId: string;
  companyName: string;
  requestId: string | null;
  requestStatus: ContactRequestStatus | null;
  contactUnlocked: boolean;
  popiaAcknowledged: boolean;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactLocation: string;
  ownerProvince: string;
  ownerTownCity: string;
  requestedAtIso: string | null;
  lastRequestedAtIso: string | null;
  updatedAtIso: string | null;
  deniedCount: number;
  lastDeniedAtIso: string | null;
  requestAgainAtIso: string | null;
  permanentlyDeniedAtIso: string | null;
};

type ContactDetailRequest = {
  id: string;
  ownerUserId: string;
  requesterUserId: string;
  status: ContactRequestStatus;
  requesterAccountType: string;
  requesterDisplayName: string;
  requesterBusinessName: string;
  requesterPhone: string;
  requesterEmail: string;
  requesterLocation: string;
  ownerCompanyName: string;
  ownerContactName: string;
  ownerContactPhone: string;
  ownerContactEmail: string;
  ownerContactLocation: string;
  createdAtIso: string;
  lastRequestedAtIso: string | null;
  approvedAtIso: string | null;
  deniedAtIso: string | null;
  updatedAtIso: string;
  deniedCount: number;
  lastDeniedAtIso: string | null;
  requestAgainAtIso: string | null;
  permanentlyDeniedAtIso: string | null;
  popiaAcknowledgedAtIso: string | null;
};

type UserMessage = {
  id: string;
  ownerUserId: string;
  senderUserId: string;
  messageType: 'message' | 'ad';
  messageText: string;
  adCaption: string;
  senderAccountType: string;
  senderDisplayName: string;
  senderBusinessName: string;
  senderPhone: string;
  senderEmail: string;
  senderLocation: string;
  imageFileName: string;
  imageMimeType: string;
  imageSizeBytes: number;
  imageUrl: string;
  hasImage: boolean;
  documentFileName: string;
  documentMimeType: string;
  documentSizeBytes: number;
  documentUrl: string;
  hasDocument: boolean;
  readAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

type OwnerDirectoryPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type OwnerDirectorySummary = {
  totalOwners: number;
  unlockedCount: number;
  lockedCount: number;
  pendingCount: number;
  temporarilyDeniedCount: number;
  permanentlyDeniedCount: number;
};

type OwnerProvinceOption = {
  value: string;
  label: string;
  count: number;
};

type RequestAllowance = {
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  resetTimezone: string;
  isLimitReached: boolean;
};

type UsersResponse = {
  ok: boolean;
  mode?: UsersMode;
  accountType?: string;
  owners?: OwnerDirectoryEntry[];
  owner?: OwnerDirectoryEntry;
  contactRequests?: ContactDetailRequest[];
  contactRequest?: ContactDetailRequest;
  incomingMessages?: UserMessage[];
  message?: UserMessage;
  pagination?: OwnerDirectoryPagination;
  summary?: OwnerDirectorySummary;
  provinceOptions?: OwnerProvinceOption[];
  ownersWithoutProvinceCount?: number;
  requestAllowance?: RequestAllowance;
  error?: string;
};

type IconProps = {
  className?: string;
};

type DropdownOption = {
  value: string;
  label: string;
};

const USERS_PAGE_SIZE = 10;
const ALL_PROVINCES_VALUE = 'all';
const PROVINCE_NOT_SAVED_VALUE = '__province_not_saved__';
const ALL_CONTACT_STATUS_VALUE: ContactAccessFilter = 'all';
const DOCUMENT_ACCEPT_TYPES = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
].join(',');

const EMPTY_PAGINATION: OwnerDirectoryPagination = {
  page: 1,
  pageSize: USERS_PAGE_SIZE,
  totalItems: 0,
  totalPages: 1,
  rangeStart: 0,
  rangeEnd: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

const EMPTY_SUMMARY: OwnerDirectorySummary = {
  totalOwners: 0,
  unlockedCount: 0,
  lockedCount: 0,
  pendingCount: 0,
  temporarilyDeniedCount: 0,
  permanentlyDeniedCount: 0,
};

const EMPTY_ALLOWANCE: RequestAllowance = {
  dailyLimit: 5,
  usedToday: 0,
  remainingToday: 5,
  resetTimezone: 'Africa/Johannesburg',
  isLimitReached: false,
};

function getSummaryCardsPerView() {
  if (typeof window === 'undefined') return 3;
  if (window.innerWidth <= 760) return 1;
  if (window.innerWidth <= 1080) return 2;
  return 3;
}


function SearchIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
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

function MailIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6.5h16v11H4v-11Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m5 8 7 5 7-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10V8.1a5 5 0 0 1 10 0V10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 10h12v10H6V10Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 14v2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4.2 4.2L19.5 6.4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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

function FilterIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}

function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SendIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
    </svg>
  );
}

function ImageIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8" cy="10" r="1.5" />
      <path d="m21 15-5-5L5 19" />
    </svg>
  );
}

function MessageIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
    </svg>
  );
}

function UploadIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function DocumentIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  );
}

function asCleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function formatAccountType(value: string): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'finance') return 'Finance';
  if (normalized === 'insurance') return 'Insurance';
  if (normalized === 'dealer') return 'Dealer';

  return 'Aim4price';
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '';

  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(time));
}

function requestStatusLabel(status: ContactRequestStatus | null): string {
  if (status === 'approved') return 'Contact details unlocked';
  if (status === 'temporarily_denied') return 'Temporarily denied';
  if (status === 'permanently_denied') return 'Permanently denied';
  if (status === 'pending') return 'Request pending';
  return 'No request yet';
}

function requestDecisionLabel(status: ContactRequestStatus): string {
  if (status === 'approved') return 'Shared';
  if (status === 'temporarily_denied') return 'Temporarily denied';
  if (status === 'permanently_denied') return 'Permanently denied';
  return 'Pending';
}

function getRequesterName(request: ContactDetailRequest): string {
  return request.requesterBusinessName || request.requesterDisplayName || 'Aim4price user';
}

function ownerProvince(owner: OwnerDirectoryEntry): string {
  return asCleanText(owner.ownerProvince);
}

function ownerTownCity(owner: OwnerDirectoryEntry): string {
  return asCleanText(owner.ownerTownCity);
}

function getMessageSenderName(message: UserMessage): string {
  return message.senderBusinessName || message.senderDisplayName || 'Aim4price user';
}

function byteSizeLabel(value: number): string {
  if (!value) return '';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function paginationPages(page: number, totalPages: number): number[] {
  const maxButtons = 5;
  const safeTotal = Math.max(1, totalPages);

  if (safeTotal <= maxButtons) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(page - 2, safeTotal - maxButtons + 1));
  return Array.from({ length: maxButtons }, (_, index) => start + index);
}


function temporaryDenialExpired(owner: OwnerDirectoryEntry): boolean {
  if (owner.requestStatus !== 'temporarily_denied' || !owner.requestAgainAtIso) return false;
  const retryTime = Date.parse(owner.requestAgainAtIso);
  return Number.isFinite(retryTime) && retryTime <= Date.now();
}

function isOwnerDenied(owner: OwnerDirectoryEntry | null): boolean {
  return owner?.requestStatus === 'temporarily_denied' || owner?.requestStatus === 'permanently_denied';
}

function statusPillClass(status: ContactRequestStatus | null): string {
  if (status === 'temporarily_denied' || status === 'permanently_denied') return styles.statusPillDanger;
  if (status === 'pending') return styles.statusPillWarning;
  return styles.ownerUnlockedPill;
}

function fileNameHasExtension(fileName: string, extensions: string[]): boolean {
  const extension = fileName.split('.').pop()?.trim().toLowerCase() ?? '';
  return extensions.includes(extension);
}

function isImageAttachment(mimeType: string | undefined, fileName: string): boolean {
  const normalizedMimeType = asCleanText(mimeType).toLowerCase();
  return normalizedMimeType.startsWith('image/') || fileNameHasExtension(fileName, ['jpg', 'jpeg', 'png', 'webp']);
}

function isPdfAttachment(mimeType: string | undefined, fileName: string): boolean {
  const normalizedMimeType = asCleanText(mimeType).toLowerCase();
  return normalizedMimeType === 'application/pdf' || fileNameHasExtension(fileName, ['pdf']);
}

function selectedFileTypeLabel(file: File): string {
  if (isImageAttachment(file.type, file.name)) return 'Image preview';
  if (isPdfAttachment(file.type, file.name)) return 'PDF preview';
  if (fileNameHasExtension(file.name, ['csv'])) return 'CSV document';
  if (fileNameHasExtension(file.name, ['xls', 'xlsx'])) return 'Excel document';
  if (fileNameHasExtension(file.name, ['doc', 'docx'])) return 'Word document';

  return 'Document';
}

type FileUploadControlProps = {
  id: string;
  label: string;
  accept: string;
  file: File | null;
  buttonLabel: string;
  emptyLabel: string;
  helperText: string;
  iconType: 'image' | 'document';
  onFileChange: (file: File | null) => void;
};

function FileUploadControl({
  id,
  label,
  accept,
  file,
  buttonLabel,
  emptyLabel,
  helperText,
  iconType,
  onFileChange,
}: FileUploadControlProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const isImagePreview = file ? isImageAttachment(file.type, file.name) : false;
  const isPdfPreview = file ? isPdfAttachment(file.type, file.name) : false;
  const Icon = iconType === 'image' ? ImageIcon : DocumentIcon;

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [file]);

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    onFileChange(event.target.files?.[0] ?? null);
  }

  function clearSelectedFile() {
    if (inputRef.current) {
      inputRef.current.value = '';
    }

    onFileChange(null);
  }

  return (
    <div className={styles.fileUploadField}>
      <span>{label}</span>
      <div className={`${styles.fileUploadPanel} ${file ? styles.fileUploadPanelSelected : ''}`}>
        <input
          id={id}
          ref={inputRef}
          type="file"
          accept={accept}
          className={styles.fileUploadInput}
          onChange={handleInputChange}
        />

        <div className={styles.fileUploadRow}>
          <label htmlFor={id} className={styles.fileUploadButton}>
            <UploadIcon className={styles.fileUploadButtonIcon} />
            <span>{file ? 'Replace file' : buttonLabel}</span>
          </label>

          {file ? (
            <div className={styles.fileUploadMeta}>
              <strong>{file.name}</strong>
              <span>{[selectedFileTypeLabel(file), byteSizeLabel(file.size)].filter(Boolean).join(' · ')}</span>
            </div>
          ) : (
            <div className={styles.fileUploadEmptyCopy}>
              <strong>{emptyLabel}</strong>
              <small>{helperText}</small>
            </div>
          )}

          {file ? (
            <button type="button" className={styles.fileClearButton} onClick={clearSelectedFile}>
              Remove
            </button>
          ) : null}
        </div>

        {file && previewUrl ? (
          <div className={styles.filePreviewCard}>
            <div className={styles.filePreviewHeader}>
              <span className={styles.filePreviewIcon}>
                <Icon className={styles.filePreviewIconSvg} />
              </span>
              <div className={styles.filePreviewHeaderText}>
                <strong>Selected file preview</strong>
                <span>{file.name}</span>
              </div>
              <a href={previewUrl} target="_blank" rel="noreferrer" className={styles.filePreviewOpen}>
                Open
              </a>
            </div>

            {isImagePreview ? (
              <img src={previewUrl} alt={`Preview of ${file.name}`} className={styles.filePreviewMedia} />
            ) : isPdfPreview ? (
              <iframe src={previewUrl} title={`Preview of ${file.name}`} className={styles.filePreviewFrame} />
            ) : (
              <p className={styles.filePreviewNote}>This file is attached and can be opened for preview where the browser supports it.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FilterDropdown({
  label,
  dropdownKey,
  value,
  options,
  openDropdown,
  onOpenChange,
  onChange,
}: {
  label: string;
  dropdownKey: FilterDropdownKey;
  value: string;
  options: DropdownOption[];
  openDropdown: FilterDropdownKey | null;
  onOpenChange: (key: FilterDropdownKey | null) => void;
  onChange: (value: string) => void;
}) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const isOpen = openDropdown === dropdownKey;

  return (
    <label className={styles.filterField}>
      <span>{label}</span>
      <div className={styles.customSelect}>
        <button
          type="button"
          className={`${styles.customSelectButton} ${isOpen ? styles.customSelectButtonOpen : ''}`}
          onClick={() => onOpenChange(isOpen ? null : dropdownKey)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span>{selectedOption?.label ?? 'Choose option'}</span>
          <ChevronDownIcon className={styles.customSelectIcon} />
        </button>

        {isOpen ? (
          <div className={styles.customSelectMenu} role="listbox" aria-label={label}>
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  type="button"
                  key={`${dropdownKey}-${option.value}`}
                  className={`${styles.customSelectOption} ${isSelected ? styles.customSelectOptionActive : ''}`}
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

export default function UsersClient() {
  const [mode, setMode] = useState<UsersMode>('directory');
  const [accountType, setAccountType] = useState('owner');
  const [owners, setOwners] = useState<OwnerDirectoryEntry[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactDetailRequest[]>([]);
  const [incomingMessages, setIncomingMessages] = useState<UserMessage[]>([]);
  const [pagination, setPagination] = useState<OwnerDirectoryPagination>(EMPTY_PAGINATION);
  const [summary, setSummary] = useState<OwnerDirectorySummary>(EMPTY_SUMMARY);
  const [requestAllowance, setRequestAllowance] = useState<RequestAllowance>(EMPTY_ALLOWANCE);
  const [provinceOptions, setProvinceOptions] = useState<OwnerProvinceOption[]>([]);
  const [ownersWithoutProvinceCount, setOwnersWithoutProvinceCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvince, setSelectedProvince] = useState<string>(ALL_PROVINCES_VALUE);
  const [selectedContactAccessFilter, setSelectedContactAccessFilter] = useState<ContactAccessFilter>(ALL_CONTACT_STATUS_VALUE);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [openFilterDropdown, setOpenFilterDropdown] = useState<FilterDropdownKey | null>(null);
  const [openOwnerId, setOpenOwnerId] = useState<string | null>(null);
  const [popiaOwner, setPopiaOwner] = useState<OwnerDirectoryEntry | null>(null);
  const [sendOwner, setSendOwner] = useState<OwnerDirectoryEntry | null>(null);
  const [sendStep, setSendStep] = useState<SendModalStep>('choice');
  const [messageText, setMessageText] = useState('');
  const [adCaption, setAdCaption] = useState('');
  const [adImageFile, setAdImageFile] = useState<File | null>(null);
  const [messageDocumentFile, setMessageDocumentFile] = useState<File | null>(null);
  const [adDocumentFile, setAdDocumentFile] = useState<File | null>(null);
  const [activeMessage, setActiveMessage] = useState<UserMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [processingOwnerIds, setProcessingOwnerIds] = useState<Set<string>>(() => new Set());
  const [processingRequestIds, setProcessingRequestIds] = useState<Set<string>>(() => new Set());
  const [processingPopiaIds, setProcessingPopiaIds] = useState<Set<string>>(() => new Set());
  const [processingMessageIds, setProcessingMessageIds] = useState<Set<string>>(() => new Set());
  const summaryViewportRef = useRef<HTMLDivElement | null>(null);
  const summaryScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [summaryStartIndex, setSummaryStartIndex] = useState(0);
  const [summaryCardsPerView, setSummaryCardsPerView] = useState(3);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setNotice(null);

      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('pageSize', String(USERS_PAGE_SIZE));

      const trimmedSearch = searchTerm.trim();
      if (trimmedSearch) params.set('search', trimmedSearch);
      if (selectedProvince !== ALL_PROVINCES_VALUE) params.set('province', selectedProvince);
      if (selectedContactAccessFilter !== ALL_CONTACT_STATUS_VALUE) params.set('contactAccess', selectedContactAccessFilter);

      const query = params.toString();
      const response = await fetch(`/api/users${query ? `?${query}` : ''}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await response.json()) as UsersResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to load users.');
      }

      setMode(data.mode ?? 'directory');
      setAccountType(data.accountType ?? 'owner');
      setOwners(Array.isArray(data.owners) ? data.owners : []);
      setContactRequests(Array.isArray(data.contactRequests) ? data.contactRequests : []);
      setIncomingMessages(Array.isArray(data.incomingMessages) ? data.incomingMessages : []);
      setPagination(data.pagination ?? EMPTY_PAGINATION);
      setSummary(data.summary ?? EMPTY_SUMMARY);
      setProvinceOptions(Array.isArray(data.provinceOptions) ? data.provinceOptions : []);
      setOwnersWithoutProvinceCount(Number(data.ownersWithoutProvinceCount ?? 0));
      setRequestAllowance(data.requestAllowance ?? EMPTY_ALLOWANCE);
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to load users.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchTerm, selectedContactAccessFilter, selectedProvince]);

  const summaryCards = useMemo(() => [
    {
      key: 'total-owner-accounts',
      label: 'Total owner accounts',
      value: summary.totalOwners,
      detail: 'Owner accounts matching filters.',
    },
    {
      key: 'unlocked-contacts',
      label: 'Unlocked contacts',
      value: summary.unlockedCount,
      detail: 'Shared contact details.',
    },
    {
      key: 'pending-requests',
      label: 'Pending requests',
      value: summary.pendingCount,
      detail: 'Waiting for owner approval.',
    },
    {
      key: 'temporarily-denied',
      label: 'Temporarily denied',
      value: summary.temporarilyDeniedCount,
      detail: 'Locked for 90 days.',
    },
    {
      key: 'permanently-denied',
      label: 'Permanently denied',
      value: summary.permanentlyDeniedCount,
      detail: 'Blocked after 3 declined requests.',
    },
    {
      key: 'daily-requests',
      label: 'Daily requests',
      value: requestAllowance.remainingToday,
      detail: 'Daily request limit.',
    },
  ], [requestAllowance.dailyLimit, requestAllowance.remainingToday, summary]);

  const summaryMaxIndex = Math.max(0, summaryCards.length - summaryCardsPerView);
  const isSummaryAtStart = summaryStartIndex <= 0;
  const isSummaryAtEnd = summaryStartIndex >= summaryMaxIndex;

  const scrollSummaryToIndex = useCallback((nextIndex: number) => {
    const viewport = summaryViewportRef.current;
    if (!viewport) return;

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const nextScrollLeft = summaryMaxIndex > 0 ? (maxScrollLeft * nextIndex) / summaryMaxIndex : 0;

    window.requestAnimationFrame(() => {
      viewport.scrollTo({ left: nextScrollLeft, behavior: 'smooth' });
    });
  }, [summaryMaxIndex]);

  const handleSummarySlide = useCallback((direction: -1 | 1) => {
    setSummaryStartIndex((currentIndex) => {
      const nextIndex = Math.min(summaryMaxIndex, Math.max(0, currentIndex + direction));
      scrollSummaryToIndex(nextIndex);
      return nextIndex;
    });
  }, [scrollSummaryToIndex, summaryMaxIndex]);

  const handleSummaryScroll = useCallback(() => {
    const viewport = summaryViewportRef.current;
    if (!viewport || summaryMaxIndex <= 0) return;

    if (summaryScrollTimeoutRef.current) {
      clearTimeout(summaryScrollTimeoutRef.current);
    }

    summaryScrollTimeoutRef.current = setTimeout(() => {
      const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      if (maxScrollLeft <= 0) return;

      const nextIndex = Math.round((viewport.scrollLeft / maxScrollLeft) * summaryMaxIndex);
      setSummaryStartIndex((currentIndex) => (currentIndex === nextIndex ? currentIndex : nextIndex));
    }, 120);
  }, [summaryMaxIndex]);
  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setOpenFilterDropdown(null);
  }, [isFilterModalOpen]);

  useEffect(() => {
    if (pagination.page !== currentPage) {
      setCurrentPage(pagination.page);
    }
  }, [currentPage, pagination.page]);


  useEffect(() => {
    function handleViewportChange() {
      setSummaryCardsPerView(getSummaryCardsPerView());
    }

    handleViewportChange();
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
    };
  }, []);


  useEffect(() => () => {
    if (summaryScrollTimeoutRef.current) {
      clearTimeout(summaryScrollTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    setSummaryStartIndex((currentIndex) => Math.min(currentIndex, summaryMaxIndex));
  }, [summaryMaxIndex]);

  useEffect(() => {
    scrollSummaryToIndex(Math.min(summaryStartIndex, summaryMaxIndex));
  }, [scrollSummaryToIndex, summaryCardsPerView, summaryMaxIndex, summaryStartIndex]);

  const pendingRequests = useMemo(
    () => contactRequests.filter((request) => request.status === 'pending'),
    [contactRequests],
  );
  const decidedRequests = useMemo(
    () => contactRequests.filter((request) => request.status !== 'pending'),
    [contactRequests],
  );
  const unreadMessageCount = useMemo(
    () => incomingMessages.filter((message) => !message.readAtIso).length,
    [incomingMessages],
  );

  const hasActiveProvinceFilter = selectedProvince !== ALL_PROVINCES_VALUE;
  const hasActiveContactLockFilter = selectedContactAccessFilter !== ALL_CONTACT_STATUS_VALUE;
  const activeFilterCount = Number(hasActiveProvinceFilter) + Number(hasActiveContactLockFilter);
  const filterButtonLabel = activeFilterCount
    ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}`
    : 'Filters';

  const provinceFilterOptions = useMemo<DropdownOption[]>(() => {
    const options: DropdownOption[] = [
      { value: ALL_PROVINCES_VALUE, label: 'All provinces' },
      ...provinceOptions.map((province) => ({
        value: province.value,
        label: `${province.label} (${province.count})`,
      })),
    ];

    if (ownersWithoutProvinceCount > 0) {
      options.push({ value: PROVINCE_NOT_SAVED_VALUE, label: `Province not saved (${ownersWithoutProvinceCount})` });
    }

    return options;
  }, [ownersWithoutProvinceCount, provinceOptions]);

  const contactAccessOptions = useMemo<DropdownOption[]>(() => [
    { value: 'all', label: `All accounts (${summary.totalOwners})` },
    { value: 'locked', label: `Locked / no request (${summary.lockedCount})` },
    { value: 'pending', label: `Pending (${summary.pendingCount})` },
    { value: 'unlocked', label: `Unlocked (${summary.unlockedCount})` },
    { value: 'temporarily_denied', label: `Temporarily denied (${summary.temporarilyDeniedCount})` },
    { value: 'permanently_denied', label: `Permanently denied (${summary.permanentlyDeniedCount})` },
  ], [summary]);

  const visiblePaginationPages = useMemo(
    () => paginationPages(pagination.page, pagination.totalPages),
    [pagination.page, pagination.totalPages],
  );



  function updateOwnerRow(nextOwner: OwnerDirectoryEntry) {
    setOwners((current) => current.map((owner) => (owner.ownerUserId === nextOwner.ownerUserId ? nextOwner : owner)));
  }

  function updateMessageRow(nextMessage: UserMessage) {
    setIncomingMessages((current) => current.map((message) => (message.id === nextMessage.id ? nextMessage : message)));
  }

  function resetDirectoryPage() {
    setCurrentPage(1);
  }

  function handleSearchChange(value: string) {
    setSearchTerm(value);
    resetDirectoryPage();
  }

  function closeSendModal() {
    setSendOwner(null);
    setSendStep('choice');
    setMessageText('');
    setAdCaption('');
    setAdImageFile(null);
    setMessageDocumentFile(null);
    setAdDocumentFile(null);
  }

  function handleToggleOwnerDetails(owner: OwnerDirectoryEntry) {
    setOpenOwnerId((current) => (current === owner.ownerUserId ? null : owner.ownerUserId));

    if (owner.contactUnlocked && !owner.popiaAcknowledged) {
      setPopiaOwner(owner);
    }
  }

  async function handleRequestContact(owner: OwnerDirectoryEntry) {
    setNotice(null);
    setProcessingOwnerIds((current) => new Set(current).add(owner.ownerUserId));

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ownerUserId: owner.ownerUserId }),
      });
      const data = (await response.json()) as UsersResponse;

      if (!response.ok || !data.ok || !data.owner) {
        throw new Error(data.error || 'Failed to send contact request.');
      }

      updateOwnerRow(data.owner);
      setNotice({
        tone: 'success',
        message: data.owner.contactUnlocked
          ? 'Contact details are already unlocked for this owner.'
          : 'Contact request sent. The owner can share or deny contact details from their notification.',
      });
      void loadUsers();
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to send contact request.',
      });
    } finally {
      setProcessingOwnerIds((current) => {
        const next = new Set(current);
        next.delete(owner.ownerUserId);
        return next;
      });
    }
  }

  async function handleAcknowledgePopia(owner: OwnerDirectoryEntry) {
    if (!owner.requestId) return;

    setNotice(null);
    setProcessingPopiaIds((current) => new Set(current).add(owner.requestId as string));

    try {
      const response = await fetch(`/api/users/contact-requests/${encodeURIComponent(owner.requestId)}/popia`, {
        method: 'PATCH',
        credentials: 'include',
      });
      const data = (await response.json()) as UsersResponse;

      if (!response.ok || !data.ok || !data.owner) {
        throw new Error(data.error || 'Failed to acknowledge POPIA notice.');
      }

      updateOwnerRow(data.owner);
      setPopiaOwner(null);
      setOpenOwnerId(data.owner.ownerUserId);
      setNotice({ tone: 'success', message: 'POPIA notice acknowledged. Contact details are now visible.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to acknowledge POPIA notice.',
      });
    } finally {
      setProcessingPopiaIds((current) => {
        const next = new Set(current);
        if (owner.requestId) next.delete(owner.requestId);
        return next;
      });
    }
  }

  async function handleSend(kind: Exclude<SendModalStep, 'choice'>) {
    if (!sendOwner) return;

    if (isOwnerDenied(sendOwner)) {
      setNotice({
        tone: 'error',
        message: 'This owner account is denied. Sending is blocked.',
      });
      closeSendModal();
      return;
    }

    setNotice(null);
    setIsSending(true);

    try {
      const formData = new FormData();
      formData.set('ownerUserId', sendOwner.ownerUserId);
      formData.set('messageType', kind);

      if (kind === 'message') {
        formData.set('message', messageText);
        if (messageDocumentFile) formData.set('document', messageDocumentFile);
      } else {
        formData.set('caption', adCaption);
        if (adImageFile) formData.set('image', adImageFile);
        if (adDocumentFile) formData.set('document', adDocumentFile);
      }

      const response = await fetch('/api/users/messages', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = (await response.json()) as UsersResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to send.');
      }

      setNotice({
        tone: 'success',
        message: kind === 'message' ? 'Message sent to the owner account.' : 'Ad sent to the owner account.',
      });
      closeSendModal();
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to send.',
      });
    } finally {
      setIsSending(false);
    }
  }

  async function handleContactDecision(request: ContactDetailRequest, status: ContactDecisionStatus) {
    setNotice(null);
    setProcessingRequestIds((current) => new Set(current).add(request.id));

    try {
      const response = await fetch(`/api/users/contact-requests/${encodeURIComponent(request.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as UsersResponse;

      if (!response.ok || !data.ok || !data.contactRequest) {
        throw new Error(data.error || 'Failed to update contact request.');
      }

      setContactRequests((current) => current.map((item) => (item.id === request.id ? data.contactRequest as ContactDetailRequest : item)));
      setNotice({
        tone: 'success',
        message: status === 'approved'
          ? 'Contact details shared. The requester will see the POPIA notice before contact details are shown.'
          : data.contactRequest.status === 'permanently_denied'
            ? 'Contact request permanently denied.'
            : `Contact request temporarily denied. The requester can try again after ${formatDate(data.contactRequest.requestAgainAtIso)}.`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to update contact request.',
      });
    } finally {
      setProcessingRequestIds((current) => {
        const next = new Set(current);
        next.delete(request.id);
        return next;
      });
    }
  }

  async function handleOpenIncomingMessage(message: UserMessage) {
    setActiveMessage(message);

    if (message.readAtIso || processingMessageIds.has(message.id)) {
      return;
    }

    setProcessingMessageIds((current) => new Set(current).add(message.id));

    try {
      const response = await fetch(`/api/users/messages/${encodeURIComponent(message.id)}`, {
        method: 'PATCH',
        credentials: 'include',
      });
      const data = (await response.json()) as UsersResponse;

      if (response.ok && data.ok && data.message) {
        updateMessageRow(data.message);
        setActiveMessage(data.message);
      }
    } finally {
      setProcessingMessageIds((current) => {
        const next = new Set(current);
        next.delete(message.id);
        return next;
      });
    }
  }

  function renderOwnerDetails(owner: OwnerDirectoryEntry) {
    const province = ownerProvince(owner);
    const townCity = ownerTownCity(owner);
    const requestedAt = formatDate(owner.lastRequestedAtIso || owner.requestedAtIso);
    const updatedAt = formatDate(owner.updatedAtIso);
    const retryDate = formatDate(owner.requestAgainAtIso);
    const requestStatusNote = owner.requestStatus === 'temporarily_denied'
      ? temporaryDenialExpired(owner)
        ? 'Temporary lockout has ended. You may request this owner again.'
        : retryDate
          ? `Try again in 90 days. Available again: ${retryDate}.`
          : 'Try again after the temporary lockout ends.'
      : owner.requestStatus === 'permanently_denied'
        ? 'This owner cannot be requested again after three declined requests.'
        : owner.requestStatus === 'pending'
          ? requestedAt
            ? `Requested ${requestedAt}. Waiting for owner approval.`
            : 'Waiting for owner approval.'
          : owner.requestStatus === 'approved'
            ? owner.popiaAcknowledged
              ? 'POPIA notice acknowledged.'
              : 'POPIA acknowledgement is required before contact details are shown.'
            : 'No request has been sent yet.';
    const isPopiaProcessing = owner.requestId ? processingPopiaIds.has(owner.requestId) : false;

    return (
      <div className={styles.ownerDetails}>
        <div className={styles.detailGrid}>
          <div className={`${styles.detailPanel} ${styles.contactDetailPanel} ${styles.ownerInfoDetailPanel}`}>
            <span>Request status</span>
            <div className={styles.ownerInfoRows}>
              <div className={styles.ownerInfoRow}>
                <strong>{requestStatusLabel(owner.requestStatus)}</strong>
              </div>
              <div className={`${styles.ownerInfoRow} ${styles.ownerInfoNoteRow}`}>
                <p>{requestStatusNote}</p>
              </div>
            </div>
          </div>

          <div className={`${styles.detailPanel} ${styles.contactDetailPanel} ${styles.ownerInfoDetailPanel}`}>
            <span>Saved province</span>
            <div className={styles.ownerInfoRows}>
              <div className={styles.ownerInfoRow}>
                <strong>{province || 'Province not saved'}</strong>
              </div>
              <div className={`${styles.ownerInfoRow} ${styles.ownerInfoNoteRow}`}>
                <p>{townCity ? `Town / city: ${townCity}` : 'Town / city not saved.'}</p>
              </div>
            </div>
          </div>

          {owner.contactUnlocked ? (
            owner.popiaAcknowledged ? (
              <div className={`${styles.detailPanel} ${styles.contactDetailPanel}`}>
                <span>Unlocked contact details</span>
                <div className={styles.contactRows}>
                  <div className={styles.contactRow}>
                    <PhoneIcon className={styles.contactIcon} />
                    <strong>{owner.contactPhone || 'No phone saved yet'}</strong>
                  </div>
                  <div className={styles.contactRow}>
                    <MailIcon className={styles.contactIcon} />
                    <strong>{owner.contactEmail || 'No email saved yet'}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`${styles.detailPanel} ${styles.popiaPanel}`}>
                <span>Contact details unlocked</span>
                <strong>POPIA notice required</strong>
                <p>Accept the POPIA notice before viewing the owner phone and email.</p>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.compactDetailButton}`}
                  onClick={() => setPopiaOwner(owner)}
                  disabled={isPopiaProcessing}
                >
                  {isPopiaProcessing ? 'Saving...' : 'Review POPIA notice'}
                </button>
              </div>
            )
          ) : (
            <div className={`${styles.detailPanel} ${styles.lockedPanel}`}>
              <div className={styles.lockedIconBadge} aria-hidden="true">
                <LockIcon className={styles.lockedIcon} />
              </div>
              <div className={styles.lockedPanelContent}>
                <span>Contact details locked</span>
                <strong>{owner.requestStatus === 'temporarily_denied' ? 'Temporary lockout active' : owner.requestStatus === 'permanently_denied' ? 'Access blocked' : 'Owner approval required'}</strong>
                <p>{updatedAt ? `Last updated ${updatedAt}` : 'Contact details stay locked until the owner shares them.'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderRequestControl(owner: OwnerDirectoryEntry) {
    const isProcessing = processingOwnerIds.has(owner.ownerUserId);
    const hasPendingRequest = owner.requestStatus === 'pending';
    const isTemporarilyDenied = owner.requestStatus === 'temporarily_denied';
    const isTemporaryDenialExpired = temporaryDenialExpired(owner);
    const isPermanentlyDenied = owner.requestStatus === 'permanently_denied';

    if (owner.contactUnlocked) {
      return <span className={`${styles.statusPill} ${styles.ownerUnlockedPill}`}>Unlocked</span>;
    }

    if (hasPendingRequest || (isTemporarilyDenied && !isTemporaryDenialExpired) || isPermanentlyDenied) {
      return (
        <span className={`${styles.statusPill} ${statusPillClass(owner.requestStatus)}`}>
          {requestStatusLabel(owner.requestStatus)}
        </span>
      );
    }

    return (
      <button
        type="button"
        className={`${styles.primaryButton} ${styles.ownerRequestButton}`}
        onClick={() => handleRequestContact(owner)}
        disabled={isProcessing || requestAllowance.isLimitReached}
        title={requestAllowance.isLimitReached ? 'Daily request limit reached. You can request more users tomorrow.' : undefined}
      >
        {isProcessing ? 'Sending...' : requestAllowance.isLimitReached ? 'Limit reached' : isTemporaryDenialExpired ? 'Request again' : 'Request'}
      </button>
    );
  }

  function renderFilterModal() {
    if (!isFilterModalOpen) return null;

    return (
      <div className={styles.filterOverlay}>
        <div className={styles.modalBackdrop} onClick={() => setIsFilterModalOpen(false)} />

        <section className={styles.filterModal} role="dialog" aria-modal="true" aria-labelledby="users-filter-title">
          <div className={styles.modalHeader}>
            <div className={styles.modalHeaderText}>
              <h3 id="users-filter-title">Choose which accounts to show.</h3>
              <p className={styles.filterIntro}>Filter owner accounts by saved province and contact access.</p>
            </div>

            <button
              type="button"
              className={styles.modalCloseButton}
              onClick={() => setIsFilterModalOpen(false)}
              aria-label="Close account filters"
            >
              <CloseIcon className={styles.buttonIcon} />
            </button>
          </div>

          <div className={styles.filterModalForm}>
            <FilterDropdown
              label="Saved province"
              dropdownKey="province"
              value={selectedProvince}
              options={provinceFilterOptions}
              openDropdown={openFilterDropdown}
              onOpenChange={setOpenFilterDropdown}
              onChange={(value) => {
                setSelectedProvince(value);
                resetDirectoryPage();
              }}
            />

            <FilterDropdown
              label="Contact access"
              dropdownKey="contactAccess"
              value={selectedContactAccessFilter}
              options={contactAccessOptions}
              openDropdown={openFilterDropdown}
              onOpenChange={setOpenFilterDropdown}
              onChange={(value) => {
                setSelectedContactAccessFilter(value as ContactAccessFilter);
                resetDirectoryPage();
              }}
            />
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setSelectedProvince(ALL_PROVINCES_VALUE);
                setSelectedContactAccessFilter(ALL_CONTACT_STATUS_VALUE);
                resetDirectoryPage();
              }}
              disabled={!activeFilterCount}
            >
              Reset filters
            </button>
            <button type="button" className={styles.primaryButton} onClick={() => setIsFilterModalOpen(false)}>
              Apply filters
            </button>
          </div>
        </section>
      </div>
    );
  }

  function renderPopiaModal() {
    if (!popiaOwner) return null;

    const isProcessing = popiaOwner.requestId ? processingPopiaIds.has(popiaOwner.requestId) : false;

    return (
      <div className={styles.actionModalOverlay}>
        <div className={styles.modalBackdrop} />
        <section className={styles.actionModal} role="dialog" aria-modal="true" aria-labelledby="popia-notice-title">
          <div className={styles.modalHeader}>
            <div className={styles.modalHeaderText}>
              <h3 id="popia-notice-title">POPIA Notice</h3>
              <p>Unlocked contact details are private and must be handled responsibly.</p>
            </div>
          </div>

          <div className={styles.popiaNoticeBody}>
            <p>
              These contact details were shared for use inside Aim4price only. You may not copy, distribute, sell,
              forward, or share this information outside the intended business purpose. Please handle all owner contact
              information responsibly and in line with POPIA.
            </p>
          </div>

          <div className={styles.modalActions}>
            <button type="button" className={styles.primaryButton} onClick={() => handleAcknowledgePopia(popiaOwner)} disabled={isProcessing}>
              {isProcessing ? 'Saving...' : 'I understand'}
            </button>
          </div>
        </section>
      </div>
    );
  }

  function renderSendModal() {
    if (!sendOwner || isOwnerDenied(sendOwner)) return null;

    return (
      <div className={styles.actionModalOverlay}>
        <div className={styles.modalBackdrop} onClick={closeSendModal} />
        <section className={styles.actionModal} role="dialog" aria-modal="true" aria-labelledby="send-owner-title">
          <div className={styles.modalHeader}>
            <div className={styles.modalHeaderText}>
              <h3 id="send-owner-title">Send to {sendOwner.companyName}</h3>
              <p>Send an internal message or ad without exposing private owner contact details.</p>
            </div>

            <button type="button" className={styles.modalCloseButton} onClick={closeSendModal} aria-label="Close send modal">
              <CloseIcon className={styles.buttonIcon} />
            </button>
          </div>

          {sendStep === 'choice' ? (
            <div className={styles.sendChoiceGrid}>
              <button type="button" className={styles.sendChoiceCard} onClick={() => setSendStep('ad')}>
                <ImageIcon className={styles.sendChoiceIcon} />
                <strong>Send Ad</strong>
                <span>Upload an ad image and optional short caption for the owner.</span>
              </button>
              <button type="button" className={styles.sendChoiceCard} onClick={() => setSendStep('message')}>
                <MessageIcon className={styles.sendChoiceIcon} />
                <strong>Send Message</strong>
                <span>Write a message and optionally attach a document.</span>
              </button>
            </div>
          ) : null}

          {sendStep === 'message' ? (
            <div className={styles.sendForm}>
              <label className={styles.textAreaField}>
                <span>Message</span>
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Type your message to this owner"
                  rows={6}
                />
              </label>
              <FileUploadControl
                id="owner-message-document-upload"
                label="Optional document"
                accept={DOCUMENT_ACCEPT_TYPES}
                file={messageDocumentFile}
                buttonLabel="Upload document"
                emptyLabel="No document selected"
                helperText="PDF, Word, Excel, CSV or image. Maximum 10 MB."
                iconType="document"
                onFileChange={setMessageDocumentFile}
              />
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setSendStep('choice')} disabled={isSending}>
                  Back
                </button>
                <button type="button" className={styles.primaryButton} onClick={() => handleSend('message')} disabled={isSending || !messageText.trim()}>
                  {isSending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>
          ) : null}

          {sendStep === 'ad' ? (
            <div className={styles.sendForm}>
              <FileUploadControl
                id="owner-ad-image-upload"
                label="Ad image"
                accept="image/png,image/jpeg,image/webp"
                file={adImageFile}
                buttonLabel="Upload ad image"
                emptyLabel="No ad image selected"
                helperText="JPG, PNG or WebP. Maximum 8 MB."
                iconType="image"
                onFileChange={setAdImageFile}
              />
              <label className={styles.textAreaField}>
                <span>Optional caption</span>
                <textarea
                  value={adCaption}
                  onChange={(event) => setAdCaption(event.target.value)}
                  placeholder="Add a short note with the ad"
                  rows={4}
                />
              </label>
              <FileUploadControl
                id="owner-ad-document-upload"
                label="Optional document"
                accept={DOCUMENT_ACCEPT_TYPES}
                file={adDocumentFile}
                buttonLabel="Upload document"
                emptyLabel="No document selected"
                helperText="PDF, Word, Excel, CSV or image. Maximum 10 MB."
                iconType="document"
                onFileChange={setAdDocumentFile}
              />
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setSendStep('choice')} disabled={isSending}>
                  Back
                </button>
                <button type="button" className={styles.primaryButton} onClick={() => handleSend('ad')} disabled={isSending || !adImageFile}>
                  {isSending ? 'Sending...' : 'Send Ad'}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  function renderMessageModal() {
    if (!activeMessage) return null;

    const senderName = getMessageSenderName(activeMessage);
    const isAd = activeMessage.messageType === 'ad';
    const documentIsImage = activeMessage.hasDocument
      ? isImageAttachment(activeMessage.documentMimeType, activeMessage.documentFileName)
      : false;
    const documentIsPdf = activeMessage.hasDocument
      ? isPdfAttachment(activeMessage.documentMimeType, activeMessage.documentFileName)
      : false;

    return (
      <div className={styles.actionModalOverlay}>
        <div className={styles.modalBackdrop} onClick={() => setActiveMessage(null)} />
        <section className={styles.actionModal} role="dialog" aria-modal="true" aria-labelledby="incoming-message-title">
          <div className={styles.modalHeader}>
            <div className={styles.modalHeaderText}>
              <h3 id="incoming-message-title">{isAd ? 'Ad received' : 'Message received'}</h3>
              <p>{senderName} · {formatAccountType(activeMessage.senderAccountType)} account</p>
            </div>

            <button type="button" className={styles.modalCloseButton} onClick={() => setActiveMessage(null)} aria-label="Close message">
              <CloseIcon className={styles.buttonIcon} />
            </button>
          </div>

          <div className={styles.incomingMessageBody}>
            {activeMessage.hasImage ? (
              <img src={activeMessage.imageUrl} alt={activeMessage.imageFileName || 'Sent ad'} className={styles.incomingMessageImage} />
            ) : null}
            <p>{isAd ? activeMessage.adCaption || 'No caption supplied.' : activeMessage.messageText}</p>
            <small>{formatDate(activeMessage.createdAtIso)}</small>
            {activeMessage.hasDocument ? (
              <div className={styles.incomingDocumentPreview}>
                {documentIsImage ? (
                  <img
                    src={activeMessage.documentUrl}
                    alt={activeMessage.documentFileName || 'Attached image'}
                    className={styles.incomingMessageImage}
                  />
                ) : documentIsPdf ? (
                  <iframe
                    src={activeMessage.documentUrl}
                    title={activeMessage.documentFileName || 'Attached PDF'}
                    className={styles.incomingDocumentFrame}
                  />
                ) : null}
                <a
                  href={activeMessage.documentUrl}
                  className={styles.attachmentLink}
                  target="_blank"
                  rel="noreferrer"
                  download={activeMessage.documentFileName || undefined}
                >
                  <span>{documentIsImage || documentIsPdf ? 'Open attachment' : 'Attached document'}</span>
                  <strong>{activeMessage.documentFileName || 'Open document'}</strong>
                  {activeMessage.documentSizeBytes ? <small>{byteSizeLabel(activeMessage.documentSizeBytes)}</small> : null}
                </a>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  function renderPagination() {
    if (pagination.totalItems <= pagination.pageSize) return null;

    return (
      <nav className={styles.usersPagination} aria-label="Users pagination">
        <div className={styles.usersPaginationSummary}>
          Showing <strong>{pagination.rangeStart}</strong>-<strong>{pagination.rangeEnd}</strong> of <strong>{pagination.totalItems}</strong> users
        </div>
        <div className={styles.usersPaginationControls}>
          <button
            type="button"
            className={styles.usersPaginationButton}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={!pagination.hasPreviousPage || isLoading}
          >
            Previous
          </button>
          <div className={styles.usersPaginationPages}>
            {visiblePaginationPages.map((page) => (
              <button
                type="button"
                key={`users-page-${page}`}
                className={`${styles.usersPaginationPageButton} ${page === pagination.page ? styles.usersPaginationPageButtonActive : ''}`}
                onClick={() => setCurrentPage(page)}
                disabled={isLoading}
                aria-current={page === pagination.page ? 'page' : undefined}
              >
                {page}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.usersPaginationButton}
            onClick={() => setCurrentPage((page) => Math.min(pagination.totalPages, page + 1))}
            disabled={!pagination.hasNextPage || isLoading}
          >
            Next
          </button>
        </div>
      </nav>
    );
  }

  function renderOwnerDirectory() {
    return (
      <>
        <section className={styles.heroPanel}>
          <h1>AIM4PRICE USER LIST</h1>
        </section>

        <section className={styles.controlsPanel} aria-label="Owner account controls">
          <section className={styles.summaryCarousel} aria-label="Users summary">
            <button
              type="button"
              className={styles.summaryArrow}
              onClick={() => handleSummarySlide(-1)}
              disabled={isSummaryAtStart}
              aria-label="Show previous user summary cards"
            >
              <span aria-hidden="true">&lt;</span>
            </button>

            <div
              className={styles.summaryViewport}
              ref={summaryViewportRef}
              onScroll={handleSummaryScroll}
              tabIndex={0}
              aria-label="Scrollable user summary cards"
            >
              <div className={styles.summaryTrack}>
                {summaryCards.map((card) => (
                  <article className={styles.summaryCard} key={card.key} data-summary-card="true">
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    <small>{card.detail}</small>
                  </article>
                ))}
              </div>
            </div>

            <button
              type="button"
              className={styles.summaryArrow}
              onClick={() => handleSummarySlide(1)}
              disabled={isSummaryAtEnd}
              aria-label="Show next user summary cards"
            >
              <span aria-hidden="true">&gt;</span>
            </button>
          </section>

          <section className={styles.toolbar} aria-label="Search and filter owners">
            <label className={styles.searchBox}>
              <SearchIcon className={styles.searchIcon} />
              <input
                value={searchTerm}
                onChange={(event: ChangeEvent<HTMLInputElement>) => handleSearchChange(event.target.value)}
                placeholder="Search by company, province or town"
                aria-label="Search company names"
              />
              {searchTerm ? (
                <button
                  type="button"
                  className={styles.clearSearchButton}
                  onClick={() => handleSearchChange('')}
                  aria-label="Clear company search"
                >
                  <CloseIcon className={styles.buttonIcon} />
                </button>
              ) : null}
            </label>

            <button
              type="button"
              className={`${styles.filterButton} ${activeFilterCount ? styles.filterButtonActive : ''}`}
              onClick={() => setIsFilterModalOpen(true)}
              disabled={isLoading}
            >
              <FilterIcon className={styles.buttonIcon} />
              <span>{filterButtonLabel}</span>
              <ChevronDownIcon className={styles.filterChevron} />
            </button>
          </section>

          <div className={`${styles.requestAllowanceNote} ${requestAllowance.isLimitReached ? styles.requestAllowanceLimit : ''}`}>
            {requestAllowance.isLimitReached
              ? 'Daily request limit reached. You can request more users tomorrow.'
              : `${requestAllowance.remainingToday} of ${requestAllowance.dailyLimit} requests remaining today.`}
            <span> Daily reset uses South African time.</span>
          </div>
        </section>

        <section className={styles.cardStack} aria-label="Owner accounts">
          {isLoading ? (
            <div className={styles.emptyState}>Loading owner accounts...</div>
          ) : owners.length ? (
            owners.map((owner) => {
              const isOpen = openOwnerId === owner.ownerUserId;
              const province = ownerProvince(owner);
              const canSendToOwner = !isOwnerDenied(owner);

              return (
                <article key={owner.ownerUserId} className={`${styles.ownerCard} ${isOpen ? styles.ownerCardOpen : ''}`}>
                  <div className={styles.ownerCardHeader}>
                    <div className={styles.ownerIdentity}>
                      <span className={styles.ownerKicker}>{province ? `Province saved: ${province}` : 'Province not saved'}</span>
                      <h2>{owner.companyName}</h2>
                    </div>

                    <div className={styles.ownerActionRow}>
                      {canSendToOwner ? (
                        <button
                          type="button"
                          className={`${styles.sendOwnerButton}`}
                          onClick={() => {
                            setSendOwner(owner);
                            setSendStep('choice');
                          }}
                        >
                          <SendIcon className={styles.buttonIcon} />
                          Send
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className={`${styles.outlineButton} ${styles.ownerDetailsButton}`}
                        onClick={() => handleToggleOwnerDetails(owner)}
                      >
                        {isOpen ? 'Close' : 'View Details'}
                      </button>

                      {renderRequestControl(owner)}
                    </div>
                  </div>

                  {isOpen ? renderOwnerDetails(owner) : null}
                </article>
              );
            })
          ) : (
            <div className={styles.emptyState}>No owner accounts match this search or filter.</div>
          )}
        </section>

        {renderPagination()}
        {renderFilterModal()}
        {renderPopiaModal()}
        {renderSendModal()}
      </>
    );
  }

  function renderContactRequestCard(request: ContactDetailRequest, isHistoric = false) {
    const isProcessing = processingRequestIds.has(request.id);
    const requesterName = getRequesterName(request);
    const retryDate = formatDate(request.requestAgainAtIso);

    return (
      <article key={request.id} className={`${styles.requestCard} ${isHistoric ? styles.requestCardHistoric : ''}`}>
        <div className={styles.requestTopline}>
          <span>{formatAccountType(request.requesterAccountType)} account</span>
          <strong>{requestDecisionLabel(request.status)}</strong>
        </div>
        <div className={styles.requestBody}>
          <div>
            <h2>{requesterName}</h2>
            <p>
              {request.status === 'pending'
                ? `${requesterName} wants to be in contact with you. Share contact details or deny request.`
                : request.status === 'approved'
                  ? 'Contact details were shared with this account.'
                  : request.status === 'permanently_denied'
                    ? 'This account has been permanently denied after three declined requests.'
                    : `This account was temporarily denied.${retryDate ? ` Available again: ${retryDate}.` : ''}`}
            </p>
            <small>{formatDate(request.createdAtIso)}</small>
          </div>
          {request.status === 'pending' ? (
            <div className={styles.requestActions}>
              <button
                type="button"
                className={styles.shareButton}
                onClick={() => handleContactDecision(request, 'approved')}
                disabled={isProcessing}
              >
                <CheckIcon className={styles.buttonIcon} />
                {isProcessing ? 'Updating...' : 'Share contact details'}
              </button>
              <button
                type="button"
                className={styles.denyButton}
                onClick={() => handleContactDecision(request, 'denied')}
                disabled={isProcessing}
              >
                <CloseIcon className={styles.buttonIcon} />
                Deny request
              </button>
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  function renderIncomingMessageCard(message: UserMessage) {
    const isUnread = !message.readAtIso;
    const senderName = getMessageSenderName(message);
    const isAd = message.messageType === 'ad';
    const preview = isAd ? message.adCaption || 'Ad image received.' : message.messageText;

    return (
      <article key={message.id} className={`${styles.messageCard} ${isUnread ? styles.messageCardUnread : ''}`}>
        <div className={styles.messageCardCopy}>
          <div className={styles.requestTopline}>
            <span>{formatAccountType(message.senderAccountType)} account</span>
            <strong>{isUnread ? 'Unread' : 'Read'}</strong>
          </div>
          <h2>{senderName}</h2>
          <p>{preview}</p>
          <small>{formatDate(message.createdAtIso)}</small>
        </div>
        {message.hasImage ? <img src={message.imageUrl} alt={message.imageFileName || 'Ad image'} className={styles.messageThumb} /> : null}
        <button type="button" className={styles.outlineButton} onClick={() => handleOpenIncomingMessage(message)}>
          Open
        </button>
      </article>
    );
  }

  function renderOwnerRequests() {
    return (
      <>
        <section className={styles.heroPanel}>
          <h1>NOTIFICATIONS</h1>
        </section>

        <section className={styles.ownerNotificationFallback} aria-label="Owner notifications">
          <h2>Contact requests, messages and ads now open from the bell.</h2>
          <p>
            Use the notification bell in the header to review contact access requests, open messages, view ads and make accept/deny decisions from a centered modal. You do not need to leave your Asset Register page.
          </p>
        </section>

        {renderMessageModal()}
      </>
    );
  }

  return (
    <main className={styles.page}>
      <AppHeader active={mode === 'directory' ? 'users' : 'none'} />

      <div className={styles.shell}>
        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}
        {mode === 'directory' ? renderOwnerDirectory() : renderOwnerRequests()}
        {!isLoading && mode === 'directory' && summary.totalOwners === 0 ? (
          <p className={styles.footerNote}>Owner accounts will appear here once they have created an Aim4price profile.</p>
        ) : null}
        <p className={styles.footerNote}>
          {mode === 'directory'
            ? `${formatAccountType(accountType)} users only see company names until an owner shares contact details and the POPIA notice is acknowledged.`
            : 'Owner contact requests, messages and ads are handled from the notification bell.'}
        </p>
      </div>
    </main>
  );
}
