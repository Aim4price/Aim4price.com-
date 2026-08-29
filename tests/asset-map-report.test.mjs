import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const reportRoute = await readFile(
  new URL("../app/api/asset-map/report/route.ts", import.meta.url),
  "utf8",
);

test("keeps the existing browser and Chromium print workflow", () => {
  assert.match(reportRoute, /Content-Type": "text\/html; charset=utf-8"/);
  assert.match(reportRoute, /window\.print\(\)/);
  assert.match(reportRoute, /Save PDF \/ Print/);
  assert.doesNotMatch(reportRoute, /puppeteer\.launch|page\.pdf\(/);
});

test("uses one readiness-aware action for automatic and manual printing", () => {
  assert.match(reportRoute, /onclick="window\.printAssetMapReport\(\)"/);
  assert.match(reportRoute, /window\.printAssetMapReport = printReport/);
  assert.match(reportRoute, /if \(printInFlight\) return printInFlight/);
  assert.match(reportRoute, /\.finally\(function \(\) \{[\s\S]*?printInFlight = null/);
  assert.match(
    reportRoute,
    /mapReady[\s\S]*?waitForTiles\(activePrintLayers\)[\s\S]*?waitForFonts[\s\S]*?waitForImages/,
  );
  assert.match(reportRoute, /image\.decode\(\)\.catch/);
});

test("starts the single-asset evidence section on a clean printed page", () => {
  assert.match(reportRoute, /assetMapReportContinuationHeader/);
  assert.match(reportRoute, /Location key and photo evidence/);
  assert.match(
    reportRoute,
    /\.assetMapReportContinuationHeader \{[\s\S]*?break-before: page;[\s\S]*?page-break-before: always;/,
  );
  assert.match(
    reportRoute,
    /\.assetMapReportContentGrid \{[\s\S]*?break-inside: avoid-page;[\s\S]*?page-break-inside: avoid;/,
  );
  assert.match(
    reportRoute,
    /#map \{[\s\S]*?height: 100%;[\s\S]*?min-height:/,
  );
  assert.doesNotMatch(reportRoute, />Page 1</);
  assert.match(reportRoute, /Aim4price Asset Intelligence/);
});

test("improves detail and photo hierarchy without dropping report data", () => {
  assert.match(reportRoute, /normalizedCoordinateNote/);
  assert.match(reportRoute, /showLocationNote/);
  assert.match(reportRoute, /assetMapReportDetailRowEmphasis/);
  assert.match(reportRoute, /Math\.min\(photos\.length, 3\)/);
  assert.match(reportRoute, /assetMapReportPhotoGridTotal\$\{photos\.length\}/);
  assert.match(
    reportRoute,
    /\.assetMapReportPhotoGrid \{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    reportRoute,
    /\.assetMapReportPhotoSection \{[\s\S]*?break-inside: auto;/,
  );
  assert.match(reportRoute, /\.assetMapReportPhotoGridTotal5 \{/);
  for (const label of [
    "Current value ex VAT",
    "Replacement price ex VAT",
    "Insured price ex VAT",
    "Last GPS coordinate",
    "Last scanned",
  ]) {
    assert.match(reportRoute, new RegExp(label));
  }
});

test("waits for high-resolution main, label, and overview map tiles", () => {
  assert.equal([...reportRoute.matchAll(/detectRetina: true/g)].length, 3);
  assert.match(reportRoute, /var printLayers = \[layers\.primary, layers\.labels\]/);
  assert.match(reportRoute, /printLayers\.push\(overviewTiles\)/);
  assert.match(reportRoute, /function waitForTiles\(tileLayers\)/);
  assert.match(reportRoute, /waitForTiles\(tileLayers\)/);
});

test("preserves the Asset Map card number in every report scope", () => {
  assert.match(
    reportRoute,
    /function numberSourcedAssets[\s\S]*?filter\(\(\{ item \}\) => hasCoordinates\(item\)\)[\s\S]*?sort\(sortSourcedAssets\)[\s\S]*?number: index \+ 1/,
  );
  assert.match(
    reportRoute,
    /const numberedMappedAssets = numberSourcedAssets\(sourcedAssets\);[\s\S]*?filterSourcesBySelection\(numberedMappedAssets, selection\)[\s\S]*?numberedMappedAssets\.filter/,
  );
  assert.match(reportRoute, /function toPrintableAsset\(source: NumberedSourcedAsset\)/);
  assert.match(reportRoute, /number: source\.number/);
  assert.doesNotMatch(
    reportRoute,
    /function toPrintableAsset\([^)]*index[^)]*\)[\s\S]*?number: index \+ 1/,
  );
  assert.match(
    reportRoute,
    /const leftTime = Number\.isFinite\(parsedLeftTime\) \? parsedLeftTime : 0;/,
  );
  assert.match(
    reportRoute,
    /left\.item\.publicAssetCode\.localeCompare\([\s\S]*?right\.item\.publicAssetCode/,
  );
});
