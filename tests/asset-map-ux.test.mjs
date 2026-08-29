import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [assetMapClient, assetMapStyles] = await Promise.all([
  read("app/asset-map/asset-map-client.tsx"),
  read("app/asset-map/page.module.css"),
]);

test("asset map stays map-first while keeping search and register scope clear", () => {
  assert.match(
    assetMapClient,
    /<h1 className=\{styles\.visuallyHidden\}>Asset Map<\/h1>/,
  );
  assert.doesNotMatch(assetMapClient, /styles\.summaryGrid/);
  assert.doesNotMatch(assetMapStyles, /\.summaryGrid \{/);
  assert.match(assetMapClient, /\{selectedFilterLabel\}/);
  assert.match(assetMapClient, /getMappedAssetCountForFilter/);
  assert.match(assetMapClient, /asset\.publicAssetCode/);
  assert.match(assetMapClient, /asset\.plateLabel/);
  assert.match(assetMapClient, /asset\.licenseRegistrationNumber/);
  assert.match(assetMapClient, /Search name, serial or registration/);
  assert.match(assetMapClient, /const firstVisibleAsset = visibleAssets\[0\]/);
});

test("register filtering drives both visible assets and export scope", () => {
  assert.match(
    assetMapClient,
    /useState<RegisterFilterId>\(ALL_REGISTER_FILTER_ID\)/,
  );
  assert.match(
    assetMapClient,
    /filterAssetsByRegister\(mappedAssets, selectedRegisterId\)/,
  );
  assert.match(
    assetMapClient,
    /filteredMappedAssets\.filter\(\(asset\) => matchesSearch\(asset, search\)\)/,
  );
  assert.match(assetMapClient, /setExportRegisterId\(selectedRegisterId\)/);
  assert.match(
    assetMapClient,
    /registerId: exportRegisterId/,
  );
});

test("refresh and failure states preserve a trustworthy map state", () => {
  assert.match(
    assetMapClient,
    /type FetchMode = "initial" \| "background" \| "manual"/,
  );
  assert.match(assetMapClient, /const \[isRefreshing, setIsRefreshing\]/);
  assert.match(assetMapClient, /const \[dataStatus, setDataStatus\]/);
  assert.match(
    assetMapClient,
    /const \[mapRendererStatus, setMapRendererStatus\]/,
  );
  assert.match(assetMapClient, /void fetchMapData\("manual"\)/);
  assert.match(assetMapClient, /mapDataRequestIdRef/);
  assert.match(assetMapClient, /mapDataAbortControllerRef\.current\?\.abort\(\)/);
  assert.match(assetMapClient, /activeManualRequestIdRef/);
  assert.match(assetMapClient, /signal: controller\.signal/);
  assert.match(
    assetMapClient,
    /requestId !== mapDataRequestIdRef\.current/,
  );
  assert.match(assetMapClient, /Your current filters and search are preserved/);
  assert.match(assetMapClient, /Asset locations couldn&apos;t be loaded/);
  assert.match(assetMapClient, /leafletLoaderPromise = null/);
  assert.match(
    assetMapClient,
    /document\.getElementById\(LEAFLET_SCRIPT_ID\)\?\.remove\(\)/,
  );
});

test("Leaflet readiness reruns marker and basemap effects after a cold load", () => {
  assert.match(assetMapClient, /setMapRendererStatus\("ready"\)/);
  assert.match(
    assetMapClient,
    /\}, \[basemapMode, mapRendererStatus\]\);/,
  );
  assert.match(
    assetMapClient,
    /\}, \[mapRendererStatus, selectedCode, visibleAssets\]\);/,
  );
  assert.match(
    assetMapClient,
    /const selectedMarkerPosition = useMemo/,
  );
  assert.match(
    assetMapClient,
    /isSidebarCollapsed,[\s\S]*?mapRendererStatus,[\s\S]*?selectedCode,[\s\S]*?selectedMarkerPosition,[\s\S]*?\]\);/,
  );
  assert.match(assetMapClient, /markerLayerRef\.current = markerLayer/);
  assert.match(assetMapClient, /mapRendererAttempt/);
});

