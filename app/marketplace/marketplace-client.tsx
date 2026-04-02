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
          (a, b) =>
            new Date(b.dateAdvertised).getTime() - new Date(a.dateAdvertised).getTime(),
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

  return (
    <main className={styles.page}>
      <AppHeader active="marketplace" />

      <section className={styles.wrap}>
        <div>
          <h1>Marketplace</h1>
          <p>
            Browse Aim4price in-house tractor listings. Anyone can view listings,
            but contact details only unlock after sign-in. Listings should flow
            from valuation to asset register and then into marketplace.
          </p>
        </div>

        <div className={styles.total}>{visible.length} listings</div>
      </section>

      <div className={styles.filters}>
        <input
          value={query}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
          placeholder="Search brand, model, area or province"
        />

        {initialFilters.brand ? (
          <span className={styles.pill}>Brand: {initialFilters.brand}</span>
        ) : null}

        {initialFilters.model ? (
          <span className={styles.pill}>Model: {initialFilters.model}</span>
        ) : null}

        {initialFilters.drive ? (
          <span className={styles.pill}>Drive: {initialFilters.drive.toUpperCase()}</span>
        ) : null}

        {initialFilters.type ? (
          <span className={styles.pill}>Type: {formatTypeLabel(initialFilters.type)}</span>
        ) : null}
      </div>

      <section className={styles.grid}>
        {visible.length > 0 ? (
          visible.map((listing) => (
            <article key={listing.id} className={styles.card}>
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                  overflow: 'hidden',
                  borderRadius: '1.15rem',
                  marginBottom: '1rem',
                  border: '1px solid rgba(16, 42, 34, 0.08)',
                  background: '#f7faf8',
                }}
              >
                <img
                  src={listing.imageSrc}
                  alt={`${listing.brandName} ${listing.modelName}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                  onError={(event) => {
                    event.currentTarget.src = FALLBACK_IMAGE;
                  }}
                />
              </div>

              <div className={styles.rowBetween}>
                <div>
                  <h2>
                    {listing.brandName} {listing.modelName}
                  </h2>
                  <p>
                    {formatTypeLabel(listing.tractorType)} tractor •{' '}
                    {listing.drive.toUpperCase()} • {formatCabLabel(listing.cab)} •{' '}
                    {listing.powerKw} kW
                  </p>
                </div>

                <div className={styles.price}>
                  {money(listing.askingPriceExVat)}
                  <small>VAT excluded</small>
                </div>
              </div>

              <div className={styles.stats}>
                <div>
                  <span>Year</span>
                  <strong>{listing.yearModel}</strong>
                </div>
                <div>
                  <span>Engine hours</span>
                  <strong>{listing.hours.toLocaleString('en-ZA')}</strong>
                </div>
                <div>
                  <span>Province</span>
                  <strong>{listing.province}</strong>
                </div>
                <div>
                  <span>Area</span>
                  <strong>{listing.area}</strong>
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.65 }}>
                  Aim4price marketplace listing for{' '}
                  <strong>
                    {listing.brandName} {listing.modelName}
                  </strong>{' '}
                  located in {listing.seller.locationLabel}. Listed on {listing.dateAdvertised}.
                </p>
              </div>

              <div
                className={styles.rowBetween}
                style={{
                  marginTop: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid rgba(16, 42, 34, 0.08)',
                }}
              >
                <div>
                  <strong>Seller contact</strong>
                  {isSignedIn ? (
                    <p>
                      {listing.seller.sellerName} • {listing.seller.sellerPhone} •{' '}
                      {listing.seller.sellerEmail}
                    </p>
                  ) : (
                    <p>Sign in to view seller phone number and email address.</p>
                  )}
                </div>

                {isSignedIn ? (
                  <span className={styles.secondary}>Contact unlocked</span>
                ) : (
                  <a href="#" className={styles.secondary}>
                    Sign in to view contact
                  </a>
                )}
              </div>
            </article>
          ))
        ) : (
          <article className={styles.card}>
            <h2>No listings found</h2>
            <p>Try a different search or remove some filters.</p>
          </article>
        )}
      </section>
    </main>
  );
}
