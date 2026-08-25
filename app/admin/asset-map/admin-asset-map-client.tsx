"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatAdminAssetMoney,
  hasAdminAssetCoordinates,
  type AdminAssetLocationFilter,
  type AdminAssetMapReport,
  type AdminGlobalAsset,
} from "../../../lib/admin-global-assets-shared";
import styles from "./page.module.css";

type BasemapMode = "road" | "satellite";

declare global {
  interface Window {
    L?: any;
  }
}

const LEAFLET_SCRIPT_ID = "aim4price-leaflet-script";
const LEAFLET_CSS_ID = "aim4price-leaflet-css";
const LEAFLET_CLUSTER_SCRIPT_ID = "aim4price-leaflet-cluster-script";
const LEAFLET_CLUSTER_CSS_ID = "aim4price-leaflet-cluster-css";
const LEAFLET_CLUSTER_DEFAULT_CSS_ID = "aim4price-leaflet-cluster-default-css";
const DEFAULT_CENTER: [number, number] = [-29, 24];
const DEFAULT_ZOOM = 5;
const SIDEBAR_RENDER_LIMIT = 300;

let leafletLoaderPromise: Promise<any> | null = null;

function loadLeafletMarkerCluster(leaflet: any): Promise<any> {
  if (leaflet?.markerClusterGroup) return Promise.resolve(leaflet);

  if (!document.getElementById(LEAFLET_CLUSTER_CSS_ID)) {
    const link = document.createElement("link");
    link.id = LEAFLET_CLUSTER_CSS_ID;
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";
    link.crossOrigin = "";
    document.head.appendChild(link);
  }
  if (!document.getElementById(LEAFLET_CLUSTER_DEFAULT_CSS_ID)) {
    const link = document.createElement("link");
    link.id = LEAFLET_CLUSTER_DEFAULT_CSS_ID;
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";
    link.crossOrigin = "";
    document.head.appendChild(link);
  }

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(
      LEAFLET_CLUSTER_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    const handleLoaded = () =>
      leaflet?.markerClusterGroup
        ? resolve(leaflet)
        : reject(new Error("Marker clustering did not initialise."));
    if (existing) {
      existing.addEventListener("load", handleLoaded, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Marker clustering could not be loaded.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = LEAFLET_CLUSTER_SCRIPT_ID;
    script.src = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
    script.async = true;
    script.crossOrigin = "";
    script.addEventListener("load", handleLoaded, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Marker clustering could not be loaded.")),
      { once: true },
    );
    document.body.appendChild(script);
  });
}

function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("The map can only load in a browser."));
  }
  if (window.L?.markerClusterGroup) return Promise.resolve(window.L);
  if (leafletLoaderPromise) return leafletLoaderPromise;

  leafletLoaderPromise = new Promise((resolve, reject) => {
    if (window.L) {
      void loadLeafletMarkerCluster(window.L).then(resolve, () => resolve(window.L));
      return;
    }
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement("link");
      link.id = LEAFLET_CSS_ID;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }

    const existing = document.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null;
    const handleLoaded = () => {
      if (!window.L) {
        reject(new Error("The global asset map did not initialise."));
        return;
      }
      void loadLeafletMarkerCluster(window.L).then(resolve, () => resolve(window.L));
    };
    if (existing) {
      existing.addEventListener("load", handleLoaded, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("The global asset map could not be loaded.")),
        { once: true },
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
      () => reject(new Error("The global asset map could not be loaded.")),
      { once: true },
    );
    document.body.appendChild(script);
  });
  return leafletLoaderPromise;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character] ?? character;
  });
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatUsage(asset: AdminGlobalAsset): string {
  if (asset.hours !== null) {
    const unit = asset.usageMetric === "km" || asset.kind === "vehicle" ? "km" : "hours";
    return `${new Intl.NumberFormat("en-ZA").format(asset.hours)} ${unit}`;
  }
  if (asset.lifeWorkedPercent !== null) {
    return `${Math.round(asset.lifeWorkedPercent * 10) / 10}% worked`;
  }
  return "Usage not saved";
}

