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
  loadMarketplaceListings,
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

type SortValue = 'newest' | 'price-low' | 'price-high' | 'hours-low' | 'hours-high' | 'year-new';

const LISTINGS_PER_PAGE = 9;
const HIDDEN_LISTING_IDS_STORAGE_KEY = 'aim4price-marketplace-hidden-listing-ids';

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

function readHiddenListingIds(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_LISTING_IDS_STORAGE_KEY) ?? '[]');

    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.map((value) => String(value));
  } catch {
    return [];
  }
}

function writeHiddenListingIds(ids: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(HIDDEN_LISTING_IDS_STORAGE_KEY, JSON.stringify(Array.from(new Set(ids))));
}

function filterHiddenListings(items: MarketplaceListing[]): MarketplaceListing[] {
  const hiddenIds = new Set(readHiddenListingIds());
  return items.filter((item) => !hiddenIds.has(String(item.id)));
}

function isUserUploaded(listing: MarketplaceListing): boolean {
  const value = listing as MarketplaceListing & {
    uploadedByUser?: boolean;
    createdByUser?: boolean;
    canDelete?: boolean;
    ownerScope?: string;
    ownerType?: string;
  };

  return Boolean(
    value.uploadedByUser ||
      value.createdByUser ||
      value.canDelete ||
      normalize(value.ownerScope) === 'self' ||
      normalize(value.ownerType) === 'self' ||
      normalize(value.publishedBy) === 'asset-register' ||
      normalize(value.publishedBy) === 'self',
  );
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

export default function MarketplaceClient({
  initialFilters,
}: {
  initialFilters: MarketplaceFilters;
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MarketplaceListing[]>(() =>
    filterHiddenListings(seedMarketplaceListings),
  );
  const [activeListing, setActiveListing] = useState<MarketplaceListing | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [brandFilter, setBrandFilter] = useState(initialFilters.brand || '');
  const [modelFilter, setModelFilter] = useState(initialFilters.model || '');
  const [typeFilter, setTypeFilter] = useState(initialFilters.type || '');
  const [driveFilter, setDriveFilter] = useState(initialFilters.drive || '');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortValue>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  const isSignedIn = false;

  useEffect(() => {
    const refresh = () => {
      setItems(filterHiddenListings(loadMarketplaceListings()));
    };

    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);

    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
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
        listing.brandName,
        listing.modelName,
        listing.area,
        listing.province,
        listing.description,
        listing.yearModel,
        listing.drive,
        listing.tractorType,
      ]
        .join(' ')
        .toLowerCase()
        .includes(search);
    });
  }, [brandFilter, driveFilter, items, provinceFilter, query, typeFilter, modelFilter]);

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

  const pageStart = visible.length ? (currentPage - 1) * LISTINGS_PER_PAGE : 0;
  const pageEnd = Math.min(pageStart + LISTINGS_PER_PAGE, visible.length);
  const pagedVisible = visible.slice(pageStart, pageEnd);

  const paginationItems = useMemo(
    () => buildPagination(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const activeImages = useMemo(
    () => (activeListing ? getImages(activeListing) : [FALLBACK_MARKETPLACE_IMAGE]),
    [activeListing],
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

  const activePills = [
    brandFilter ? `Brand: ${brandFilter}` : '',
    modelFilter ? `Model: ${modelFilter}` : '',
    driveFilter ? `Drive: ${driveFilter.toUpperCase()}` : '',
    typeFilter ? `Type: ${formatTypeLabel(typeFilter)}` : '',
    provinceFilter ? `Province: ${provinceFilter}` : '',
  ].filter(Boolean);

  const canDeleteActiveListing = activeListing ? isUserUploaded(activeListing) : false;

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
    setActiveListing(listing);
    setActiveImageIndex(0);
  }

  function closeListing() {
    setActiveListing(null);
    setActiveImageIndex(0);
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

  function handleDeleteActiveListing() {
    if (!activeListing || !isUserUploaded(activeListing)) {
      return;
    }

    const listingName = `${activeListing.brandName} ${activeListing.modelName}`;
    const confirmed = window.confirm(`Delete ${listingName} from the marketplace?`);

    if (!confirmed) {
      return;
    }

    const listingId = String(activeListing.id);
    const nextHiddenIds = [...readHiddenListingIds(), listingId];
    writeHiddenListingIds(nextHiddenIds);

    setItems((current) => current.filter((item) => String(item.id) !== listingId));
    closeListing();
  }

  return (
    <main className={styles.page}>
      <div className={styles.topBand}>
        <AppHeader active="marketplace" />
      </div>

      <div className={styles.inner}>
        <section className={styles.hero}>
          <div className={styles.heroBackdrop} />

          <div className={styles.heroTop}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>Aim4price marketplace</span>
              <h1>Browse live machinery listings.</h1>
              <p>
                Open any listing for notes, photo gallery, seller area and sign-in gated contact
                details.
              </p>
            </div>

            <aside className={styles.totalCard}>
              <strong>{stats.live}</strong>
              <span>Live listings</span>
              <small>
                {brands.length} brands across {stats.provinces} provinces
              </small>
            </aside>
          </div>

          <div className={styles.statsRow}>
            <div className={styles.heroStat}>
              <span>Browse</span>
              <strong>{stats.live}</strong>
              <small>currently listed</small>
            </div>

            <div className={styles.heroStat}>
              <span>Brands</span>
              <strong>{stats.brands}</strong>
              <small>seeded + register</small>
            </div>

            <div className={styles.heroStat}>
              <span>Newest year</span>
              <strong>{stats.newestYear}</strong>
              <small>in current stock</small>
            </div>
          </div>
        </section>

        <section className={styles.filtersShell}>
          <div className={styles.filtersHeader}>
            <div>
              <span className={styles.sectionEyebrow}>Find faster</span>
              <h2>Keep browsing simple.</h2>
              <p>Use the filters that matter, then move through the listing pages.</p>
            </div>

            <button type="button" className={styles.clearButton} onClick={clearFilters}>
              Clear filters
            </button>
          </div>

          <div className={styles.filterGrid}>
            <label className={`${styles.field} ${styles.searchField}`}>
              <span>Search</span>
              <input
                id="marketplace-search"
                value={query}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
                placeholder="Brand, model, area or province"
              />
            </label>

            <label className={`${styles.field} ${styles.brandField}`}>
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

            <label className={`${styles.field} ${styles.modelField}`}>
              <span>Model</span>
              <input
                value={modelFilter}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setModelFilter(event.target.value)}
                placeholder="Type a model"
              />
            </label>

            <label className={`${styles.field} ${styles.driveField}`}>
              <span>Drive</span>
              <select value={driveFilter} onChange={(event) => setDriveFilter(event.target.value)}>
                <option value="">All drive types</option>
                <option value="2wd">2WD</option>
                <option value="4wd">4WD</option>
              </select>
            </label>

            <label className={`${styles.field} ${styles.typeField}`}>
              <span>Type</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">All types</option>
                <option value="field">Field</option>
                <option value="orchard">Orchard</option>
              </select>
            </label>

            <label className={`${styles.field} ${styles.provinceField}`}>
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

            <label className={`${styles.field} ${styles.sortField}`}>
              <span>Sort</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortValue)}
              >
                <option value="newest">Newest listed</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="hours-low">Hours: low to high</option>
                <option value="hours-high">Hours: high to low</option>
                <option value="year-new">Year: newest first</option>
              </select>
            </label>
          </div>

          {activePills.length ? (
            <div className={styles.pillRow}>
              {activePills.map((pill) => (
                <span key={pill} className={styles.pill}>
                  {pill}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section className={styles.resultsTop}>
          <div>
            <span className={styles.sectionEyebrow}>Results</span>
            <h2>
              {visible.length} listing{visible.length === 1 ? '' : 's'} ready to open
            </h2>
          </div>

          <div className={styles.resultsMeta}>
            <strong>
              {visible.length === 0 ? 0 : pageStart + 1}-{pageEnd}
            </strong>
            <small>shown on this page</small>
          </div>
        </section>

        <section className={styles.grid}>
          {pagedVisible.length > 0 ? (
            pagedVisible.map((listing) => {
              const cardImages = getImages(listing);

              return (
                <article
                  key={listing.id}
                  className={styles.card}
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

                    <span className={styles.imageTag}>{getListingTag(listing)}</span>

                    {cardImages.length > 1 ? (
                      <span className={styles.photoCount}>{cardImages.length} photos</span>
                    ) : null}
                  </div>

                  <div className={styles.cardHead}>
                    <div className={styles.titleBlock}>
                      <h3>
                        {listing.brandName} {listing.modelName}
                      </h3>
                      <p className={styles.specLine}>
                        {formatTypeLabel(listing.tractorType)} tractor • {listing.drive.toUpperCase()} •{' '}
                        {formatCabLabel(listing.cab)} • {listing.powerKw} kW
                      </p>
                    </div>

                    <div className={styles.priceBlock}>
                      <strong>{money(listing.askingPriceExVat)}</strong>
                      <small>VAT excluded</small>
                    </div>
                  </div>

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
                    <span className={styles.clickHint}>Open listing details</span>
                    <span className={styles.cardDate}>{formatPublishedDate(listing.publishedAtIso)}</span>
                  </div>
                </article>
              );
            })
          ) : (
            <article className={styles.emptyState}>
              <h2>No listings found</h2>
              <p>Try a different brand, drive type, province, or search phrase.</p>
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
                        ‹
                      </button>

                      <button
                        type="button"
                        className={`${styles.galleryArrow} ${styles.rightArrow}`}
                        onClick={showNextImage}
                        aria-label="Next photo"
                      >
                        ›
                      </button>
                    </>
                  ) : null}

                  <span className={styles.modalBadge}>
                    Photo {activeImageIndex + 1} of {activeImages.length}
                  </span>
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
                    <span className={styles.statLabel}>Province</span>
                    <strong className={styles.statValue}>{activeListing.province}</strong>
                  </div>

                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Area</span>
                    <strong className={styles.statValue}>{activeListing.area}</strong>
                  </div>
                </div>

                <div className={styles.modalSection}>
                  <span className={styles.sectionLabel}>Listing notes</span>
                  <p>{getListingNote(activeListing)}</p>
                </div>

                <div className={styles.modalSection}>
                  <span className={styles.sectionLabel}>Listing information</span>
                  <p>
                    Located in {activeListing.area}, {activeListing.province}. Listed on{' '}
                    {formatPublishedDate(activeListing.dateAdvertised || activeListing.publishedAtIso)}.
                  </p>
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
                      onClick={handleDeleteActiveListing}
                    >
                      Delete listing
                    </button>
                  </div>
                ) : null}

                <div className={styles.lockCard}>
                  <div>
                    <span className={styles.sectionLabel}>Seller contact</span>
                    {isSignedIn ? (
                      <p>
                        {activeListing.sellerName} • {activeListing.sellerPhone}
                        {activeListing.sellerEmail ? ` • ${activeListing.sellerEmail}` : ''}
                      </p>
                    ) : (
                      <p>
                        View seller phone number and email after sign-in. Browsing stays open before
                        account creation.
                      </p>
                    )}
                  </div>

                  {!isSignedIn ? (
                    <div className={styles.lockActions}>
                      <a href="#" className={styles.primaryAction}>
                        Create account
                      </a>
                      <a href="#" className={styles.secondaryAction}>
                        Login
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
