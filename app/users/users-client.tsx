'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type MouseEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type ContactRequestStatus = 'pending' | 'approved' | 'denied';
type UsersMode = 'directory' | 'requests';
type NoticeTone = 'success' | 'error';

type OwnerDirectoryEntry = {
  ownerUserId: string;
  companyName: string;
  requestId: string | null;
  requestStatus: ContactRequestStatus | null;
  contactUnlocked: boolean;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactLocation: string;
  ownerProvince: string;
  ownerTownCity: string;
  requestedAtIso: string | null;
  updatedAtIso: string | null;
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
  approvedAtIso: string | null;
  deniedAtIso: string | null;
  updatedAtIso: string;
};

type UsersResponse = {
  ok: boolean;
  mode?: UsersMode;
  accountType?: string;
  owners?: OwnerDirectoryEntry[];
  owner?: OwnerDirectoryEntry;
  contactRequests?: ContactDetailRequest[];
  contactRequest?: ContactDetailRequest;
  error?: string;
};

type IconProps = {
  className?: string;
};

const ALL_PROVINCES_VALUE = 'all';
const PROVINCE_NOT_SAVED_VALUE = '__province_not_saved__';

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
  if (status === 'denied') return 'Request denied';
  if (status === 'pending') return 'Request pending';
  return 'No request yet';
}

function getRequesterName(request: ContactDetailRequest): string {
  return request.requesterBusinessName || request.requesterDisplayName || 'Aim4price user';
}

function ownerSearchText(owner: OwnerDirectoryEntry): string {
  return [
    owner.companyName,
    owner.ownerProvince,
    owner.ownerTownCity,
    owner.contactUnlocked ? owner.contactName : '',
    owner.contactUnlocked ? owner.contactPhone : '',
    owner.contactUnlocked ? owner.contactEmail : '',
    owner.contactUnlocked ? owner.contactLocation : '',
  ]
    .map((value) => asCleanText(value).toLowerCase())
    .filter(Boolean)
    .join(' ');
}

function ownerProvince(owner: OwnerDirectoryEntry): string {
  return asCleanText(owner.ownerProvince);
}

function ownerTownCity(owner: OwnerDirectoryEntry): string {
  return asCleanText(owner.ownerTownCity);
}

function renderProvinceLabel(value: string): string {
  if (value === PROVINCE_NOT_SAVED_VALUE) return 'Province not saved';
  if (value === ALL_PROVINCES_VALUE) return 'Filter';
  return value;
}

