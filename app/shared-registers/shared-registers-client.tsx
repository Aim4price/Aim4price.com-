'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type AccountType = 'owner' | 'dealer' | 'finance' | 'insurance';
type PartnerType = 'dealer' | 'finance' | 'insurance';
type GrantStatus = 'pending' | 'active' | 'revoked' | 'declined';
type NoticeTone = 'success' | 'error';
type SharedRegisterValueSort = 'highest' | 'lowest';

type IconProps = {
  className?: string;
};

type SessionResponse = {
  ok: boolean;
  signedIn: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    accountType: AccountType;
  } | null;
};

type SharedRegisterSummary = {
  id: string;
  ownerUserId: string;
  partnerUserId: string;
  partnerType: PartnerType;
  status: GrantStatus;
  permissionLevel: string;
  includeDocuments: boolean;
  includeScanHistory: boolean;
  ownerMessage: string;
  ownerName: string;
  ownerBusinessName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerProvince: string;
  ownerTownCity: string;
  createdAtIso: string;
  acceptedAtIso: string | null;
  revokedAtIso: string | null;
  declinedAtIso: string | null;
  lastViewedAtIso: string | null;
  assetCount: number;
  totalValue: number;
};

type SharedRegistersResponse = {
  ok: boolean;
  registers?: SharedRegisterSummary[];
  grant?: SharedRegisterSummary;
  error?: string;
};

const VAT_RATE = 0.15;

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

const VALUE_SORT_OPTIONS: Array<{ value: SharedRegisterValueSort; label: string }> = [
  { value: 'highest', label: 'Highest value first' },
  { value: 'lowest', label: 'Lowest value first' },
];

function FilterIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 12h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 17h2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m15 15 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m18 6-12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatCurrency(value: number | null | undefined): string {
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

function ownerName(register: SharedRegisterSummary): string {
  return register.ownerBusinessName || register.ownerName || 'Aim4price owner';
}

function ownerLocation(register: SharedRegisterSummary): string {
  return [register.ownerTownCity, register.ownerProvince].filter(Boolean).join(', ') || 'Location not saved';
}

function ownerContactParts(register: SharedRegisterSummary): string[] {
  return [
    register.ownerName || ownerName(register),
    register.ownerPhone || 'No contact number',
    register.ownerEmail || 'No email saved',
    ownerLocation(register),
  ].filter(Boolean);
}

function registerHref(register: SharedRegisterSummary): string {
  return `/shared-registers/${encodeURIComponent(register.ownerUserId)}`;
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

function registerMatchesSearch(register: SharedRegisterSummary, query: string): boolean {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  const haystack = [
    ownerName(register),
    register.ownerName,
    register.ownerBusinessName,
    register.ownerEmail,
    register.ownerPhone,
    register.ownerTownCity,
    register.ownerProvince,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export default function SharedRegistersClient() {
  const [registers, setRegisters] = useState<SharedRegisterSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [valueSort, setValueSort] = useState<SharedRegisterValueSort>('highest');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [registerToDelete, setRegisterToDelete] = useState<SharedRegisterSummary | null>(null);
  const [isDeletingAccess, setIsDeletingAccess] = useState(false);
  const [registerToOpen, setRegisterToOpen] = useState<SharedRegisterSummary | null>(null);
  const [hasAcceptedPopia, setHasAcceptedPopia] = useState(false);

  const activeRegisters = useMemo(() => registers.filter((register) => register.status === 'active'), [registers]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    activeRegisters.forEach((register) => {
      const parsed = new Date(register.createdAtIso);
      if (!Number.isNaN(parsed.getTime())) {
        years.add(parsed.getFullYear());
      }
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [activeRegisters]);

  const filteredRegisters = useMemo(() => {
    const filtered = activeRegisters.filter((register) => {
      const parsed = new Date(register.createdAtIso);
      const matchesMonth = monthFilter === 'all' || (!Number.isNaN(parsed.getTime()) && String(parsed.getMonth()) === monthFilter);
      const matchesYear = yearFilter === 'all' || (!Number.isNaN(parsed.getTime()) && String(parsed.getFullYear()) === yearFilter);
      return matchesMonth && matchesYear && registerMatchesSearch(register, searchTerm);
    });

    return [...filtered].sort((a, b) => {
      const left = Number(a.totalValue || 0);
      const right = Number(b.totalValue || 0);
      return valueSort === 'lowest' ? left - right : right - left;
    });
  }, [activeRegisters, monthFilter, searchTerm, valueSort, yearFilter]);

  const filteredActiveRegisterValue = useMemo(
    () => filteredRegisters.reduce((sum, register) => sum + Number(register.totalValue || 0), 0),
    [filteredRegisters],
  );

  const hasActiveFilters = Boolean(searchTerm.trim()) || monthFilter !== 'all' || yearFilter !== 'all' || valueSort !== 'highest';

  const loadRegisters = useCallback(async () => {
    setIsLoading(true);

    try {
      const [sessionResponse, registersResponse] = await Promise.all([
        fetch('/api/me', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/shared-registers', { cache: 'no-store', credentials: 'include' }),
      ]);
      const sessionData = (await sessionResponse.json()) as SessionResponse;
      const registersData = (await registersResponse.json()) as SharedRegistersResponse;

      if (!sessionData?.signedIn) {
        throw new Error('You must be signed in.');
      }

      if (!registersResponse.ok || !registersData.ok || !registersData.registers) {
        throw new Error(registersData.error ?? 'Failed to load shared registers.');
      }

      setRegisters(registersData.registers);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load shared registers.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRegisters();
  }, [loadRegisters]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function resetFilters() {
    setMonthFilter('all');
    setYearFilter('all');
    setValueSort('highest');
  }

  function openRegisterDisclaimer(register: SharedRegisterSummary) {
    setRegisterToOpen(register);
    setHasAcceptedPopia(false);
  }

  function closeRegisterDisclaimer() {
    setRegisterToOpen(null);
    setHasAcceptedPopia(false);
  }

  function confirmOpenRegister() {
    if (!registerToOpen || !hasAcceptedPopia) return;
    window.open(registerHref(registerToOpen), '_blank', 'noopener,noreferrer');
    closeRegisterDisclaimer();
  }

  function openDeleteModal(register: SharedRegisterSummary) {
    setRegisterToDelete(register);
  }

  function closeDeleteModal() {
    if (isDeletingAccess) return;
    setRegisterToDelete(null);
  }

  async function handleDeleteSharedAccess() {
    if (!registerToDelete) return;

    setIsDeletingAccess(true);

    try {
      const response = await fetch(`/api/shared-access/${encodeURIComponent(registerToDelete.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = (await response.json().catch(() => null)) as SharedRegistersResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? 'Failed to delete shared access.');
      }

      setRegisters((current) => current.filter((register) => register.id !== registerToDelete.id));
      setNotice({ tone: 'success', message: 'Shared access deleted.' });
      setRegisterToDelete(null);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to delete shared access.' });
    } finally {
      setIsDeletingAccess(false);
    }
  }

  return (
    <main className={styles.page}>
      <AppHeader active="asset-register" />

      <section className={styles.shell}>
        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <section className={styles.registerPanel}>
          <div className={styles.registerHeader}>
            <div className={styles.registerTitleBlock}>
              <h1>Shared registers</h1>
              <p>Open the owner registers shared to this account.</p>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                className={`${styles.secondaryButton} ${styles.filterTriggerButton} ${hasActiveFilters ? styles.filterTriggerButtonActive : ''}`}
                onClick={() => setIsFilterModalOpen(true)}
                disabled={isLoading}
              >
                <FilterIcon className={styles.buttonIcon} />
                <span>Filter</span>
                <ChevronDownIcon className={styles.filterChevron} />
              </button>
            </div>
          </div>

          <div className={styles.summaryRow}>
            <div className={`${styles.summaryTile} ${styles.registerValueTile}`}>
              <span className={styles.summaryLabel}>Total shared registers</span>
              <strong className={styles.summaryValue}>{filteredRegisters.length}</strong>
              <div className={styles.summaryFooter}>
                <small>{hasActiveFilters ? 'Showing after search and filters.' : `${activeRegisters.length} active ${activeRegisters.length === 1 ? 'register' : 'registers'}.`}</small>
              </div>
            </div>

            <div className={styles.summaryTile}>
              <span className={styles.summaryLabel}>Total value shared</span>
              <strong className={styles.summaryValue}>{formatCurrency(filteredActiveRegisterValue)}</strong>
              <div className={styles.summaryFooter}>
                <small>Excl. VAT</small>
              </div>
            </div>

            <div className={styles.summaryTile}>
              <span className={styles.summaryLabel}>Total value shared incl. VAT</span>
              <strong className={styles.summaryValue}>{formatCurrency(filteredActiveRegisterValue * (1 + VAT_RATE))}</strong>
              <div className={styles.summaryFooter}>
                <small>Calculated at 15% VAT.</small>
              </div>
            </div>
          </div>

          <div className={styles.toolbar}>
            <label className={styles.searchWrap}>
              <SearchIcon className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by owner, business, contact or location"
                aria-label="Search shared registers"
              />

              {searchTerm ? (
                <button
                  type="button"
                  className={styles.clearSearchButton}
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                >
                  <CloseIcon className={styles.buttonIcon} />
                </button>
              ) : null}
            </label>
          </div>

          {isLoading ? <div className={styles.emptyState}>Loading shared registers...</div> : null}

          {!isLoading && filteredRegisters.length ? (
            <div className={styles.registerStack}>
              {filteredRegisters.map((register) => {
                const registerValueText = `${formatCurrency(register.totalValue)} excl. VAT`;

                return (
                  <article className={styles.sharedRegisterCard} key={register.id}>
                    <div className={styles.sharedRegisterMain}>
                      <span className={styles.registerKicker}>Received {formatDate(register.createdAtIso)}</span>
                      <h2>{ownerName(register)}</h2>
                      <p className={styles.registerContactLine}>
                        {ownerContactParts(register).map((part) => (
                          <span key={part}>{part}</span>
                        ))}
                      </p>
                      <div className={styles.registerPreviewPill}>
                        <span>Full Asset Register</span>
                        <strong>{registerValueText}</strong>
                      </div>
                      {register.ownerMessage ? <p className={styles.ownerMessage}>{register.ownerMessage}</p> : null}
                    </div>

                    <div className={styles.sharedRegisterActions}>
                      <button type="button" className={styles.dangerButton} onClick={() => openDeleteModal(register)}>
                        Delete
                      </button>
                      <button type="button" className={styles.primaryButton} onClick={() => openRegisterDisclaimer(register)}>
                        Open
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {!isLoading && !filteredRegisters.length ? (
            <div className={styles.emptyState}>
              {registers.length ? 'No shared registers match the current search or filters.' : 'No owner registers are currently shared with this account.'}
            </div>
          ) : null}
        </section>
      </section>

      {isFilterModalOpen ? (
        <div className={styles.modalBackdrop}>
          <div className={`${styles.modalCard} ${styles.filterModal}`} role="dialog" aria-modal="true" aria-labelledby="shared-register-filter-title">
            <div className={styles.modalHeader}>
              <div>
                <h3 id="shared-register-filter-title">Filter shared registers.</h3>
                <p>Choose which shared registers to show by received date and value order.</p>
              </div>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => setIsFilterModalOpen(false)}
                aria-label="Close filters"
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={styles.filterGrid}>
              <label className={styles.field}>
                <span>Month</span>
                <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
                  {MONTH_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>Year</span>
                <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                  <option value="all">All years</option>
                  {yearOptions.map((year) => (
                    <option value={String(year)} key={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>Value order</span>
                <select value={valueSort} onChange={(event) => setValueSort(event.target.value as SharedRegisterValueSort)}>
                  {VALUE_SORT_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={resetFilters}>
                Reset
              </button>
              <button type="button" className={styles.primaryButton} onClick={() => setIsFilterModalOpen(false)}>
                Apply filters
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {registerToOpen ? (
        <div className={styles.modalBackdrop}>
          <div className={`${styles.modalCard} ${styles.consentModal}`} role="dialog" aria-modal="true" aria-labelledby="shared-register-popia-title">
            <div className={styles.modalHeader}>
              <div>
                <h3 id="shared-register-popia-title">POPIA access disclaimer.</h3>
                <p>Confirm that you understand how this shared Asset Register may be used before opening it.</p>
              </div>
              <button type="button" className={styles.modalCloseButton} onClick={closeRegisterDisclaimer} aria-label="Close disclaimer">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.selectedRegisterBox}>
                <span>Selected register</span>
                <strong>{ownerName(registerToOpen)}</strong>
                <p>{formatCurrency(registerToOpen.totalValue)} excl. VAT · {registerToOpen.assetCount} assets</p>
              </div>

              <ul className={styles.popiaList}>
                <li>You may only use the owner details and asset information for the reason this register was shared with your account.</li>
                <li>Do not copy, forward or reuse personal information outside the agreed finance, insurance or dealer process.</li>
                <li>Any asset updates you make can affect the owner&apos;s saved Asset Register, reports and future asset records.</li>
              </ul>

              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={hasAcceptedPopia} onChange={(event) => setHasAcceptedPopia(event.target.checked)} />
                <span>I understand the POPIA responsibility and the effect of updating shared assets.</span>
              </label>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeRegisterDisclaimer}>
                Close
              </button>
              <button type="button" className={styles.primaryButton} onClick={confirmOpenRegister} disabled={!hasAcceptedPopia}>
                Open shared register
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {registerToDelete ? (
        <div className={styles.modalBackdrop}>
          <div className={`${styles.modalCard} ${styles.warningModal}`} role="dialog" aria-modal="true" aria-labelledby="shared-register-delete-title">
            <div className={styles.modalHeader}>
              <div>
                <h3 id="shared-register-delete-title">Delete shared access?</h3>
                <p>This removes the shared register from this account. The owner&apos;s Asset Register stays saved.</p>
              </div>
              <button type="button" className={styles.modalCloseButton} onClick={closeDeleteModal} aria-label="Close delete confirmation">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.selectedRegisterBox}>
                <span>Selected register</span>
                <strong>{ownerName(registerToDelete)}</strong>
                <p>{formatCurrency(registerToDelete.totalValue)} excl. VAT · Received {formatDate(registerToDelete.createdAtIso)}</p>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeDeleteModal} disabled={isDeletingAccess}>
                Close
              </button>
              <button type="button" className={styles.dangerButton} onClick={() => void handleDeleteSharedAccess()} disabled={isDeletingAccess}>
                {isDeletingAccess ? 'Deleting...' : 'Yes, delete access'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