test("map and long asset list keep selection discoverable", () => {
  assert.match(assetMapClient, /showAllVisibleAssets/);
  assert.match(assetMapClient, /map\.fitBounds\(bounds/);
  assert.match(assetMapClient, /map\.on\("click", handleMapClick\)/);
  assert.match(assetMapClient, /bubblingMouseEvents: false/);
  assert.match(assetMapClient, /assetButtonsByCodeRef/);
  assert.match(assetMapClient, /selectedButton\?\.scrollIntoView/);
  assert.match(
    assetMapClient,
    /!selectedCode \|\|[\s\S]*?isSidebarCollapsed[\s\S]*?selectedButton\?\.scrollIntoView[\s\S]*?\[isSidebarCollapsed, selectedCode\]/,
  );
  assert.match(assetMapClient, /aria-pressed=\{isActive\}/);
  assert.match(assetMapClient, /selectedCardHeight \* 0\.28/);
  assert.doesNotMatch(
    assetMapClient,
    /if\s*\(\s*visibleAssets\.length === 1\s*\)/,
  );
});

test("selected asset panel prioritises readable details and green actions", () => {
  assert.match(assetMapClient, /Last known location/);
  assert.match(assetMapClient, /buildLocationLabel\(selectedAsset\)/);
  assert.match(assetMapClient, /Open register/);
  assert.match(assetMapClient, /Open in Maps/);
  assert.match(assetMapClient, /PDF report/);
  assert.match(
    assetMapStyles,
    /\.selectedDetailGrid > span:last-child \{[\s\S]*?grid-column: 1 \/ -1;/,
  );
  assert.doesNotMatch(assetMapStyles, /action-copper/);
  assert.doesNotMatch(assetMapStyles, /#bd6b2b/);
});

test("responsive controls and export dialog avoid overflow and focus loss", () => {
  assert.doesNotMatch(assetMapClient, /minimumWidth=\{352\}/);
  assert.match(assetMapClient, /exportModalRef\.current\?\.focus\(\)/);
  assert.match(assetMapClient, /document\.body\.style\.overflow = "hidden"/);
  assert.match(assetMapClient, /exportTriggerRef\.current\?\.focus\(\)/);
  assert.match(assetMapClient, /event\.key === "Tab"/);
  assert.match(assetMapClient, /const focusIsInside = focusRoots\.some/);
  assert.match(
    assetMapStyles,
    /\.exportModal \{[\s\S]*?overflow-y: auto;[\s\S]*?outline: none;/,
  );
  assert.match(
    assetMapStyles,
    /@media \(max-width: 620px\) \{[\s\S]*?\.topActionButtons \{[\s\S]*?repeat\(2/,
  );
  assert.match(
    assetMapStyles,
    /@media \(max-width: 860px\) \{[\s\S]*?\.selectedAssetContent \{[\s\S]*?padding-right: 2\.45rem;/,
  );
  assert.doesNotMatch(
    assetMapStyles,
    /@media \(max-width: 620px\)[\s\S]*?\.sidebarToggleButton\s*[,\{]/,
  );
});

test("map styling supports branded markers, loading, and reduced motion", () => {
  assert.match(assetMapStyles, /\.assetListLoading \{/);
  assert.match(assetMapStyles, /\.mapLoading \{/);
  assert.match(assetMapStyles, /\.mapError \{/);
  assert.match(assetMapStyles, /\.mapControlStack \{/);
  assert.match(assetMapStyles, /\.fitMapButton \{/);
  assert.match(
    assetMapStyles,
    /\.aim4priceMapMarkerPin\)[\s\S]*?color: #0f5840;[\s\S]*?background: #ffffff;/,
  );
  assert.match(
    assetMapStyles,
    /\.aim4priceMapMarker--active \.aim4priceMapMarkerPin\)[\s\S]*?background: #0f5840;/,
  );
  assert.match(assetMapStyles, /@media \(prefers-reduced-motion: reduce\)/);
});
