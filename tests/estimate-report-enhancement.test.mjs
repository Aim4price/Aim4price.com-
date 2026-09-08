import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  MAX_ESTIMATE_REPORT_PHOTOS,
  enhanceEstimateReportHtml,
  normalizeEstimateReportPhotos,
} from '../lib/estimate-report-enhancement.ts';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function baseReportHtml() {
  return `<!doctype html>
<html>
  <head><style>.assetReportPage{display:block}</style></head>
  <body>
    <main class="assetReportPage">
      <div class="assetReportInner">
        <img class="assetReportLogo" src="data:image/png;base64,QUFBQQ==" alt="Aim4price logo" />
        <div class="assetReportPageNumber">Page 1 of 1</div>
      </div>
    </main>

    <script>
      (function () {
        window.__reportReady = true;
      })();
    </script>
  </body>
</html>`;
}

const PHOTO = 'data:image/jpeg;base64,QUFBQQ==';

test('estimate report spacing is enhanced without creating an extra page when no photos are supplied', () => {
  const html = enhanceEstimateReportHtml(baseReportHtml(), {
    machineTitle: 'Test Tractor',
    generatedAt: '2026-09-08T09:00:00+02:00',
  });

  assert.match(html, /id="estimate-report-enhancements"/);
  assert.match(html, /\.assetReportContentGrid[\s\S]*?gap:\s*14px/);
  assert.match(html, /\.assetReportSideCard \.assetReportRow[\s\S]*?grid-template-columns:\s*25mm minmax\(0, 1fr\)/);
  assert.match(html, /Page 1 of 1/);
  assert.doesNotMatch(html, /estimateReportPhotoPage/);
});

test('temporary estimate report photos are constrained to supported inline images and the four-photo limit', () => {
  const photos = normalizeEstimateReportPhotos([
    PHOTO,
    'data:image/png;base64,QUJDRA==',
    'data:image/webp;base64,QUJDRA==',
    PHOTO,
    PHOTO,
    'https://example.com/not-inline.jpg',
    'data:text/plain;base64,QUFBQQ==',
  ]);

  assert.equal(MAX_ESTIMATE_REPORT_PHOTOS, 4);
  assert.equal(photos.length, 4);
  assert.ok(photos.every((photo) => /^data:image\/(?:jpeg|png|webp);base64,/.test(photo)));
});

test('temporary report photos are appended as a branded second page without cropping', () => {
  const html = enhanceEstimateReportHtml(baseReportHtml(), {
    machineTitle: 'New Holland TT4.90',
    generatedAt: '2026-09-08T09:00:00+02:00',
    reportPhotos: [PHOTO, PHOTO],
  });

  assert.match(html, /Page 1 of 2/);
  assert.match(html, /Page 2 of 2/);
  assert.match(html, /class="assetReportPage estimateReportPhotoPage"/);
  assert.match(html, /data-count="2"/);
  assert.match(html, /Estimate Photos/);
  assert.match(html, /not saved to the Asset Register/);
  assert.match(html, /\.estimateReportPhotoFigure img[\s\S]*?object-fit:\s*contain/);
  assert.equal((html.match(/<figure class="estimateReportPhotoFigure">/g) ?? []).length, 2);
  assert.ok(html.indexOf('estimateReportPhotoPage') < html.indexOf('<script>'), 'photo page must exist before the print script waits for images');
});

test('Get Estimate mounts an in-memory photo picker and routes the existing PDF action through the enhancer', async () => {
  const [page, picker, enhancedRoute, config] = await Promise.all([
    read('app/valuation/page.tsx'),
    read('app/valuation/EstimateReportPhotos.tsx'),
    read('app/api/valuation/report-enhanced/route.ts'),
    read('next.config.mjs'),
  ]);

  assert.match(page, /<EstimateReportPhotos\s*\/>/);
  assert.match(picker, /\[data-result-action="download-pdf"\]/);
  assert.match(picker, /payload\.reportPhotos = reportPhotos/);
  assert.match(picker, /canvas\.toDataURL\('image\/jpeg'/);
  assert.match(picker, /MAX_SOURCE_PHOTO_BYTES = 20 \* 1024 \* 1024/);
  assert.match(picker, /this estimate only/);
  assert.match(picker, /not saved to the Asset Register/);
  assert.doesNotMatch(picker, /localStorage|sessionStorage/);

  assert.match(enhancedRoute, /POST as renderBaseValuationReport/);
  assert.match(enhancedRoute, /enhanceEstimateReportHtml\(baseHtml, rawPayload\)/);
  assert.match(config, /source:\s*['"]\/api\/valuation\/report['"]/);
  assert.match(config, /destination:\s*['"]\/api\/valuation\/report-enhanced['"]/);
});
