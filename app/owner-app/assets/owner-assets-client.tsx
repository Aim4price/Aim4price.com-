'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import BalancedHeadingText from '../balanced-heading';
import styles from '../owner-app.module.css';

type Asset = {
  id: string;
  title: string;
  kind: string;
  brandName: string;
  modelName: string;
  yearModel: number | null;
  serialNumber: string;
  registrationNumber: string;
  registerName: string;
  note: string;
  usage: number | null;
  usageMetric: 'hours' | 'km' | 'percentage';
};

type ApiResponse = {
  ok: boolean;
  items?: Asset[];
  error?: string;
};

function searchHaystack(asset: Asset): string {
  return [
    asset.title,
    asset.kind,
    asset.brandName,
    asset.modelName,
    asset.yearModel,
    asset.serialNumber,
    asset.registrationNumber,
    asset.registerName,
    asset.note,
  ].join(' ').toLowerCase();
}

function serialDisplayText(asset: Asset): string {
  return asset.serialNumber || 'Not captured';
}

function yearDisplayText(asset: Asset): string {
  if (asset.yearModel) return String(asset.yearModel);
  return asset.title.match(/\b(?:19|20)\d{2}\b/)?.[0] || 'Not captured';
}

function usageDisplayText(asset: Asset): string {
  if (asset.usage === null) return 'Not captured';
  const value = asset.usage.toLocaleString('en-ZA');
  if (asset.usageMetric === 'percentage') return `${value}%`;
  return `${value} ${asset.usageMetric}`;
}

export default function OwnerAssetsClient({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;
    const terms = normalizedQuery.split(/\s+/).filter(Boolean);
    const compactQuery = normalizedQuery.replace(/[^a-z0-9]/g, '');
    return items.filter((asset) => {
      const haystack = searchHaystack(asset);
      const compactHaystack = haystack.replace(/[^a-z0-9]/g, '');
      return terms.every((term) => haystack.includes(term)) || Boolean(compactQuery && compactHaystack.includes(compactQuery));
    });
  }, [items, query]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAssets() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/owner-app/assets', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as ApiResponse | null;
        if (response.status === 401) {
          window.location.replace('/owner-app/login');
          return;
        }
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || 'Failed to load your assets.');
        }
        setItems(payload.items ?? []);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Failed to load your assets.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadAssets();
    return () => controller.abort();
  }, []);

  return (
    <div className={styles.wideContent}>
      <section className={styles.assetListToolbar}>
        <div className={styles.assetSearchField}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search asset, model, reg or serial"
            aria-label="Search assets"
            autoComplete="off"
          />
        </div>
        <Link className={styles.addAssetButton} href="/owner-app/assets/add" prefetch={false}>
          <span aria-hidden="true">+</span>
          <span>Add asset</span>
        </Link>
      </section>

      {error ? <div className={styles.errorNotice}>{error}</div> : null}
      {loading ? <div className={styles.loading}>Loading your assets…</div> : null}
      {!loading && !error && !items.length ? <div className={styles.empty}>No assets have been added yet.</div> : null}
      {!loading && !error && items.length > 0 && !filteredItems.length ? <div className={styles.empty}>No assets match this search.</div> : null}

      {!loading && !error ? (
        <section className={styles.managerAssetList} aria-label="Owner assets">
          {filteredItems.map((asset) => (
            <article key={asset.id} className={styles.managerAssetCard}>
              <h2><BalancedHeadingText text={asset.title} /></h2>

              <div className={styles.managerAssetMetaGrid}>
                <div>
                  <span>Serial</span>
                  <strong>{serialDisplayText(asset)}</strong>
                </div>
                <div>
                  <span>Year</span>
                  <strong>{yearDisplayText(asset)}</strong>
                </div>
                <div>
                  <span>Usage</span>
                  <strong>{usageDisplayText(asset)}</strong>
                </div>
              </div>

              <Link
                className={`${styles.assetMirrorAction} ${styles.assetMirrorManageAction} ${styles.ownerAssetOpenButton}`}
                href={`/owner-app/assets/${encodeURIComponent(asset.id)}`}
                prefetch={false}
              >
                Open
              </Link>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
