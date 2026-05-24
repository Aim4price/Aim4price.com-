'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type NoticeTone = 'error';
type BasemapMode = 'road' | 'satellite';
type MarkerTone = 'recent' | 'warm' | 'older';
type AssetStatusChoice = 'yes' | 'no' | 'unknown' | 'not_applicable';
type IconProps = { className?: string };

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
  licenseRegistrationNumber: string;
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

function SearchIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.8 18.1a7.3 7.3 0 1 0 0-14.6 7.3 7.3 0 0 0 0 14.6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m16.3 16.3 4.2 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m8 10 4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 11a8 8 0 0 0-14.7-4.3L4 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 4v4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 13a8 8 0 0 0 14.7 4.3L20 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 20v-4h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
    asset.licenseRegistrationNumber,
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
  const registration = escapeHtml(asset.licenseRegistrationNumber || '');
  const registrationRow = asset.licenseStatus === 'yes' && registration
    ? `<div style="display:grid; gap:2px;"><span style="color:#607182; font-size:9.5px; font-weight:850; letter-spacing:0.075em; text-transform:uppercase;">Registration</span><strong style="color:#123130; font-size:11.5px; line-height:1.18; font-weight:850;">${registration}</strong></div>`
    : '';
  const gps = escapeHtml(formatLatLng(asset));

  return `
    <div style="min-width: 236px; max-width: 268px; font-family: Montserrat, Inter, Arial, sans-serif; color: #122f2a; padding:2px;">
      <div style="display:flex; align-items:center; gap:9px; margin-bottom:11px; padding-right:12px;">
        <div style="display:inline-flex; align-items:center; justify-content:center; width:29px; height:29px; border-radius:999px; color:#fff; background:#3768d5; font-size:12px; font-weight:900; box-shadow:0 9px 18px rgba(55,104,213,.24); flex:0 0 auto;">${markerNumber}</div>
        <div style="min-width:0; display:grid; gap:2px;">
          <div style="font-weight: 900; font-size: 14px; line-height: 1.12; letter-spacing: -0.032em; color:#0b3328; overflow-wrap:anywhere;">${title}</div>
          <div style="font-size: 10.5px; color: #667581; font-weight:760;">${plate}</div>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 10px; font-size:11.5px; color:#53666b;">
        <div style="display:grid; gap:2px;"><span style="color:#607182; font-size:9.5px; font-weight:850; letter-spacing:0.075em; text-transform:uppercase;">Asset type</span><strong style="color:#123130; font-size:11.5px; line-height:1.18; font-weight:850;">${assetType}</strong></div>
        <div style="display:grid; gap:2px;"><span style="color:#607182; font-size:9.5px; font-weight:850; letter-spacing:0.075em; text-transform:uppercase;">Fuel</span><strong style="color:#123130; font-size:11.5px; line-height:1.18; font-weight:850;">${fuel}</strong></div>
        <div style="display:grid; gap:2px;"><span style="color:#607182; font-size:9.5px; font-weight:850; letter-spacing:0.075em; text-transform:uppercase;">Licensed</span><strong style="color:#123130; font-size:11.5px; line-height:1.18; font-weight:850;">${licensed}</strong></div>
        ${registrationRow}
        <div style="grid-column:1 / -1; display:grid; gap:2px;"><span style="color:#607182; font-size:9.5px; font-weight:850; letter-spacing:0.075em; text-transform:uppercase;">GPS</span><strong style="color:#123130; font-size:11.5px; line-height:1.18; font-weight:850;">${gps}</strong></div>
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
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [basemapMode, setBasemapMode] = useState<BasemapMode>('road');
  const [summary, setSummary] = useState<AssetMapResponse['summary'] | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const visibleAssets = useMemo(() => mappedAssets.filter((asset) => matchesSearch(asset, search)), [mappedAssets, search]);

  useEffect(() => {
    if (selectedCode && !visibleAssets.some((asset) => asset.publicAssetCode === selectedCode)) {
      setSelectedCode(null);
    }
  }, [selectedCode, visibleAssets]);

  useEffect(() => {
    if (!search.trim()) {
      return;
    }

    if (visibleAssets.length === 1) {
      setSelectedCode(visibleAssets[0].publicAssetCode);
      return;
    }

    setSelectedCode(null);
  }, [search, visibleAssets]);

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

      L.control.zoom({ position: 'topleft' }).addTo(map);

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
          paddingTopLeft: [58, 82],
          paddingBottomRight: [58, 82],
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

  const selectedAsset = useMemo(
    () => visibleAssets.find((asset) => asset.publicAssetCode === selectedCode) ?? null,
    [selectedCode, visibleAssets],
  );

  const fullMapReportHref = mappedAssets.length ? '/api/asset-map/report' : null;

  const selectedAssetReportHref = selectedAsset
    ? `/api/asset-map/report?assetCode=${encodeURIComponent(selectedAsset.publicAssetCode)}`
    : null;

  function handleSearchChange(value: string) {
    setSearch(value);
  }

  function handleResetMapView() {
    setSearch('');
    setSelectedCode(null);
  }

  function buildGoogleMapsHref(asset: AssetMapItem): string | null {
    if (!hasCoordinates(asset)) return null;
    return `https://www.google.com/maps/search/?api=1&query=${asset.lastKnownLat},${asset.lastKnownLng}`;
  }

  return (
    <main className={styles.page}>
      <AppHeader active="asset-register" />

      <section className={styles.shell}>
        <article className={styles.mapWorkspace} aria-label="QR scanned asset workspace">
          <header className={styles.workspaceHeader}>
            <div className={styles.mapTitleBlock}>
              <h1>QR Scanned Assets</h1>
            </div>
          </header>

          {notice ? <div className={styles.notice}>{notice.message}</div> : null}

          <form
            className={styles.mapToolbar}
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <label className={styles.searchControl} aria-label="Search scanned assets">
              <SearchIcon className={styles.searchIcon} />
              <input
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search title, serial number, plate, QR code or location"
              />
            </label>

            <div className={styles.toolbarActions}>
              <button type="button" className={styles.secondaryAction} onClick={() => void fetchMapData('refresh')} disabled={isRefreshing || isLoading}>
                <RefreshIcon className={styles.buttonIcon} />
                <span>{isRefreshing ? 'Refreshing…' : 'Refresh map'}</span>
              </button>
              {fullMapReportHref ? (
                <a href={fullMapReportHref} target="_blank" rel="noreferrer" className={styles.primaryAction}>
                  <DownloadIcon className={styles.buttonIcon} />
                  <span>Download full map</span>
                </a>
              ) : (
                <button type="button" className={`${styles.primaryAction} ${styles.actionDisabled}`} disabled>
                  <DownloadIcon className={styles.buttonIcon} />
                  <span>Download asset map</span>
                </button>
              )}
            </div>
          </form>

          <section className={styles.mapStage} aria-label="Mapped assets and locations">
            <aside className={styles.assetSidebar} aria-label="Visible mapped assets">
              <div className={styles.assetSidebarHeader}>
                <button type="button" className={styles.assetSidebarResetButton} onClick={handleResetMapView}>
                  <span aria-hidden="true">‹</span>
                  <span>All assets</span>
                </button>
              </div>

              <div className={styles.assetList}>
                {!isLoading && !mappedAssets.length ? (
                  <p className={styles.emptyState}>No GPS locations saved yet. Scan an asset and save location data to place the first marker on this map.</p>
                ) : !isLoading && !visibleAssets.length ? (
                  <p className={styles.emptyState}>No mapped assets match this search. Clear the search to show all mapped assets.</p>
                ) : !isLoading ? (
                  visibleAssets.map((asset, index) => {
                    const isActive = selectedCode === asset.publicAssetCode;
                    const googleMapsHref = buildGoogleMapsHref(asset);
                    const usageText = asset.hours === null ? 'Usage not saved' : `${formatHours(asset.hours)} hours`;

                    return (
                      <article key={asset.publicAssetCode} className={`${styles.assetCard} ${isActive ? styles.assetCardActive : ''}`}>
                        <button type="button" className={styles.assetCardButton} onClick={() => setSelectedCode(asset.publicAssetCode)}>
                          <span className={styles.assetNumber}>{index + 1}</span>
                          <span className={styles.assetCardBody}>
                            <span className={styles.assetCardHeader}>
                              <strong>{asset.title || 'Saved asset'}</strong>
                              <small>{asset.assetTypeLabel || asset.kind || 'Asset'}</small>
                            </span>
                            <span className={styles.assetCardMeta}>
                              <span>{asset.lastKnownLocationText || formatLatLng(asset)}</span>
                              <span>{asset.yearModel ? formatYearModel(asset.yearModel) : 'Year not saved'}</span>
                            </span>
                            <span className={styles.assetCardCopy}>
                              {(asset.plateLabel || asset.publicAssetCode || 'No plate label saved')}
                              <span aria-hidden="true"> · </span>
                              {usageText}
                              <span aria-hidden="true"> · </span>
                              {formatCondition(asset.condition)}
                            </span>
                          </span>
                        </button>

                        {isActive ? (
                          <div className={styles.assetCardDetailPanel}>
                            <div className={styles.assetDetailGrid}>
                              <span>
                                <small>Fuel</small>
                                <strong>{formatFuel(asset.fuelPercent)}</strong>
                              </span>
                              <span>
                                <small>Serial</small>
                                <strong>{asset.serialNumber || '—'}</strong>
                              </span>
                              <span>
                                <small>GPS</small>
                                <strong>{formatLatLng(asset)}</strong>
                              </span>
                              <span>
                                <small>Last scanned</small>
                                <strong>{formatDate(asset.lastScannedAtIso)}</strong>
                              </span>
                            </div>

                            <div className={styles.assetCardActions}>
                              {selectedAssetReportHref ? (
                                <a
                                  href={selectedAssetReportHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`${styles.primaryActionCompact} ${styles.assetCardDownloadAction}`}
                                >
                                  <DownloadIcon className={styles.buttonIcon} />
                                  <span>Download map</span>
                                </a>
                              ) : null}

                              <Link href="/asset-register" className={styles.secondaryActionCompact}>
                                Asset register
                              </Link>
                              {googleMapsHref ? (
                                <a href={googleMapsHref} target="_blank" rel="noreferrer" className={styles.secondaryActionCompact}>
                                  Google Maps
                                </a>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                ) : null}
              </div>
            </aside>

            <div className={styles.assetMapShell}>
              {!isLoading && !mappedAssets.length ? (
                <div className={styles.mapEmpty}>
                  <strong>No GPS locations saved yet.</strong>
                  <span>Scan an asset and save location data to place the first marker on this map.</span>
                </div>
              ) : null}
              {!isLoading && mappedAssets.length > 0 && !visibleAssets.length ? (
                <div className={styles.mapEmpty}>
                  <strong>No mapped assets match this search.</strong>
                  <span>Clear the search to show all mapped assets.</span>
                </div>
              ) : null}

              <div className={styles.mapCanvas} ref={mapElementRef} aria-label="Asset map canvas" />

              <div
                className={styles.layerControl}
                aria-label="Map style"
                onPointerDown={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onWheel={(event) => event.stopPropagation()}
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
            </div>
          </section>
        </article>
      </section>
    </main>
  );
}
