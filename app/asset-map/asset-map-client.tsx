'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type NoticeTone = 'error';
type RecencyFilter = 'all' | '7' | '30' | '90';
type BasemapMode = 'road' | 'satellite';
type MarkerTone = 'recent' | 'warm' | 'older';

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
const REPORT_DOWNLOAD_HREF = '/api/asset-map/report';
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

function getMarkerTone(asset: AssetMapItem): MarkerTone {
  if (asset.lastScannedAtIso) {
    const parsed = new Date(asset.lastScannedAtIso).getTime();
    if (!Number.isNaN(parsed)) {
      const ageDays = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
      if (ageDays <= 7) return 'recent';
      if (ageDays <= 30) return 'warm';
    }
  }

  return 'older';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildMarkerLabel(asset: AssetMapItem, index: number): string {
  const raw = String(asset.title || asset.plateLabel || asset.publicAssetCode || '').trim();
  const initials = raw
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || String(index + 1);
}

function buildPopupHtml(asset: AssetMapItem): string {
  const title = escapeHtml(asset.title || 'Saved asset');
  const plate = escapeHtml(asset.plateLabel || 'No plate label');
  const location = escapeHtml(asset.lastKnownLocationText || 'No location note saved');
  const scanned = escapeHtml(formatDate(asset.lastScannedAtIso));

  return `
    <div style="min-width: 210px; font-family: Inter, Arial, sans-serif; color: #16312f;">
      <div style="font-weight: 900; font-size: 15px; line-height: 1.18; margin-bottom: 7px; letter-spacing: -0.02em;">${title}</div>
      <div style="font-size: 12px; color: #5b6a70; margin-bottom: 5px;">${plate}</div>
      <div style="font-size: 12px; color: #5b6a70; margin-bottom: 5px;">${location}</div>
      <div style="font-size: 12px; color: #5b6a70;">Last scanned: ${scanned}</div>
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

  const selectedAssetPosition = useMemo(() => {
    if (!selectedAsset) return 0;
    const index = filteredAssets.findIndex((asset) => asset.publicAssetCode === selectedAsset.publicAssetCode);
    return index >= 0 ? index + 1 : 0;
  }, [filteredAssets, selectedAsset]);

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
        zoomControl: false,
        attributionControl: true,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

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

    filteredAssets.forEach((asset, index) => {
      const lat = asset.lastKnownLat as number;
      const lng = asset.lastKnownLng as number;
      const markerTone = getMarkerTone(asset);
      const isActive = asset.publicAssetCode === selectedCode;
      const label = escapeHtml(buildMarkerLabel(asset, index));

      const icon = L.divIcon({
        className: `aim4priceMapMarker aim4priceMapMarker--${markerTone}${isActive ? ' aim4priceMapMarker--active' : ''}`,
        html: `<span class="aim4priceMapMarkerPin"><b>${label}</b></span>`,
        iconSize: [36, 42],
        iconAnchor: [18, 38],
        popupAnchor: [0, -34],
      });

      const marker = L.marker([lat, lng], { icon, title: asset.title || asset.plateLabel || 'Saved asset' });

      marker.bindPopup(buildPopupHtml(asset));
      marker.on('click', () => setSelectedCode(asset.publicAssetCode));
      marker.addTo(markerLayer);
      markersByCodeRef.current.set(asset.publicAssetCode, marker);
      bounds.push([lat, lng]);
    });

    const signature = filteredAssets.map((asset) => asset.publicAssetCode).join('|');
    if (signature !== lastBoundsSignatureRef.current) {
      lastBoundsSignatureRef.current = signature;

      if (bounds.length === 1) {
        map.setView(bounds[0], 12);
      } else {
        map.fitBounds(bounds, {
          padding: [58, 58],
          maxZoom: 12,
        });
      }
    }
  }, [filteredAssets, selectedCode]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = selectedCode ? markersByCodeRef.current.get(selectedCode) : null;

    if (!map || !marker) {
      return;
    }

    const latLng = marker.getLatLng();
    map.panTo(latLng, { animate: true, duration: 0.55 });
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
  const scannedAssetCount = useMemo(() => assets.filter((asset) => Boolean(asset.lastScannedAtIso)).length, [assets]);
  const lastUpdatedText = lastLoadedAtIso ? formatDate(lastLoadedAtIso) : 'Waiting for first refresh';
  const selectedGoogleMapsHref =
    selectedAsset && hasCoordinates(selectedAsset)
      ? `https://www.google.com/maps/search/?api=1&query=${selectedAsset.lastKnownLat},${selectedAsset.lastKnownLng}`
      : null;

  return (
    <main className={styles.page}>
      <AppHeader active="asset-register" />

      <section className={styles.shell}>
        <section className={styles.commandBar}>
          <div className={styles.commandTitle}>
            <span className={styles.eyebrow}>Fleet visibility</span>
            <h1>Asset map</h1>
            <p>Clean QR scan-location view with marker focus, quick filters and a scanned-assets export.</p>
          </div>

          <div className={styles.statStrip} aria-label="Asset map summary">
            <div className={styles.statPill}>
              <span>Mapped</span>
              <strong>{summary?.assetsWithLocation ?? mappedAssets.length}</strong>
            </div>
            <div className={styles.statPill}>
              <span>No GPS</span>
              <strong>{summary?.assetsWithoutLocation ?? assetsAwaitingLocation}</strong>
            </div>
            <div className={styles.statPill}>
              <span>30 days</span>
              <strong>{summary?.scannedLast30Days ?? 0}</strong>
            </div>
            <div className={styles.statPill}>
              <span>Report</span>
              <strong>{scannedAssetCount}</strong>
            </div>
          </div>

          <div className={styles.commandActions}>
            {scannedAssetCount > 0 ? (
              <a href={REPORT_DOWNLOAD_HREF} className={styles.darkButton}>
                Export scan report
              </a>
            ) : (
              <button type="button" className={`${styles.darkButton} ${styles.buttonDisabled}`} disabled>
                No report yet
              </button>
            )}
            <button type="button" className={styles.lightButton} onClick={() => void fetchMapData('refresh')} disabled={isRefreshing || isLoading}>
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </section>

        {notice ? <div className={styles.notice}>{notice.message}</div> : null}

        <section className={styles.mapConsole}>
          <div className={styles.mapFrame}>
            {isLoading ? <div className={styles.mapEmpty}>Loading the asset map...</div> : null}
            {!isLoading && !mappedAssets.length ? (
              <div className={styles.mapEmpty}>
                <strong>No asset locations saved yet.</strong>
                <span>Scan an asset and save a GPS location to place the first marker on the map.</span>
              </div>
            ) : null}
            {!isLoading && mappedAssets.length && !filteredAssets.length ? (
              <div className={styles.mapEmpty}>
                <strong>No mapped assets match this view.</strong>
                <span>Clear the search or choose a wider time filter.</span>
              </div>
            ) : null}

            <div className={styles.mapCanvas} ref={mapElementRef} aria-label="Asset map canvas" />

            <div
              className={styles.controlDock}
              onPointerDown={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onWheel={(event) => event.stopPropagation()}
            >
              <label className={styles.searchControl}>
                <span>Search</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Asset title, plate, code or location"
                />
              </label>

              <div className={styles.filterGroup} aria-label="Scan age filter">
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
            </div>

            <div
              className={styles.layerDock}
              onPointerDown={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
            >
              {BASEMAP_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.layerButton} ${basemapMode === option.value ? styles.layerButtonActive : ''}`}
                  onClick={() => setBasemapMode(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {!isLoading && filteredAssets.length ? (
              <label
                className={styles.assetPicker}
                onPointerDown={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
              >
                <span>Choose scanned asset</span>
                <select
                  value={selectedAsset?.publicAssetCode ?? ''}
                  onChange={(event) => setSelectedCode(event.target.value || null)}
                  aria-label="Choose scanned asset on the map"
                >
                  {filteredAssets.map((asset) => (
                    <option key={asset.publicAssetCode} value={asset.publicAssetCode}>
                      {asset.title} {asset.plateLabel ? `• ${asset.plateLabel}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {selectedAsset ? (
              <aside
                className={styles.assetPreview}
                onPointerDown={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
              >
                <div className={styles.assetPreviewTop}>
                  <span>
                    {selectedAssetPosition || 1}/{filteredAssets.length || 1}
                  </span>
                  <strong>{selectedAsset.title}</strong>
                  <p>{selectedAsset.plateLabel || selectedAsset.publicAssetCode || 'No plate label'}</p>
                </div>

                <div className={styles.previewStats}>
                  <div>
                    <span>Condition</span>
                    <strong>{formatCondition(selectedAsset.condition)}</strong>
                  </div>
                  <div>
                    <span>Usage</span>
                    <strong>{formatHours(selectedAsset.hours)}</strong>
                  </div>
                  <div>
                    <span>Fuel</span>
                    <strong>{formatFuel(selectedAsset.fuelPercent)}</strong>
                  </div>
                </div>

                <div className={styles.lastScanBox}>
                  <span>Last scanned</span>
                  <strong>{formatDate(selectedAsset.lastScannedAtIso)}</strong>
                  <small>{selectedAsset.lastKnownLocationText || `${selectedAsset.lastKnownLat}, ${selectedAsset.lastKnownLng}`}</small>
                </div>

                <div className={styles.previewActions}>
                  {selectedGoogleMapsHref ? (
                    <a href={selectedGoogleMapsHref} target="_blank" rel="noreferrer" className={styles.darkButton}>
                      Google Maps
                    </a>
                  ) : null}
                  <Link href="/asset-register" className={styles.lightButton}>
                    Open register
                  </Link>
                </div>
              </aside>
            ) : null}

            <div className={styles.mapFooterDock}>
              <span>Updated {lastUpdatedText}</span>
              <div className={styles.legend}>
                <span><i className={styles.legendRecent} /> 7 days</span>
                <span><i className={styles.legendWarm} /> 30 days</span>
                <span><i className={styles.legendOlder} /> Older</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.assetDrawer}>
          <div className={styles.drawerHeader}>
            <div>
              <span className={styles.eyebrowSoft}>Mapped assets</span>
              <h2>{filteredAssets.length} visible</h2>
            </div>
            <p>Tap any asset to centre it on the map.</p>
          </div>

          <div className={styles.assetRail}>
            {filteredAssets.length ? (
              filteredAssets.map((asset) => {
                const isActive = asset.publicAssetCode === selectedAsset?.publicAssetCode;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    className={`${styles.assetRailItem} ${isActive ? styles.assetRailItemActive : ''}`}
                    onClick={() => setSelectedCode(asset.publicAssetCode)}
                  >
                    <span>{asset.plateLabel || asset.publicAssetCode || 'Pending plate'}</span>
                    <strong>{asset.title}</strong>
                    <small>{formatDate(asset.lastScannedAtIso)}</small>
                    <em>{asset.lastKnownLocationText || 'No location note'}</em>
                  </button>
                );
              })
            ) : (
              <div className={styles.emptyRail}>No mapped assets match the current search or time filter.</div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
