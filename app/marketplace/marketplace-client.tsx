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

export default function MarketplaceClient({
  initialFilters,
}: {
  initialFilters: MarketplaceFilters;
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MarketplaceListing[]>(seedMarketplaceListings);
  const [activeListing, setActiveListing] = useState<MarketplaceListing | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const isSignedIn = false;

  useEffect(() => {
    const refresh = () => {
      setItems(loadMarketplaceListings());
    };

    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);

    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const visible = useMemo(
    () =>
      items.filter((listing) => {
        const filterBrand = normalize(initialFilters.brand);
        const filterModel = normalize(initialFilters.model);
        const filterDrive = normalize(initialFilters.drive);
        const filterType = normalize(initialFilters.type);
        const search = normalize(query);

        if (
          filterBrand &&
          normalize(listing.brandSlug) !== filterBrand &&
          normalize(listing.brandName) !== filterBrand
        ) {
          return false;
        }

        if (filterModel && normalize(listing.modelName) !== filterModel) {
          return false;
        }

        if (filterDrive && normalize(listing.drive) !== filterDrive) {
          return false;
        }

        if (filterType && normalize(listing.tractorType) !== filterType) {
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
        ]
          .join(' ')
          .toLowerCase()
          .includes(search);
      }),
    [
      initialFilters.brand,
      initialFilters.drive,
      initialFilters.model,
      initialFilters.type,
      items,
      query,
    ],
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

  const activePills = [
    initialFilters.brand ? `Brand: ${initialFilters.brand}` : '',
    initialFilters.model ? `Model: ${initialFilters.model}` : '',
    initialFilters.drive ? `Drive: ${initialFilters.drive.toUpperCase()}` : '',
    initialFilters.type ? `Type: ${formatTypeLabel(initialFilters.type)}` : '',
  ].filter(Boolean);

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

  return (
    <main className={styles.page}>
      <div className={styles.topBand}>
        <AppHeader active="marketplace" />
      </div>

      <div className={styles.inner}>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>Aim4price marketplace</span>
              <h1>Marketplace</h1>
              <p>
                Browse Aim4price in-house tractor listings. Click any listing to open the full
                equipment view, location, notes and photo gallery. Contact details stay locked until
                sign-in.
              </p>
            </div>

            <aside className={styles.totalCard}>
              <strong>{visible.length}</strong>
              <span>Live listings</span>
              <small>Click a listing to view full details</small>
            </aside>
          </div>

          <div className={styles.searchPanel}>
            <label htmlFor="marketplace-search" className={styles.searchLabel}>
              Search listings
            </label>

            <input
              id="marketplace-search"
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
              placeholder="Search brand, model, area or province"
            />

            {activePills.length ? (
              <div className={styles.pillRow}>
                {activePills.map((pill) => (
                  <span key={pill} className={styles.pill}>
                    {pill}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className={styles.grid}>
          {visible.length > 0 ? (
            visible.map((listing) => {
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
                      <h2>
                        {listing.brandName} {listing.modelName}
                      </h2>
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
                    <span className={styles.clickHint}>Click to view location, notes and photos</span>
                  </div>
                </article>
              );
            })
          ) : (
            <article className={styles.emptyState}>
              <h2>No listings found</h2>
              <p>Try a different brand, model, area or province.</p>
            </article>
          )}
        </section>
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
                    <strong>{money(activeListing.askingPriceExVat)}</strong>
                    <small>VAT excluded</small>
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
                    {activeListing.dateAdvertised}.
                  </p>
                </div>

                <div className={styles.modalSection}>
                  <span className={styles.sectionLabel}>Seller contact</span>
                  {isSignedIn ? (
                    <p>
                      {activeListing.sellerName} • {activeListing.sellerPhone}
                      {activeListing.sellerEmail ? ` • ${activeListing.sellerEmail}` : ''}
                    </p>
                  ) : (
                    <p>Sign in above to view seller phone number and email address.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}