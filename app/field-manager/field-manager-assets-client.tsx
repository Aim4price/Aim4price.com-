'use client';

import { useEffect, useMemo, useState } from 'react';
import FieldManagerNavLink from './field-manager-nav-link';
import FieldManagerServiceLocationModal from './field-manager-service-location-modal';
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
  groups?: AssetGroupSummary[];
  error?: string;
};

type AssetGroupSummary = {
  id: string;
  name: string;
  primaryAssetId: string;
  memberAssetIds: string[];
  memberCount: number;
};

type OpenAssetApiResponse = {
  ok: boolean;
  assetId?: string;
  publicAssetCode?: string;
  redirectTo?: string;
  error?: string;
};

type LocationGateRequest = {
  assetTitle: string;
  assetId: string;
  publicAssetCode: string;
  redirectTo: string;
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
  const [groups, setGroups] = useState<AssetGroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showAllAssets, setShowAllAssets] = useState(false);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openingAssetId, setOpeningAssetId] = useState<string | null>(null);
  const [locationGate, setLocationGate] = useState<LocationGateRequest | null>(null);

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => searchHaystack(asset).includes(query));
  }, [assets, search]);
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );
  const groupByAssetId = useMemo(() => new Map(
    groups.flatMap((group) => group.memberAssetIds.map((assetId) => [assetId, group] as const)),
  ), [groups]);
  const selectedGroupAssetIds = useMemo(
    () => new Set(selectedGroup?.memberAssetIds ?? []),
    [selectedGroup],
  );
  const hasSearch = Boolean(search.trim());
  const directoryAssets = useMemo(() => {
    if (hasSearch || showAllAssets || !groups.length) return filteredAssets;
    if (selectedGroup) return filteredAssets.filter((asset) => selectedGroupAssetIds.has(asset.id));
    return filteredAssets.filter((asset) => !groupByAssetId.has(asset.id));
  }, [filteredAssets, groupByAssetId, groups.length, hasSearch, selectedGroup, selectedGroupAssetIds, showAllAssets]);
  const showDirectoryHome = groups.length > 0 && !hasSearch && !selectedGroup && !showAllAssets;

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
      setGroups(assetsPayload.groups ?? []);
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

      if (!response.ok || !payload?.ok || !payload.redirectTo || !payload.assetId || !payload.publicAssetCode) {
        throw new Error(extractError(payload, 'This asset cannot be opened.'));
      }

      setLocationGate({
        assetTitle: asset.title,
        assetId: payload.assetId,
        publicAssetCode: payload.publicAssetCode,
        redirectTo: payload.redirectTo,
      });
      setOpeningAssetId(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'This asset cannot be opened.');
      setOpeningAssetId(null);
    }
  }

  function returnToDirectory() {
    setSelectedGroupId(null);
    setShowAllAssets(false);
  }

  function renderAssetCard(asset: FieldManagerAssetSummary) {
    const isOpening = openingAssetId === asset.id;
    const assetGroup = groupByAssetId.get(asset.id);

    return (
      <article key={asset.id} className={styles.assetCard}>
        <div className={styles.assetTopRow}>
          <div>
            <h2>{asset.title}</h2>
            {hasSearch && assetGroup ? <p>Umbrella: {assetGroup.name}</p> : null}
          </div>
        </div>

        <div className={`${styles.assetMetaGrid} ${styles.assetMetaGridVertical}`}>
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

        {!isLoading && groups.length > 0 && !hasSearch && (selectedGroup || showAllAssets) ? (
          <section className={styles.assetDirectoryNav} aria-label="Asset directory navigation">
            <button type="button" onClick={returnToDirectory}>Back to umbrellas</button>
            <div>
              <span>{selectedGroup ? 'Umbrella' : 'Maintenance'}</span>
              <strong>{selectedGroup?.name || 'All assets'}</strong>
            </div>
          </section>
        ) : null}

        {isLoading ? <p className={styles.mobileEmpty}>Loading available assets…</p> : null}

        {!isLoading && !assets.length ? (
          <p className={styles.mobileEmpty}>No assets are available for this Field Manager login.</p>
        ) : null}

        {!isLoading && assets.length > 0 && !filteredAssets.length ? (
          <p className={styles.mobileEmpty}>No assets match this search.</p>
        ) : null}

        <div className={styles.assetDirectory}>
          {showDirectoryHome ? (
            <section className={styles.assetDirectorySection} aria-labelledby="field-umbrella-heading">
              <div className={styles.assetDirectoryHeading}>
                <span>Organised assets</span>
                <h1 id="field-umbrella-heading">Umbrellas</h1>
              </div>
              <div className={styles.assetList}>
                {groups.map((group) => (
                  <article key={group.id} className={`${styles.assetCard} ${styles.assetDirectoryUmbrellaCard}`}>
                    <div className={styles.assetDirectoryUmbrellaIcon} aria-hidden="true">☂</div>
                    <div className={styles.assetTopRow}><div><h2>{group.name}</h2></div></div>
                    <p className={styles.assetDirectoryCount}>{group.memberCount} linked {group.memberCount === 1 ? 'asset' : 'assets'}</p>
                    <button
                      type="button"
                      className={`${styles.mobilePrimaryButton} ${styles.assetOpenButton}`}
                      onClick={() => setSelectedGroupId(group.id)}
                    >
                      Open umbrella
                    </button>
                  </article>
                ))}
                <article className={`${styles.assetCard} ${styles.assetDirectoryUmbrellaCard}`}>
                  <div className={styles.assetDirectoryUmbrellaIcon} aria-hidden="true">▦</div>
                  <div className={styles.assetTopRow}><div><h2>All assets</h2></div></div>
                  <p className={styles.assetDirectoryCount}>View every available physical asset.</p>
                  <button
                    type="button"
                    className={`${styles.mobilePrimaryButton} ${styles.assetOpenButton}`}
                    onClick={() => setShowAllAssets(true)}
                  >
                    View all assets
                  </button>
                </article>
              </div>
            </section>
          ) : null}

          {directoryAssets.length ? (
            <section className={styles.assetDirectorySection} aria-label="Field Manager assets">
              {showDirectoryHome ? (
                <div className={styles.assetDirectoryHeading}>
                  <span>Not inside an umbrella</span>
                  <h1>Other assets</h1>
                </div>
              ) : null}
              <div className={styles.assetList}>{directoryAssets.map(renderAssetCard)}</div>
            </section>
          ) : null}
        </div>

        {locationGate ? (
          <FieldManagerServiceLocationModal
            {...locationGate}
            onCancel={() => setLocationGate(null)}
            onError={setNotice}
          />
        ) : null}
      </section>
    </main>
  );
}
