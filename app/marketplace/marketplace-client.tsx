'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';
import { listings } from '../../lib/tractor-data';
import { money } from '../../lib/tractor-logic';

type MarketplaceFilters = {
  brand: string;
  model: string;
  drive: string;
  type: string;
};

const FALLBACK_IMAGE = '/brand/Tractor.png';

function normalize(value: string | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function safeImage(src?: string): string {
  const value = String(src ?? '').trim();
  return value || FALLBACK_IMAGE;
}

function formatTypeLabel(value: string): string {
  return value === 'orchard' ? 'Orchard' : 'Field';
}

function formatCabLabel(value: string): string {
  return value === 'cab' ? 'Cab' : 'Open Station';
}

function buildPrototypeSeller(area: string, province: string, index: number) {
  const padded = String(index + 1).padStart(2, '0');

  return {
    sellerName: `${toTitleCase(area)} Machinery`,
    sellerPhone: `+27 82 555 01${padded}`,
    sellerEmail: `${normalize(area).replace(/[^a-z0-9]+/g, '')}@aim4price-demo.co.za`,
    locationLabel: `${area}, ${province}`,
  };
}

export default function MarketplaceClient({
  initialFilters,
}: {
  initialFilters: MarketplaceFilters;
}) {
  const [query, setQuery] = useState('');
  const isSignedIn = false;

  const marketplaceListings = useMemo(
    () =>
      [...listings]
        .sort(
          (a, b) => new Date(b.dateAdvertised).getTime() - new Date(a.dateAdvertised).getTime(),
        )
        .map((listing, index) => ({
          ...listing,
          imageSrc: safeImage(listing.imageSrc),
          seller: buildPrototypeSeller(listing.area, listing.province, index),
        })),
    [],
  );

  const visible = useMemo(
    () =>
      marketplaceListings.filter((listing) => {
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
          listing.tractorType,
          listing.drive,
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
      marketplaceListings,
      query,
    ],
  );

  const activePills = [
    initialFilters.brand ? `Brand: ${initialFilters.brand}` : '',
    initialFilters.model ? `Model: ${initialFilters.model}` : '',
    initialFilters.drive ? `Drive: ${initialFilters.drive.toUpperCase()}` : '',
    initialFilters.type ? `Type: ${formatTypeLabel(initialFilters.type)}` : '',
  ].filter(Boolean);

  return (
    <main className={styles.page}>
      <AppHeader active="marketplace" />

      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Aim4price tractor marketplace</span>
            <h1>Marketplace</h1>
            <p>
              Browse Aim4price in-house tractor listings. Anyone can view listings. Contact details
              only unlock after sign-in. Listings should flow from valuation to asset register and
              then into marketplace.
            </p>
          </div>

          <aside className={styles.totalCard}>
            <strong>{visible.length}</strong>
            <span>Live listings</span>
            <small>Public browsing • Contact locked</small>
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
          visible.map((listing) => (
            <article key={listing.id} className={styles.card}>
              <div className={styles.imageFrame}>
                <img
                  src={listing.imageSrc}
                  alt={`${listing.brandName} ${listing.modelName}`}
                  className={styles.image}
                  onError={(event) => {
                    event.currentTarget.src = FALLBACK_IMAGE;
                  }}
                />
                <span className={styles.imageTag}>In-house listing</span>
              </div>

              <div className={styles.cardHead}>
                <div className={styles.titleBlock}>
                  <h2>
                    {listing.brandName} {listing.modelName}
                  </h2>
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

              <div className={styles.stats}>
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

                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Province</span>
                  <strong className={styles.statValue}>{listing.province}</strong>
                </div>

                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Area</span>
                  <strong className={styles.statValue}>{listing.area}</strong>
                </div>
              </div>

              <div className={styles.noteBox}>
                <strong>Listing summary</strong>
                <p>
                  Aim4price marketplace listing for{' '}
                  <b>
                    {listing.brandName} {listing.modelName}
                  </b>{' '}
                  located in {listing.seller.locationLabel}. Listed on {listing.dateAdvertised}.
                </p>
              </div>

              <div className={styles.contactRow}>
                <div className={styles.contactCopy}>
                  <strong>Seller contact</strong>
                  {isSignedIn ? (
                    <p>
                      {listing.seller.sellerName} • {listing.seller.sellerPhone} •{' '}
                      {listing.seller.sellerEmail}
                    </p>
                  ) : (
                    <p>Sign in above to view seller phone number and email address.</p>
                  )}
                </div>

                {isSignedIn ? (
                  <span className={styles.secondary}>Contact unlocked</span>
                ) : (
                  <span className={styles.secondary}>Contact locked</span>
                )}
              </div>
            </article>
          ))
        ) : (
          <article className={styles.emptyState}>
            <h2>No listings found</h2>
            <p>Try a different brand, model, area or province.</p>
          </article>
        )}
      </section>
    </main>
  );
}
