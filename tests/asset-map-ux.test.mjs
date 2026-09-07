import { assertNoWebsiteReflow } from './helpers/site-layout-audit.mjs';
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [assetMapClient, assetMapStyles] = await Promise.all([
  read("app/asset-map/asset-map-client.tsx"),
  read("app/asset-map/page.module.css"),
]);

test("restores the initial Asset Map structure", () => {
  assert.match(assetMapClient, /<h1>Asset Map Tracking<\/h1>/);
  assert.match(assetMapClient, /className=\{styles\.topActions\}/);
  assert.match(assetMapClient, /styles\.assetSidebar/);
  assert.match(assetMapClient, /className=\{styles\.assetList\}/);
  assert.match(assetMapClient, /className=\{styles\.assetMapShell\}/);
  assert.match(assetMapClient, /className=\{styles\.selectedAssetCard\}/);
  assert.doesNotMatch(assetMapClient, /styles\.summaryGrid/);
  assert.doesNotMatch(assetMapClient, /styles\.visuallyHidden/);
  assert.doesNotMatch(assetMapClient, /QR Asset Map/);
});

test("uses one canonical number for list cards and map markers", () => {
  assert.match(
    assetMapClient,
    /type NumberedAssetMapItem = AssetMapItem & \{[\s\S]*?mapNumber: number;/,
  );
  assert.match(
    assetMapClient,
    /function numberMappedAssets[\s\S]*?\.map\(\(asset, index\) => \(\{ \.\.\.asset, mapNumber: index \+ 1 \}\)\)/,
  );
  assert.match(
    assetMapClient,
    /const mappedAssets = useMemo\(\(\) => numberMappedAssets\(assets\)/,
  );
  assert.match(assetMapClient, /const markerNumber = asset\.mapNumber/);
  assert.match(assetMapClient, /\{asset\.mapNumber\}/);
  assert.doesNotMatch(assetMapClient, /\{selectedAsset\.mapNumber\}/);
  assert.doesNotMatch(assetMapClient, /const markerNumber = index \+ 1/);
  assert.doesNotMatch(assetMapClient, /selectedAssetIndex/);
  assert.match(
    assetMapClient,
    /left\.publicAssetCode\.localeCompare\(right\.publicAssetCode/,
  );
  assert.match(assetMapClient, /Number\.isFinite\(parsedLeftTime\)/);
});

test("keeps filtering and search useful without silently selecting while typing", () => {
  assert.match(
    assetMapClient,
    /filterAssetsByRegister\(mappedAssets, selectedRegisterId\)/,
  );
  assert.match(
    assetMapClient,
    /filteredMappedAssets\.filter\(\(asset\) => matchesSearch\(asset, search\)\)/,
  );
  assert.match(assetMapClient, /asset\.publicAssetCode/);
  assert.match(assetMapClient, /asset\.plateLabel/);
  assert.match(assetMapClient, /asset\.licenseRegistrationNumber/);
  assert.match(assetMapClient, /Search name, serial or registration/);
  assert.match(assetMapClient, /const firstVisibleAsset = visibleAssets\[0\]/);
  assert.doesNotMatch(
    assetMapClient,
    /if\s*\(\s*visibleAssets\.length === 1\s*\)/,
  );
  assert.match(assetMapClient, /\{selectedFilterLabel\}/);
});

test("recovers cleanly from data and Leaflet failures", () => {
  assert.match(
    assetMapClient,
    /type FetchMode = "initial" \| "background"/,
  );
  assert.match(assetMapClient, /mapDataRequestIdRef/);
  assert.match(assetMapClient, /mapDataAbortControllerRef\.current\?\.abort\(\)/);
  assert.match(assetMapClient, /signal: controller\.signal/);
  assert.match(
    assetMapClient,
    /requestId !== mapDataRequestIdRef\.current/,
  );
  assert.match(assetMapClient, /const \[dataStatus, setDataStatus\]/);
  assert.match(
    assetMapClient,
    /const \[mapRendererStatus, setMapRendererStatus\]/,
  );
  assert.match(assetMapClient, /leafletLoaderPromise = null/);
  assert.match(
    assetMapClient,
    /document\.getElementById\(LEAFLET_SCRIPT_ID\)\?\.remove\(\)/,
  );
  assert.match(assetMapClient, /Asset locations couldn&apos;t be loaded/);
  assert.match(assetMapClient, /The map couldn&apos;t start/);
});

test("reruns map effects when Leaflet becomes ready", () => {
  assert.match(assetMapClient, /setMapRendererStatus\("ready"\)/);
  assert.match(
    assetMapClient,
    /\}, \[basemapMode, mapRendererStatus\]\);/,
  );
  assert.match(
    assetMapClient,
    /\}, \[mapRendererStatus, selectedCode, visibleAssets\]\);/,
  );
  assert.match(assetMapClient, /markerLayerRef\.current = L\.layerGroup/);
  assert.match(assetMapClient, /mapRendererAttempt/);
});

