"use client";

import { currentWebsiteScale } from '../../lib/website-canvas';

import DropdownOverlay from "../../components/DropdownOverlay";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Link from "next/link";
import { downloadAssetMapReport } from "../../lib/asset-map-download";
import AppHeader from "../../components/AppHeader";
import styles from "./page.module.css";

type NoticeTone = "error";
type BasemapMode = "road" | "satellite";
type FetchMode = "initial" | "background";
type ExportFormat = "pdf" | "xlsx";
type ExportStep = "format" | "scope";
type RegisterFilterId = string;
type AssetStatusChoice = "yes" | "no" | "unknown" | "not_applicable";
type AssetMapUsageMetric = "hours" | "km" | "percentage" | null;
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
  lifeWorkedPercent: number | null;
  usageMetric: AssetMapUsageMetric;
  usageDisplay: string;
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

type NumberedAssetMapItem = AssetMapItem & {
  mapNumber: number;
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

function handleMenuNavigation(event: ReactKeyboardEvent<HTMLDivElement>) {
  if (
    event.key !== "ArrowDown" &&
    event.key !== "ArrowUp" &&
    event.key !== "Home" &&
    event.key !== "End"
  ) {
    return;
  }

  const menuItems = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="menuitemradio"]:not([disabled])',
    ),
  );
  if (!menuItems.length) return;

  event.preventDefault();
  const currentIndex = menuItems.indexOf(
    document.activeElement as HTMLButtonElement,
  );
  let nextIndex = 0;

  if (event.key === "End") {
    nextIndex = menuItems.length - 1;
  } else if (event.key === "ArrowUp") {
    nextIndex = currentIndex <= 0 ? menuItems.length - 1 : currentIndex - 1;
  } else if (event.key === "ArrowDown") {
    nextIndex = currentIndex >= menuItems.length - 1 ? 0 : currentIndex + 1;
  }

  menuItems[nextIndex]?.focus();
}

function focusAdjacentControl(
  root: ParentNode,
  origin: HTMLElement | null,
  backwards: boolean,
) {
  if (!origin) return;

  const focusableElements = Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("aria-hidden"));
  const originIndex = focusableElements.indexOf(origin);
  const nextIndex = backwards ? originIndex - 1 : originIndex + 1;
  (focusableElements[nextIndex] ?? origin).focus();
}
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

function FilterIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 5h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7 12h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10 19h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="2.3"
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

    const handleFailure = (message: string) => {
      leafletLoaderPromise = null;
      document.getElementById(LEAFLET_SCRIPT_ID)?.remove();
      reject(new Error(message));
    };

    const handleLoaded = () => {
      if (window.L) {
        resolve(window.L);
        return;
      }

      handleFailure("Leaflet did not initialise correctly.");
    };

    if (existingScript) {
      if (window.L) {
        resolve(window.L);
        return;
      }

      existingScript.addEventListener("load", handleLoaded, { once: true });
      existingScript.addEventListener(
        "error",
        () => handleFailure("Failed to load the map renderer."),
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
      () => handleFailure("Failed to load the map renderer."),
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

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-ZA").format(Math.round(value));
}

function formatYearModel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return String(Math.round(value));
}

function normalizePhotos(photos?: string[] | null): string[] {
  if (!Array.isArray(photos)) return [];
  return photos.map((photo) => String(photo ?? "").trim()).filter(Boolean);
}

