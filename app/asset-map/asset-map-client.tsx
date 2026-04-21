'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type NoticeTone = 'error';
type RecencyFilter = 'all' | '7' | '30' | '90';
type BasemapMode = 'road' | 'satellite';

type AssetMapItem = {
  id: string;
  title: string;
  plateLabel: string;
  publicAssetCode: string;
  qrStatus: string;
  condition: string;
  hours: number | null;
  fuelPercent: number | null;
  serialNumber: string;
  lastScannedAtIso: string | null;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastKnownLocationText: string;
  updatedAtIso: string;
};

type AssetMapResponse = {
  ok: boolean;
  assets?: AssetMapItem[];
  summary?: {
    totalAssets: number;
    assetsWithLocation: number;
    assetsWithoutLocation: number;
    activeMappedAssets: number;
    scannedLast30Days: number;
  };
  error?: string;
};

type LeafletTileLayerSet = {
  road: any | null;
  satellite: any | null;
};

declare global {
  interface Window {
    L?: any;
  }
}

let leafletLoaderPromise: Promise<any> | null = null;

const LEAFLET_SCRIPT_ID = 'aim4price-leaflet-script';
const LEAFLET_CSS_ID = 'aim4price-leaflet-css';
const DEFAULT_CENTER: [number, number] = [-29.0, 24.0];
const DEFAULT_ZOOM = 5;
const BASEMAP_STORAGE_KEY = 'aim4price-asset-map-basemap';
const RECENCY_OPTIONS: Array<{ value: RecencyFilter; label: string }> = [
  { value: 'all', label: 'All mapped' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];
const BASEMAP_OPTIONS: Array<{ value: BasemapMode; label: string }> = [
  { value: 'road', label: 'Map' },
  { value: 'satellite', label: 'Satellite' },
];

function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Leaflet can only load in the browser.'));
  }

  if (window.L) {
    return Promise.resolve(window.L);
  }

  if (leafletLoaderPromise) {
    return leafletLoaderPromise;
  }

  leafletLoaderPromise = new Promise((resolve, reject) => {
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement('link');
      link.id = LEAFLET_CSS_ID;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null;

    const handleLoaded = () => {
      if (window.L) {
        resolve(window.L);
        return;
      }

      reject(new Error('Leaflet did not initialise correctly.'));
    };

    if (existingScript) {
      if (window.L) {
        resolve(window.L);
        return;
      }

      existingScript.addEventListener('load', handleLoaded, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load the map renderer.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = LEAFLET_SCRIPT_ID;
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.crossOrigin = '';
    script.addEventListener('load', handleLoaded, { once: true });
    script.addEventListener('error', () => reject(new Error('Failed to load the map renderer.')), { once: true });
    document.body.appendChild(script);
  });

  return leafletLoaderPromise;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function formatCondition(value?: string | null): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return 'Not saved';
  if (normalized === 'excellent') return 'Excellent';
  if (normalized === 'good') return 'Good';
  if (normalized === 'fair') return 'Fair';
  if (normalized === 'used') return 'Used';
  if (normalized === 'serious') return 'Requires attention';
  return normalized;
}

function formatFuel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function formatHours(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-ZA').format(Math.round(value));
}

function hasCoordinates(asset: AssetMapItem): boolean {
  const { lastKnownLat: lat, lastKnownLng: lng } = asset;
  if (lat === null || lng === null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function matchesSearch(asset: AssetMapItem, search: string): boolean {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return true;

  return [asset.title, asset.plateLabel, asset.publicAssetCode, asset.lastKnownLocationText, asset.serialNumber]
    .join(' ')
    .toLowerCase()
    .includes(normalizedSearch);
}

function matchesRecency(asset: AssetMapItem, filter: RecencyFilter): boolean {
  if (filter === 'all') {
    return true;
  }

  if (!asset.lastScannedAtIso) {
    return false;
  }

  const parsed = new Date(asset.lastScannedAtIso).getTime();
  if (Number.isNaN(parsed)) {
    return false;
  }

  const ageDays = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
  const limit = Number(filter);
  return Number.isFinite(limit) ? ageDays <= limit : true;
}

function getMarkerColors(asset: AssetMapItem): { fill: string; stroke: string } {
  if (asset.lastScannedAtIso) {
    const parsed = new Date(asset.lastScannedAtIso).getTime();
    if (!Number.isNaN(parsed)) {
      const ageDays = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
      if (ageDays <= 7) {
        return { fill: '#1f8f63', stroke: '#145843' };
      }
      if (ageDays <= 30) {
        return { fill: '#3d6bd6', stroke: '#24438a' };
      }
    }
  }

  return { fill: '#7b8797', stroke: '#506070' };
}

function buildPopupHtml(asset: AssetMapItem): string {
  const escape = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const title = escape(asset.title || 'Saved asset');
  const plate = escape(asset.plateLabel || 'No plate label');
  const location = escape(asset.lastKnownLocationText || 'No location note saved');
  const scanned = escape(formatDate(asset.lastScannedAtIso));

  return `
    <div style="min-width: 180px; font-family: Inter, Arial, sans-serif; color: #183033;">
      <div style="font-weight: 800; font-size: 15px; line-height: 1.2; margin-bottom: 6px;">${title}</div>
      <div style="font-size: 12px; color: #526268; margin-bottom: 4px;">${plate}</div>
      <div style="font-size: 12px; color: #526268; margin-bottom: 4px;">${location}</div>
      <div style="font-size: 12px; color: #526268;">Last scanned: ${scanned}</div>
    </div>
  `;
}

export default function AssetMapClient() {
  const [assets, setAssets] = useState<AssetMapItem[]>([]);
  const [search, setSearch] = useState('');
  const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>('all');
  const [basemapMode, setBasemapMode] = useState<BasemapMode>('road');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [summary, setSummary] = useState<AssetMapResponse['summary'] | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastLoadedAtIso, setLastLoadedAtIso] = useState<string | null>(null);

  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);
  const baseLayersRef = useRef<LeafletTileLayerSet>({ road: null, satellite: null });
  const markersByCodeRef = useRef<Map<string, any>>(new Map());
  const lastBoundsSignatureRef = useRef('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const savedMode = window.localStorage.getItem(BASEMAP_STORAGE_KEY);
    if (savedMode === 'road' || savedMode === 'satellite') {
      setBasemapMode(savedMode);
    }
  }, []);

  const fetchMapData = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    const initialLoad = mode === 'initial';

    if (initialLoad) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const response = await fetch('/api/asset-map', {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await response.json().catch(() => null)) as AssetMapResponse | null;

      if (!response.ok || !data?.ok || !Array.isArray(data.assets)) {
        throw new Error(data?.error ?? 'Failed to load the asset map.');
      }

      setAssets(data.assets);
      setSummary(data.summary ?? null);
      setLastLoadedAtIso(new Date().toISOString());
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load the asset map.' });
    } finally {
      if (initialLoad) {
        setIsLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchMapData('initial');
  }, [fetchMapData]);

  useEffect(() => {
    if (!notice) return undefined;

    const timeout = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchMapData('refresh');
      }
    }, 45000);

    return () => window.clearInterval(interval);
  }, [fetchMapData]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(BASEMAP_STORAGE_KEY, basemapMode);
  }, [basemapMode]);

  const mappedAssets = useMemo(() => assets.filter(hasCoordinates), [assets]);

  const filteredAssets = useMemo(() => {
    return mappedAssets
      .filter((asset) => matchesSearch(asset, search))
      .filter((asset) => matchesRecency(asset, recencyFilter))
      .sort((left, right) => {
        const leftTime = left.lastScannedAtIso ? new Date(left.lastScannedAtIso).getTime() : 0;
        const rightTime = right.lastScannedAtIso ? new Date(right.lastScannedAtIso).getTime() : 0;

        if (rightTime !== leftTime) {
          return rightTime - leftTime;
        }

        return left.title.localeCompare(right.title, 'en', { sensitivity: 'base' });
      });
  }, [mappedAssets, recencyFilter, search]);

  const selectedAsset = useMemo(() => {
    return filteredAssets.find((asset) => asset.publicAssetCode === selectedCode) ?? filteredAssets[0] ?? null;
  }, [filteredAssets, selectedCode]);

  useEffect(() => {
    if (!selectedAsset) {
      if (selectedCode !== null) {
        setSelectedCode(null);
      }
      return;
    }

    if (selectedAsset.publicAssetCode !== selectedCode) {
      setSelectedCode(selectedAsset.publicAssetCode);
    }
  }, [selectedAsset, selectedCode]);

  useEffect(() => {
    let cancelled = false;

    async function initialiseMap() {
      if (!mapElementRef.current || mapRef.current) {
        return;
      }

      const L = await loadLeaflet();
      if (cancelled || !mapElementRef.current) {
        return;
      }

      leafletRef.current = L;

      const map = L.map(mapElementRef.current, {
        zoomControl: true,
        attributionControl: true,
      });

      const roadLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      });
      const satelliteLayer = L.tileLayer(
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri',
        },
      );

      baseLayersRef.current = {
        road: roadLayer,
        satellite: satelliteLayer,
      };

      roadLayer.addTo(map);
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      mapRef.current = map;
      markerLayerRef.current = L.layerGroup().addTo(map);

      const invalidate = () => map.invalidateSize();
      window.setTimeout(invalidate, 120);
      window.addEventListener('resize', invalidate);
      (map as any).__aim4priceInvalidate = invalidate;
    }

    void initialiseMap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const baseLayers = baseLayersRef.current;

    if (!map || !baseLayers.road || !baseLayers.satellite) {
      return;
    }

    const activeLayer = basemapMode === 'satellite' ? baseLayers.satellite : baseLayers.road;
    const inactiveLayer = basemapMode === 'satellite' ? baseLayers.road : baseLayers.satellite;

    if (inactiveLayer && map.hasLayer(inactiveLayer)) {
      map.removeLayer(inactiveLayer);
    }

    if (activeLayer && !map.hasLayer(activeLayer)) {
      activeLayer.addTo(map);
    }
  }, [basemapMode]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    const markerLayer = markerLayerRef.current;

    if (!map || !L || !markerLayer) {
      return;
    }

    markerLayer.clearLayers();
    markersByCodeRef.current.clear();

    if (!filteredAssets.length) {
      lastBoundsSignatureRef.current = '';
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds: Array<[number, number]> = [];

    for (const asset of filteredAssets) {
      const lat = asset.lastKnownLat as number;
      const lng = asset.lastKnownLng as number;
      const colors = getMarkerColors(asset);

      const marker = L.circleMarker([lat, lng], {
        radius: 10,
        color: colors.stroke,
        weight: 2,
        fillColor: colors.fill,
        fillOpacity: 0.95,
      });

      marker.bindPopup(buildPopupHtml(asset));
      marker.on('click', () => setSelectedCode(asset.publicAssetCode));
      marker.addTo(markerLayer);
      markersByCodeRef.current.set(asset.publicAssetCode, marker);
      bounds.push([lat, lng]);
    }

    const signature = filteredAssets.map((asset) => asset.publicAssetCode).join('|');
    if (signature !== lastBoundsSignatureRef.current) {
      lastBoundsSignatureRef.current = signature;

      if (bounds.length === 1) {
        map.setView(bounds[0], 11);
      } else {
        map.fitBounds(bounds, {
          padding: [44, 44],
          maxZoom: 12,
        });
      }
    }
  }, [filteredAssets]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = selectedCode ? markersByCodeRef.current.get(selectedCode) : null;

    if (!map || !marker) {
      return;
    }

    const latLng = marker.getLatLng();
    map.panTo(latLng, { animate: true, duration: 0.6 });
    marker.openPopup();
  }, [selectedCode]);

  useEffect(() => {
    return () => {
      const map = mapRef.current;
      if (!map) return;

      const invalidate = (map as any).__aim4priceInvalidate;
      if (invalidate) {
        window.removeEventListener('resize', invalidate);
      }

      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      baseLayersRef.current = { road: null, satellite: null };
      markersByCodeRef.current.clear();
      lastBoundsSignatureRef.current = '';
    };
  }, []);

  const assetsAwaitingLocation = useMemo(() => Math.max(0, assets.length - mappedAssets.length), [assets.length, mappedAssets.length]);
  const selectedGoogleMapsHref =
    selectedAsset && hasCoordinates(selectedAsset)
      ? `https://www.google.com/maps/search/?api=1&query=${selectedAsset.lastKnownLat},${selectedAsset.lastKnownLng}`
      : null;

  return (
    <main className={styles.page}>
      <AppHeader active="none" />

      <section className={styles.shell}>
        <div className={styles.hero}>
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}>Fleet visibility</span>
            <h1>Asset map</h1>
            <p>
              See the latest saved scan locations for your assets in one place. This first version keeps one
              marker per asset and shows the last known scan position only.
            </p>
          </div>

          <div className={styles.heroAside}>
            <div className={styles.heroStat}>
              <span>Assets on map</span>
              <strong>{summary?.assetsWithLocation ?? mappedAssets.length}</strong>
            </div>
            <div className={styles.heroStat}>
              <span>Awaiting location</span>
              <strong>{summary?.assetsWithoutLocation ?? assetsAwaitingLocation}</strong>
            </div>
            <div className={styles.heroStat}>
              <span>Scanned in 30 days</span>
              <strong>{summary?.scannedLast30Days ?? 0}</strong>
            </div>
          </div>
        </div>

        {notice ? <div className={styles.notice}>{notice.message}</div> : null}

        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <span>Search assets</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, plate label, code or location"
            />
          </label>

          <div className={styles.toolbarAside}>
            <div className={styles.filterRail}>
              {RECENCY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.filterChip} ${recencyFilter === option.value ? styles.filterChipActive : ''}`}
                  onClick={() => setRecencyFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className={styles.toolbarStatus}>
              <span>{lastLoadedAtIso ? `Updated ${formatDate(lastLoadedAtIso)}` : 'Waiting for the first refresh'}</span>
              <button type="button" className={styles.secondaryButton} onClick={() => void fetchMapData('refresh')} disabled={isRefreshing || isLoading}>
                {isRefreshing ? 'Refreshing…' : 'Refresh map'}
              </button>
            </div>
          </div>
        </div>

        <div className={styles.layout}>
          <section className={styles.mapCard}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.kicker}>Latest marker view</span>
                <h2>Asset location map</h2>
                <p>Markers are based on the most recent saved latitude and longitude for each asset.</p>
              </div>

              <div className={styles.mapControlRail}>
                <div className={styles.basemapToggle} role="group" aria-label="Map layer toggle">
                  {BASEMAP_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.basemapButton} ${basemapMode === option.value ? styles.basemapButtonActive : ''}`}
                      onClick={() => setBasemapMode(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className={styles.legend}>
                  <span><i className={styles.legendRecent} /> 7 days</span>
                  <span><i className={styles.legendWarm} /> 30 days</span>
                  <span><i className={styles.legendOlder} /> Older</span>
                </div>
              </div>
            </div>

            <div className={styles.mapFrame}>
              {isLoading ? <div className={styles.mapEmpty}>Loading the asset map...</div> : null}
              {!isLoading && !mappedAssets.length ? (
                <div className={styles.mapEmpty}>
                  <strong>No asset locations saved yet.</strong>
                  <span>Scan an asset and save a real GPS location to place the first marker on the map.</span>
                </div>
              ) : null}
              {!isLoading && mappedAssets.length && !filteredAssets.length ? (
                <div className={styles.mapEmpty}>
                  <strong>No mapped assets match this filter.</strong>
                  <span>Clear or widen the search to bring your saved markers back into view.</span>
                </div>
              ) : null}
              <div className={styles.mapCanvas} ref={mapElementRef} aria-label="Asset map canvas" />
            </div>
          </section>

          <aside className={styles.sidebar}>
            <section className={styles.sidebarCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.kicker}>Selected asset</span>
                  <h2>{selectedAsset?.title ?? 'No asset selected'}</h2>
                  <p>
                    {selectedAsset
                      ? 'This card reflects the latest saved scan position and current operational snapshot.'
                      : 'Choose a marker or asset row to inspect the latest saved location.'}
                  </p>
                </div>
              </div>

              {selectedAsset ? (
                <div className={styles.selectedStack}>
                  <div className={styles.metricGrid}>
                    <div className={styles.metricTile}>
                      <span>Plate label</span>
                      <strong>{selectedAsset.plateLabel || 'Pending'}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Condition</span>
                      <strong>{formatCondition(selectedAsset.condition)}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Hours</span>
                      <strong>{formatHours(selectedAsset.hours)}</strong>
                    </div>
                    <div className={styles.metricTile}>
                      <span>Fuel</span>
                      <strong>{formatFuel(selectedAsset.fuelPercent)}</strong>
                    </div>
                  </div>

                  <div className={styles.detailCard}>
                    <span>Last scanned</span>
                    <strong>{formatDate(selectedAsset.lastScannedAtIso)}</strong>
                    <p>{selectedAsset.lastKnownLocationText || 'No location note saved on this asset yet.'}</p>
                    <small>
                      {selectedAsset.lastKnownLat}, {selectedAsset.lastKnownLng}
                    </small>
                  </div>

                  <div className={styles.inlineActions}>
                    {selectedGoogleMapsHref ? (
                      <a href={selectedGoogleMapsHref} target="_blank" rel="noreferrer" className={styles.primaryButton}>
                        Open in Google Maps
                      </a>
                    ) : null}
                    <Link href="/asset-register" className={styles.secondaryButton}>
                      Open asset register
                    </Link>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyPanel}>Pick any marker to see the latest location details here.</div>
              )}
            </section>

            <section className={styles.sidebarCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.kicker}>Mapped assets</span>
                  <h2>{filteredAssets.length}</h2>
                  <p>Click a row to focus that asset on the map.</p>
                </div>
              </div>

              <div className={styles.assetList}>
                {filteredAssets.length ? (
                  filteredAssets.map((asset) => {
                    const isActive = asset.publicAssetCode === selectedAsset?.publicAssetCode;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        className={`${styles.assetListItem} ${isActive ? styles.assetListItemActive : ''}`}
                        onClick={() => setSelectedCode(asset.publicAssetCode)}
                      >
                        <div className={styles.assetListHeader}>
                          <strong>{asset.title}</strong>
                          <span>{asset.plateLabel || 'Pending'}</span>
                        </div>
                        <div className={styles.assetListMeta}>
                          <span>{formatDate(asset.lastScannedAtIso)}</span>
                          <span>{asset.lastKnownLocationText || 'No location note'}</span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className={styles.emptyPanel}>No mapped assets match the current search or time filter.</div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
