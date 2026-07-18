'use client';

import { useEffect, useMemo, useState } from 'react';
import FieldManagerNavLink from './field-manager-nav-link';
import styles from './page.module.css';

type FieldManagerSession = {
  id: string;
  displayName: string;
  username: string;
};

type FieldManagerAssetSummary = {
  id: string;
  ownerUserId: string;
  publicAssetCode: string;
  plateLabel: string;
  qrStatus: string;
  title: string;
  kind: string;
  equipmentFamilyLabel: string;
  brandName: string;
  modelName: string;
  typedModelName: string;
  serialNumber: string;
  registrationNumber: string;
  vinNumber: string;
  internalReference: string;
  note: string;
  usageReading: number | null;
  usageLabel: string;
  yearModel: number | null;
  lifeWorkedPercent: number | null;
  lastScannedAtIso: string | null;
  updatedAtIso: string | null;
};

type SessionApiResponse = {
  ok: boolean;
  manager?: FieldManagerSession;
  error?: string;
};

type AssetsApiResponse = {
  ok: boolean;
  assets?: FieldManagerAssetSummary[];
  error?: string;
};

type OpenAssetApiResponse = {
  ok: boolean;
  redirectTo?: string;
  error?: string;
};

function extractError(payload: { error?: string } | null, fallback: string): string {
  return payload?.error?.trim() || fallback;
}

function serialDisplayText(asset: FieldManagerAssetSummary): string {
  return asset.serialNumber || 'Not captured';
}

function formatYearModel(asset: FieldManagerAssetSummary): string {
  if (asset.yearModel) return String(asset.yearModel);

  const titleYear = asset.title.match(/\b(?:19|20)\d{2}\b/);
  return titleYear?.[0] || 'Not captured';
}

function searchHaystack(asset: FieldManagerAssetSummary): string {
  return [
    asset.title,
    asset.brandName,
    asset.modelName,
    asset.typedModelName,
    asset.kind,
    asset.equipmentFamilyLabel,
    asset.registrationNumber,
    asset.serialNumber,
    asset.vinNumber,
    asset.internalReference,
    asset.note,
    asset.yearModel ? String(asset.yearModel) : '',
    asset.plateLabel,
    asset.publicAssetCode,
  ]
    .join(' ')
    .toLowerCase();
}

export default function FieldManagerAssetsClient() {
  const [assets, setAssets] = useState<FieldManagerAssetSummary[]>([]);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openingAssetId, setOpeningAssetId] = useState<string | null>(null);

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => searchHaystack(asset).includes(query));
  }, [assets, search]);

  useEffect(() => {
    void loadFieldManagerAssets();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function loadFieldManagerAssets() {
    setIsLoading(true);

    try {
      const sessionResponse = await fetch('/api/field-manager/session', {
        credentials: 'include',
        cache: 'no-store',
      });
      const sessionPayload = (await sessionResponse.json().catch(() => null)) as SessionApiResponse | null;

      if (sessionResponse.status === 401) {
        window.location.replace('/field-manager/login');
        return;
      }

      if (!sessionResponse.ok || !sessionPayload?.ok || !sessionPayload.manager) {
        throw new Error(extractError(sessionPayload, 'Field Manager login is required.'));
      }

      const assetsResponse = await fetch('/api/field-manager/assets', {
        credentials: 'include',
        cache: 'no-store',
      });
      const assetsPayload = (await assetsResponse.json().catch(() => null)) as AssetsApiResponse | null;

      if (assetsResponse.status === 401) {
        window.location.replace('/field-manager/login');
        return;
      }

      if (!assetsResponse.ok || !assetsPayload?.ok) {
        throw new Error(extractError(assetsPayload, 'Failed to load assets.'));
      }

      setAssets(assetsPayload.assets ?? []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to load assets.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenAsset(asset: FieldManagerAssetSummary) {
    setOpeningAssetId(asset.id);
    setNotice(null);

    try {
      const response = await fetch(`/api/field-manager/assets/${encodeURIComponent(asset.id)}/open`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as OpenAssetApiResponse | null;

      if (response.status === 401) {
        window.location.replace('/field-manager/login');
        return;
      }

      if (!response.ok || !payload?.ok || !payload.redirectTo) {
        throw new Error(extractError(payload, 'This asset cannot be opened.'));
      }

      window.location.assign(payload.redirectTo);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'This asset cannot be opened.');
      setOpeningAssetId(null);
    }
  }

  return (
    <main className={styles.mobilePage}>
      <section className={styles.assetsShell}>
        <header className={styles.assetsHeader} aria-label="Field Manager account controls">
          <FieldManagerNavLink href="/field-manager" label="Home" />
        </header>

        {notice ? <div className={styles.errorNotice}>{notice}</div> : null}

        <section className={styles.searchCard}>
          <div className={styles.searchField}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search asset, model, reg, serial or notes"
              aria-label="Search assets"
              autoComplete="off"
            />
          </div>
        </section>

        {isLoading ? <p className={styles.mobileEmpty}>Loading available assets…</p> : null}

        {!isLoading && !assets.length ? (
          <p className={styles.mobileEmpty}>No assets are available for this Field Manager login.</p>
        ) : null}

        {!isLoading && assets.length > 0 && !filteredAssets.length ? (
          <p className={styles.mobileEmpty}>No assets match this search.</p>
        ) : null}

        <section className={styles.assetList} aria-label="Field Manager assets">
          {filteredAssets.map((asset) => {
            const isOpening = openingAssetId === asset.id;

            return (
              <article key={asset.id} className={styles.assetCard}>
                <div className={styles.assetTopRow}>
                  <div>
                    <h2>{asset.title}</h2>
                  </div>
                </div>

                <div className={styles.assetMetaGrid}>
                  <div>
                    <span>Serial</span>
                    <strong>{serialDisplayText(asset)}</strong>
                  </div>
                  <div>
                    <span>Year</span>
                    <strong>{formatYearModel(asset)}</strong>
                  </div>
                  <div>
                    <span>Usage</span>
                    <strong>{asset.usageLabel}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className={`${styles.mobilePrimaryButton} ${styles.assetOpenButton}`}
                  onClick={() => void handleOpenAsset(asset)}
                  disabled={Boolean(openingAssetId)}
                >
                  {isOpening ? 'Opening…' : 'Open'}
                </button>
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}