function formatPercent(value: number): string {
  const clamped = Math.max(0, Math.min(100, value));
  const rounded = Math.round(clamped * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function buildUsageDisplay(asset: AssetMapItem): string {
  const apiUsageDisplay = String(asset.usageDisplay ?? "").trim();
  if (apiUsageDisplay) return apiUsageDisplay;

  if (asset.usageMetric === "percentage") {
    return asset.lifeWorkedPercent === null || !Number.isFinite(asset.lifeWorkedPercent)
      ? "Usage not saved"
      : `${formatPercent(asset.lifeWorkedPercent)}% worked`;
  }

  if (asset.hours !== null && Number.isFinite(asset.hours)) {
    const unit = asset.usageMetric === "km" ? "km" : "hours";
    return `${formatNumber(asset.hours)} ${unit}`;
  }

  if (asset.lifeWorkedPercent !== null && Number.isFinite(asset.lifeWorkedPercent)) {
    return `${formatPercent(asset.lifeWorkedPercent)}% worked`;
  }

  return "Usage not saved";
}

function buildUsageMeta(asset: AssetMapItem): string {
  const usageDisplay = buildUsageDisplay(asset);
  return usageDisplay === "Usage not saved"
    ? usageDisplay
    : `Usage: ${usageDisplay}`;
}

function buildAssetMeta(asset: AssetMapItem): string {
  const usageText = buildUsageMeta(asset);

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
  const params = new URLSearchParams({ registerId: asset.registerId, assetId: asset.id });
  return `/asset-register?${params.toString()}#${hash}`;
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
    asset.publicAssetCode,
    asset.plateLabel,
    asset.licenseRegistrationNumber,
    asset.lastKnownLocationText,
    asset.usageDisplay,
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
    const fallbackRegisterLabel = `Asset Register #${normalizedFilters.length}`;
    const label =
      String(filter.label ?? "")
        .replace(/\s+/g, " ")
        .trim() ||
      (id === ALL_REGISTER_FILTER_ID ? "All Assets" : fallbackRegisterLabel);

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

function filterAssetsByRegister<T extends AssetMapItem>(
  assets: T[],
  registerId: RegisterFilterId,
): T[] {
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
  const parsedLeftTime = left.lastScannedAtIso
    ? new Date(left.lastScannedAtIso).getTime()
    : 0;
  const parsedRightTime = right.lastScannedAtIso
    ? new Date(right.lastScannedAtIso).getTime()
    : 0;
  const leftTime = Number.isFinite(parsedLeftTime) ? parsedLeftTime : 0;
  const rightTime = Number.isFinite(parsedRightTime) ? parsedRightTime : 0;

  if (rightTime !== leftTime) {
    return rightTime - leftTime;
  }

  const titleOrder = left.title.localeCompare(right.title, "en", {
    sensitivity: "base",
  });
  if (titleOrder !== 0) return titleOrder;

  return left.publicAssetCode.localeCompare(right.publicAssetCode, "en", {
    sensitivity: "base",
  });
}

function numberMappedAssets(assets: AssetMapItem[]): NumberedAssetMapItem[] {
  return assets
    .filter(hasCoordinates)
    .sort(sortMappedAssets)
    .map((asset, index) => ({ ...asset, mapNumber: index + 1 }));
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
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [exportStep, setExportStep] = useState<ExportStep>("format");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [basemapMode, setBasemapMode] = useState<BasemapMode>("road");
  const [notice, setNotice] = useState<{
    tone: NoticeTone;
    message: string;
  } | null>(null);
  const [dataStatus, setDataStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [mapRendererStatus, setMapRendererStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [mapRendererAttempt, setMapRendererAttempt] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isExportScopeMenuOpen, setIsExportScopeMenuOpen] = useState(false);

  const filterDropdownRef = useRef<HTMLDivElement | null>(null);
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const exportScopeDropdownRef = useRef<HTMLDivElement | null>(null);
  const exportScopeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const exportModalRef = useRef<HTMLElement | null>(null);
  const exportTriggerRef = useRef<HTMLButtonElement | null>(null);
  const sidebarCollapseTriggerRef = useRef<HTMLButtonElement | null>(null);
  const sidebarExpandTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const selectedAssetCardRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);
  const baseLayersRef = useRef<LeafletTileLayerSet>({
    road: null,
    satellite: null,
    satelliteLabels: null,
  });
  const markersByCodeRef = useRef<Map<string, any>>(new Map());
  const assetButtonsByCodeRef = useRef<Map<string, HTMLButtonElement>>(
    new Map(),
  );
  const mapDataRequestIdRef = useRef(0);
  const mapDataAbortControllerRef = useRef<AbortController | null>(null);
  const lastBoundsSignatureRef = useRef("");
  const isLoading = dataStatus === "loading";

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
    async (mode: FetchMode = "initial") => {
      const initialLoad = mode === "initial";
      const requestId = mapDataRequestIdRef.current + 1;
      mapDataRequestIdRef.current = requestId;
      mapDataAbortControllerRef.current?.abort();
      const controller = new AbortController();
      mapDataAbortControllerRef.current = controller;

      if (initialLoad) {
        setDataStatus("loading");
      }

      try {
        const response = await fetch("/api/asset-map", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response
          .json()
          .catch(() => null)) as AssetMapResponse | null;

        if (!response.ok || !data?.ok || !Array.isArray(data.assets)) {
          throw new Error(data?.error ?? "Failed to load the asset map.");
        }

        if (requestId !== mapDataRequestIdRef.current) {
          return;
        }

        const nextRegisterFilters = normalizeRegisterFilters(
          data.registerFilters,
        );
        const requestedAssetId = initialLoad && typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("assetId")?.trim() || null
          : null;
        const requestedAsset = requestedAssetId
          ? data.assets.find((asset) => asset.id === requestedAssetId && hasCoordinates(asset)) ?? null
          : null;
        setAssets(data.assets);
        setDataStatus("ready");
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
        if (requestedAsset) {
          setSearch("");
          setSelectedRegisterId(ALL_REGISTER_FILTER_ID);
          setSelectedCode(requestedAsset.publicAssetCode);
        }
        setNotice(null);
      } catch (error) {
        if (
          controller.signal.aborted ||
          requestId !== mapDataRequestIdRef.current
        ) {
          return;
        }

        setDataStatus((currentStatus) =>
          currentStatus === "ready" ? currentStatus : "error",
        );
        setNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load the asset map.",
        });
      } finally {
        if (mapDataAbortControllerRef.current === controller) {
          mapDataAbortControllerRef.current = null;
        }
      }
    },
    [],
  );

  useEffect(() => {
    void fetchMapData("initial");
  }, [fetchMapData]);

  useEffect(
    () => () => {
      mapDataRequestIdRef.current += 1;
      mapDataAbortControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!notice) return undefined;

    const timeout = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!isExportModalOpen && isExportScopeMenuOpen) {
      setIsExportScopeMenuOpen(false);
    }
  }, [isExportModalOpen, isExportScopeMenuOpen]);

  useEffect(() => {
    if (!isFilterMenuOpen || typeof window === "undefined") {
      return undefined;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const menu = document.getElementById("asset-map-register-filter-menu");
      const selectedItem = menu?.querySelector<HTMLElement>(
        '[role="menuitemradio"][aria-checked="true"]',
      );
      const firstItem = menu?.querySelector<HTMLElement>(
        '[role="menuitemradio"]',
      );
      (selectedItem ?? firstItem)?.focus();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isFilterMenuOpen]);

  useEffect(() => {
    if (!isExportScopeMenuOpen || typeof window === "undefined") {
      return undefined;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const menu = document.getElementById("asset-map-export-register-menu");
      const selectedItem = menu?.querySelector<HTMLElement>(
        '[role="menuitemradio"][aria-checked="true"]',
      );
      const firstItem = menu?.querySelector<HTMLElement>(
        '[role="menuitemradio"]',
      );
      (selectedItem ?? firstItem)?.focus();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isExportScopeMenuOpen]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      (!isFilterMenuOpen &&
        !isExportScopeMenuOpen &&
        !isExportModalOpen &&
        !selectedCode)
    ) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (
        isFilterMenuOpen &&
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(target) &&
        !document
          .getElementById("asset-map-register-filter-menu")
          ?.contains(target)
      ) {
        setIsFilterMenuOpen(false);
      }

      if (
        isExportScopeMenuOpen &&
        exportScopeDropdownRef.current &&
        !exportScopeDropdownRef.current.contains(target) &&
        !document
          .getElementById("asset-map-export-register-menu")
          ?.contains(target)
      ) {
        setIsExportScopeMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if (event.key === "Tab" && isExportModalOpen && exportModalRef.current) {
        const focusRoots = [
          exportModalRef.current,
          document.getElementById("asset-map-export-register-menu"),
        ].filter((root): root is HTMLElement => root instanceof HTMLElement);
        const focusableElements = focusRoots
          .flatMap((root) =>
            Array.from(
              root.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
              ),
            ),
          )
          .filter((element) => !element.hasAttribute("aria-hidden"));
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;
        const focusIsInside = focusRoots.some(
          (root) => activeElement && root.contains(activeElement),
        );

        if (!focusIsInside) {
          event.preventDefault();
          const focusTarget = event.shiftKey
            ? (lastFocusable ?? exportModalRef.current)
            : (firstFocusable ?? exportModalRef.current);
          focusTarget.focus();
          return;
        }

        if (
          event.shiftKey &&
          (activeElement === firstFocusable ||
            activeElement === exportModalRef.current)
        ) {
          event.preventDefault();
          (lastFocusable ?? exportModalRef.current).focus();
          return;
        }

        if (!event.shiftKey && activeElement === lastFocusable) {
          event.preventDefault();
          (firstFocusable ?? exportModalRef.current).focus();
          return;
        }
      }

      if (event.key !== "Escape") return;

      if (isFilterMenuOpen || isExportScopeMenuOpen) {
        if (isExportScopeMenuOpen) {
          exportScopeTriggerRef.current?.focus();
        } else {
          filterTriggerRef.current?.focus();
        }
        setIsFilterMenuOpen(false);
        setIsExportScopeMenuOpen(false);
        return;
      }

      if (isExportModalOpen) {
        setIsExportScopeMenuOpen(false);
        setIsExportModalOpen(false);
        return;
      }

      if (selectedCode) {
        setSelectedCode(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isFilterMenuOpen,
    isExportScopeMenuOpen,
    isExportModalOpen,
    selectedCode,
  ]);

  useEffect(() => {
    if (!isExportModalOpen || typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const animationFrame = window.requestAnimationFrame(() => {
      exportModalRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.body.style.overflow = previousOverflow;
      exportTriggerRef.current?.focus();
    };
  }, [isExportModalOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchMapData("background");
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

  const mappedAssets = useMemo(() => numberMappedAssets(assets), [assets]);
  const filteredMappedAssets = useMemo(
    () => filterAssetsByRegister(mappedAssets, selectedRegisterId),
    [mappedAssets, selectedRegisterId],
  );

  const visibleAssets = useMemo(
    () => filteredMappedAssets.filter((asset) => matchesSearch(asset, search)),
    [filteredMappedAssets, search],
  );
  const selectedMarkerPosition = useMemo(() => {
    const selectedAsset = visibleAssets.find(
      (asset) => asset.publicAssetCode === selectedCode,
    );

    return selectedAsset
      ? `${selectedAsset.lastKnownLat},${selectedAsset.lastKnownLng}`
      : "";
  }, [selectedCode, visibleAssets]);
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
    if (
      !selectedCode ||
      isSidebarCollapsed ||
      typeof window === "undefined"
    ) {
      return undefined;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const selectedButton = assetButtonsByCodeRef.current.get(selectedCode);
      selectedButton?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isSidebarCollapsed, selectedCode]);

  const showAllVisibleAssets = useCallback(() => {
    const map = mapRef.current;
    if (!map || !visibleAssets.length) return;

    const bounds = visibleAssets.map(
      (asset) =>
        [asset.lastKnownLat as number, asset.lastKnownLng as number] as [
          number,
          number,
        ],
    );

    setSelectedCode(null);
    if (bounds.length === 1) {
      map.setView(bounds[0], 13);
    } else {
      map.fitBounds(bounds, {
        paddingTopLeft: [58, 82],
        paddingBottomRight: [58, 82],
        maxZoom: 13,
      });
    }
  }, [visibleAssets]);

  useEffect(() => {
    let cancelled = false;

    if (mapRef.current) {
      setMapRendererStatus("ready");
      return undefined;
    }

    setMapRendererStatus("loading");

    async function initialiseMap() {
      try {
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
            updateWhenIdle: false,
            keepBuffer: 4,
            attribution: "Tiles &copy; Esri",
          },
        );
        const satelliteLabelLayer = L.tileLayer(
          "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 19,
            updateWhenIdle: false,
            keepBuffer: 4,
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
        const handleMapClick = () => setSelectedCode(null);
        map.on("click", handleMapClick);

        const invalidate = () => map.invalidateSize();
        window.setTimeout(invalidate, 120);
        window.addEventListener("resize", invalidate);
        (map as any).__aim4priceInvalidate = invalidate;
        setMapRendererStatus("ready");
      } catch {
        if (!cancelled) {
          setMapRendererStatus("error");
        }
      }
    }

    void initialiseMap();

    return () => {
      cancelled = true;
    };
  }, [mapRendererAttempt]);

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
  }, [basemapMode, mapRendererStatus]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    const markerLayer = markerLayerRef.current;

    if (mapRendererStatus !== "ready" || !map || !L || !markerLayer) {
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

    visibleAssets.forEach((asset) => {
      const lat = asset.lastKnownLat as number;
      const lng = asset.lastKnownLng as number;
      const isActive = asset.publicAssetCode === selectedCode;
      const markerNumber = asset.mapNumber;

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
        bubblingMouseEvents: false,
        zIndexOffset: isActive ? 1000 : 0,
      });

      const tooltipContent = document.createElement("span");
      tooltipContent.textContent = `${markerNumber}. ${asset.title || asset.plateLabel || "Saved asset"}`;
      marker.bindTooltip(tooltipContent, {
        direction: "top",
        offset: [0, -34],
        opacity: 0.92,
      });
      marker.on("click", () => setSelectedCode(asset.publicAssetCode));
      marker.addTo(markerLayer);
      markersByCodeRef.current.set(asset.publicAssetCode, marker);
      bounds.push([lat, lng]);
    });

    const signature = visibleAssets
      .map(
        (asset) =>
          `${asset.mapNumber}:${asset.publicAssetCode}:${asset.lastKnownLat ?? ""},${asset.lastKnownLng ?? ""}`,
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
  }, [mapRendererStatus, selectedCode, visibleAssets]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = selectedCode
      ? markersByCodeRef.current.get(selectedCode)
      : null;

    if (!map || !marker) {
      return;
    }

    const latLng = marker.getLatLng();
    const zoom = map.getZoom();
    const mapHeight = map.getSize().y;
    const selectedCardHeight =
      (selectedAssetCardRef.current?.getBoundingClientRect().height ?? 0) / currentWebsiteScale();
    const verticalOffset =
      mapHeight >= 430 && selectedCardHeight > 0
        ? Math.min(selectedCardHeight * 0.3, 88)
        : 0;
    const targetCenter = verticalOffset
      ? map.unproject(
          map.project(latLng, zoom).add([0, verticalOffset]),
          zoom,
        )
      : latLng;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.panTo(targetCenter, {
      animate: !prefersReducedMotion,
      duration: prefersReducedMotion ? 0 : 0.55,
    });
  }, [
    isSidebarCollapsed,
    mapRendererStatus,
    selectedCode,
    selectedMarkerPosition,
  ]);

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
      assetButtonsByCodeRef.current.clear();
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
  const selectedExportHref =
    exportFormat === "pdf" ? exportPdfHref : exportXlsxHref;
  const selectedExportLabel =
    exportFormat === "pdf" ? "Download PDF" : "Download XLSX";
  const selectedExportDescription =
    exportFormat === "pdf"
      ? "Printable Asset Map Tracking report for the selected scope."
      : "Excel GPS sheet with the latest saved coordinates for the selected scope.";

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

  function handleSearchSubmit() {
    const firstVisibleAsset = visibleAssets[0];
    if (firstVisibleAsset) {
      setSelectedCode(firstVisibleAsset.publicAssetCode);
    }
  }

  function clearSearch() {
    setSearch("");
    setSelectedCode(null);
  }

  function openExportModal() {
    setExportRegisterId(selectedRegisterId);
    setExportFormat("pdf");
    setExportStep("format");
    setIsFilterMenuOpen(false);
    setIsExportScopeMenuOpen(false);
    setIsExportModalOpen(true);
  }

  function closeExportModal() {
    setIsExportScopeMenuOpen(false);
    setIsExportModalOpen(false);
  }

  function chooseExportFormat(format: ExportFormat) {
    setExportFormat(format);
    setIsExportScopeMenuOpen(false);
    setExportStep("scope");
  }

  function goBackToExportFormat() {
    setIsExportScopeMenuOpen(false);
    setExportStep("format");
  }

  function selectPageRegisterFilter(registerId: RegisterFilterId) {
    setSelectedRegisterId(registerId);
    setIsFilterMenuOpen(false);
    filterTriggerRef.current?.focus();
  }

  function selectExportRegisterFilter(registerId: RegisterFilterId) {
    setExportRegisterId(registerId);
    setIsExportScopeMenuOpen(false);
    exportScopeTriggerRef.current?.focus();
  }

  function handlePageFilterMenuKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) {
    handleMenuNavigation(event);
    if (event.key !== "Tab") return;

    event.preventDefault();
    setIsFilterMenuOpen(false);
    focusAdjacentControl(document, filterTriggerRef.current, event.shiftKey);
  }

  function handleExportScopeMenuKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) {
    handleMenuNavigation(event);
    if (event.key !== "Tab") return;

    event.preventDefault();
    setIsExportScopeMenuOpen(false);
    if (exportModalRef.current) {
      focusAdjacentControl(
        exportModalRef.current,
        exportScopeTriggerRef.current,
        event.shiftKey,
      );
    }
  }

  async function handleDownload(href: string, format: ExportFormat) {
    if (isDownloading) return;
    setIsDownloading(true);
    setNotice(null);
    try {
      await downloadAssetMapReport(href, format);
      closeExportModal();
    } catch (error) {
      closeExportModal();
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Unable to download the report. Please try again." });
    } finally {
      setIsDownloading(false);
    }
  }

  function updateSidebarCollapsed(collapsed: boolean) {
    setIsSidebarCollapsed(collapsed);
    if (typeof window === "undefined") return;

    window.requestAnimationFrame(() => {
      const nextTrigger = collapsed
        ? sidebarExpandTriggerRef.current
        : sidebarCollapseTriggerRef.current;
      nextTrigger?.focus();
    });
  }

  function retryMapRenderer() {
    const map = mapRef.current;
    if (map) {
      const invalidate = (map as any).__aim4priceInvalidate;
      if (invalidate && typeof window !== "undefined") {
        window.removeEventListener("resize", invalidate);
      }
      map.remove();
    }

    mapRef.current = null;
    leafletRef.current = null;
    markerLayerRef.current = null;
    baseLayersRef.current = {
      road: null,
      satellite: null,
      satelliteLabels: null,
    };
    markersByCodeRef.current.clear();
    lastBoundsSignatureRef.current = "";
    setMapRendererAttempt((currentAttempt) => currentAttempt + 1);
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
                handleSearchSubmit();
              }}
            >
              <label
                className={styles.searchWrap}
                aria-label="Search mapped assets"
              >
                <SearchIcon className={styles.searchIcon} />
                <input
                  type="search"
                  className={styles.searchInput}
                  value={search}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder="Search name, serial or registration"
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
                <div className={styles.filterDropdown} ref={filterDropdownRef}>
                  <button
                    ref={filterTriggerRef}
                    type="button"
                    className={`${styles.filterControl} ${styles.topActionButton} ${isFilterMenuOpen ? styles.filterControlOpen : ""}`}
                    onClick={() => setIsFilterMenuOpen((current) => !current)}
                    aria-haspopup="menu"
                    aria-expanded={isFilterMenuOpen}
                    aria-controls="asset-map-register-filter-menu"
                    aria-label={`Filter: ${selectedFilterLabel}`}
                  >
                    <FilterIcon className={styles.buttonIcon} />
                    <span className={styles.filterControlLabel}>
                      {selectedFilterLabel}
                    </span>
                  </button>
                  {isFilterMenuOpen ? (
                    <DropdownOverlay
                      id="asset-map-register-filter-menu"
                      className={styles.filterMenu}
                      matchAnchorWidth={false}
                      role="menu"
                      aria-label="Filter mapped assets by asset register"
                      onKeyDown={handlePageFilterMenuKeyDown}
                    >
                      {registerFilters.map((filter) => {
                        const isSelected = filter.id === selectedRegisterId;

                        return (
                          <button
                            key={filter.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={isSelected}
                            tabIndex={isSelected ? 0 : -1}
                            className={`${styles.filterMenuOption} ${isSelected ? styles.filterMenuOptionActive : ""}`}
                            onClick={() => selectPageRegisterFilter(filter.id)}
                          >
                            <span>{filter.label}</span>
                            {isSelected ? <strong>Selected</strong> : null}
                          </button>
                        );
                      })}
                    </DropdownOverlay>
                  ) : null}
                </div>
                <button
                  ref={exportTriggerRef}
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

          {notice && dataStatus === "ready" ? (
            <div className={styles.notice} role="alert">
              {notice.message}
            </div>
          ) : null}

          <section
            className={`${styles.mapStage} ${isSidebarCollapsed ? styles.mapStageCollapsed : ""}`}
            aria-label="Mapped assets and locations"
          >
            <aside
              id="asset-map-asset-list"
              className={`${styles.assetSidebar} ${isSidebarCollapsed ? styles.assetSidebarCollapsed : ""}`}
              aria-label="Visible mapped assets"
            >
              <div className={styles.assetSidebarHeader}>
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
                <button
                  ref={sidebarCollapseTriggerRef}
                  type="button"
                  className={styles.sidebarToggleButton}
                  onClick={() => updateSidebarCollapsed(true)}
                  aria-label="Close asset list"
                  data-tooltip="Close"
                  aria-expanded={!isSidebarCollapsed}
                  aria-controls="asset-map-asset-list"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>

              {!isSidebarCollapsed ? (
                <div className={styles.assetList}>
                  {dataStatus === "loading" ? (
                    <p className={styles.emptyState} role="status">
                      Loading mapped assets…
                    </p>
                  ) : dataStatus === "error" ? (
                    <div className={styles.sidebarError} role="alert">
                      <strong>Asset locations couldn&apos;t be loaded.</strong>
                      <span>Check the connection and try again.</span>
                      <button
                        type="button"
                        className={styles.retryButton}
                        onClick={() => void fetchMapData("initial")}
                      >
                        Try again
                      </button>
                    </div>
                  ) : !mappedAssets.length ? (
                    <p className={styles.emptyState}>
                      No GPS locations saved yet. Save a GPS location on an
                      asset to place the first marker on this map.
                    </p>
                  ) : !filteredMappedAssets.length ? (
                    <p className={styles.emptyState}>
                      No mapped GPS assets in {selectedFilterLabel}. Choose All
                      Assets or another register.
                    </p>
                  ) : !visibleAssets.length ? (
                    <p className={styles.emptyState}>
                      No mapped assets match this search in{" "}
                      {selectedFilterLabel}. Clear the search or choose another
                      register.
                    </p>
                  ) : (
                    visibleAssets.map((asset) => {
                      const isActive = selectedCode === asset.publicAssetCode;
                      const usageText = buildUsageDisplay(asset);

                      return (
                        <article
                          key={asset.publicAssetCode}
                          className={`${styles.assetCard} ${isActive ? styles.assetCardActive : ""}`}
                        >
                          <button
                            type="button"
                            className={styles.assetCardButton}
                            ref={(element) => {
                              if (element) {
                                assetButtonsByCodeRef.current.set(
                                  asset.publicAssetCode,
                                  element,
                                );
                              } else {
                                assetButtonsByCodeRef.current.delete(
                                  asset.publicAssetCode,
                                );
                              }
                            }}
                            onClick={() =>
                              setSelectedCode(asset.publicAssetCode)
                            }
                            aria-pressed={isActive}
                          >
                            <span className={styles.assetNumber}>
                              {asset.mapNumber}
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
                  )}
                </div>
              ) : null}
            </aside>

            <div className={styles.assetMapShell}>
              {isSidebarCollapsed ? (
                <button
                  ref={sidebarExpandTriggerRef}
                  type="button"
                  className={styles.sidebarExpandButton}
                  onClick={() => updateSidebarCollapsed(false)}
                  aria-label="Open asset list"
                  data-tooltip="Open"
                  aria-expanded="false"
                  aria-controls="asset-map-asset-list"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="m10 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              ) : null}

              {dataStatus === "loading" ? (
                <div className={styles.mapLoading} role="status">
                  <span className={styles.mapLoadingPulse} aria-hidden="true" />
                  <strong>Loading asset locations…</strong>
                </div>
              ) : dataStatus === "error" ? (
                <div className={styles.mapError} role="alert">
                  <strong>Asset locations couldn&apos;t be loaded.</strong>
                  <span>Check the connection and try again.</span>
                  <button
                    type="button"
                    className={styles.retryButton}
                    onClick={() => void fetchMapData("initial")}
                  >
                    Try again
                  </button>
                </div>
              ) : mapRendererStatus === "loading" ? (
                <div className={styles.mapLoading} role="status">
                  <span className={styles.mapLoadingPulse} aria-hidden="true" />
                  <strong>Preparing the map…</strong>
                </div>
              ) : mapRendererStatus === "error" ? (
                <div className={styles.mapError} role="alert">
                  <strong>The map couldn&apos;t start.</strong>
                  <span>Your asset list is still available.</span>
                  <button
                    type="button"
                    className={styles.retryButton}
                    onClick={retryMapRenderer}
                  >
                    Try again
                  </button>
                </div>
              ) : !mappedAssets.length ? (
                <div className={styles.mapEmpty}>
                  <strong>No GPS locations saved yet.</strong>
                  <span>
                    Save a GPS location on an asset to place the first marker on
                    this map.
                  </span>
                </div>
              ) : null}
              {dataStatus === "ready" &&
              mapRendererStatus === "ready" &&
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
              {dataStatus === "ready" &&
              mapRendererStatus === "ready" &&
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
                  ref={selectedAssetCardRef}
                  className={styles.selectedAssetCard}
                  aria-label={`Selected asset: ${selectedAsset.title || "Saved asset"}`}
                  tabIndex={-1}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
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
                          {selectedAssetPhotos.map((photo, index) => (
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
                        <div className={styles.selectedAssetIdentity}>
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
                        </div>

                      </div>

                      <div className={styles.selectedDetailGrid}>
                        <span>
                          <small>Serial</small>
                          <strong>{selectedAsset.serialNumber || "—"}</strong>
                        </span>
                        <span>
                          <small>Last updated</small>
                          <strong>
                            {formatDate(selectedAsset.updatedAtIso)}
                          </strong>
                        </span>
                      </div>

                      <div className={styles.selectedActionRow}>
                        <Link
                          href={buildAssetRegisterHref(selectedAsset)}
                          prefetch={true}
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
                          <button
                            type="button"
                            disabled={isDownloading}
                            onClick={() => void handleDownload(selectedAssetReportHref, "pdf")}
                            className={`${styles.selectedActionButton} ${styles.selectedActionDownload}`}
                          >
                            <DownloadIcon className={styles.buttonIcon} />
                            <span>{isDownloading ? "Preparing…" : "Download"}</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              ) : null}

              {dataStatus === "ready" &&
              mapRendererStatus === "ready" &&
              visibleAssets.length ? (
                <button
                  type="button"
                  className={styles.fitMapButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    showAllVisibleAssets();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <MapIcon className={styles.buttonIcon} />
                  <span>Show all locations</span>
                  <strong>{visibleAssets.length}</strong>
                </button>
              ) : null}

              {dataStatus === "ready" && mapRendererStatus === "ready" ? (
                <div
                  className={styles.layerControl}
                  role="group"
                  aria-label="Map style"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onWheel={(event) => event.stopPropagation()}
                >
                  {BASEMAP_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.layerButton} ${basemapMode === option.value ? styles.layerButtonActive : ""}`}
                      onClick={() => setBasemapMode(option.value)}
                      aria-pressed={basemapMode === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </article>
      </section>

      {isExportModalOpen ? (
        <div
          className={styles.modalBackdrop} data-website-overlay
          role="presentation"
          onMouseDown={closeExportModal}
        >
          <section
            ref={exportModalRef}
            className={styles.exportModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-map-export-title"
            tabIndex={-1}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={styles.exportModalHeader}>
              <div>
                <h2 id="asset-map-export-title">Export Asset Map Tracking</h2>
              </div>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeExportModal}
                aria-label="Close download options"
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </header>

            {exportStep === "format" ? (
              <>
                <div
                  className={styles.exportChoices}
                  aria-label="Choose Asset Map export format"
                >
                  <button
                    type="button"
                    className={`${styles.exportOption} ${exportFormat === "pdf" ? styles.exportOptionActive : ""}`}
                    onClick={() => chooseExportFormat("pdf")}
                    aria-pressed={exportFormat === "pdf"}
                  >
                    <span className={styles.exportGraphic}>
                      <img
                        src="/brand/pdf.png"
                        alt="PDF map report"
                        className={styles.exportGraphicImage}
                      />
                    </span>
                    <span className={styles.exportOptionTitleBlock}>
                      <strong>PDF map report</strong>
                      <small>
                        Download a clean printable Asset Map Tracking report.
                      </small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.exportOption} ${exportFormat === "xlsx" ? styles.exportOptionActive : ""}`}
                    onClick={() => chooseExportFormat("xlsx")}
                    aria-pressed={exportFormat === "xlsx"}
                  >
                    <span className={styles.exportGraphic}>
                      <img
                        src="/brand/sheet.png"
                        alt="XLSX GPS workbook"
                        className={styles.exportGraphicImage}
                      />
                    </span>
                    <span className={styles.exportOptionTitleBlock}>
                      <strong>XLSX GPS workbook</strong>
                      <small>
                        Download the latest saved GPS coordinates in Excel
                        format.
                      </small>
                    </span>
                  </button>
                </div>

                <div className={styles.exportActions}>
                  <button
                    type="button"
                    className={`${styles.secondaryAction} ${styles.exportSecondaryButton}`}
                    onClick={closeExportModal}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.exportScopeBox}>
                  <div
                    className={`${styles.exportScopeField} ${isExportScopeMenuOpen ? styles.exportScopeFieldOpen : ""}`}
                    ref={exportScopeDropdownRef}
                    data-asset-map-export-select-root="true"
                  >
                    <span className={styles.exportScopeLabel}>
                      Asset Register
                    </span>
                    <button
                      ref={exportScopeTriggerRef}
                      type="button"
                      className={`${styles.exportScopeTrigger} ${isExportScopeMenuOpen ? styles.exportScopeTriggerOpen : ""}`}
                      onClick={() =>
                        setIsExportScopeMenuOpen((current) => !current)
                      }
                      aria-haspopup="menu"
                      aria-expanded={isExportScopeMenuOpen}
                      aria-controls="asset-map-export-register-menu"
                    >
                      <span>{exportFilterLabel}</span>
                      <ChevronDownIcon className={styles.filterChevron} />
                    </button>
                    {isExportScopeMenuOpen ? (
                      <DropdownOverlay
                        id="asset-map-export-register-menu"
                        className={`${styles.filterMenu} ${styles.exportScopeMenu}`}
                        role="menu"
                        aria-label="Choose asset register export scope"
                        onKeyDown={handleExportScopeMenuKeyDown}
                      >
                        {registerFilters.map((filter) => {
                          const isSelected = filter.id === exportRegisterId;

                          return (
                            <button
                              key={filter.id}
                              type="button"
                              role="menuitemradio"
                              aria-checked={isSelected}
                              tabIndex={isSelected ? 0 : -1}
                              className={`${styles.filterMenuOption} ${isSelected ? styles.filterMenuOptionActive : ""}`}
                              onClick={() =>
                                selectExportRegisterFilter(filter.id)
                              }
                            >
                              <span>{filter.label}</span>
                              {isSelected ? <strong>Selected</strong> : null}
                            </button>
                          );
                        })}
                      </DropdownOverlay>
                    ) : null}
                  </div>
                </div>

                <div className={styles.exportScopeSummary}>
                  <strong>{exportFilterLabel}</strong>
                  <span>
                    {selectedExportDescription} {exportScopedAssets.length}{" "}
                    mapped GPS{" "}
                    {exportScopedAssets.length === 1 ? "asset" : "assets"} in
                    this scope.
                  </span>
                </div>

                {!exportScopeHasMappedAssets ? (
                  <p className={styles.exportEmptyNote}>
                    No mapped GPS assets are available in the selected scope.
                  </p>
                ) : null}

                <div className={styles.exportActions}>
                  <button
                    type="button"
                    className={`${styles.secondaryAction} ${styles.exportSecondaryButton}`}
                    onClick={goBackToExportFormat}
                  >
                    Back
                  </button>
                  {exportScopeHasMappedAssets ? (
                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={() => void handleDownload(selectedExportHref, exportFormat)}
                      className={`${styles.primaryAction} ${styles.exportPrimaryButton}`}
                    >
                      <DownloadIcon className={styles.buttonIcon} />
                      <span>{isDownloading ? "Preparing…" : selectedExportLabel}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`${styles.primaryAction} ${styles.exportPrimaryButton}`}
                      disabled
                    >
                      <DownloadIcon className={styles.buttonIcon} />
                      <span>{selectedExportLabel}</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}

