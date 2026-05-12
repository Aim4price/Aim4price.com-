'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type NoticeTone = 'error';
type BasemapMode = 'road' | 'satellite';
type MarkerTone = 'recent' | 'warm' | 'older';
type AssetStatusChoice = 'yes' | 'no' | 'unknown' | 'not_applicable';

type AssetMapItem = {
  id: string;
  title: string;
  kind: string;
  assetTypeLabel: string;
  plateLabel: string;
  publicAssetCode: string;
  qrStatus: string;
  condition: string;
  financeStatus: AssetStatusChoice;
  insuranceStatus: AssetStatusChoice;
  licenseStatus: AssetStatusChoice;
  hours: number | null;
  fuelPercent: number | null;
  serialNumber: string;
  brandName: string;
  modelName: string;
  typedModelName: string;
  yearModel: number | null;
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
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatFuel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function formatHours(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-ZA').format(Math.round(value));
}

function formatYearModel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return String(Math.round(value));
}

function formatAssetStatusChoice(value?: AssetStatusChoice | null): string {
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  if (value === 'not_applicable') return 'Not applicable';
  return 'Not sure';
}

function buildAssetOptionLabel(asset: AssetMapItem): string {
  const title = asset.title || asset.plateLabel || asset.publicAssetCode || 'Saved asset';
  const yearPrefix = asset.yearModel ? `${formatYearModel(asset.yearModel)} ` : '';
  const plate = asset.plateLabel || asset.publicAssetCode;
  return `${yearPrefix}${title}${plate ? ` • ${plate}` : ''}`;
}

function formatLatLng(asset: AssetMapItem): string {
  if (!hasCoordinates(asset)) return '—';
  return `${Number(asset.lastKnownLat).toFixed(6)}, ${Number(asset.lastKnownLng).toFixed(6)}`;
}

