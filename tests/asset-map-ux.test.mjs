import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [assetMapClient, assetMapStyles] = await Promise.all([
  read("app/asset-map/asset-map-client.tsx"),
  read("app/asset-map/page.module.css"),
]);

test("asset map presents a useful location summary and visible register scope", () => {
  assert.match(assetMapClient, /Live asset locations/);
  assert.match(assetMapClient, /summary\.assetsWithLocation/);
  assert.match(assetMapClient, /summary\.scannedLast30Days/);
  assert.match(assetMapClient, /summary\.assetsWithoutLocation/);
  assert.match(assetMapClient, /className=\{styles\.filterControlCopy\}/);
  assert.match(assetMapClient, /\{selectedFilterLabel\}/);
  assert.match(assetMapClient, /getMappedAssetCountForFilter/);
  assert.doesNotMatch(
    assetMapClient,
    /className=\{styles\.filterControlLabel\}>Filter</,
  );
});

test("map and long asset list keep selection discoverable", () => {
  assert.match(assetMapClient, /showAllVisibleAssets/);
  assert.match(assetMapClient, /map\.fitBounds\(bounds/);
  assert.match(assetMapClient, /map\.on\("click", handleMapClick\)/);
  assert.match(assetMapClient, /bubblingMouseEvents: false/);
  assert.match(assetMapClient, /assetButtonsByCodeRef/);
  assert.match(assetMapClient, /selectedButton\?\.scrollIntoView/);
  assert.match(assetMapClient, /aria-pressed=\{isActive\}/);
  assert.match(assetMapClient, /Show all locations/);
});

test("selected asset panel prioritises location and clear next actions", () => {
  assert.match(assetMapClient, /Last known location/);
  assert.match(assetMapClient, /buildLocationLabel\(selectedAsset\)/);
  assert.match(assetMapClient, /Open register/);
  assert.match(assetMapClient, /Open in Maps/);
  assert.match(assetMapClient, /PDF report/);
  assert.doesNotMatch(assetMapClient, /selectedAssetPhotos\s*\.slice\(0, 6\)/);
});

test("asset map styling supports loading, branded markers, and responsive controls", () => {
  assert.match(assetMapStyles, /\.summaryGrid \{/);
  assert.match(assetMapStyles, /\.assetListLoading \{/);
  assert.match(assetMapStyles, /\.mapLoading \{/);
  assert.match(assetMapStyles, /\.mapControlStack \{/);
  assert.match(assetMapStyles, /\.fitMapButton \{/);
  assert.match(
    assetMapStyles,
    /\.selectedAssetCard \{[\s\S]*?right: clamp\([\s\S]*?transform: none;/,
  );
  assert.match(
    assetMapStyles,
    /\.aim4priceMapMarkerPin\)[\s\S]*?background: #0f5840;/,
  );
  assert.match(assetMapStyles, /@media \(prefers-reduced-motion: reduce\)/);
});
