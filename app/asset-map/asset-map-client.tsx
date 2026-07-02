"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import styles from "./page.module.css";

type NoticeTone = "error";
type BasemapMode = "road" | "satellite";
type RegisterFilterId = string;
type AssetStatusChoice = "yes" | "no" | "unknown" | "not_applicable";
type IconProps = { className?: string };

type AssetMapItem = {
  id: string;
  registerId: string;
  registerName: string;
  registerLabel: string;
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
  value: number;
  selectedMethod: string;
  replacementPriceExVat: number | null;
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
  photos: string[];
};

type RegisterFilterOption = {
  id: RegisterFilterId;
  label: string;
  registerId?: string | null;
  value?: string;
};

type AssetMapResponse = {
  ok: boolean;
  assets?: AssetMapItem[];
  registerFilters?: RegisterFilterOption[];
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
  satelliteLabels: any | null;
};

declare global {
  interface Window {
    L?: any;
  }
}

let leafletLoaderPromise: Promise<any> | null = null;

const LEAFLET_SCRIPT_ID = "aim4price-leaflet-script";
const LEAFLET_CSS_ID = "aim4price-leaflet-css";
const DEFAULT_CENTER: [number, number] = [-29.0, 24.0];
const DEFAULT_ZOOM = 5;
const ALL_REGISTER_FILTER_ID = "all";
const BASEMAP_STORAGE_KEY = "aim4price-asset-map-basemap";
const BASEMAP_OPTIONS: Array<{ value: BasemapMode; label: string }> = [
  { value: "road", label: "Map" },
  { value: "satellite", label: "Satellite" },
];

function SearchIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.8 18.1a7.3 7.3 0 1 0 0-14.6 7.3 7.3 0 0 0 0 14.6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="m16.3 16.3 4.2 4.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DownloadIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 4v10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="m8 10 4 4 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 19h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RefreshIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 11a8 8 0 0 0-14.7-4.3L4 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 4v4h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 13a8 8 0 0 0 14.7 4.3L20 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 20v-4h-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RegisterIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 4h10a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9 9h6M9 13h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MapIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Leaflet can only load in the browser."));
  }

  if (window.L) {
    return Promise.resolve(window.L);
  }

  if (leafletLoaderPromise) {
    return leafletLoaderPromise;
  }

  leafletLoaderPromise = new Promise((resolve, reject) => {
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement("link");
      link.id = LEAFLET_CSS_ID;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById(
      LEAFLET_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    const handleLoaded = () => {
      if (window.L) {
        resolve(window.L);
        return;
      }

      reject(new Error("Leaflet did not initialise correctly."));
    };

    if (existingScript) {
      if (window.L) {
        resolve(window.L);
        return;
      }

      existingScript.addEventListener("load", handleLoaded, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load the map renderer.")),
        {
          once: true,
        },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = LEAFLET_SCRIPT_ID;
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.crossOrigin = "";
    script.addEventListener("load", handleLoaded, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Failed to load the map renderer.")),
      { once: true },
    );
    document.body.appendChild(script);
  });

  return leafletLoaderPromise;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatCondition(value?: string | null): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return "Not saved";
  if (normalized === "excellent") return "Excellent";
  if (normalized === "good") return "Good";
  if (normalized === "fair") return "Fair";
  if (normalized === "used") return "Used";
  if (normalized === "serious") return "Requires attention";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatFuel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function formatHours(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-ZA").format(Math.round(value));
}

function formatYearModel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return String(Math.round(value));
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "Not saved";

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function methodLabel(value?: string | null): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "market") return "Aim4price";
  if (normalized === "manual") return "Manual";
  if (normalized === "generic") return "Aim4price";
  if (normalized === "tractor") return "Aim4price";
  return "Aim4price";
}

function normalizePhotos(photos?: string[] | null): string[] {
  if (!Array.isArray(photos)) return [];
  return photos.map((photo) => String(photo ?? "").trim()).filter(Boolean);
}

function buildAssetMeta(asset: AssetMapItem): string {
  const usageText =
    asset.hours === null
      ? "Usage not saved"
      : `Usage: ${formatHours(asset.hours)} hours`;

  return [
    asset.yearModel
      ? `Year Model: ${formatYearModel(asset.yearModel)}`
      : "Year not saved",
    usageText,
    `Condition: ${formatCondition(asset.condition)}`,
  ].join(" • ");
}

function buildAssetRegisterHref(asset: AssetMapItem): string {
  const hash = `asset-card-${encodeURIComponent(asset.id)}`;
  return `/asset-register#${hash}`;
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
    asset.assetTypeLabel,
    asset.kind,
    asset.serialNumber,
    asset.brandName,
    asset.modelName,
    asset.typedModelName,
    asset.registerName,
    asset.registerLabel,
    asset.lastKnownLocationText,
    formatCondition(asset.condition),
    asset.yearModel ? String(asset.yearModel) : "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedSearch);
}

function normalizeRegisterFilters(
  filters?: RegisterFilterOption[],
): RegisterFilterOption[] {
  const normalizedFilters: RegisterFilterOption[] = [
    { id: ALL_REGISTER_FILTER_ID, label: "All Assets", registerId: null },
  ];
  const seen = new Set<string>([ALL_REGISTER_FILTER_ID]);

  (filters ?? []).forEach((filter) => {
    const rawId = String(
      filter.id ?? filter.value ?? filter.registerId ?? "",
    ).trim();
    const id = rawId || ALL_REGISTER_FILTER_ID;
    const label =
      String(filter.label ?? "")
        .replace(/\s+/g, " ")
        .trim() ||
      (id === ALL_REGISTER_FILTER_ID ? "All Assets" : "Asset Register");

    if (id === ALL_REGISTER_FILTER_ID) {
      normalizedFilters[0] = {
        id: ALL_REGISTER_FILTER_ID,
        label: "All Assets",
        registerId: null,
      };
      return;
    }

    if (seen.has(id)) return;
    seen.add(id);
    normalizedFilters.push({ id, label, registerId: filter.registerId ?? id });
  });

  return normalizedFilters;
}

function filterAssetsByRegister(
  assets: AssetMapItem[],
  registerId: RegisterFilterId,
): AssetMapItem[] {
  if (!registerId || registerId === ALL_REGISTER_FILTER_ID) return assets;
  return assets.filter((asset) => asset.registerId === registerId);
}

function findRegisterFilterLabel(
  filters: RegisterFilterOption[],
  registerId: RegisterFilterId,
): string {
  return (
    filters.find((filter) => filter.id === registerId)?.label ?? "All Assets"
  );
}

function buildAssetMapReportHref(options: {
  format: "pdf" | "xlsx";
  registerId?: RegisterFilterId;
  assetCode?: string;
}): string {
  const params = new URLSearchParams();
  params.set("format", options.format);

  if (options.assetCode) {
    params.set("assetCode", options.assetCode);
  } else {
    params.set("registerId", options.registerId || ALL_REGISTER_FILTER_ID);
  }

  return `/api/asset-map/report?${params.toString()}`;
}

function sortMappedAssets(left: AssetMapItem, right: AssetMapItem): number {
  const leftTime = left.lastScannedAtIso
    ? new Date(left.lastScannedAtIso).getTime()
    : 0;
  const rightTime = right.lastScannedAtIso
    ? new Date(right.lastScannedAtIso).getTime()
    : 0;

  if (rightTime !== leftTime) {
    return rightTime - leftTime;
  }

  return left.title.localeCompare(right.title, "en", { sensitivity: "base" });
}

export default function AssetMapClient() {
  const [assets, setAssets] = useState<AssetMapItem[]>([]);
  const [registerFilters, setRegisterFilters] = useState<
    RegisterFilterOption[]
  >(() => normalizeRegisterFilters());
  const [selectedRegisterId, setSelectedRegisterId] =
    useState<RegisterFilterId>(ALL_REGISTER_FILTER_ID);
  const [exportRegisterId, setExportRegisterId] = useState<RegisterFilterId>(
    ALL_REGISTER_FILTER_ID,
  );
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [basemapMode, setBasemapMode] = useState<BasemapMode>("road");
  const [notice, setNotice] = useState<{
    tone: NoticeTone;
    message: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);
  const baseLayersRef = useRef<LeafletTileLayerSet>({
    road: null,
    satellite: null,
    satelliteLabels: null,
  });
  const markersByCodeRef = useRef<Map<string, any>>(new Map());
  const lastBoundsSignatureRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedMode = window.localStorage.getItem(BASEMAP_STORAGE_KEY);
    if (savedMode === "road" || savedMode === "satellite") {
      setBasemapMode(savedMode);
    }
  }, []);

  const fetchMapData = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const initialLoad = mode === "initial";

      if (initialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const response = await fetch("/api/asset-map", {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await response
          .json()
          .catch(() => null)) as AssetMapResponse | null;

        if (!response.ok || !data?.ok || !Array.isArray(data.assets)) {
          throw new Error(data?.error ?? "Failed to load the asset map.");
        }

        const nextRegisterFilters = normalizeRegisterFilters(
          data.registerFilters,
        );
        setAssets(data.assets);
        setRegisterFilters(nextRegisterFilters);
        setSelectedRegisterId((currentRegisterId) =>
          nextRegisterFilters.some((filter) => filter.id === currentRegisterId)
            ? currentRegisterId
            : ALL_REGISTER_FILTER_ID,
        );
        setExportRegisterId((currentRegisterId) =>
          nextRegisterFilters.some((filter) => filter.id === currentRegisterId)
            ? currentRegisterId
            : ALL_REGISTER_FILTER_ID,
        );
      } catch (error) {
        setNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load the asset map.",
        });
      } finally {
        if (initialLoad) {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void fetchMapData("initial");
  }, [fetchMapData]);

  useEffect(() => {
    if (!notice) return undefined;

    const timeout = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!isExportModalOpen || typeof window === "undefined") {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExportModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExportModalOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchMapData("refresh");
      }
    }, 45000);

    return () => window.clearInterval(interval);
  }, [fetchMapData]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(BASEMAP_STORAGE_KEY, basemapMode);
  }, [basemapMode]);

  const mappedAssets = useMemo(
    () => assets.filter(hasCoordinates).sort(sortMappedAssets),
    [assets],
  );
  const filteredMappedAssets = useMemo(
    () => filterAssetsByRegister(mappedAssets, selectedRegisterId),
    [mappedAssets, selectedRegisterId],
  );

  const visibleAssets = useMemo(
    () => filteredMappedAssets.filter((asset) => matchesSearch(asset, search)),
    [filteredMappedAssets, search],
  );
  const exportScopedAssets = useMemo(
    () => filterAssetsByRegister(mappedAssets, exportRegisterId),
    [mappedAssets, exportRegisterId],
  );

  useEffect(() => {
    if (
      selectedCode &&
      !visibleAssets.some((asset) => asset.publicAssetCode === selectedCode)
    ) {
      setSelectedCode(null);
    }
  }, [selectedCode, visibleAssets]);

  useEffect(() => {
    setSelectedPhotoIndex(0);
  }, [selectedCode]);

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

      L.control.zoom({ position: "topleft" }).addTo(map);

      const roadLayer = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      );
      const satelliteLayer = L.tileLayer(
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          attribution: "Tiles &copy; Esri",
        },
      );
      const satelliteLabelLayer = L.tileLayer(
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          attribution: "Labels &copy; Esri",
        },
      );

      baseLayersRef.current = {
        road: roadLayer,
        satellite: satelliteLayer,
        satelliteLabels: satelliteLabelLayer,
      };

      roadLayer.addTo(map);
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      mapRef.current = map;
      markerLayerRef.current = L.layerGroup().addTo(map);

      const invalidate = () => map.invalidateSize();
      window.setTimeout(invalidate, 120);
      window.addEventListener("resize", invalidate);
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

    if (
      !map ||
      !baseLayers.road ||
      !baseLayers.satellite ||
      !baseLayers.satelliteLabels
    ) {
      return;
    }

    [baseLayers.road, baseLayers.satellite, baseLayers.satelliteLabels].forEach(
      (layer) => {
        if (layer && map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      },
    );

    if (basemapMode === "satellite") {
      baseLayers.satellite.addTo(map);
      baseLayers.satelliteLabels.addTo(map);
      return;
    }

    baseLayers.road.addTo(map);
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
      lastBoundsSignatureRef.current = "";
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds: Array<[number, number]> = [];

    visibleAssets.forEach((asset, index) => {
      const lat = asset.lastKnownLat as number;
      const lng = asset.lastKnownLng as number;
      const isActive = asset.publicAssetCode === selectedCode;
      const markerNumber = index + 1;

      const icon = L.divIcon({
        className: `aim4priceMapMarker${isActive ? " aim4priceMapMarker--active" : ""}`,
        html: `<span class="aim4priceMapMarkerPin"><b>${markerNumber}</b></span>`,
        iconSize: [42, 48],
        iconAnchor: [21, 44],
        popupAnchor: [0, -38],
      });

      const marker = L.marker([lat, lng], {
        icon,
        title: asset.title || asset.plateLabel || "Saved asset",
      });

      marker.bindTooltip(
        `${markerNumber}. ${asset.title || asset.plateLabel || "Saved asset"}`,
        {
          direction: "top",
          offset: [0, -34],
          opacity: 0.92,
        },
      );
      marker.on("click", () => setSelectedCode(asset.publicAssetCode));
      marker.addTo(markerLayer);
      markersByCodeRef.current.set(asset.publicAssetCode, marker);
      bounds.push([lat, lng]);
    });

    const signature = visibleAssets
      .map(
        (asset) =>
          `${asset.publicAssetCode}:${asset.lastKnownLat ?? ""},${asset.lastKnownLng ?? ""}`,
      )
      .join("|");
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
    const marker = selectedCode
      ? markersByCodeRef.current.get(selectedCode)
      : null;

    if (!map || !marker) {
      return;
    }

    const latLng = marker.getLatLng();
    map.panTo(latLng, { animate: true, duration: 0.55 });
  }, [selectedCode]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || typeof window === "undefined") {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      map.invalidateSize();
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [isSidebarCollapsed]);

  useEffect(() => {
    return () => {
      const map = mapRef.current;
      if (!map) return;

      const invalidate = (map as any).__aim4priceInvalidate;
      if (invalidate) {
        window.removeEventListener("resize", invalidate);
      }

      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      baseLayersRef.current = {
        road: null,
        satellite: null,
        satelliteLabels: null,
      };
      markersByCodeRef.current.clear();
      lastBoundsSignatureRef.current = "";
    };
  }, []);

  const selectedAsset = useMemo(
    () =>
      visibleAssets.find((asset) => asset.publicAssetCode === selectedCode) ??
      null,
    [selectedCode, visibleAssets],
  );

  const selectedFilterLabel = findRegisterFilterLabel(
    registerFilters,
    selectedRegisterId,
  );
  const exportFilterLabel = findRegisterFilterLabel(
    registerFilters,
    exportRegisterId,
  );
  const showCardRegisterLabel = selectedRegisterId === ALL_REGISTER_FILTER_ID;
  const exportScopeHasMappedAssets = exportScopedAssets.length > 0;
  const exportPdfHref = buildAssetMapReportHref({
    format: "pdf",
    registerId: exportRegisterId,
  });
  const exportXlsxHref = buildAssetMapReportHref({
    format: "xlsx",
    registerId: exportRegisterId,
  });

  const selectedAssetReportHref = selectedAsset
    ? buildAssetMapReportHref({
        format: "pdf",
        assetCode: selectedAsset.publicAssetCode,
      })
    : null;

  const selectedAssetPhotos = selectedAsset
    ? normalizePhotos(selectedAsset.photos)
    : [];
  const selectedAssetSafePhotoIndex = selectedAssetPhotos.length
    ? Math.min(selectedPhotoIndex, selectedAssetPhotos.length - 1)
    : 0;
  const selectedAssetPhoto =
    selectedAssetPhotos[selectedAssetSafePhotoIndex] ?? null;
  const selectedAssetGoogleMapsHref = selectedAsset
    ? buildGoogleMapsHref(selectedAsset)
    : null;
  const hasMultipleSelectedPhotos = selectedAssetPhotos.length > 1;

  const showPreviousSelectedPhoto = useCallback(() => {
    if (selectedAssetPhotos.length <= 1) return;

    setSelectedPhotoIndex(
      (currentIndex) =>
        (currentIndex - 1 + selectedAssetPhotos.length) %
        selectedAssetPhotos.length,
    );
  }, [selectedAssetPhotos.length]);

  const showNextSelectedPhoto = useCallback(() => {
    if (selectedAssetPhotos.length <= 1) return;

    setSelectedPhotoIndex(
      (currentIndex) => (currentIndex + 1) % selectedAssetPhotos.length,
    );
  }, [selectedAssetPhotos.length]);

  const hasActiveSearch = search.trim().length > 0;

  function handleSearchChange(value: string) {
    setSearch(value);
  }

  function clearSearch() {
    setSearch("");
    setSelectedCode(null);
  }

  function openExportModal() {
    setExportRegisterId(selectedRegisterId);
    setIsExportModalOpen(true);
  }

  function buildGoogleMapsHref(asset: AssetMapItem): string | null {
    if (!hasCoordinates(asset)) return null;
    return `https://www.google.com/maps/search/?api=1&query=${asset.lastKnownLat},${asset.lastKnownLng}`;
  }

  return (
    <main className={styles.page}>
      <AppHeader active="asset-register" />

      <section className={styles.shell}>
        <article
          className={styles.mapWorkspace}
          aria-label="Asset Map Tracking workspace"
        >
          <header className={styles.panelHeader}>
            <div className={styles.pageTitleBlock}>
              <h1>Asset Map Tracking</h1>
            </div>

            <form
              className={styles.topActions}
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <label
                className={styles.searchWrap}
                aria-label="Search by asset name, type or serial"
              >
                <SearchIcon className={styles.searchIcon} />
                <input
                  type="search"
                  className={styles.searchInput}
                  value={search}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder="Search by asset name, type or serial"
                />
                {hasActiveSearch ? (
                  <button
                    type="button"
                    className={styles.clearSearchButton}
                    onClick={clearSearch}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                ) : null}
              </label>

              <div className={styles.topActionButtons}>
                <label
                  className={`${styles.filterControl} ${styles.topActionButton}`}
                >
                  <span className={styles.filterControlLabel}>Filter</span>
                  <span className={styles.filterControlValue}>
                    {selectedFilterLabel}
                  </span>
                  <select
                    className={styles.filterSelect}
                    value={selectedRegisterId}
                    onChange={(event) =>
                      setSelectedRegisterId(event.target.value)
                    }
                    aria-label="Filter mapped assets by asset register"
                  >
                    {registerFilters.map((filter) => (
                      <option key={filter.id} value={filter.id}>
                        {filter.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={`${styles.secondaryAction} ${styles.topActionButton} ${styles.topRefreshButton}`}
                  onClick={() => void fetchMapData("refresh")}
                  disabled={isRefreshing || isLoading}
                >
                  <RefreshIcon className={styles.buttonIcon} />
                  <span>{isRefreshing ? "Refreshing…" : "Refresh"}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.primaryAction} ${styles.topActionButton} ${styles.topReportButton} ${!mappedAssets.length ? styles.actionDisabled : ""}`}
                  onClick={openExportModal}
                  disabled={!mappedAssets.length || isLoading}
                >
                  <DownloadIcon className={styles.buttonIcon} />
                  <span>Download</span>
                </button>
              </div>
            </form>
          </header>

          {notice ? (
            <div className={styles.notice}>{notice.message}</div>
          ) : null}

          <section
            className={`${styles.mapStage} ${isSidebarCollapsed ? styles.mapStageCollapsed : ""}`}
            aria-label="Mapped assets and locations"
          >
            <aside
              className={`${styles.assetSidebar} ${isSidebarCollapsed ? styles.assetSidebarCollapsed : ""}`}
              aria-label="Visible mapped assets"
            >
              <div className={styles.assetSidebarHeader}>
                <button
                  type="button"
                  className={styles.sidebarToggleButton}
                  onClick={() => setIsSidebarCollapsed((current) => !current)}
                  aria-label={
                    isSidebarCollapsed
                      ? "Expand asset list"
                      : "Collapse asset list"
                  }
                  aria-expanded={!isSidebarCollapsed}
                >
                  <span aria-hidden="true">
                    {isSidebarCollapsed ? ">" : "<"}
                  </span>
                </button>
                {!isSidebarCollapsed ? (
                  <span className={styles.assetSidebarTitle}>
                    <strong>{visibleAssets.length}</strong>
                    <span>
                      {visibleAssets.length === 1
                        ? "mapped asset"
                        : "mapped assets"}
                    </span>
                  </span>
                ) : null}
              </div>

              {!isSidebarCollapsed ? (
                <div className={styles.assetList}>
                  {!isLoading && !mappedAssets.length ? (
                    <p className={styles.emptyState}>
                      No GPS locations saved yet. Save a GPS location on an
                      asset to place the first marker on this map.
                    </p>
                  ) : !isLoading && !filteredMappedAssets.length ? (
                    <p className={styles.emptyState}>
                      No mapped GPS assets in {selectedFilterLabel}. Choose All
                      Assets or another register.
                    </p>
                  ) : !isLoading && !visibleAssets.length ? (
                    <p className={styles.emptyState}>
                      No mapped assets match this search in{" "}
                      {selectedFilterLabel}. Clear the search or choose another
                      register.
                    </p>
                  ) : !isLoading ? (
                    visibleAssets.map((asset, index) => {
                      const isActive = selectedCode === asset.publicAssetCode;
                      const usageText =
                        asset.hours === null
                          ? "Usage not saved"
                          : `${formatHours(asset.hours)} hours`;

                      return (
                        <article
                          key={asset.publicAssetCode}
                          className={`${styles.assetCard} ${isActive ? styles.assetCardActive : ""}`}
                        >
                          <button
                            type="button"
                            className={styles.assetCardButton}
                            onClick={() =>
                              setSelectedCode(asset.publicAssetCode)
                            }
                          >
                            <span className={styles.assetNumber}>
                              {index + 1}
                            </span>
                            <span className={styles.assetCardBody}>
                              <span className={styles.assetCardHeader}>
                                <strong>{asset.title || "Saved asset"}</strong>
                                <small>
                                  {asset.assetTypeLabel ||
                                    asset.kind ||
                                    "Asset"}
                                </small>
                                {showCardRegisterLabel ? (
                                  <span className={styles.assetRegisterLabel}>
                                    {asset.registerLabel || asset.registerName}
                                  </span>
                                ) : null}
                              </span>
                              <span className={styles.assetCardMeta}>
                                <span>
                                  {asset.yearModel
                                    ? formatYearModel(asset.yearModel)
                                    : "Year not saved"}
                                </span>
                                <span>{formatCondition(asset.condition)}</span>
                                <span>{usageText}</span>
                              </span>
                            </span>
                          </button>
                        </article>
                      );
                    })
                  ) : null}
                </div>
              ) : null}
            </aside>

            <div className={styles.assetMapShell}>
              {!isLoading && !mappedAssets.length ? (
                <div className={styles.mapEmpty}>
                  <strong>No GPS locations saved yet.</strong>
                  <span>
                    Save a GPS location on an asset to place the first marker on
                    this map.
                  </span>
                </div>
              ) : null}
              {!isLoading &&
              mappedAssets.length > 0 &&
              !filteredMappedAssets.length ? (
                <div className={styles.mapEmpty}>
                  <strong>
                    No mapped GPS assets in {selectedFilterLabel}.
                  </strong>
                  <span>
                    Choose All Assets or another register to show saved GPS
                    locations.
                  </span>
                </div>
              ) : null}
              {!isLoading &&
              filteredMappedAssets.length > 0 &&
              !visibleAssets.length ? (
                <div className={styles.mapEmpty}>
                  <strong>No mapped assets match this search.</strong>
                  <span>Clear the search or choose another register.</span>
                </div>
              ) : null}

              <div
                className={styles.mapCanvas}
                ref={mapElementRef}
                aria-label="Asset map canvas"
              />

              {selectedAsset ? (
                <article
                  className={styles.selectedAssetCard}
                  aria-label={`Selected asset: ${selectedAsset.title || "Saved asset"}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onWheel={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className={styles.selectedCardCloseButton}
                    onClick={() => setSelectedCode(null)}
                    aria-label="Close selected asset card"
                  >
                    <CloseIcon className={styles.buttonIcon} />
                  </button>

                  <div className={styles.selectedAssetMain}>
                    <div className={styles.selectedPhotoPanel}>
                      <div className={styles.selectedPhotoFrame}>
                        {selectedAssetPhoto ? (
                          <img
                            src={selectedAssetPhoto}
                            alt={`${selectedAsset.title || "Selected asset"} photo ${selectedAssetSafePhotoIndex + 1}`}
                            className={styles.selectedPhotoImage}
                          />
                        ) : (
                          <div className={styles.selectedPhotoPlaceholder}>
                            <strong>No photos uploaded</strong>
                            <span>
                              Photos added in the Asset Register will show here.
                            </span>
                          </div>
                        )}

                        {hasMultipleSelectedPhotos ? (
                          <>
                            <button
                              type="button"
                              className={`${styles.selectedPhotoNavButton} ${styles.selectedPhotoNavButtonPrevious}`}
                              onClick={showPreviousSelectedPhoto}
                              aria-label="Show previous photo"
                            >
                              <span aria-hidden="true">&lt;</span>
                            </button>
                            <button
                              type="button"
                              className={`${styles.selectedPhotoNavButton} ${styles.selectedPhotoNavButtonNext}`}
                              onClick={showNextSelectedPhoto}
                              aria-label="Show next photo"
                            >
                              <span aria-hidden="true">&gt;</span>
                            </button>
                          </>
                        ) : null}
                      </div>

                      {selectedAssetPhotos.length > 1 ? (
                        <div
                          className={styles.selectedPhotoThumbRow}
                          aria-label="Selected asset photos"
                        >
                          {selectedAssetPhotos
                            .slice(0, 6)
                            .map((photo, index) => (
                              <button
                                type="button"
                                key={`${selectedAsset.publicAssetCode}-photo-${index}`}
                                className={`${styles.selectedPhotoThumbButton} ${index === selectedAssetSafePhotoIndex ? styles.selectedPhotoThumbButtonActive : ""}`}
                                onClick={() => setSelectedPhotoIndex(index)}
                                aria-label={`Show photo ${index + 1}`}
                              >
                                <img
                                  src={photo}
                                  alt={`${selectedAsset.title || "Selected asset"} thumbnail ${index + 1}`}
                                />
                              </button>
                            ))}
                        </div>
                      ) : null}
                    </div>

                    <div className={styles.selectedAssetContent}>
                      <div className={styles.selectedAssetHeader}>
                        <div className={styles.selectedAssetTitleGroup}>
                          <h2>{selectedAsset.title || "Saved asset"}</h2>
                          <p>{buildAssetMeta(selectedAsset)}</p>
                          {showCardRegisterLabel ? (
                            <span className={styles.selectedRegisterLabel}>
                              {selectedAsset.registerLabel ||
                                selectedAsset.registerName}
                            </span>
                          ) : null}
                        </div>

                        <div className={styles.selectedValueBlock}>
                          <small>
                            {methodLabel(selectedAsset.selectedMethod)} value
                          </small>
                          <strong>{formatMoney(selectedAsset.value)}</strong>
                          <span>Excl. VAT</span>
                        </div>
                      </div>

                      <div className={styles.selectedDetailGrid}>
                        <span>
                          <small>Fuel</small>
                          <strong>
                            {formatFuel(selectedAsset.fuelPercent)}
                          </strong>
                        </span>
                        <span>
                          <small>Serial</small>
                          <strong>{selectedAsset.serialNumber || "—"}</strong>
                        </span>
                        <span>
                          <small>Last scanned</small>
                          <strong>
                            {formatDate(selectedAsset.lastScannedAtIso)}
                          </strong>
                        </span>
                      </div>

                      <div className={styles.selectedActionRow}>
                        <Link
                          href={buildAssetRegisterHref(selectedAsset)}
                          className={`${styles.selectedActionButton} ${styles.selectedActionRegister}`}
                        >
                          <RegisterIcon className={styles.buttonIcon} />
                          <span>Asset Register</span>
                        </Link>
                        {selectedAssetGoogleMapsHref ? (
                          <a
                            href={selectedAssetGoogleMapsHref}
                            target="_blank"
                            rel="noreferrer"
                            className={`${styles.selectedActionButton} ${styles.selectedActionMap}`}
                          >
                            <MapIcon className={styles.buttonIcon} />
                            <span>Maps</span>
                          </a>
                        ) : null}
                        {selectedAssetReportHref ? (
                          <a
                            href={selectedAssetReportHref}
                            target="_blank"
                            rel="noreferrer"
                            className={`${styles.selectedActionButton} ${styles.selectedActionDownload}`}
                          >
                            <DownloadIcon className={styles.buttonIcon} />
                            <span>Download</span>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              ) : null}

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
                    className={`${styles.layerButton} ${basemapMode === option.value ? styles.layerButtonActive : ""}`}
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

      {isExportModalOpen ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={() => setIsExportModalOpen(false)}
        >
          <section
            className={styles.exportModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-map-export-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={styles.exportModalHeader}>
              <div>
                <h2 id="asset-map-export-title">Download Asset Map Tracking</h2>
                <p>Choose the asset register scope and export format.</p>
              </div>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => setIsExportModalOpen(false)}
                aria-label="Close download options"
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </header>

            <label className={styles.exportScopeField}>
              <span>Asset register scope</span>
              <select
                value={exportRegisterId}
                onChange={(event) => setExportRegisterId(event.target.value)}
              >
                {registerFilters.map((filter) => (
                  <option key={filter.id} value={filter.id}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.exportScopeSummary}>
              <strong>{exportFilterLabel}</strong>
              <span>
                {exportScopedAssets.length} mapped GPS{" "}
                {exportScopedAssets.length === 1 ? "asset" : "assets"} in this
                scope.
              </span>
            </div>

            <div
              className={styles.exportFormatGrid}
              aria-label="Download format options"
            >
              {exportScopeHasMappedAssets ? (
                <a
                  href={exportPdfHref}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.exportFormatButton}
                >
                  <DownloadIcon className={styles.buttonIcon} />
                  <span>PDF map report</span>
                </a>
              ) : (
                <button
                  type="button"
                  className={`${styles.exportFormatButton} ${styles.actionDisabled}`}
                  disabled
                >
                  <DownloadIcon className={styles.buttonIcon} />
                  <span>PDF map report</span>
                </button>
              )}

              {exportScopeHasMappedAssets ? (
                <a href={exportXlsxHref} className={styles.exportFormatButton}>
                  <DownloadIcon className={styles.buttonIcon} />
                  <span>Excel GPS sheet</span>
                </a>
              ) : (
                <button
                  type="button"
                  className={`${styles.exportFormatButton} ${styles.actionDisabled}`}
                  disabled
                >
                  <DownloadIcon className={styles.buttonIcon} />
                  <span>Excel GPS sheet</span>
                </button>
              )}
            </div>

            {!exportScopeHasMappedAssets ? (
              <p className={styles.exportEmptyNote}>
                No mapped GPS assets are available in the selected scope.
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