function assetSearchText(asset: AdminGlobalAsset): string {
  return [
    asset.title,
    asset.assetTypeLabel,
    asset.sectorLabel,
    asset.brandName,
    asset.modelName,
    asset.typedModelName,
    asset.serialNumber,
    asset.registrationNumber,
    asset.publicAssetCode,
    asset.plateLabel,
    asset.registerLabel,
    asset.lastKnownLocationText,
    asset.owner.label,
    asset.owner.name,
    asset.owner.businessName,
    asset.owner.email,
    asset.owner.phone,
    asset.owner.province,
    asset.owner.townCity,
  ]
    .join(" ")
    .toLowerCase();
}

function mapsHref(asset: AdminGlobalAsset): string | null {
  if (!hasAdminAssetCoordinates(asset)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${asset.lastKnownLat},${asset.lastKnownLng}`;
}

export default function AdminAssetMapClient({
  initialReport,
}: {
  initialReport: AdminAssetMapReport;
}) {
  const [report, setReport] = useState(initialReport);
  const [search, setSearch] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [province, setProvince] = useState("");
  const [sector, setSector] = useState("");
  const [location, setLocation] = useState<AdminAssetLocationFilter>("all");
  const [lifecycle, setLifecycle] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<BasemapMode>("road");
  const [refreshing, setRefreshing] = useState(false);
  const [openingOwnerId, setOpeningOwnerId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);
  const markersByAssetIdRef = useRef<Map<string, any>>(new Map());
  const roadLayerRef = useRef<any>(null);
  const satelliteLayerRef = useRef<any>(null);
  const labelsLayerRef = useRef<any>(null);
  const lastBoundsSignatureRef = useRef("");
  const initialFocusHandledRef = useRef(false);

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return report.assets.filter((asset) => {
      if (query && !assetSearchText(asset).includes(query)) return false;
      if (ownerUserId && asset.ownerUserId !== ownerUserId) return false;
      if (province) {
        const assetProvince = asset.owner.province || "__not_saved__";
        if (assetProvince !== province) return false;
      }
      if (sector && asset.sectorKey !== sector) return false;
      if (lifecycle && asset.lifecycleState !== lifecycle) return false;
      const mapped = hasAdminAssetCoordinates(asset);
      if (location === "mapped" && !mapped) return false;
      if (location === "missing" && mapped) return false;
      return true;
    });
  }, [lifecycle, location, ownerUserId, province, report.assets, search, sector]);

  const mappedAssets = useMemo(
    () => filteredAssets.filter(hasAdminAssetCoordinates),
    [filteredAssets],
  );
  const sidebarAssets = filteredAssets.slice(0, SIDEBAR_RENDER_LIMIT);
  const selectedAsset = useMemo(
    () => report.assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [report.assets, selectedAssetId],
  );
  const filtersActive = Boolean(
    search.trim() || ownerUserId || province || sector || lifecycle || location !== "all",
  );

  const refreshReport = useCallback(async (showBusy = true) => {
    if (showBusy) setRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/admin/asset-map", {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        report?: AdminAssetMapReport;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok || !payload.report) {
        throw new Error(payload?.error || "The global asset map could not be refreshed.");
      }
      setReport(payload.report);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "The global asset map could not be refreshed.",
      );
    } finally {
      if (showBusy) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (initialFocusHandledRef.current) return;
    initialFocusHandledRef.current = true;
    const requestedAssetId = new URLSearchParams(window.location.search).get("assetId")?.trim();
    if (requestedAssetId && report.assets.some((asset) => asset.id === requestedAssetId)) {
      setSelectedAssetId(requestedAssetId);
    }
  }, [report.assets]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshReport(false);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [refreshReport]);

  useEffect(() => {
    let cancelled = false;
    async function initialiseMap() {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapElementRef.current || mapRef.current) return;
        leafletRef.current = L;
        const map = L.map(mapElementRef.current, {
          zoomControl: false,
          attributionControl: true,
        });
        L.control.zoom({ position: "topleft" }).addTo(map);
        roadLayerRef.current = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        ).addTo(map);
        satelliteLayerRef.current = L.tileLayer(
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19, attribution: "Tiles &copy; Esri" },
        );
        labelsLayerRef.current = L.tileLayer(
          "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19, attribution: "Labels &copy; Esri" },
        );
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        markerLayerRef.current = L.markerClusterGroup
          ? L.markerClusterGroup({
              chunkedLoading: true,
              removeOutsideVisibleBounds: true,
              showCoverageOnHover: false,
              maxClusterRadius: 52,
            }).addTo(map)
          : L.layerGroup().addTo(map);
        mapRef.current = map;
        window.setTimeout(() => map.invalidateSize(), 100);
      } catch (mapError) {
        setError(mapError instanceof Error ? mapError.message : "The map could not be loaded.");
      }
    }
    void initialiseMap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !roadLayerRef.current || !satelliteLayerRef.current || !labelsLayerRef.current) {
      return;
    }
    for (const layer of [roadLayerRef.current, satelliteLayerRef.current, labelsLayerRef.current]) {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    }
    if (basemap === "satellite") {
      satelliteLayerRef.current.addTo(map);
      labelsLayerRef.current.addTo(map);
    } else {
      roadLayerRef.current.addTo(map);
    }
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !L || !markerLayer) return;

    markerLayer.clearLayers();
    markersByAssetIdRef.current.clear();
    if (!mappedAssets.length) {
      lastBoundsSignatureRef.current = "";
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds: Array<[number, number]> = [];
    mappedAssets.forEach((asset, index) => {
      const markerNumber = index + 1;
      const isSelected = selectedAssetId === asset.id;
      const icon = L.divIcon({
        className: `adminGlobalAssetMarker${isSelected ? " adminGlobalAssetMarker--selected" : ""}`,
        html: `<span><b>${markerNumber}</b></span>`,
        iconSize: [34, 40],
        iconAnchor: [17, 36],
      });
      const marker = L.marker([asset.lastKnownLat, asset.lastKnownLng], {
        icon,
        title: asset.title,
      });
      marker.bindTooltip(
        `<strong>${escapeHtml(asset.title)}</strong><br>${escapeHtml(asset.owner.label)}`,
        { direction: "top", offset: [0, -28], opacity: 0.96 },
      );
      marker.on("click", () => setSelectedAssetId(asset.id));
      marker.addTo(markerLayer);
      markersByAssetIdRef.current.set(asset.id, marker);
      bounds.push([asset.lastKnownLat as number, asset.lastKnownLng as number]);
    });

    const signature = mappedAssets
      .map((asset) => `${asset.id}:${asset.lastKnownLat},${asset.lastKnownLng}`)
      .join("|");
    if (signature !== lastBoundsSignatureRef.current) {
      lastBoundsSignatureRef.current = signature;
      if (bounds.length === 1) map.setView(bounds[0], 13);
      else map.fitBounds(bounds, { padding: [45, 45], maxZoom: 13 });
    }
  }, [mappedAssets, selectedAssetId]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = selectedAssetId
      ? markersByAssetIdRef.current.get(selectedAssetId)
      : null;
    if (!map || !marker) return;
    if (markerLayerRef.current?.zoomToShowLayer) {
      markerLayerRef.current.zoomToShowLayer(marker, () => map.panTo(marker.getLatLng()));
    } else {
      map.panTo(marker.getLatLng());
    }
  }, [selectedAssetId]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      markersByAssetIdRef.current.clear();
    };
  }, []);

  function clearFilters() {
    setSearch("");
    setOwnerUserId("");
    setProvince("");
    setSector("");
    setLocation("all");
    setLifecycle("");
  }

  async function openOwnerAccount(asset: AdminGlobalAsset) {
    if (openingOwnerId) return;
    setOpeningOwnerId(asset.ownerUserId);
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: asset.ownerUserId, action: "open_account" }),
      });
      const payload = (await response.json().catch(() => null)) as {
        redirectUrl?: string;
        error?: string;
      } | null;
      if (!response.ok || !payload?.redirectUrl) {
        throw new Error(payload?.error || "The owner account could not be opened.");
      }
      window.location.assign(payload.redirectUrl);
    } catch (openError) {
      setError(
        openError instanceof Error ? openError.message : "The owner account could not be opened.",
      );
      setOpeningOwnerId(null);
    }
  }

  return (
    <>
      <section className={styles.metrics} aria-label="Global asset map summary">
        <article>
          <span>All saved assets</span>
          <strong>{report.summary.totalAssets.toLocaleString("en-ZA")}</strong>
          <small>Across every Aim4price account and register</small>
        </article>
        <article className={styles.featuredMetric}>
          <span>Mapped assets</span>
          <strong>{report.summary.mappedAssets.toLocaleString("en-ZA")}</strong>
          <small>Assets with valid saved GPS coordinates</small>
        </article>
        <article>
          <span>Missing GPS</span>
          <strong>{report.summary.missingLocationAssets.toLocaleString("en-ZA")}</strong>
          <small>Still searchable in the asset list</small>
        </article>
        <article>
          <span>Owner accounts</span>
          <strong>{report.summary.ownerAccounts.toLocaleString("en-ZA")}</strong>
          <small>Accounts represented on this workspace</small>
        </article>
        <article>
          <span>Registered value</span>
          <strong>{formatAdminAssetMoney(report.summary.totalValueExVat)}</strong>
          <small>Current saved asset value · Excl. VAT</small>
        </article>
      </section>

      <section className={styles.mapCard}>
        <header className={styles.filterBar}>
          <label className={styles.searchField}>
            <span>Search everything</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Asset, owner, email, serial, registration or location"
            />
          </label>
          <label>
            <span>Owner account</span>
            <select value={ownerUserId} onChange={(event) => setOwnerUserId(event.target.value)}>
              <option value="">All accounts</option>
              {report.options.owners.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Province</span>
            <select value={province} onChange={(event) => setProvince(event.target.value)}>
              <option value="">All provinces</option>
              {report.options.provinces.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Sector</span>
            <select value={sector} onChange={(event) => setSector(event.target.value)}>
              <option value="">All sectors</option>
              {report.options.sectors.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>GPS status</span>
            <select
              value={location}
              onChange={(event) => setLocation(event.target.value as AdminAssetLocationFilter)}
            >
              <option value="all">Mapped + missing</option>
              <option value="mapped">Mapped only</option>
              <option value="missing">Missing GPS only</option>
            </select>
          </label>
          <label>
            <span>Lifecycle</span>
            <select value={lifecycle} onChange={(event) => setLifecycle(event.target.value)}>
              <option value="">All states</option>
              {report.options.lifecycleStates.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>
          <div className={styles.filterActions}>
            <button type="button" onClick={clearFilters} disabled={!filtersActive}>
              Clear
            </button>
            <button type="button" onClick={() => void refreshReport()} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </header>

        {error ? <p className={styles.errorNotice}>{error}</p> : null}

        <div className={styles.mapWorkspace}>
          <aside className={styles.assetSidebar} aria-label="Filtered global assets">
            <header>
              <div>
                <strong>{filteredAssets.length.toLocaleString("en-ZA")}</strong>
                <span>matching assets</span>
              </div>
              <small>{mappedAssets.length.toLocaleString("en-ZA")} visible map pins</small>
            </header>
            <div className={styles.assetList}>
              {!sidebarAssets.length ? (
                <p className={styles.emptyState}>No assets match these filters.</p>
              ) : (
                sidebarAssets.map((asset) => {
                  const mapped = hasAdminAssetCoordinates(asset);
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      className={`${styles.assetRow} ${selectedAssetId === asset.id ? styles.assetRowActive : ""}`}
                      onClick={() => setSelectedAssetId(asset.id)}
                    >
                      <span className={mapped ? styles.mapNumber : styles.missingPin}>
                        <b>
                          {mapped
                            ? mappedAssets.findIndex((mappedAsset) => mappedAsset.id === asset.id) + 1
                            : "—"}
                        </b>
                      </span>
                      <span className={styles.assetRowCopy}>
                        <strong>{asset.title}</strong>
                        <small>{asset.owner.label}</small>
                        <em>
                          {asset.assetTypeLabel} · {asset.owner.province || "Province not saved"}
                        </em>
                      </span>
                      <span className={mapped ? styles.mappedBadge : styles.missingBadge}>
                        {mapped ? "Mapped" : "No GPS"}
                      </span>
                    </button>
                  );
                })
              )}
              {filteredAssets.length > SIDEBAR_RENDER_LIMIT ? (
                <p className={styles.listLimitNote}>
                  Showing the first {SIDEBAR_RENDER_LIMIT.toLocaleString("en-ZA")} matches here.
                  Use Admin Discovery for the complete paginated result.
                </p>
              ) : null}
            </div>
          </aside>

          <section className={styles.mapPane} aria-label="All account asset locations">
            <div ref={mapElementRef} className={styles.mapCanvas} />
            {!mappedAssets.length ? (
              <div className={styles.mapEmpty}>
                <strong>No map pins in this view</strong>
                <span>
                  {filteredAssets.length
                    ? "The matching assets do not have saved GPS coordinates."
                    : "Clear or change the filters to see assets."}
                </span>
              </div>
            ) : null}
            <div className={styles.mapMode} aria-label="Map style">
              <button
                type="button"
                className={basemap === "road" ? styles.mapModeActive : ""}
                onClick={() => setBasemap("road")}
              >
                Map
              </button>
              <button
                type="button"
                className={basemap === "satellite" ? styles.mapModeActive : ""}
                onClick={() => setBasemap("satellite")}
              >
                Satellite
              </button>
            </div>

            {selectedAsset ? (
              <article className={styles.assetDetail} aria-label="Selected Admin asset">
                <header>
                  <div>
                    <p>{selectedAsset.assetTypeLabel}</p>
                    <h2>{selectedAsset.title}</h2>
                    <span>{selectedAsset.owner.label}</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Close selected asset"
                    onClick={() => setSelectedAssetId(null)}
                  >
                    ×
                  </button>
                </header>
                <div className={styles.assetDetailGrid}>
                  <span><small>Value</small><strong>{formatAdminAssetMoney(selectedAsset.value)}</strong></span>
                  <span><small>Serial</small><strong>{selectedAsset.serialNumber || "Not saved"}</strong></span>
                  <span><small>Registration</small><strong>{selectedAsset.registrationNumber || "Not saved"}</strong></span>
                  <span><small>Usage</small><strong>{formatUsage(selectedAsset)}</strong></span>
                  <span><small>Last scanned</small><strong>{formatDate(selectedAsset.lastScannedAtIso)}</strong></span>
                  <span><small>Lifecycle</small><strong>{titleCase(selectedAsset.lifecycleState)}</strong></span>
                </div>
                <section className={styles.ownerContact}>
                  <strong>Owner details · Admin unlocked</strong>
                  <span>{selectedAsset.owner.name || selectedAsset.owner.label}</span>
                  <span>{selectedAsset.owner.email || "Email not saved"}</span>
                  <span>{selectedAsset.owner.phone || "Phone not saved"}</span>
                  <span>
                    {[selectedAsset.owner.townCity, selectedAsset.owner.province]
                      .filter(Boolean)
                      .join(", ") || "Account location not saved"}
                  </span>
                </section>
                <footer>
                  <button
                    type="button"
                    onClick={() => void openOwnerAccount(selectedAsset)}
                    disabled={openingOwnerId === selectedAsset.ownerUserId}
                  >
                    {openingOwnerId === selectedAsset.ownerUserId ? "Opening…" : "Open owner account"}
                  </button>
                  <Link href={`/admin/discovery?assetId=${encodeURIComponent(selectedAsset.id)}`}>
                    Full Discovery record
                  </Link>
                  {mapsHref(selectedAsset) ? (
                    <a href={mapsHref(selectedAsset) ?? ""} target="_blank" rel="noreferrer">
                      Google Maps
                    </a>
                  ) : null}
                </footer>
              </article>
            ) : null}
          </section>
        </div>
      </section>
    </>
  );
}
