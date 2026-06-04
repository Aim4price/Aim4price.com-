'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

export type CompanyTypeFilter = 'all' | 'finance' | 'insurance' | 'dealer';
type PartnerType = Exclude<CompanyTypeFilter, 'all'>;

type PartnerDirectoryEntry = {
  userId: string;
  partnerType: PartnerType;
  displayName: string;
  businessName: string;
  phone: string;
  email: string;
  province: string;
  townCity: string;
  addressLine1: string;
  logoUrl: string;
  websiteUrl: string;
  extraPhotoUrls: string[];
  description: string;
  latitude: number | null;
  longitude: number | null;
  serviceRadiusKm: number | null;
  brandFocus: string;
  services: string;
};

type PartnerDirectoryApiResponse = {
  ok: boolean;
  partners?: PartnerDirectoryEntry[];
  error?: string;
};

type CompaniesClientProps = {
  initialType: CompanyTypeFilter;
};

type TypeTab = {
  value: PartnerType;
  title: string;
  description: string;
};

const TYPE_TABS: TypeTab[] = [
  { value: 'finance', title: 'Finance', description: 'Banks, finance houses and refinance partners.' },
  { value: 'insurance', title: 'Insurance', description: 'Insurers and brokers for machinery cover.' },
  { value: 'dealer', title: 'Dealers', description: 'Dealers, replacement quotes and machinery support.' },
];

const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m20.5 20.5-4.35-4.35" />
      <circle cx="10.8" cy="10.8" r="6.2" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M7 12h10M10 17h4" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function companyTypeLabel(value: PartnerType): string {
  if (value === 'finance') return 'Finance';
  if (value === 'insurance') return 'Insurance';
  return 'Dealer';
}

function companyTypeDescription(value: PartnerType): string {
  if (value === 'finance') return 'Finance partner';
  if (value === 'insurance') return 'Insurer or broker';
  return 'Dealer partner';
}

function companyName(company: PartnerDirectoryEntry): string {
  return company.businessName || company.displayName || 'Aim4price company';
}

function companyInitial(company: PartnerDirectoryEntry): string {
  return (companyName(company).trim().charAt(0) || 'A').toUpperCase();
}

function companyLocation(company: PartnerDirectoryEntry): string {
  return [company.townCity, company.province].filter(Boolean).join(', ') || 'Location not saved';
}

function companyAddress(company: PartnerDirectoryEntry): string {
  return [company.addressLine1, company.townCity, company.province].filter(Boolean).join(', ') || 'Address not saved';
}

function companyServices(company: PartnerDirectoryEntry): string {
  return company.services || companyTypeLabel(company.partnerType);
}

function companyRadius(company: PartnerDirectoryEntry): string {
  return company.serviceRadiusKm ? `${company.serviceRadiusKm} km service radius` : 'Service radius not saved';
}

function normalizeWebsiteHref(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function formatWebsiteDisplay(value: string): string {
  const href = normalizeWebsiteHref(value);

  if (!href) {
    return 'Website not saved';
  }

  try {
    const parsed = new URL(href);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  }
}

function normalizeEmailHref(value: string): string {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? `mailto:${trimmed}` : '';
}

function normalizePhoneHref(value: string): string {
  const cleaned = value.replace(/[^+\d]/g, '');
  return cleaned ? `tel:${cleaned}` : '';
}

function textMatches(value: string, query: string): boolean {
  return value.toLowerCase().includes(query);
}

function countCompaniesByType(companies: PartnerDirectoryEntry[], type: PartnerType): number {
  return companies.filter((company) => company.partnerType === type).length;
}

function typeToneClass(type: PartnerType): string {
  if (type === 'finance') return styles.toneFinance;
  if (type === 'insurance') return styles.toneInsurance;
  return styles.toneDealer;
}

function typePillClass(type: PartnerType): string {
  if (type === 'finance') return styles.typePillFinance;
  if (type === 'insurance') return styles.typePillInsurance;
  return styles.typePillDealer;
}

function mediaUrlsForCompany(company: PartnerDirectoryEntry): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  [company.logoUrl, ...company.extraPhotoUrls].forEach((url) => {
    const next = String(url ?? '').trim();

    if (!next || seen.has(next)) {
      return;
    }

    seen.add(next);
    urls.push(next);
  });

  return urls.slice(0, 4);
}

function extractApiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === 'string' && record.error.trim()) return record.error;
    if (typeof record.message === 'string' && record.message.trim()) return record.message;
  }

  return fallback;
}