function hasCoordinates(asset: AssetMapItem): boolean {
  const { lastKnownLat: lat, lastKnownLng: lng } = asset;
  if (lat === null || lng === null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function matchesSearch(asset: AssetMapItem, search: string): boolean {
  const normalizedSearch = normalizeSearch(search);
  if (!normalizedSearch) return true;

  return [
    asset.title,
    asset.plateLabel,
    asset.publicAssetCode,
    asset.lastKnownLocationText,
    asset.serialNumber,
    asset.assetTypeLabel,
    asset.brandName,
    asset.modelName,
    asset.typedModelName,
    formatAssetStatusChoice(asset.financeStatus),
    formatAssetStatusChoice(asset.insuranceStatus),
    formatAssetStatusChoice(asset.licenseStatus),
    asset.yearModel ? String(asset.yearModel) : '',
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedSearch);
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

function buildPopupHtml(asset: AssetMapItem, markerNumber: number): string {
  const title = escapeHtml(asset.title || 'Saved asset');
  const plate = escapeHtml(asset.plateLabel || asset.publicAssetCode || 'No plate label');
  const assetType = escapeHtml(asset.assetTypeLabel || 'Asset');
  const fuel = escapeHtml(formatFuel(asset.fuelPercent));
  const licensed = escapeHtml(formatAssetStatusChoice(asset.licenseStatus));
  const gps = escapeHtml(formatLatLng(asset));

  return `
    <div style="min-width: 226px; font-family: Montserrat, Inter, Arial, sans-serif; color: #122f2a;">
      <div style="display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:999px; color:#fff; background:#103f35; font-size:12px; font-weight:900; margin-bottom:8px;">${markerNumber}</div>
      <div style="font-weight: 850; font-size: 16px; line-height: 1.15; margin-bottom: 6px; letter-spacing: -0.03em;">${title}</div>
      <div style="font-size: 12px; color: #5b6a70; margin-bottom: 9px;">${plate}</div>
      <div style="display:grid; gap:6px; font-size:12px; color:#53666b;">
        <div><strong style="color:#132d2d;">Asset type:</strong> ${assetType}</div>
        <div><strong style="color:#132d2d;">Fuel:</strong> ${fuel}</div>
        <div><strong style="color:#132d2d;">Licensed:</strong> ${licensed}</div>
        <div><strong style="color:#132d2d;">GPS:</strong> ${gps}</div>
      </div>
    </div>
  `;
}

function sortMappedAssets(left: AssetMapItem, right: AssetMapItem): number {
  const leftTime = left.lastScannedAtIso ? new Date(left.lastScannedAtIso).getTime() : 0;
  const rightTime = right.lastScannedAtIso ? new Date(right.lastScannedAtIso).getTime() : 0;

  if (rightTime !== leftTime) {
    return rightTime - leftTime;
  }

  return left.title.localeCompare(right.title, 'en', { sensitivity: 'base' });
}

export default function AssetMapClient() {
  const [assets, setAssets] = useState<AssetMapItem[]>([]);
  const [search, setSearch] = useState('');
  const [chosenCode, setChosenCode] = useState<'all' | string>('all');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [basemapMode, setBasemapMode] = useState<BasemapMode>('road');
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

  const mappedAssets = useMemo(() => assets.filter(hasCoordinates).sort(sortMappedAssets), [assets]);

  const visibleAssets = useMemo(() => {
    if (chosenCode !== 'all') {
      return mappedAssets.filter((asset) => asset.publicAssetCode === chosenCode);
    }

    return mappedAssets.filter((asset) => matchesSearch(asset, search));
  }, [chosenCode, mappedAssets, search]);

  const selectedAsset = useMemo(() => {
    if (!selectedCode) return null;
    return mappedAssets.find((asset) => asset.publicAssetCode === selectedCode) ?? null;
  }, [mappedAssets, selectedCode]);

  const selectedVisiblePosition = useMemo(() => {
    if (!selectedAsset) return 0;
    const index = visibleAssets.findIndex((asset) => asset.publicAssetCode === selectedAsset.publicAssetCode);
    return index >= 0 ? index + 1 : 0;
  }, [selectedAsset, visibleAssets]);

  useEffect(() => {
    if (selectedCode && !visibleAssets.some((asset) => asset.publicAssetCode === selectedCode)) {
      setSelectedCode(null);
    }
  }, [selectedCode, visibleAssets]);

  useEffect(() => {
    if (!search.trim() || chosenCode !== 'all') {
      return;
    }

    if (visibleAssets.length === 1) {
      setSelectedCode(visibleAssets[0].publicAssetCode);
      return;
    }

    setSelectedCode(null);
  }, [chosenCode, search, visibleAssets]);

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

      L.control.zoom({ position: 'bottomleft' }).addTo(map);

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

    if (!visibleAssets.length) {
      lastBoundsSignatureRef.current = '';
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds: Array<[number, number]> = [];

    visibleAssets.forEach((asset, index) => {
      const lat = asset.lastKnownLat as number;
      const lng = asset.lastKnownLng as number;
      const markerTone = getMarkerTone(asset);
      const isActive = asset.publicAssetCode === selectedCode;
      const markerNumber = index + 1;

      const icon = L.divIcon({
        className: `aim4priceMapMarker aim4priceMapMarker--${markerTone}${isActive ? ' aim4priceMapMarker--active' : ''}`,
        html: `<span class="aim4priceMapMarkerPin"><b>${markerNumber}</b></span>`,
        iconSize: [42, 48],
        iconAnchor: [21, 44],
        popupAnchor: [0, -38],
      });

      const marker = L.marker([lat, lng], { icon, title: asset.title || asset.plateLabel || 'Saved asset' });

      marker.bindPopup(buildPopupHtml(asset, markerNumber));
      marker.on('click', () => setSelectedCode(asset.publicAssetCode));
      marker.addTo(markerLayer);
      markersByCodeRef.current.set(asset.publicAssetCode, marker);
      bounds.push([lat, lng]);
    });

    const signature = visibleAssets.map((asset) => asset.publicAssetCode).join('|');
    if (signature !== lastBoundsSignatureRef.current) {
      lastBoundsSignatureRef.current = signature;

      if (bounds.length === 1) {
        map.setView(bounds[0], 13);
      } else {
        map.fitBounds(bounds, {
          paddingTopLeft: [88, 118],
          paddingBottomRight: [390, 120],
          maxZoom: 13,
        });
      }
    }
  }, [selectedCode, visibleAssets]);

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

  const lastUpdatedText = lastLoadedAtIso ? formatDate(lastLoadedAtIso) : 'Waiting for first refresh';
  const selectedGoogleMapsHref =
    selectedAsset && hasCoordinates(selectedAsset)
      ? `https://www.google.com/maps/search/?api=1&query=${selectedAsset.lastKnownLat},${selectedAsset.lastKnownLng}`
      : null;
  const reportHref = useMemo(() => {
    if (!visibleAssets.length) return null;

    const showingAll = chosenCode === 'all' && !search.trim() && visibleAssets.length === mappedAssets.length;
    if (showingAll) {
      return '/api/asset-map/report';
    }

    const codes = visibleAssets.map((asset) => encodeURIComponent(asset.publicAssetCode)).join(',');
    return `/api/asset-map/report?codes=${codes}`;
  }, [chosenCode, mappedAssets.length, search, visibleAssets]);

  function handleSearchChange(value: string) {
    setSearch(value);
    setChosenCode('all');
  }

  function handleChooseAsset(value: string) {
    if (value === 'all') {
      setChosenCode('all');
      setSelectedCode(null);
      setSearch('');
      return;
    }

    setChosenCode(value);
    setSelectedCode(value);
    setSearch('');
  }

  return (
    <main className={styles.page}>
      <AppHeader active="asset-register" />

      <section className={styles.shell}>
        <div className={styles.topStrip}>
          <div className={styles.mapTitleBlock}>
            <h1>Asset map</h1>
            <p>
              {visibleAssets.length} mapped asset{visibleAssets.length === 1 ? '' : 's'} visible
              <span aria-hidden="true"> · </span>
              Updated {lastUpdatedText}
            </p>
          </div>

          <div className={styles.topActions}>
            {reportHref ? (
              <a href={reportHref} target="_blank" rel="noreferrer" className={styles.primaryAction}>
                Download asset map
              </a>
            ) : (
              <button type="button" className={`${styles.primaryAction} ${styles.actionDisabled}`} disabled>
                Download asset map
              </button>
            )}
            <button type="button" className={styles.secondaryAction} onClick={() => void fetchMapData('refresh')} disabled={isRefreshing || isLoading}>
              {isRefreshing ? 'Refreshing…' : 'Refresh map'}
            </button>
          </div>
        </div>

        {notice ? <div className={styles.notice}>{notice.message}</div> : null}

        <section className={styles.mapShell} aria-label="Asset map workspace">
          <div className={styles.mapFrame}>
            {isLoading ? <div className={styles.mapEmpty}>Loading the asset map...</div> : null}
            {!isLoading && !mappedAssets.length ? (
              <div className={styles.mapEmpty}>
                <strong>No GPS locations saved yet.</strong>
                <span>Scan an asset and save location data to place the first marker on this map.</span>
              </div>
            ) : null}
            {!isLoading && mappedAssets.length > 0 && !visibleAssets.length ? (
              <div className={styles.mapEmpty}>
                <strong>No mapped assets match this view.</strong>
                <span>Clear the search or choose All assets on map in the dropdown.</span>
              </div>
            ) : null}

            <div className={styles.mapCanvas} ref={mapElementRef} aria-label="Asset map canvas" />

            <div
              className={styles.controlRow}
              onPointerDown={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onWheel={(event) => event.stopPropagation()}
            >
              <div className={styles.mapControls}>
                <label className={styles.searchControl} aria-label="Search scanned assets">
                  <input
                    value={search}
                    onChange={(event) => handleSearchChange(event.target.value)}
                    placeholder="Search title, serial number, plate, QR code or location"
                  />
                </label>
              </div>

              <div className={styles.layerControl} aria-label="Map style">
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

              <aside className={styles.assetOverlay}>
                <label className={styles.assetSelectBlock} aria-label="Choose asset on the map">
                  <div className={styles.selectShell}>
                    <select value={chosenCode} onChange={(event) => handleChooseAsset(event.target.value)} aria-label="Choose asset on the map">
                      <option value="all">All assets on map</option>
                      {mappedAssets.map((asset) => (
                        <option key={asset.publicAssetCode} value={asset.publicAssetCode}>
                          {buildAssetOptionLabel(asset)}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                {selectedAsset ? (
                  <div className={styles.assetInfoCard}>
                    <div className={styles.assetInfoHeader}>
                      <div className={styles.assetInfoTop}>
                        <span>{selectedVisiblePosition ? `Marker ${selectedVisiblePosition}` : 'Selected asset'}</span>
                        <button type="button" onClick={() => handleChooseAsset('all')}>
                          Show all
                        </button>
                      </div>
                      <h2>{selectedAsset.title}</h2>
                      <p>
                        {selectedAsset.yearModel ? `${formatYearModel(selectedAsset.yearModel)} · ` : ''}
                        {selectedAsset.plateLabel || selectedAsset.publicAssetCode || 'No plate label saved'}
                      </p>
                    </div>

                    <div className={styles.assetFacts}>
                      <div>
                        <span>Asset type</span>
                        <strong>{selectedAsset.assetTypeLabel || selectedAsset.kind || 'Asset'}</strong>
                      </div>
                      <div>
                        <span>Year model</span>
                        <strong>{formatYearModel(selectedAsset.yearModel)}</strong>
                      </div>
                      <div>
                        <span>Serial</span>
                        <strong>{selectedAsset.serialNumber || '—'}</strong>
                      </div>
                      <div>
                        <span>Fuel</span>
                        <strong>{formatFuel(selectedAsset.fuelPercent)}</strong>
                      </div>
                      <div>
                        <span>Usage</span>
                        <strong>{formatHours(selectedAsset.hours)}</strong>
                      </div>
                      <div>
                        <span>Condition</span>
                        <strong>{formatCondition(selectedAsset.condition)}</strong>
                      </div>
                      <div>
                        <span>Financed</span>
                        <strong>{formatAssetStatusChoice(selectedAsset.financeStatus)}</strong>
                      </div>
                      <div>
                        <span>Insured</span>
                        <strong>{formatAssetStatusChoice(selectedAsset.insuranceStatus)}</strong>
                      </div>
                      <div>
                        <span>Licensed</span>
                        <strong>{formatAssetStatusChoice(selectedAsset.licenseStatus)}</strong>
                      </div>
                      <div>
                        <span>Last scanned</span>
                        <strong>{formatDate(selectedAsset.lastScannedAtIso)}</strong>
                      </div>
                    </div>

                    <div className={styles.gpsBox}>
                      <span>GPS location</span>
                      <strong>{formatLatLng(selectedAsset)}</strong>
                      <small>{selectedAsset.lastKnownLocationText || 'No written location note saved.'}</small>
                    </div>

                    <div className={styles.assetActions}>
                      <Link href="/asset-register" className={styles.primaryActionCompact}>
                        Asset register
                      </Link>
                      {selectedGoogleMapsHref ? (
                        <a href={selectedGoogleMapsHref} target="_blank" rel="noreferrer" className={styles.secondaryActionCompact}>
                          Google Maps
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
