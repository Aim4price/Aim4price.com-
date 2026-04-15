'use client';

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';
import {
  FALLBACK_MARKETPLACE_IMAGE,
  seedMarketplaceListings,
  type MarketplaceListing,
} from '../../lib/marketplace';
import { money } from '../../lib/tractor-logic';

type MarketplaceFilters = {
  brand: string;
  model: string;
  drive: string;
  type: string;
};

type MarketplaceClientProps = {
  initialFilters: MarketplaceFilters;
  isSignedIn: boolean;
};

type SortValue = 'newest' | 'price-low' | 'price-high' | 'hours-low' | 'hours-high' | 'year-new';

type MarketplaceApiResponse = {
  ok: boolean;
  listings?: MarketplaceListing[];
  error?: string;
};

type ActiveFilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

const LISTINGS_PER_PAGE = 9;

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 21l-4.35-4.35" />
      <circle cx="11" cy="11" r="6.25" />
    </svg>
  );
}

function BrandIcon({ src }: { src: string }) {
  return <img src={src} alt="" aria-hidden="true" className={styles.brandIcon} />;
}

function IconCopy() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M6.5 15.5H6A2 2 0 0 1 4 13.5V6a2 2 0 0 1 2-2h7.5a2 2 0 0 1 2 2v.5" />
    </svg>
  );
}

function IconArrowLeft() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m14.5 6.5-5 5 5 5" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9.5 6.5 5 5-5 5" />
    </svg>
  );
}

function normalize(value: string | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function formatTypeLabel(value: string): string {
  return value === 'orchard' ? 'Orchard' : 'Field';
}

function formatCabLabel(value: string): string {
  return value === 'cab' ? 'Cab' : 'Open Station';
}

function safeImage(src?: string): string {
  const value = String(src ?? '').trim();
  return value || FALLBACK_MARKETPLACE_IMAGE;
}

function getImages(listing: MarketplaceListing): string[] {
  const raw = [
    ...(Array.isArray(listing.imageUrls) ? listing.imageUrls : []),
    listing.imageSrc,
  ]
    .map((item) => safeImage(item))
    .filter(Boolean);

  const unique = Array.from(new Set(raw));
  return unique.length ? unique : [FALLBACK_MARKETPLACE_IMAGE];
}

function getListingTag(listing: MarketplaceListing): string {
  return listing.publishedBy === 'asset-register' ? 'From asset register' : 'In-house listing';
}

function getListingNote(listing: MarketplaceListing): string {
  const note = String(listing.description ?? '').trim();

  if (note) {
    return note;
  }

  return `${listing.brandName} ${listing.modelName} listed in ${listing.area}, ${listing.province}.`;
}

function formatPublishedDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Recently listed';
  }

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function formatLocation(listing: MarketplaceListing): string {
  return `${listing.area}, ${listing.province}`;
}

function sortListings(items: MarketplaceListing[], sortBy: SortValue): MarketplaceListing[] {
  const next = [...items];

  next.sort((a, b) => {
    if (sortBy === 'price-low') {
      return a.askingPriceExVat - b.askingPriceExVat;
    }

    if (sortBy === 'price-high') {
      return b.askingPriceExVat - a.askingPriceExVat;
    }

    if (sortBy === 'hours-low') {
      return a.hours - b.hours;
    }

    if (sortBy === 'hours-high') {
      return b.hours - a.hours;
    }

    if (sortBy === 'year-new') {
      return b.yearModel - a.yearModel;
    }

    return new Date(b.publishedAtIso).getTime() - new Date(a.publishedAtIso).getTime();
  });

  return next;
}

function buildPagination(currentPage: number, totalPages: number): Array<number | string> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | string> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    pages.push('ellipsis-left');
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (end < totalPages - 1) {
    pages.push('ellipsis-right');
  }

  pages.push(totalPages);
  return pages;
}

function listingMatchesReference(listing: MarketplaceListing, value: string): boolean {
  const normalizedValue = String(value).trim();

  return normalizedValue === listing.id || normalizedValue === String(listing.sourceAssetId ?? '').trim();
}

function buildListingShareUrl(listing: MarketplaceListing): string {
  if (typeof window === 'undefined') {
    return `/marketplace?listing=${encodeURIComponent(listing.id)}`;
  }

  const url = new URL('/marketplace', window.location.origin);
  url.searchParams.set('listing', listing.id);
  return url.toString();
}

function buildListingShareText(listing: MarketplaceListing): string {
  return [
    `${listing.brandName} ${listing.modelName}`,
    `${money(listing.askingPriceExVat)} excl. VAT`,
    formatLocation(listing),
    'View this listing on Aim4price.',
  ].join(' • ');
}