test("map controls and selection preserve the user's context", () => {
  assert.match(assetMapClient, /showAllVisibleAssets/);
  assert.match(assetMapClient, /Show all locations/);
  assert.match(assetMapClient, /map\.on\("click", handleMapClick\)/);
  assert.match(assetMapClient, /bubblingMouseEvents: false/);
  assert.match(assetMapClient, /tooltipContent\.textContent/);
  assert.match(assetMapClient, /assetButtonsByCodeRef/);
  assert.match(assetMapClient, /selectedButton\?\.scrollIntoView/);
  assert.match(assetMapClient, /selectedMarkerPosition/);
  assert.match(assetMapClient, /selectedCardHeight \* 0\.3/);
  assert.match(assetMapClient, /keepBuffer: 4/);
  assert.match(assetMapClient, /aria-pressed=\{basemapMode === option\.value\}/);
  assert.match(assetMapClient, /const focusIsInside = focusRoots\.some/);
  assert.match(
    assetMapClient,
    /ref=\{filterTriggerRef\}[\s\S]{0,180}styles\.filterControl/,
  );
  assert.doesNotMatch(
    assetMapClient,
    /ref=\{filterTriggerRef\}[\s\S]{0,180}styles\.clearSearchButton/,
  );
  assert.match(assetMapClient, /function updateSidebarCollapsed/);
  assert.match(assetMapClient, /sidebarExpandTriggerRef\.current/);
  assert.match(assetMapClient, /sidebarCollapseTriggerRef\.current/);
  assert.match(assetMapClient, /nextTrigger\?\.focus\(\)/);
  assert.match(assetMapClient, /function handleMenuNavigation/);
  assert.match(assetMapClient, /event\.key !== "ArrowDown"/);
  assert.match(assetMapClient, /menuItems\[nextIndex\]\?\.focus\(\)/);
  assert.match(assetMapClient, /onKeyDown=\{handlePageFilterMenuKeyDown\}/);
  assert.match(assetMapClient, /onKeyDown=\{handleExportScopeMenuKeyDown\}/);
  assert.equal(
    [...assetMapClient.matchAll(/tabIndex=\{isSelected \? 0 : -1\}/g)].length,
    2,
  );
  assert.match(assetMapClient, /focusAdjacentControl\(document/);
  assert.match(assetMapClient, /focusAdjacentControl\([\s\S]*?exportModalRef\.current/);
  assert.equal(
    [...assetMapClient.matchAll(/\(selectedItem \?\? firstItem\)\?\.focus\(\)/g)]
      .length,
    2,
  );
});

test("selected overlay keeps the original compact content without a duplicate number badge", () => {
  assert.match(assetMapClient, /styles\.selectedAssetIdentity/);
  assert.doesNotMatch(assetMapClient, /styles\.selectedAssetNumber/);
  assert.match(assetMapClient, />Serial</);
  assert.match(assetMapClient, />Last scanned</);
  assert.match(assetMapClient, />Asset Register</);
  assert.match(assetMapClient, />Maps</);
  assert.match(assetMapClient, />Download</);
  assert.doesNotMatch(assetMapClient, />Last known location</);
  assert.doesNotMatch(assetMapClient, /\.slice\(0, 6\)/);
  assert.match(
    assetMapStyles,
    /\.selectedAssetCard \{[\s\S]*?left: 50%;[\s\S]*?transform: translateX\(-50%\);/,
  );
});

test("styling keeps the original layout while improving map clarity", () => {
  assert.match(
    assetMapStyles,
    /\.mapStage \{[\s\S]*?grid-template-columns: minmax\(18rem, 22rem\) minmax\(0, 1fr\);/,
  );
  assert.match(assetMapStyles, /\.fitMapButton \{/);
  assert.match(assetMapStyles, /\.mapLoading,\s*\.mapError \{/);
  assert.doesNotMatch(assetMapStyles, /\.selectedAssetNumber \{/);
  assert.match(assetMapStyles, /\.sidebarExpandButton \{/);
  assert.doesNotMatch(
    assetMapStyles,
    /\.mapStageCollapsed \{[^}]*3\.7rem/,
  );
  assertNoWebsiteReflow(assetMapStyles);
  assert.match(
    assetMapStyles,
    /\.aim4priceMapMarkerPin\)[\s\S]*?color: #0f5840;[\s\S]*?border: 3px solid #0f5840;/,
  );
  assert.match(
    assetMapStyles,
    /\.aim4priceMapMarker--active \.aim4priceMapMarkerPin\)[\s\S]*?background: #0f5840;/,
  );
});