export default function CompaniesClient({ initialType }: CompaniesClientProps) {
  const [companies, setCompanies] = useState<PartnerDirectoryEntry[]>([]);
  const [selectedType, setSelectedType] = useState<CompanyTypeFilter>(initialType);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadCompanies() {
      try {
        setIsLoading(true);
        setErrorMessage('');

        const response = await fetch('/api/partners', {
          credentials: 'include',
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);
        const data = payload as PartnerDirectoryApiResponse | null;

        if (!response.ok || !data?.ok || !Array.isArray(data.partners)) {
          throw new Error(extractApiError(payload, 'Failed to load companies.'));
        }

        if (!mounted) return;
        setCompanies(data.partners);
      } catch (error) {
        if (!mounted) return;
        setCompanies([]);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load companies.');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCompanies();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredCompanies = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return companies.filter((company) => {
      if (selectedType !== 'all' && company.partnerType !== selectedType) {
        return false;
      }

      if (selectedProvince && company.province !== selectedProvince) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        companyName(company),
        company.displayName,
        companyTypeLabel(company.partnerType),
        companyTypeDescription(company.partnerType),
        company.province,
        company.townCity,
        company.addressLine1,
        company.email,
        company.phone,
        company.websiteUrl,
        company.brandFocus,
        company.services,
        company.description,
      ].join(' ');

      return textMatches(searchable, query);
    });
  }, [companies, searchTerm, selectedProvince, selectedType]);

  const activeFilterCount = [selectedProvince, selectedType !== 'all' ? selectedType : ''].filter(Boolean).length;
  const resultLabel = isLoading
    ? 'Loading companies'
    : `${filteredCompanies.length} ${filteredCompanies.length === 1 ? 'company' : 'companies'} shown`;

  function handleTypeSelect(type: CompanyTypeFilter) {
    setSelectedType((current) => (current === type ? 'all' : type));
    setOpenCompanyId(null);
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchTerm(event.target.value);
    setOpenCompanyId(null);
  }

  function clearFilters() {
    setSelectedType('all');
    setSelectedProvince('');
    setSearchTerm('');
    setOpenCompanyId(null);
  }

  function renderCompanyDetails(company: PartnerDirectoryEntry) {
    const mediaUrls = mediaUrlsForCompany(company);
    const websiteHref = normalizeWebsiteHref(company.websiteUrl);
    const emailHref = normalizeEmailHref(company.email);
    const phoneHref = normalizePhoneHref(company.phone);

    return (
      <section className={styles.detailPanel} aria-label={`${companyName(company)} details`}>
        <aside className={styles.mediaPanel}>
          <div className={styles.mediaGrid}>
            {mediaUrls.length ? (
              mediaUrls.map((url, index) => (
                <span
                  key={`${company.userId}-${url}-${index}`}
                  className={`${styles.mediaTile} ${index === 0 && company.logoUrl ? styles.logoTile : ''}`}
                >
                  <img src={url} alt={index === 0 && company.logoUrl ? `${companyName(company)} logo` : `${companyName(company)} photo ${index + 1}`} />
                </span>
              ))
            ) : (
              <span className={`${styles.mediaTile} ${styles.emptyLogoTile}`}>
                <span>{companyInitial(company)}</span>
              </span>
            )}
          </div>
        </aside>

        <div className={styles.detailContent}>
          <div className={styles.detailTitleBlock}>
            <span className={`${styles.typePill} ${typePillClass(company.partnerType)}`}>{companyTypeDescription(company.partnerType)}</span>
            <h3>{companyName(company)}</h3>
            <p>{companyLocation(company)}</p>
          </div>

          <div className={styles.detailMatrix}>
            {phoneHref ? (
              <a className={styles.detailRow} href={phoneHref}>
                <small>Contact</small>
                <span>{company.phone}</span>
              </a>
            ) : (
              <span className={styles.detailRow}>
                <small>Contact</small>
                <span>Contact not saved</span>
              </span>
            )}

            {emailHref ? (
              <a className={styles.detailRow} href={emailHref}>
                <small>Email</small>
                <span>{company.email}</span>
              </a>
            ) : (
              <span className={styles.detailRow}>
                <small>Email</small>
                <span>Email not saved</span>
              </span>
            )}

            {websiteHref ? (
              <a className={styles.detailRow} href={websiteHref} target="_blank" rel="noreferrer">
                <small>Website</small>
                <span>{formatWebsiteDisplay(websiteHref)}</span>
              </a>
            ) : (
              <span className={styles.detailRow}>
                <small>Website</small>
                <span>{formatWebsiteDisplay(company.websiteUrl)}</span>
              </span>
            )}

            <span className={styles.detailRow}>
              <small>Address</small>
              <span>{companyAddress(company)}</span>
            </span>

            <span className={styles.detailRow}>
              <small>Service area</small>
              <span>{companyRadius(company)}</span>
            </span>

            <span className={styles.detailRow}>
              <small>Services</small>
              <span>{companyServices(company)}</span>
            </span>

            <span className={styles.detailRow}>
              <small>Brands</small>
              <span>{company.brandFocus || 'Brands not saved'}</span>
            </span>
          </div>

          <div className={styles.descriptionBox}>
            <small>Company notes</small>
            <p>{company.description || 'No company description has been saved yet.'}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <main className={styles.page}>
      <AppHeader active="none" />

      <section className={styles.shell}>
        <section className={styles.heroCard}>
          <div className={styles.heroTitleRow}>
            <div>
              <span>Partner directory</span>
              <h1>List of companies</h1>
              <p>Finance providers, insurers, brokers and dealers listed on Aim4price.</p>
            </div>
            <strong>{resultLabel}</strong>
          </div>

          <div className={styles.categoryGrid} aria-label="Company types">
            {TYPE_TABS.map((tab) => {
              const isActive = selectedType === tab.value;
              const count = countCompaniesByType(companies, tab.value);

              return (
                <button
                  key={tab.value}
                  type="button"
                  className={`${styles.categoryButton} ${typeToneClass(tab.value)} ${isActive ? styles.categoryButtonActive : ''}`}
                  onClick={() => handleTypeSelect(tab.value)}
                  aria-pressed={isActive}
                >
                  <strong>{tab.title}</strong>
                  <span>{tab.description}</span>
                  <small>{count} listed</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.searchPanel} aria-label="Search companies">
          <label className={styles.searchBox}>
            <SearchIcon className={styles.icon} />
            <input
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by company, province or town"
              aria-label="Search by company, province or town"
            />
            {searchTerm ? (
              <button type="button" className={styles.clearSearchButton} onClick={() => setSearchTerm('')} aria-label="Clear search">
                <CloseIcon className={styles.icon} />
              </button>
            ) : null}
          </label>

          <div className={styles.filterShell}>
            <button
              type="button"
              className={`${styles.filterButton} ${activeFilterCount ? styles.filterButtonActive : ''}`}
              onClick={() => setIsFilterOpen((current) => !current)}
              aria-expanded={isFilterOpen}
            >
              <FilterIcon className={styles.icon} />
              <span>{activeFilterCount ? `Filters (${activeFilterCount})` : 'Filters'}</span>
              <ChevronDownIcon className={styles.chevronIcon} />
            </button>

            {isFilterOpen ? (
              <div className={styles.filterPopover}>
                <label className={styles.filterField}>
                  <span>Company type</span>
                  <select value={selectedType} onChange={(event) => setSelectedType(event.target.value as CompanyTypeFilter)}>
                    <option value="all">All companies</option>
                    <option value="finance">Finance</option>
                    <option value="insurance">Insurance</option>
                    <option value="dealer">Dealers</option>
                  </select>
                </label>

                <label className={styles.filterField}>
                  <span>Province</span>
                  <select value={selectedProvince} onChange={(event) => setSelectedProvince(event.target.value)}>
                    <option value="">All provinces</option>
                    {PROVINCES.map((province) => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                </label>

                <div className={styles.filterActions}>
                  <button type="button" className={styles.ghostButton} onClick={clearFilters}>Clear filters</button>
                  <button type="button" className={styles.primaryButton} onClick={() => setIsFilterOpen(false)}>Apply</button>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {errorMessage ? <p className={styles.noticeError}>{errorMessage}</p> : null}

        <section className={styles.companyStack} aria-label="Companies">
          {isLoading ? (
            <div className={styles.emptyState}>Loading companies...</div>
          ) : filteredCompanies.length ? (
            filteredCompanies.map((company) => {
              const isOpen = openCompanyId === company.userId;

              return (
                <article key={company.userId} className={`${styles.companyCard} ${isOpen ? styles.companyCardOpen : ''}`}>
                  <div className={styles.companySummary}>
                    <div className={styles.companyIdentity}>
                      <span className={`${styles.typePill} ${typePillClass(company.partnerType)}`}>{companyTypeLabel(company.partnerType)}</span>
                      <h2>{companyName(company)}</h2>
                      <p>{companyLocation(company)}</p>
                    </div>

                    <button
                      type="button"
                      className={styles.viewDetailsButton}
                      onClick={() => setOpenCompanyId((current) => (current === company.userId ? null : company.userId))}
                    >
                      {isOpen ? 'Close' : 'View Details'}
                    </button>
                  </div>

                  {isOpen ? renderCompanyDetails(company) : null}
                </article>
              );
            })
          ) : (
            <div className={styles.emptyState}>No companies match this search or filter.</div>
          )}
        </section>
      </section>
    </main>
  );
}
