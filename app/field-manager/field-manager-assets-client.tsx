'use client';

import { useEffect, useMemo, useState } from 'react';
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
  usageReading: number | null;
  usageLabel: string;
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

function formatDate(value: string | null): string {
  if (!value) return 'No update yet';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No update yet';

  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function assetIdentityText(asset: FieldManagerAssetSummary): string {
  return [asset.brandName, asset.modelName || asset.typedModelName, asset.equipmentFamilyLabel || asset.kind]
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(' • ');
}

function secondaryIdentityText(asset: FieldManagerAssetSummary): string {
  const entries = [
    asset.registrationNumber ? `Reg ${asset.registrationNumber}` : '',
    asset.serialNumber ? `Serial ${asset.serialNumber}` : '',
    asset.vinNumber ? `VIN ${asset.vinNumber}` : '',
    asset.internalReference ? `Ref ${asset.internalReference}` : '',
    asset.plateLabel ? `Code ${asset.plateLabel}` : '',
  ].filter(Boolean);

  return entries.length ? entries.join(' • ') : 'No registration, serial or internal reference saved';
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
    asset.plateLabel,
    asset.publicAssetCode,
  ]
    .join(' ')
    .toLowerCase();
}

export default function FieldManagerAssetsClient() {
  const [manager, setManager] = useState<FieldManagerSession | null>(null);
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

      setManager(sessionPayload.manager);
      setAssets(assetsPayload.assets ?? []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to load assets.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/field-manager/login', {
      method: 'DELETE',
      credentials: 'include',
      cache: 'no-store',
    }).catch(() => undefined);
    window.location.replace('/field-manager/login');
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
        <header className={styles.assetsHeader}>
          <div>
            <span>Aim4price</span>
            <h1>Field Manager</h1>
            <p>{manager ? `Signed in as ${manager.displayName}` : 'Mobile asset access'}</p>
          </div>
          <button type="button" className={styles.logoutButton} onClick={() => void handleLogout()}>
            Logout
          </button>
        </header>

        {notice ? <div className={styles.errorNotice}>{notice}</div> : null}

        <section className={styles.searchCard}>
          <label className={styles.searchField}>
            <span>Choose asset</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search asset, model, reg, serial or reference"
              autoComplete="off"
            />
          </label>
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
                    <span className={styles.assetKind}>{asset.equipmentFamilyLabel || asset.kind || 'Asset'}</span>
                    <h2>{asset.title}</h2>
                    <p>{assetIdentityText(asset) || 'Asset identity not fully saved'}</p>
                  </div>
                  <span className={styles.assetCode}>{asset.plateLabel || asset.publicAssetCode}</span>
                </div>

                <div className={styles.assetMetaGrid}>
                  <div>
                    <span>Identity</span>
                    <strong>{secondaryIdentityText(asset)}</strong>
                  </div>
                  <div>
                    <span>Usage</span>
                    <strong>{asset.usageLabel}</strong>
                  </div>
                  <div>
                    <span>Last field update</span>
                    <strong>{formatDate(asset.lastScannedAtIso)}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.mobilePrimaryButton}
                  onClick={() => void handleOpenAsset(asset)}
                  disabled={Boolean(openingAssetId)}
                >
                  {isOpening ? 'Opening…' : 'Open Field Update'}
                </button>
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}
