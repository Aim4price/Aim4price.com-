'use client';

import Link from 'next/link';
import { useMemo, useState, type ChangeEvent } from 'react';
import styles from './page.module.css';
import { listings } from '../../lib/tractor-data';
import { money } from '../../lib/tractor-logic';

type MarketplaceFilters = {
  brand: string;
  model: string;
  drive: string;
  type: string;
};

export default function MarketplaceClient({
  initialFilters,
}: {
  initialFilters: MarketplaceFilters;
}) {
  const [query, setQuery] = useState('');

  const visible = useMemo(
    () =>
      listings.filter((listing) => {
        if (initialFilters.brand && listing.brandSlug !== initialFilters.brand && listing.brandName !== initialFilters.brand) return false;
        if (initialFilters.model && listing.modelName !== initialFilters.model) return false;
        if (initialFilters.drive && listing.drive !== initialFilters.drive) return false;
        if (initialFilters.type && listing.tractorType !== initialFilters.type) return false;
        if (!query.trim()) return true;

        return `${listing.brandName} ${listing.modelName} ${listing.area} ${listing.province}`
          .toLowerCase()
          .includes(query.toLowerCase());
      }),
    [initialFilters.brand, initialFilters.model, initialFilters.drive, initialFilters.type, query],
  );

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          ← Aim4price
        </Link>
        <nav className={styles.nav}>
          <Link href="/valuation">Valuation</Link>
          <Link href="/asset-register">Asset Register</Link>
          <Link href="/marketplace" className={styles.active}>
            Marketplace
          </Link>
        </nav>
      </header>

      <section className={styles.wrap}>
        <div>
          <h1>Marketplace</h1>
          <p>This first tractor page shows structured comparable listings from the prototype Market Vault.</p>
        </div>
        <div className={styles.total}>{visible.length} listings</div>
      </section>

      <div className={styles.filters}>
        <input
          value={query}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
          placeholder="Search listings"
        />
        {initialFilters.brand ? <span className={styles.pill}>Brand: {initialFilters.brand}</span> : null}
        {initialFilters.model ? <span className={styles.pill}>Model: {initialFilters.model}</span> : null}
        {initialFilters.drive ? <span className={styles.pill}>Drive: {initialFilters.drive.toUpperCase()}</span> : null}
      </div>

      <section className={styles.grid}>
        {visible.map((listing) => (
          <article key={listing.id} className={styles.card}>
            <div className={styles.rowBetween}>
              <div>
                <h2>
                  {listing.brandName} {listing.modelName}
                </h2>
                <p>
                  {listing.tractorType} tractor • {listing.drive.toUpperCase()} •{' '}
                  {listing.cab === 'cab' ? 'Cab' : 'Open Station'} • {listing.powerKw} kW
                </p>
              </div>
              <div className={styles.price}>
                {money(listing.advertisedPriceExVat)}
                <small>VAT excluded</small>
              </div>
            </div>

            <div className={styles.stats}>
              <div>
                <span>Year</span>
                <strong>{listing.yearModel}</strong>
              </div>
              <div>
                <span>Hours</span>
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

            <div className={styles.rowBetween}>
              <div>
                <strong>{listing.sourceName}</strong>
                <p>Advertised: {listing.dateAdvertised}</p>
              </div>
              <a href={listing.sourceUrl} target="_blank" rel="noreferrer" className={styles.secondary}>
                View source
              </a>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
