'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
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

function statusPillClass(status: ContactRequestStatus | null): string {
  if (status === 'temporarily_denied' || status === 'permanently_denied') return styles.statusPillDanger;
  if (status === 'pending') return styles.statusPillWarning;
  return styles.ownerUnlockedPill;
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
  const [activeMessage, setActiveMessage] = useState<UserMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [processingOwnerIds, setProcessingOwnerIds] = useState<Set<string>>(() => new Set());
  const [processingRequestIds, setProcessingRequestIds] = useState<Set<string>>(() => new Set());
  const [processingPopiaIds, setProcessingPopiaIds] = useState<Set<string>>(() => new Set());
  const [processingMessageIds, setProcessingMessageIds] = useState<Set<string>>(() => new Set());

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

    setNotice(null);
    setIsSending(true);

    try {
      const formData = new FormData();
      formData.set('ownerUserId', sendOwner.ownerUserId);
      formData.set('messageType', kind);

      if (kind === 'message') {
        formData.set('message', messageText);
      } else {
        formData.set('caption', adCaption);
        if (adImageFile) formData.set('image', adImageFile);
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
    const isPopiaProcessing = owner.requestId ? processingPopiaIds.has(owner.requestId) : false;

    return (
      <div className={styles.ownerDetails}>
        <div className={styles.detailGrid}>
          <div className={styles.detailPanel}>
            <span>Request status</span>
            <strong>{requestStatusLabel(owner.requestStatus)}</strong>
            {owner.requestStatus === 'temporarily_denied' ? (
              <p>{temporaryDenialExpired(owner) ? 'Temporary lockout has ended. You may request this owner again.' : retryDate ? `Try again in 90 days. Available again: ${retryDate}.` : 'Try again after the temporary lockout ends.'}</p>
            ) : owner.requestStatus === 'permanently_denied' ? (
              <p>This owner cannot be requested again after three declined requests.</p>
            ) : owner.requestStatus === 'pending' ? (
              <p>{requestedAt ? `Requested ${requestedAt}. Waiting for owner approval.` : 'Waiting for owner approval.'}</p>
            ) : owner.requestStatus === 'approved' ? (
              <p>{owner.popiaAcknowledged ? 'POPIA notice acknowledged.' : 'POPIA acknowledgement is required before contact details are shown.'}</p>
            ) : (
              <p>No request has been sent yet.</p>
            )}
          </div>

          <div className={styles.detailPanel}>
            <span>Saved province</span>
            <strong>{province || 'Province not saved'}</strong>
            <p>{townCity ? `Town / city: ${townCity}` : 'Town / city not saved.'}</p>
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
                  {owner.contactLocation ? <p>{owner.contactLocation}</p> : null}
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
    if (!sendOwner) return null;

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
                <span>Write an internal message for the owner account.</span>
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
              <label className={styles.fileUploadField}>
                <span>Ad image</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setAdImageFile(event.target.files?.[0] ?? null)}
                />
                <small>{adImageFile ? `${adImageFile.name} · ${byteSizeLabel(adImageFile.size)}` : 'JPG, PNG or WebP. Maximum 8 MB.'}</small>
              </label>
              <label className={styles.textAreaField}>
                <span>Optional caption</span>
                <textarea
                  value={adCaption}
                  onChange={(event) => setAdCaption(event.target.value)}
                  placeholder="Add a short note with the ad"
                  rows={4}
                />
              </label>
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
          <section className={styles.summaryGrid} aria-label="Users summary">
            <article className={styles.summaryCard}>
              <span>Total owner accounts</span>
              <strong>{summary.totalOwners}</strong>
              <small>Owner accounts matching your search and province filter.</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Unlocked contacts</span>
              <strong>{summary.unlockedCount}</strong>
              <small>Owners who have shared contact details.</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Pending requests</span>
              <strong>{summary.pendingCount}</strong>
              <small>Waiting for owner approval.</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Temporarily denied</span>
              <strong>{summary.temporarilyDeniedCount}</strong>
              <small>Locked for 90 days from owner decline.</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Permanently denied</span>
              <strong>{summary.permanentlyDeniedCount}</strong>
              <small>Blocked after three declined requests.</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Daily requests</span>
              <strong>{requestAllowance.remainingToday}</strong>
              <small>{requestAllowance.remainingToday} of {requestAllowance.dailyLimit} requests remaining today.</small>
            </article>
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

              return (
                <article key={owner.ownerUserId} className={`${styles.ownerCard} ${isOpen ? styles.ownerCardOpen : ''}`}>
                  <div className={styles.ownerCardHeader}>
                    <div className={styles.ownerIdentity}>
                      <span className={styles.ownerKicker}>{province ? `Province saved: ${province}` : 'Province not saved'}</span>
                      <h2>{owner.companyName}</h2>
                    </div>

                    <div className={styles.ownerActionRow}>
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
          <h1>CONTACT REQUESTS</h1>
        </section>

        <p className={styles.pageLead}>Control which finance, insurance and dealer accounts can see your saved contact details. Messages and ads sent to your owner account also appear here.</p>

        <section className={styles.summaryGrid} aria-label="Contact request summary">
          <article className={styles.summaryCard}>
            <span>Pending requests</span>
            <strong>{pendingRequests.length}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>Shared</span>
            <strong>{contactRequests.filter((request) => request.status === 'approved').length}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>Denied</span>
            <strong>{contactRequests.filter((request) => request.status === 'temporarily_denied' || request.status === 'permanently_denied').length}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>Unread messages</span>
            <strong>{unreadMessageCount}</strong>
          </article>
        </section>

        <section className={styles.cardStack} aria-label="Pending contact requests">
          {isLoading ? (
            <div className={styles.emptyState}>Loading contact requests...</div>
          ) : pendingRequests.length ? (
            pendingRequests.map((request) => renderContactRequestCard(request))
          ) : (
            <div className={styles.emptyState}>No pending contact detail requests.</div>
          )}
        </section>

        {!isLoading ? (
          <section className={styles.historySection} aria-label="Incoming messages and ads">
            <h2>Messages and ads</h2>
            <div className={styles.cardStack}>
              {incomingMessages.length ? incomingMessages.slice(0, 20).map((message) => renderIncomingMessageCard(message)) : <div className={styles.emptyState}>No messages or ads have been sent to your account yet.</div>}
            </div>
          </section>
        ) : null}

        {!isLoading && decidedRequests.length ? (
          <section className={styles.historySection} aria-label="Request history">
            <h2>Recent decisions</h2>
            <div className={styles.cardStack}>
              {decidedRequests.slice(0, 12).map((request) => renderContactRequestCard(request, true))}
            </div>
          </section>
        ) : null}

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
            : 'Your contact details remain locked unless you approve a request.'}
        </p>
      </div>
    </main>
  );
}