export default function UsersClient() {
  const [mode, setMode] = useState<UsersMode>('directory');
  const [accountType, setAccountType] = useState('owner');
  const [owners, setOwners] = useState<OwnerDirectoryEntry[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactDetailRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvince, setSelectedProvince] = useState<string>(ALL_PROVINCES_VALUE);
  const [isProvinceFilterOpen, setIsProvinceFilterOpen] = useState(false);
  const [openOwnerId, setOpenOwnerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [processingOwnerIds, setProcessingOwnerIds] = useState<Set<string>>(() => new Set());
  const [processingRequestIds, setProcessingRequestIds] = useState<Set<string>>(() => new Set());

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setNotice(null);

      const response = await fetch('/api/users', {
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
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to load users.',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const provinceCounts = useMemo(() => {
    return owners.reduce<Record<string, number>>((counts, owner) => {
      const province = ownerProvince(owner);

      if (!province) {
        return counts;
      }

      counts[province] = (counts[province] ?? 0) + 1;
      return counts;
    }, {});
  }, [owners]);

  const provinceOptions = useMemo(() => {
    return Object.keys(provinceCounts).sort((first, second) => first.localeCompare(second));
  }, [provinceCounts]);

  const ownersWithoutProvinceCount = useMemo(
    () => owners.filter((owner) => !ownerProvince(owner)).length,
    [owners],
  );

  const hasActiveProvinceFilter = selectedProvince !== ALL_PROVINCES_VALUE;
  const activeProvinceLabel = renderProvinceLabel(selectedProvince);

  useEffect(() => {
    if (selectedProvince === ALL_PROVINCES_VALUE) return;

    if (selectedProvince === PROVINCE_NOT_SAVED_VALUE) {
      if (ownersWithoutProvinceCount === 0) {
        setSelectedProvince(ALL_PROVINCES_VALUE);
      }
      return;
    }

    if (!provinceOptions.includes(selectedProvince)) {
      setSelectedProvince(ALL_PROVINCES_VALUE);
    }
  }, [ownersWithoutProvinceCount, provinceOptions, selectedProvince]);

  const filteredOwners = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return owners.filter((owner) => {
      const province = ownerProvince(owner);
      const matchesSearch = !normalizedSearch || ownerSearchText(owner).includes(normalizedSearch);
      const matchesProvince = selectedProvince === ALL_PROVINCES_VALUE
        || (selectedProvince === PROVINCE_NOT_SAVED_VALUE ? !province : province.toLowerCase() === selectedProvince.toLowerCase());

      return matchesSearch && matchesProvince;
    });
  }, [owners, searchTerm, selectedProvince]);

  const pendingRequests = useMemo(
    () => contactRequests.filter((request) => request.status === 'pending'),
    [contactRequests],
  );
  const decidedRequests = useMemo(
    () => contactRequests.filter((request) => request.status !== 'pending'),
    [contactRequests],
  );

  function updateOwnerRow(nextOwner: OwnerDirectoryEntry) {
    setOwners((current) => current.map((owner) => (owner.ownerUserId === nextOwner.ownerUserId ? nextOwner : owner)));
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

  async function handleContactDecision(request: ContactDetailRequest, status: Exclude<ContactRequestStatus, 'pending'>) {
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
          ? 'Contact details shared. The requester can now see your saved contact details.'
          : 'Contact request denied.',
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

  function handleFilterOverlayMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      setIsProvinceFilterOpen(false);
    }
  }

  function renderOwnerDetails(owner: OwnerDirectoryEntry) {
    const province = ownerProvince(owner);
    const townCity = ownerTownCity(owner);
    const requestedAt = formatDate(owner.requestedAtIso);
    const updatedAt = formatDate(owner.updatedAtIso);

    return (
      <div className={styles.ownerDetails}>
        <div className={styles.detailGrid}>
          <div className={styles.detailPanel}>
            <span>Request status</span>
            <strong>{requestStatusLabel(owner.requestStatus)}</strong>
            <p>{requestedAt ? `Requested ${requestedAt}` : 'No request has been sent yet.'}</p>
          </div>

          <div className={styles.detailPanel}>
            <span>Saved province</span>
            <strong>{province || 'Province not saved'}</strong>
            <p>{townCity ? `Town / city: ${townCity}` : 'Town / city not saved.'}</p>
          </div>

          {owner.contactUnlocked ? (
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
                <p>{owner.contactLocation || 'Location not saved.'}</p>
              </div>
            </div>
          ) : (
            <div className={`${styles.detailPanel} ${styles.lockedPanel}`}>
              <LockIcon className={styles.lockedIcon} />
              <div>
                <span>Contact details locked</span>
                <strong>Owner approval required</strong>
                <p>{updatedAt ? `Last updated ${updatedAt}` : 'Contact details stay locked until the owner shares them.'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderProvinceFilterModal() {
    if (!isProvinceFilterOpen) return null;

    return (
      <div className={styles.filterOverlay} onMouseDown={handleFilterOverlayMouseDown}>
        <section className={styles.filterModal} role="dialog" aria-modal="true" aria-labelledby="province-filter-title">
          <div className={styles.modalHeader}>
            <div>
              <h3 id="province-filter-title">Choose province.</h3>
              <p>Filter owner accounts by the province saved on their account profile.</p>
            </div>
            <button
              type="button"
              className={styles.modalCloseButton}
              onClick={() => setIsProvinceFilterOpen(false)}
              aria-label="Close province filter"
            >
              <CloseIcon className={styles.buttonIcon} />
            </button>
          </div>

          <div className={styles.provinceList}>
            <button
              type="button"
              className={`${styles.provinceOption} ${selectedProvince === ALL_PROVINCES_VALUE ? styles.provinceOptionActive : ''}`}
              onClick={() => setSelectedProvince(ALL_PROVINCES_VALUE)}
            >
              <span>All provinces</span>
              <strong>{owners.length}</strong>
            </button>

            {provinceOptions.map((province) => (
              <button
                key={province}
                type="button"
                className={`${styles.provinceOption} ${selectedProvince === province ? styles.provinceOptionActive : ''}`}
                onClick={() => setSelectedProvince(province)}
              >
                <span>{province}</span>
                <strong>{provinceCounts[province] ?? 0}</strong>
              </button>
            ))}

            {ownersWithoutProvinceCount ? (
              <button
                type="button"
                className={`${styles.provinceOption} ${selectedProvince === PROVINCE_NOT_SAVED_VALUE ? styles.provinceOptionActive : ''}`}
                onClick={() => setSelectedProvince(PROVINCE_NOT_SAVED_VALUE)}
              >
                <span>Province not saved</span>
                <strong>{ownersWithoutProvinceCount}</strong>
              </button>
            ) : null}
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setSelectedProvince(ALL_PROVINCES_VALUE)}
            >
              Reset filter
            </button>
            <button type="button" className={styles.primaryButton} onClick={() => setIsProvinceFilterOpen(false)}>
              Apply filter
            </button>
          </div>
        </section>
      </div>
    );
  }

  function renderOwnerDirectory() {
    return (
      <>
        <section className={styles.heroPanel}>
          <h1>AIM4PRICE ACCOUNTS</h1>
        </section>

        <section className={styles.controlsPanel} aria-label="Owner account controls">
          <section className={styles.summaryGrid} aria-label="Users summary">
            <article className={styles.summaryCard}>
              <span>Total owner accounts</span>
              <strong>{owners.length}</strong>
            </article>
            <article className={styles.summaryCard}>
              <span>Unlocked contacts</span>
              <strong>{owners.filter((owner) => owner.contactUnlocked).length}</strong>
            </article>
            <article className={styles.summaryCard}>
              <span>Pending requests</span>
              <strong>{owners.filter((owner) => owner.requestStatus === 'pending').length}</strong>
            </article>
          </section>

          <section className={styles.toolbar} aria-label="Search and filter owners">
            <label className={styles.searchBox}>
              <SearchIcon className={styles.searchIcon} />
              <input
                value={searchTerm}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchTerm(event.target.value)}
                placeholder="Search..."
                aria-label="Search company names"
              />
              {searchTerm ? (
                <button
                  type="button"
                  className={styles.clearSearchButton}
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear company search"
                >
                  <CloseIcon className={styles.buttonIcon} />
                </button>
              ) : null}
            </label>

            <button
              type="button"
              className={`${styles.filterButton} ${hasActiveProvinceFilter ? styles.filterButtonActive : ''}`}
              onClick={() => setIsProvinceFilterOpen(true)}
              disabled={isLoading}
            >
              <FilterIcon className={styles.buttonIcon} />
              <span>{activeProvinceLabel}</span>
              <ChevronDownIcon className={styles.filterChevron} />
            </button>
          </section>
        </section>

        <section className={styles.cardStack} aria-label="Owner accounts">
          {isLoading ? (
            <div className={styles.emptyState}>Loading owner accounts...</div>
          ) : filteredOwners.length ? (
            filteredOwners.map((owner) => {
              const isProcessing = processingOwnerIds.has(owner.ownerUserId);
              const hasPendingRequest = owner.requestStatus === 'pending';
              const requestDenied = owner.requestStatus === 'denied';
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
                        className={styles.outlineButton}
                        onClick={() => setOpenOwnerId((current) => (current === owner.ownerUserId ? null : owner.ownerUserId))}
                      >
                        {isOpen ? 'Close' : 'View Details'}
                      </button>

                      {owner.contactUnlocked ? (
                        <span className={styles.statusPill}>Unlocked</span>
                      ) : (
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => handleRequestContact(owner)}
                          disabled={isProcessing || hasPendingRequest}
                        >
                          {isProcessing
                            ? 'Sending...'
                            : hasPendingRequest
                              ? 'Pending'
                              : requestDenied
                                ? 'Request again'
                                : 'Request'}
                        </button>
                      )}
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

        {renderProvinceFilterModal()}
      </>
    );
  }

  function renderContactRequestCard(request: ContactDetailRequest, isHistoric = false) {
    const isProcessing = processingRequestIds.has(request.id);
    const requesterName = getRequesterName(request);

    return (
      <article key={request.id} className={`${styles.requestCard} ${isHistoric ? styles.requestCardHistoric : ''}`}>
        <div className={styles.requestTopline}>
          <span>{formatAccountType(request.requesterAccountType)} account</span>
          <strong>{request.status === 'pending' ? 'Pending' : request.status === 'approved' ? 'Shared' : 'Denied'}</strong>
        </div>
        <div className={styles.requestBody}>
          <div>
            <h2>{requesterName}</h2>
            <p>{requesterName} wants to be in contact with you. Share contact details or deny request.</p>
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

  function renderOwnerRequests() {
    return (
      <>
        <section className={styles.heroPanel}>
          <h1>CONTACT REQUESTS</h1>
        </section>

        <p className={styles.pageLead}>Control which finance, insurance and dealer accounts can see your saved contact details.</p>

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
            <strong>{contactRequests.filter((request) => request.status === 'denied').length}</strong>
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

        {!isLoading && decidedRequests.length ? (
          <section className={styles.historySection} aria-label="Request history">
            <h2>Recent decisions</h2>
            <div className={styles.cardStack}>
              {decidedRequests.slice(0, 12).map((request) => renderContactRequestCard(request, true))}
            </div>
          </section>
        ) : null}
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
        {!isLoading && mode === 'directory' && owners.length === 0 ? (
          <p className={styles.footerNote}>Owner accounts will appear here once they have created an Aim4price profile.</p>
        ) : null}
        <p className={styles.footerNote}>
          {mode === 'directory'
            ? `${formatAccountType(accountType)} users only see company names until an owner shares contact details.`
            : 'Your contact details remain locked unless you approve a request.'}
        </p>
      </div>
    </main>
  );
}
