'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import BalancedHeadingText from '../balanced-heading';
import OwnerServiceLocationModal from '../owner-service-location-modal';
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
  usageMetric: 'hours' | 'km' | 'percentage' | 'not_applicable';
};

type ApiResponse = {
  ok: boolean;
  items?: Asset[];
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

type OwnerAssetApiResponse = {
  ok?: boolean;
  item?: {
    publicAssetCode?: string;
  };
  error?: string;
};

type LocationGateRequest = {
  assetTitle: string;
  assetId: string;
  publicAssetCode: string;
  redirectTo: string;
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
  if (asset.usageMetric === 'not_applicable') return 'Not applicable';
  if (asset.usage === null) return 'Not captured';
  const value = asset.usage.toLocaleString('en-ZA');
  if (asset.usageMetric === 'percentage') return `${value}% worked`;
  return `${value} ${asset.usageMetric}`;
}

export default function OwnerAssetsClient({
  initialQuery = '',
  mode = 'assets',
  canAddAssets = false,
}: {
  initialQuery?: string;
  mode?: 'assets' | 'maintenance' | 'problem';
  canAddAssets?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<Asset[]>([]);
  const [groups, setGroups] = useState<AssetGroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showAllAssets, setShowAllAssets] = useState(false);
  const [restored, setRestored] = useState(false);
  const scrollRestored = useRef(false);
  const directoryKey = `owner-directory-${mode}`;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [openingAssetId, setOpeningAssetId] = useState<string | null>(null);
  const [locationGate, setLocationGate] = useState<LocationGateRequest | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(directoryKey) || 'null');
      if (saved && !initialQuery) { setQuery(saved.query || ''); setSelectedGroupId(saved.group || null); setShowAllAssets(Boolean(saved.all)); }
    } catch { /* Storage is optional. */ }
    setRestored(true);
  }, [directoryKey, initialQuery]);
  useEffect(() => {
    if (!restored) return;
    try { sessionStorage.setItem(directoryKey, JSON.stringify({ query, group: selectedGroupId, all: showAllAssets })); } catch { /* Storage is optional. */ }
  }, [restored, directoryKey, query, selectedGroupId, showAllAssets]);

  useEffect(() => {
    if (loading || !restored || scrollRestored.current) return;
    scrollRestored.current = true;
    let frame = 0;
    try { const y = Number(sessionStorage.getItem(`${directoryKey}-scroll`) || 0); frame = requestAnimationFrame(() => window.scrollTo(0, y)); } catch { /* Storage is optional. */ }
    const remember = () => { try { sessionStorage.setItem(`${directoryKey}-scroll`, String(window.scrollY)); } catch { /* Storage is optional. */ } };
    document.addEventListener('click', remember, true);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('click', remember, true); };
  }, [loading, restored, directoryKey]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;
    const terms = normalizedQuery.split(/\s+/).filter(Boolean);
    const compactQuery = normalizedQuery.replace(/[^a-z0-9]/g, '');
    return items.filter((asset) => {
      const groupNames = groups.filter(group => group.memberAssetIds.includes(asset.id)).map(group => group.name).join(' ').toLowerCase();
      const haystack = `${searchHaystack(asset)} ${groupNames}`;
      const compactHaystack = haystack.replace(/[^a-z0-9]/g, '');
      return terms.every((term) => haystack.includes(term)) || Boolean(compactQuery && compactHaystack.includes(compactQuery));
    });
  }, [items, query, groups]);

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
  const hasSearch = Boolean(query.trim());
  const directoryItems = useMemo(() => {
    if (hasSearch || showAllAssets || !groups.length) return filteredItems;
    if (selectedGroup) return filteredItems.filter((asset) => selectedGroupAssetIds.has(asset.id));
    return filteredItems.filter((asset) => !groupByAssetId.has(asset.id));
  }, [filteredItems, groupByAssetId, groups.length, hasSearch, selectedGroup, selectedGroupAssetIds, showAllAssets]);
  const matchingAssetIds = useMemo(() => new Set(filteredItems.map(asset => asset.id)), [filteredItems]);
  const matchingGroups = useMemo(
    () => hasSearch ? groups.filter(group => query.trim().toLowerCase().split(/\s+/).every(term => group.name.toLowerCase().includes(term))) : groups,
    [groups, hasSearch, query],
  );
  const showDirectoryHome = groups.length > 0 && !selectedGroup && !showAllAssets && !hasSearch;

  useEffect(() => {
    const controller = new AbortController();

    async function loadAssets(silent = false) {
      if (!silent) setLoading(true);
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
        setGroups(payload.groups ?? []);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Failed to load your assets.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadAssets();
    const refresh = () => { if (document.visibilityState === 'visible') void loadAssets(true); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { controller.abort(); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  async function handleOpenMaintenance(asset: Asset) {
    setOpeningAssetId(asset.id);
    setActionError('');

    try {
      const response = await fetch(`/api/owner-app/assets/${encodeURIComponent(asset.id)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null) as OwnerAssetApiResponse | null;

      if (response.status === 401) {
        window.location.replace('/owner-app/login');
        return;
      }

      const publicAssetCode = payload?.item?.publicAssetCode?.trim();
      if (!response.ok || !payload?.ok || !publicAssetCode) {
        throw new Error(payload?.error?.trim() || 'This service cannot be opened.');
      }

      setLocationGate({
        assetTitle: asset.title,
        assetId: asset.id,
        publicAssetCode,
        redirectTo: `/owner-app/operations/maintenance/${encodeURIComponent(asset.id)}${mode === 'problem' ? '?reportProblem=1' : ''}`,
      });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'This service cannot be opened.');
    } finally {
      setOpeningAssetId(null);
    }
  }

  function returnToDirectory() {
    setSelectedGroupId(null);
    setShowAllAssets(false);
  }

  function renderAssetCard(asset: Asset) {
    return (
      <article key={asset.id} className={`${styles.managerAssetCard} ${hasSearch && matchingAssetIds.has(asset.id) ? styles.assetDirectorySearchMatch : ''}`}>
        <h2 title={asset.title}><BalancedHeadingText text={asset.title} /></h2>

        <div className={`${styles.managerAssetMetaGrid} ${styles.ownerAssetMetaStack}`}>
          <div>
            <span>Serial / VIN</span>
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

        {mode !== 'assets' ? (
          <button
            type="button"
            className={`${styles.assetMirrorAction} ${styles.assetMirrorManageAction} ${styles.ownerAssetOpenButton}`}
            onClick={() => void handleOpenMaintenance(asset)}
            disabled={openingAssetId !== null}
          >
            {openingAssetId === asset.id ? 'Opening…' : mode === 'problem' ? 'Report problem' : 'Record work'}
          </button>
        ) : (
          <Link
            className={`${styles.assetMirrorAction} ${styles.assetMirrorManageAction} ${styles.ownerAssetOpenButton}`}
            href={`/owner-app/assets/${encodeURIComponent(asset.id)}`}
            prefetch={false}
          >
            Open
          </Link>
        )}
      </article>
    );
  }

  return (
    <div className={styles.wideContent}>
      <section className={styles.assetListToolbar}>
        <div className={styles.assetSearchField}>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              returnToDirectory();
            }}
            placeholder="Search assets or groups"
            aria-label="Search assets or groups"
            autoComplete="off"
          />
        </div>
        {mode === 'assets' && canAddAssets ? (
          <Link className={styles.addAssetButton} href="/owner-app/assets/add" prefetch={false}>
            <span aria-hidden="true">+</span>
            <span>Add asset</span>
          </Link>
        ) : null}
      </section>

      {!loading && !error && groups.length > 0 && (selectedGroup || showAllAssets) ? (
        <section className={styles.assetDirectoryNav} aria-label="Asset directory navigation">
          <button type="button" onClick={returnToDirectory}>All groups</button><strong>{selectedGroup?.name || 'All assets'}</strong>
        </section>
      ) : null}

      {hasSearch && !loading && !error ? <p role="status" className={styles.searchResultCount}>{directoryItems.length} matching {directoryItems.length === 1 ? 'asset' : 'assets'} <button type="button" onClick={() => { setQuery(''); returnToDirectory(); }}>Clear search</button></p> : null}
      {error ? <div className={styles.errorNotice}>{error}</div> : null}
      {actionError ? <div className={styles.errorNotice}>{actionError}</div> : null}
      {loading ? <div className={styles.loading}>Loading your assets…</div> : null}
      {!loading && !error && !items.length ? <div className={styles.empty}>No assets have been added yet.</div> : null}
      {!loading && !error && items.length > 0 && !directoryItems.length && !matchingGroups.length ? <div className={styles.empty}>No assets match this search.</div> : null}

      {!loading && !error ? (
        <div className={styles.assetDirectory}>
          {showDirectoryHome || (hasSearch && matchingGroups.length > 0) ? (
            <section className={styles.assetDirectorySection} aria-label="Asset groups">
              <div className={styles.managerAssetList}>
                {!hasSearch ? (
                  <article className={`${styles.managerAssetCard} ${styles.assetDirectoryAllCard}`}>
                    <h2>All assets</h2>
                    <p>View every physical asset in one list.</p>
                    <button
                      type="button"
                      className={`${styles.assetMirrorAction} ${styles.assetMirrorManageAction} ${styles.ownerAssetOpenButton}`}
                      onClick={() => setShowAllAssets(true)}
                    >
                      View all assets
                    </button>
                  </article>
                ) : null}
                {matchingGroups.map((group) => (
                  <article key={group.id} className={`${styles.managerAssetCard} ${styles.assetDirectoryUmbrellaCard} ${hasSearch ? styles.assetDirectorySearchMatch : ''}`}>
                    <h2 title={group.name}>{group.name}</h2>
                    <p>{group.memberCount} linked {group.memberCount === 1 ? 'asset' : 'assets'}</p>
                    <button
                      type="button"
                      className={`${styles.assetMirrorAction} ${styles.assetMirrorManageAction} ${styles.ownerAssetOpenButton}`}
                      onClick={() => { setQuery(''); setShowAllAssets(false); setSelectedGroupId(group.id); }}
                      aria-label={`Open ${group.name}`}
                    >
                      Open
                    </button>
                  </article>
                ))}

              </div>
            </section>
          ) : null}

          {directoryItems.length ? (
            <section className={styles.assetDirectorySection} aria-label={mode === 'maintenance' ? 'Assets available for maintenance' : 'Owner assets'}>
              {showDirectoryHome ? (
                <div className={styles.assetDirectoryHeading}>
                  <span>Not in a group</span>
                  <h2>Other assets</h2>
                </div>
              ) : null}
              <div className={styles.managerAssetList}>
                {directoryItems.map(renderAssetCard)}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {locationGate ? (
        <OwnerServiceLocationModal
          {...locationGate}
          recordLabel={mode === 'problem' ? 'problem report' : 'service'}
          onCancel={() => setLocationGate(null)}
          onError={setActionError}
        />
      ) : null}
    </div>
  );
}