async function copyTextToClipboard(value: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard is not available.');
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export default function MarketplaceClient({
  initialFilters,
  isSignedIn,
}: MarketplaceClientProps) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MarketplaceListing[]>(seedMarketplaceListings);
  const [activeListing, setActiveListing] = useState<MarketplaceListing | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [shareListing, setShareListing] = useState<MarketplaceListing | null>(null);
  const [shareFeedback, setShareFeedback] = useState('');
  const [listingQueryId, setListingQueryId] = useState('');

  const [brandFilter, setBrandFilter] = useState(initialFilters.brand || '');
  const [modelFilter, setModelFilter] = useState(initialFilters.model || '');
  const [typeFilter, setTypeFilter] = useState(initialFilters.type || '');
  const [driveFilter, setDriveFilter] = useState(initialFilters.drive || '');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortValue>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterPanelOpen, setFilterPanelOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      try {
        const response = await fetch('/api/marketplace', {
          cache: 'no-store',
          credentials: 'include',
        });

        const data = (await response.json()) as MarketplaceApiResponse;

        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to load marketplace.');
        }

        if (!mounted) {
          return;
        }

        const publishedListings = Array.isArray(data.listings) ? data.listings : [];
        setItems([...publishedListings, ...seedMarketplaceListings]);
      } catch {
        if (mounted) {
          setItems(seedMarketplaceListings);
        }
      }
    }

    void refresh();
    window.addEventListener('focus', refresh);

    return () => {
      mounted = false;
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncListingFromUrl = () => {
      const searchParams = new URLSearchParams(window.location.search);
      setListingQueryId(String(searchParams.get('listing') ?? '').trim());
    };

    syncListingFromUrl();
    window.addEventListener('popstate', syncListingFromUrl);

    return () => {
      window.removeEventListener('popstate', syncListingFromUrl);
    };
  }, []);

  const brands = useMemo(
    () => Array.from(new Set(items.map((item) => item.brandName))).sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const provinces = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.province).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  );


  const filtered = useMemo(() => {
    const search = normalize(query);
    const filterBrand = normalize(brandFilter);
    const filterModel = normalize(modelFilter);
    const filterDrive = normalize(driveFilter);
    const filterType = normalize(typeFilter);
    const filterProvince = normalize(provinceFilter);

    return items.filter((listing) => {
      if (
        filterBrand &&
        normalize(listing.brandSlug) !== filterBrand &&
        normalize(listing.brandName) !== filterBrand
      ) {
        return false;
      }

      if (filterModel && !normalize(listing.modelName).includes(filterModel)) {
        return false;
      }

      if (filterDrive && normalize(listing.drive) !== filterDrive) {
        return false;
      }

      if (filterType && normalize(listing.tractorType) !== filterType) {
        return false;
      }

      if (filterProvince && normalize(listing.province) !== filterProvince) {
        return false;
      }

      if (!search) {
        return true;
      }

      return [
        listing.title,
        listing.brandName,
        listing.modelName,
        listing.area,
        listing.province,
        listing.location,
        listing.description,
        listing.yearModel,
        listing.drive,
        listing.tractorType,
        listing.cab,
        listing.powerKw,
        listing.powerHp,
        listing.horsepowerHp,
        listing.sellerName,
        listing.sellerCompany,
        listing.sourceName,
        listing.sourceUrl,
      ]
        .join(' ')
        .toLowerCase()
        .includes(search);
    });
  }, [brandFilter, driveFilter, items, modelFilter, provinceFilter, query, typeFilter]);

  const visible = useMemo(() => sortListings(filtered, sortBy), [filtered, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, brandFilter, modelFilter, typeFilter, driveFilter, provinceFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(visible.length / LISTINGS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!listingQueryId) {
      return;
    }

    const matchedListing = items.find((listing) => listingMatchesReference(listing, listingQueryId));

    if (!matchedListing) {
      return;
    }

    setActiveListing((current) => (current?.id === matchedListing.id ? current : matchedListing));
    setActiveImageIndex(0);
  }, [items, listingQueryId]);

  useEffect(() => {
    if (!isFilterPanelOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFilterPanelOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFilterPanelOpen]);

  const pageStart = visible.length ? (currentPage - 1) * LISTINGS_PER_PAGE : 0;
  const pageEnd = Math.min(pageStart + LISTINGS_PER_PAGE, visible.length);
  const pagedVisible = visible.slice(pageStart, pageEnd);
  const isSingleResultLayout = pagedVisible.length === 1;

  const paginationItems = useMemo(
    () => buildPagination(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const activeImages = useMemo(
    () => (activeListing ? getImages(activeListing) : [FALLBACK_MARKETPLACE_IMAGE]),
    [activeListing],
  );

  const shareUrl = useMemo(
    () => (shareListing ? buildListingShareUrl(shareListing) : ''),
    [shareListing],
  );


  useEffect(() => {
    if (!activeListing) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveListing(null);
        setActiveImageIndex(0);
        return;
      }

      if (activeImages.length <= 1) {
        return;
      }

      if (event.key === 'ArrowRight') {
        setActiveImageIndex((current) => (current + 1) % activeImages.length);
      }

      if (event.key === 'ArrowLeft') {
        setActiveImageIndex((current) => (current - 1 + activeImages.length) % activeImages.length);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeImages.length, activeListing]);

  useEffect(() => {
    if (!shareListing) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShareListing(null);
        setShareFeedback('');
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [shareListing]);

  const stats = useMemo(() => {
    if (!items.length) {
      return {
        live: 0,
        brands: 0,
        provinces: 0,
        newestYear: '—',
      };
    }

    return {
      live: items.length,
      brands: brands.length,
      provinces: provinces.length,
      newestYear: String(Math.max(...items.map((item) => item.yearModel))),
    };
  }, [brands.length, items, provinces.length]);

  const activeFilterChips: ActiveFilterChip[] = [
    query.trim()
      ? {
          id: 'query',
          label: `Search: ${query.trim()}`,
          onRemove: () => setQuery(''),
        }
      : null,
    brandFilter
      ? {
          id: 'brand',
          label: `Brand: ${brandFilter}`,
          onRemove: () => setBrandFilter(''),
        }
      : null,
    modelFilter
      ? {
          id: 'model',
          label: `Model: ${modelFilter}`,
          onRemove: () => setModelFilter(''),
        }
      : null,
    driveFilter
      ? {
          id: 'drive',
          label: `Drive: ${driveFilter.toUpperCase()}`,
          onRemove: () => setDriveFilter(''),
        }
      : null,
    typeFilter
      ? {
          id: 'type',
          label: `Category: ${formatTypeLabel(typeFilter)}`,
          onRemove: () => setTypeFilter(''),
        }
      : null,
    provinceFilter
      ? {
          id: 'province',
          label: `Province: ${provinceFilter}`,
          onRemove: () => setProvinceFilter(''),
        }
      : null,
  ].filter(Boolean) as ActiveFilterChip[];

  const activeFilterCount = activeFilterChips.length;
  const canDeleteActiveListing = Boolean(activeListing?.canManage && activeListing?.sourceAssetId);

  function updateListingUrl(nextListingId: string | null) {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);

    if (nextListingId) {
      url.searchParams.set('listing', nextListingId);
    } else {
      url.searchParams.delete('listing');
    }

    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    setListingQueryId(nextListingId ?? '');
  }

  function openFilterPanel() {
    setFilterPanelOpen(true);
  }

  function closeFilterPanel() {
    setFilterPanelOpen(false);
  }

  function clearFilters() {
    setQuery('');
    setBrandFilter('');
    setModelFilter('');
    setTypeFilter('');
    setDriveFilter('');
    setProvinceFilter('');
    setSortBy('newest');
    setCurrentPage(1);
  }

  function openListing(listing: MarketplaceListing) {
    setFilterPanelOpen(false);
    setActiveListing(listing);
    setActiveImageIndex(0);
    updateListingUrl(listing.id);
  }

  function closeListing() {
    setActiveListing(null);
    setActiveImageIndex(0);
    updateListingUrl(null);
  }

  function openShareSheet(listing: MarketplaceListing) {
    setShareListing(listing);
    setShareFeedback('');
  }

  function closeShareSheet() {
    setShareListing(null);
    setShareFeedback('');
  }

  function showPreviousImage() {
    setActiveImageIndex((current) => (current - 1 + activeImages.length) % activeImages.length);
  }

  function showNextImage() {
    setActiveImageIndex((current) => (current + 1) % activeImages.length);
  }

  function handleCardKeyDown(
    event: ReactKeyboardEvent<HTMLElement>,
    listing: MarketplaceListing,
  ) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openListing(listing);
    }
  }


  function openShareWindow(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleShareAction(channel: 'whatsapp' | 'facebook' | 'copy') {
    if (!shareListing) {
      return;
    }

    const nextShareUrl = buildListingShareUrl(shareListing);
    const nextShareText = buildListingShareText(shareListing);

    try {
      if (channel === 'copy') {
        await copyTextToClipboard(nextShareUrl);
        setShareFeedback('Listing link copied to clipboard.');
        return;
      }

      if (channel === 'whatsapp') {
        openShareWindow(`https://wa.me/?text=${encodeURIComponent(`${nextShareText} ${nextShareUrl}`)}`);
        closeShareSheet();
        return;
      }

      openShareWindow(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(nextShareUrl)}&quote=${encodeURIComponent(nextShareText)}`,
      );
      closeShareSheet();
    } catch {
      setShareFeedback('Sharing did not complete. Please try again.');
    }
  }

  async function handleDeleteActiveListing() {
    if (!activeListing?.sourceAssetId || !activeListing.canManage) {
      return;
    }

    const listingName = `${activeListing.brandName} ${activeListing.modelName}`;
    const confirmed = window.confirm(`Delete ${listingName} from the marketplace?`);

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/marketplace?assetId=${encodeURIComponent(activeListing.sourceAssetId)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to delete listing.');
      }

      setItems((current) =>
        current.filter((listing) => listing.sourceAssetId !== activeListing.sourceAssetId),
      );
      closeListing();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to delete listing.');
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.topBand}>
        <AppHeader active="marketplace" />
      </div>

      <div className={styles.inner}>
        <section className={styles.summaryStrip}>
          <div className={styles.summaryCopy}>
            <span className={styles.eyebrow}>Aim4price marketplace</span>
            <h1>Find live machinery listings faster.</h1>
            <p>
              The marketplace now keeps search first, details cleaner, and sharing easy without a
              large header getting in the way.
            </p>
          </div>

          <div className={styles.summaryStats}>
            <div className={styles.summaryStat}>
              <span className={styles.summaryStatLabel}>Live listings</span>
              <strong className={styles.summaryStatValue}>{stats.live}</strong>
              <small className={styles.summaryStatNote}>ready to browse now</small>
            </div>

            <div className={styles.summaryStat}>
              <span className={styles.summaryStatLabel}>Brands</span>
              <strong className={styles.summaryStatValue}>{stats.brands}</strong>
              <small className={styles.summaryStatNote}>seeded + register</small>
            </div>

            <div className={styles.summaryStat}>
              <span className={styles.summaryStatLabel}>Newest year</span>
              <strong className={styles.summaryStatValue}>{stats.newestYear}</strong>
              <small className={styles.summaryStatNote}>{stats.provinces} provinces covered</small>
            </div>
          </div>
        </section>

        <section className={styles.browseShell}>
          <div className={styles.browseHeader}>
            <div className={styles.browseCopy}>
              <span className={styles.sectionEyebrow}>Find faster</span>
              <h2>Make the main view effortless to scan.</h2>
              <p>
                Keep the primary search visible, move secondary filters into a clean drawer, and
                make every card obvious to act on.
              </p>
            </div>
          </div>

          <div className={styles.toolbarRow}>
            <label className={styles.toolbarSearch}>
              <span>Search marketplace</span>
              <div className={styles.toolbarSearchInputWrap}>
                <span className={styles.searchIcon} aria-hidden="true">
                  <IconSearch />
                </span>
                <input
                  id="marketplace-search"
                  value={query}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
                  placeholder="Search brand, model, province, area or keyword"
                />
                {query ? (
                  <button
                    type="button"
                    className={styles.searchClearButton}
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </label>

            <div className={styles.browseActions}>
              <label className={styles.toolbarSelect}>
                <span>Sort</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortValue)}>
                  <option value="newest">Newest listed</option>
                  <option value="price-low">Price: low to high</option>
                  <option value="price-high">Price: high to low</option>
                  <option value="hours-low">Hours: low to high</option>
                  <option value="hours-high">Hours: high to low</option>
                  <option value="year-new">Year: newest first</option>
                </select>
              </label>

              <button
                type="button"
                className={styles.filterToggle}
                onClick={openFilterPanel}
                aria-expanded={isFilterPanelOpen}
                aria-controls="marketplace-filter-drawer"
              >
                <span className={styles.buttonIcon} aria-hidden="true">
                  <BrandIcon src="/brand/options.png" />
                </span>
                <span>Filter search</span>
                {activeFilterCount ? (
                  <strong className={styles.filterToggleCount}>{activeFilterCount}</strong>
                ) : null}
              </button>
            </div>
          </div>


          {activeFilterChips.length ? (
            <div className={styles.activeFilterBar}>
              <div className={styles.pillRow}>
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={styles.pill}
                    onClick={chip.onRemove}
                  >
                    <span>{chip.label}</span>
                    <strong aria-hidden="true">×</strong>
                  </button>
                ))}
              </div>

              <button type="button" className={styles.clearInlineButton} onClick={clearFilters}>
                Reset all
              </button>
            </div>
          ) : (
            <p className={styles.browseHint}>
              Start with search, then open filters only when you need a tighter result set.
            </p>
          )}
        </section>

        <section className={styles.resultsTop}>
          <div>
            <span className={styles.sectionEyebrow}>Results</span>
            <h2>
              {visible.length} listing{visible.length === 1 ? '' : 's'} ready to open
            </h2>
            <p className={styles.resultsLead}>
              Open a card for photos, protected contact details and quick share tools.
            </p>
          </div>

          <div className={styles.resultsMeta}>
            <strong>
              {visible.length === 0 ? 0 : pageStart + 1}-{pageEnd}
            </strong>
            <small>shown on this page</small>
          </div>
        </section>

        <section className={`${styles.grid} ${isSingleResultLayout ? styles.gridSingle : ''}`}>
          {pagedVisible.length > 0 ? (
            pagedVisible.map((listing) => {
              const cardImages = getImages(listing);

              return (
                <article
                  key={listing.id}
                  className={`${styles.card} ${isSingleResultLayout ? styles.cardSingle : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openListing(listing)}
                  onKeyDown={(event) => handleCardKeyDown(event, listing)}
                >
                  <div className={styles.imageFrame}>
                    <img
                      src={cardImages[0] ?? FALLBACK_MARKETPLACE_IMAGE}
                      alt={`${listing.brandName} ${listing.modelName}`}
                      className={styles.image}
                      onError={(event) => {
                        event.currentTarget.src = FALLBACK_MARKETPLACE_IMAGE;
                      }}
                    />

                    <div className={styles.imageTopRow}>
                      <span className={styles.imageTag}>{getListingTag(listing)}</span>
                      {cardImages.length > 1 ? (
                        <span className={styles.photoCount}>{cardImages.length} photos</span>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.cardHead}>
                    <div className={styles.titleBlock}>
                      <h3>
                        {listing.brandName} {listing.modelName}
                      </h3>
                      <p className={styles.specLine}>
                        {formatTypeLabel(listing.tractorType)} tractor •{' '}
                        {listing.drive.toUpperCase()} • {formatCabLabel(listing.cab)} •{' '}
                        {listing.powerKw} kW
                      </p>
                    </div>

                    <div className={styles.priceBlock}>
                      <strong>{money(listing.askingPriceExVat)}</strong>
                      <small>VAT excluded</small>
                    </div>
                  </div>

                  <div className={styles.metaRow}>
                    <span className={styles.metaPill}>{formatLocation(listing)}</span>
                    <span className={styles.metaPill}>
                      Listed {formatPublishedDate(listing.publishedAtIso)}
                    </span>
                  </div>

                  <p className={styles.summaryLine}>{getListingNote(listing)}</p>

                  <div className={styles.compactStats}>
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Year</span>
                      <strong className={styles.statValue}>{listing.yearModel}</strong>
                    </div>

                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Engine hours</span>
                      <strong className={styles.statValue}>
                        {listing.hours.toLocaleString('en-ZA')}
                      </strong>
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    <button
                      type="button"
                      className={styles.cardPrimaryButton}
                      onClick={(event) => {
                        event.stopPropagation();
                        openListing(listing);
                      }}
                    >
                      View details
                    </button>

                    <button
                      type="button"
                      className={styles.cardSecondaryButton}
                      onClick={(event) => {
                        event.stopPropagation();
                        openShareSheet(listing);
                      }}
                    >
                      <span className={styles.buttonIcon} aria-hidden="true">
                        <BrandIcon src="/brand/share.png" />
                      </span>
                      Share
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <article className={styles.emptyState}>
              <h2>No listings found</h2>
              <p>Try a different search phrase, brand, province or category.</p>
              <button type="button" className={styles.emptyButton} onClick={clearFilters}>
                Reset filters
              </button>
            </article>
          )}
        </section>

        {visible.length > 0 ? (
          <div className={styles.paginationShell}>
            <div className={styles.paginationCopy}>
              Page {currentPage} of {totalPages}
            </div>

            <div className={styles.paginationControls}>
              <button
                type="button"
                className={styles.pageNavButton}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>

              {paginationItems.map((item) =>
                typeof item === 'number' ? (
                  <button
                    key={item}
                    type="button"
                    className={`${styles.pageButton} ${
                      item === currentPage ? styles.pageButtonActive : ''
                    }`}
                    onClick={() => setCurrentPage(item)}
                    aria-current={item === currentPage ? 'page' : undefined}
                  >
                    {item}
                  </button>
                ) : (
                  <span key={item} className={styles.pageEllipsis}>
                    …
                  </span>
                ),
              )}

              <button
                type="button"
                className={styles.pageNavButton}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {isFilterPanelOpen ? (
        <div className={styles.filterOverlay} onClick={closeFilterPanel}>
          <aside
            id="marketplace-filter-drawer"
            className={styles.filterDrawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketplace-filter-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.filterDrawerHeader}>
              <div>
                <span className={styles.sectionEyebrow}>Filter search</span>
                <h2 id="marketplace-filter-title">Refine the listings without clutter.</h2>
                <p>
                  Search stays on the page. Use the drawer for the narrower machinery and seller area
                  filters only when you need them.
                </p>
              </div>

              <button
                type="button"
                className={styles.drawerCloseButton}
                onClick={closeFilterPanel}
                aria-label="Close filter search"
              >
                ×
              </button>
            </div>

            <div className={styles.filterDrawerBody}>
              <section className={styles.drawerSection}>
                <div className={styles.drawerSectionHead}>
                  <h3>Machinery details</h3>
                  <p>Use these fields to narrow the listing type, brand, model and drive layout.</p>
                </div>

                <div className={styles.drawerGrid}>
                  <label className={styles.field}>
                    <span>Brand</span>
                    <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}>
                      <option value="">All brands</option>
                      {brands.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span>Model</span>
                    <input
                      value={modelFilter}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setModelFilter(event.target.value)}
                      placeholder="Enter model or series"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Drive</span>
                    <select value={driveFilter} onChange={(event) => setDriveFilter(event.target.value)}>
                      <option value="">All drive types</option>
                      <option value="2wd">2WD</option>
                      <option value="4wd">4WD</option>
                      <option value="tracks">Tracks</option>
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span>Category</span>
                    <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                      <option value="">All types</option>
                      <option value="field">Field</option>
                      <option value="orchard">Orchard</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className={styles.drawerSection}>
                <div className={styles.drawerSectionHead}>
                  <h3>Seller area</h3>
                  <p>Focus the results to one province or leave the whole marketplace open.</p>
                </div>

                <div className={styles.drawerGridSingle}>
                  <label className={styles.field}>
                    <span>Province</span>
                    <select
                      value={provinceFilter}
                      onChange={(event) => setProvinceFilter(event.target.value)}
                    >
                      <option value="">All provinces</option>
                      {provinces.map((province) => (
                        <option key={province} value={province}>
                          {province}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
            </div>

            <div className={styles.filterDrawerFooter}>
              <button type="button" className={styles.resetTextButton} onClick={clearFilters}>
                Reset all
              </button>

              <button type="button" className={styles.applyButton} onClick={closeFilterPanel}>
                Show {visible.length} listing{visible.length === 1 ? '' : 's'}
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {activeListing ? (
        <div className={styles.modalOverlay} onClick={closeListing}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketplace-listing-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.closeButton}
              onClick={closeListing}
              aria-label="Close listing"
            >
              ×
            </button>

            <div className={styles.modalLayout}>
              <div className={styles.viewer}>
                <div className={styles.modalImageFrame}>
                  <img
                    src={activeImages[activeImageIndex] ?? FALLBACK_MARKETPLACE_IMAGE}
                    alt={`${activeListing.brandName} ${activeListing.modelName}`}
                    className={styles.modalImage}
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK_MARKETPLACE_IMAGE;
                    }}
                  />

                  {activeImages.length > 1 ? (
                    <>
                      <button
                        type="button"
                        className={`${styles.galleryArrow} ${styles.leftArrow}`}
                        onClick={showPreviousImage}
                        aria-label="Previous photo"
                      >
                        <IconArrowLeft />
                      </button>

                      <button
                        type="button"
                        className={`${styles.galleryArrow} ${styles.rightArrow}`}
                        onClick={showNextImage}
                        aria-label="Next photo"
                      >
                        <IconArrowRight />
                      </button>
                    </>
                  ) : null}

                  <span className={styles.modalBadge}>
                    Photo {activeImageIndex + 1} of {activeImages.length}
                  </span>
                </div>

                {activeImages.length > 1 ? (
                  <div className={styles.thumbRow}>
                    {activeImages.map((imageSrc, index) => (
                      <button
                        key={`${imageSrc}-${index}`}
                        type="button"
                        className={`${styles.thumbButton} ${
                          index === activeImageIndex ? styles.thumbButtonActive : ''
                        }`}
                        onClick={() => setActiveImageIndex(index)}
                        aria-label={`Show photo ${index + 1}`}
                      >
                        <img
                          src={imageSrc}
                          alt=""
                          className={styles.thumbImage}
                          onError={(event) => {
                            event.currentTarget.src = FALLBACK_MARKETPLACE_IMAGE;
                          }}
                        />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className={styles.viewerMetaCard}>
                  <span className={styles.sectionLabel}>Seller area</span>
                  <strong>{formatLocation(activeListing)}</strong>
                  <small>
                    Listed {formatPublishedDate(activeListing.dateAdvertised || activeListing.publishedAtIso)}
                  </small>
                </div>
              </div>

              <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                  <div className={styles.modalTitleBlock}>
                    <span className={styles.modalEyebrow}>{getListingTag(activeListing)}</span>
                    <h2 id="marketplace-listing-title">
                      {activeListing.brandName} {activeListing.modelName}
                    </h2>
                    <p className={styles.specLine}>
                      {formatTypeLabel(activeListing.tractorType)} tractor •{' '}
                      {activeListing.drive.toUpperCase()} • {formatCabLabel(activeListing.cab)} •{' '}
                      {activeListing.powerKw} kW
                    </p>
                    <div className={styles.modalMetaRow}>
                      <span className={styles.metaPill}>{formatLocation(activeListing)}</span>
                      <span className={styles.metaPill}>
                        Listed {formatPublishedDate(activeListing.dateAdvertised || activeListing.publishedAtIso)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.modalPriceBlock}>
                    <small>Asking price</small>
                    <strong>{money(activeListing.askingPriceExVat)}</strong>
                    <span>VAT excluded</span>
                  </div>
                </div>

                <div className={styles.modalStats}>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Year</span>
                    <strong className={styles.statValue}>{activeListing.yearModel}</strong>
                  </div>

                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Engine hours</span>
                    <strong className={styles.statValue}>
                      {activeListing.hours.toLocaleString('en-ZA')}
                    </strong>
                  </div>

                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Drive</span>
                    <strong className={styles.statValue}>{activeListing.drive.toUpperCase()}</strong>
                  </div>

                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Category</span>
                    <strong className={styles.statValue}>{formatTypeLabel(activeListing.tractorType)}</strong>
                  </div>

                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Cab</span>
                    <strong className={styles.statValue}>{formatCabLabel(activeListing.cab)}</strong>
                  </div>

                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Power</span>
                    <strong className={styles.statValue}>
                      {activeListing.powerKw} kW / {activeListing.horsepowerHp} hp
                    </strong>
                  </div>
                </div>

                <div className={styles.modalInfoGrid}>
                  <div className={styles.modalSection}>
                    <span className={styles.sectionLabel}>Listing notes</span>
                    <p>{getListingNote(activeListing)}</p>
                  </div>

                  <div className={`${styles.modalSection} ${styles.contactSection}`}>
                    <span className={styles.sectionLabel}>Contact details</span>

                    {isSignedIn ? (
                      <div className={styles.contactRows}>
                        <div className={styles.contactRow}>
                          <span className={styles.contactLabel}>Seller</span>
                          <strong className={styles.contactValue}>{activeListing.sellerName}</strong>
                        </div>

                        {activeListing.sellerCompany ? (
                          <div className={styles.contactRow}>
                            <span className={styles.contactLabel}>Company</span>
                            <strong className={styles.contactValue}>{activeListing.sellerCompany}</strong>
                          </div>
                        ) : null}

                        <div className={styles.contactRow}>
                          <span className={styles.contactLabel}>Phone</span>
                          <strong className={styles.contactValue}>
                            <a href={`tel:${activeListing.sellerPhone}`}>{activeListing.sellerPhone}</a>
                          </strong>
                        </div>

                        {activeListing.sellerEmail ? (
                          <div className={styles.contactRow}>
                            <span className={styles.contactLabel}>Email</span>
                            <strong className={styles.contactValue}>
                              <a href={`mailto:${activeListing.sellerEmail}`}>{activeListing.sellerEmail}</a>
                            </strong>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className={styles.contactLocked}>
                        <p>
                          Sign in to reveal the seller phone number and email. You can still browse
                          and share the listing before account creation.
                        </p>
                        <div className={styles.lockActions}>
                          <a href="/auth#signup" className={styles.primaryAction}>
                            Create account
                          </a>
                          <a href="/auth#login" className={styles.secondaryAction}>
                            Login
                          </a>
                        </div>
                      </div>
                    )}

                    {activeListing.sourceName ? (
                      <p className={styles.contactFootnote}>Source: {activeListing.sourceName}</p>
                    ) : null}
                  </div>
                </div>

                {canDeleteActiveListing ? (
                  <div className={styles.ownerCard}>
                    <div>
                      <span className={styles.sectionLabel}>Listing actions</span>
                      <p>You uploaded this listing. You can remove it from the marketplace here.</p>
                    </div>

                    <button
                      type="button"
                      className={styles.deleteAction}
                      onClick={() => void handleDeleteActiveListing()}
                    >
                      Delete listing
                    </button>
                  </div>
                ) : null}

                <div className={`${styles.modalActionStrip} ${styles.modalActionStripBottom}`}>
                  <div className={styles.modalActionCopy}>
                    <span className={styles.sectionLabel}>Share this listing</span>
                    <p className={styles.modalActionHint}>
                      Send it straight to WhatsApp or Facebook, or copy the direct Aim4price link.
                    </p>
                    <div className={styles.inlineChannelRow}>
                      <span className={styles.channelPill}>
                        <span className={styles.channelPillIcon} aria-hidden="true">
                          <BrandIcon src="/brand/whatsapp.png" />
                        </span>
                        WhatsApp
                      </span>
                      <span className={styles.channelPill}>
                        <span className={styles.channelPillIcon} aria-hidden="true">
                          <BrandIcon src="/brand/facebook.png" />
                        </span>
                        Facebook
                      </span>
                      <span className={styles.channelPill}>Direct link</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.sharePrimaryButton}
                    onClick={() => openShareSheet(activeListing)}
                  >
                    <span className={styles.buttonIcon} aria-hidden="true">
                      <BrandIcon src="/brand/share.png" />
                    </span>
                    Open share options
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {shareListing ? (
        <div className={styles.shareOverlay} onClick={closeShareSheet}>
          <div
            className={styles.shareDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-listing-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.shareCloseButton}
              onClick={closeShareSheet}
              aria-label="Close share dialog"
            >
              ×
            </button>

            <div className={styles.shareHeader}>
              <span className={styles.sectionEyebrow}>Share listing</span>
              <h2 id="share-listing-title">Push this listing out in seconds.</h2>
              <p>
                Use the two main channels first, then copy the direct listing link anywhere else you
                need it.
              </p>
            </div>

            <div className={styles.sharePreviewCard}>
              <div className={styles.sharePreviewMedia}>
                <img
                  src={getImages(shareListing)[0] ?? FALLBACK_MARKETPLACE_IMAGE}
                  alt={`${shareListing.brandName} ${shareListing.modelName}`}
                  className={styles.sharePreviewImage}
                  onError={(event) => {
                    event.currentTarget.src = FALLBACK_MARKETPLACE_IMAGE;
                  }}
                />
                <span className={styles.sharePreviewTag}>{getListingTag(shareListing)}</span>
              </div>

              <div className={styles.sharePreviewCopy}>
                <strong>
                  {shareListing.brandName} {shareListing.modelName}
                </strong>
                <div className={styles.sharePreviewMeta}>
                  <span>{money(shareListing.askingPriceExVat)} excl. VAT</span>
                  <small>{formatLocation(shareListing)}</small>
                </div>
                <p className={styles.sharePreviewHint}>
                  The link opens straight to this listing inside Aim4price.
                </p>
              </div>
            </div>

            <div className={styles.shareGrid}>
              <button
                type="button"
                className={`${styles.shareActionButton} ${styles.shareActionPrimary}`}
                onClick={() => void handleShareAction('whatsapp')}
              >
                <span className={styles.shareActionIcon} aria-hidden="true">
                  <BrandIcon src="/brand/whatsapp.png" />
                </span>
                <span className={styles.shareActionText}>
                  <strong>WhatsApp</strong>
                  <small>Best for buyer groups and direct chats</small>
                </span>
              </button>

              <button
                type="button"
                className={`${styles.shareActionButton} ${styles.shareActionSecondary}`}
                onClick={() => void handleShareAction('facebook')}
              >
                <span className={styles.shareActionIcon} aria-hidden="true">
                  <BrandIcon src="/brand/facebook.png" />
                </span>
                <span className={styles.shareActionText}>
                  <strong>Facebook</strong>
                  <small>Share to your feed, page or buyer audience</small>
                </span>
              </button>

            </div>

            <div className={styles.shareLinkRow}>
              <label className={styles.shareLinkField}>
                <span>Direct listing link</span>
                <input value={shareUrl} readOnly aria-label="Direct listing link" />
              </label>

              <button
                type="button"
                className={styles.shareLinkCopyButton}
                onClick={() => void handleShareAction('copy')}
              >
                <span className={styles.shareActionIcon} aria-hidden="true">
                  <IconCopy />
                </span>
                Copy link
              </button>
            </div>

            {shareFeedback ? <p className={styles.shareFeedback}>{shareFeedback}</p> : null}

          </div>
        </div>
      ) : null}
    </main>
  );
}
