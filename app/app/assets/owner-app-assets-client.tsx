'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import OwnerAppNav from '../owner-app-nav';
import { ownerAppMoney, ownerAppUsage, type OwnerAppAsset, type OwnerAppAssetsResponse } from '../owner-app-types';
import styles from '../owner-app.module.css';

function searchText(asset: OwnerAppAsset): string {
  return [
    asset.title,
    asset.registerName,
    asset.categoryLabel,
    asset.kind,
    asset.brandName,
    asset.modelName,
    asset.serialNumber,
    asset.licenseRegistrationNumber,
  ].join(' ').toLowerCase();
}

export default function OwnerAppAssetsClient() {
  const [assets, setAssets] = useState<OwnerAppAsset[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    fetch('/api/owner-app/assets', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as OwnerAppAssetsResponse | null;
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Assets could not be loaded.');
        if (active) setAssets(payload.assets ?? []);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Assets could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, []);

  const visibleAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return assets;
    return assets.filter((asset) => searchText(asset).includes(normalized));
  }, [assets, query]);

  return (
    <main className={styles.appPage}>
      <OwnerAppNav title="My Assets" backHref="/app" />
      <div className={styles.shell}>
        <header className={styles.pageHeader}>
          <p className={styles.pageEyebrow}>My Assets</p>
          <h1>Find an asset.</h1>
          <p>Search across all your Aim4price asset registers.</p>
        </header>

        <label className={styles.searchBox}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, model, serial or registration"
            aria-label="Search assets"
          />
          <span aria-hidden="true">⌕</span>
        </label>

        {loading ? <div className={styles.loadingState}><span className={styles.spinner} aria-label="Loading assets" /></div> : null}
        {error ? <div className={`${styles.notice} ${styles.noticeError}`} role="alert">{error}</div> : null}

        {!loading && !error ? (
          <section className={styles.assetList} aria-label="Saved assets">
            {visibleAssets.length ? visibleAssets.map((asset) => (
              <Link key={asset.id} className={styles.assetCard} href={`/app/assets/${encodeURIComponent(asset.id)}`}>
                <div className={styles.assetCardTop}>
                  <div>
                    <h2>{asset.title}</h2>
                    <p className={styles.assetMeta}>
                      {[asset.yearModel, asset.brandName, asset.modelName].filter(Boolean).join(' · ') || asset.categoryLabel || asset.kind}
                    </p>
                  </div>
                  <span className={styles.assetCardValue}>{ownerAppMoney(asset.value)}</span>
                </div>
                <div className={styles.assetFacts}>
                  <div className={styles.assetFact}>
                    <span>Register</span>
                    <strong>{asset.registerName}</strong>
                  </div>
                  <div className={styles.assetFact}>
                    <span>Usage</span>
                    <strong>{ownerAppUsage(asset)}</strong>
                  </div>
                </div>
              </Link>
            )) : <div className={styles.emptyState}>{query ? 'No saved assets match that search.' : 'No assets have been saved yet.'}</div>}
          </section>
        ) : null}
      </div>
    </main>
  );
}
