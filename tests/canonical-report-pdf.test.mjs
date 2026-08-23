import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { prepareReportHtmlForPdf } from '../lib/report-pdf.ts';
import { isAllowedReportResourceUrl } from '../lib/report-resource-policy.ts';

test('canonical PDF preparation preserves report markup and styles while removing auto-print code', () => {
  const source = `<!doctype html>
    <html>
      <head><style>@page { size: A4 landscape; } .record { color: #10382f; }</style></head>
      <body>
        <main class="assetReportPage"><h1>Exact Aim4price report</h1><p class="record">RPS601S1</p></main>
        <script>window.addEventListener('load', function () { window.print(); });</script>
        <script>document.body.dataset.shouldNotRun = 'true';</script>
      </body>
    </html>`;

  const prepared = prepareReportHtmlForPdf(source, 'https://www.aim4price.com/api/report?format=pdf');

  assert.match(prepared, /<base href="https:\/\/www\.aim4price\.com\/api\/report\?format=pdf">/);
  assert.match(prepared, /@page \{ size: A4 landscape; \}/);
  assert.match(prepared, /<main class="assetReportPage"><h1>Exact Aim4price report<\/h1><p class="record">RPS601S1<\/p><\/main>/);
  assert.doesNotMatch(prepared, /window\.print/);
  assert.doesNotMatch(prepared, /<script|shouldNotRun/);
});

test('report resource allowlist keeps session assets and trusted storage while rejecting SSRF hosts', () => {
  const baseUrl = 'https://www.aim4price.com/api/asset-register/scan-report?format=pdf';

  assert.equal(isAllowedReportResourceUrl('/api/asset-register/uploads/photo.jpg', baseUrl), true);
  assert.equal(isAllowedReportResourceUrl('https://fonts.gstatic.com/s/montserrat/font.woff2', baseUrl), true);
  assert.equal(isAllowedReportResourceUrl('https://bucket.s3.af-south-1.amazonaws.com/photo.jpg', baseUrl), true);
  assert.equal(isAllowedReportResourceUrl('https://abc.cloudfront.net/logo.png', baseUrl), true);
  assert.equal(isAllowedReportResourceUrl('data:image/png;base64,AA==', baseUrl), true);
  assert.equal(isAllowedReportResourceUrl('https://unapproved.example/logo.png', baseUrl), false);
  assert.equal(isAllowedReportResourceUrl('http://127.0.0.1/private', baseUrl), false);
  assert.equal(isAllowedReportResourceUrl('http://localhost./private', baseUrl), false);
  assert.equal(isAllowedReportResourceUrl('http://service.internal/private', baseUrl), false);
  assert.equal(isAllowedReportResourceUrl('http://[::ffff:127.0.0.1]/private', baseUrl), false);
});

test('Chromium renderer strips and blocks scripts, waits for resources, and prints canonical CSS', async () => {
  const [renderer, resourcePolicy, reportLogo] = await Promise.all([
    readFile(new URL('../lib/report-pdf.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/report-resource-policy.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/report-logo.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(renderer, /replace\(\/<script/);
  assert.match(renderer, /setJavaScriptEnabled\(false\)/);
  assert.doesNotMatch(renderer, /setBypassCSP/);
  assert.match(renderer, /\['image', 'font', 'stylesheet'\]/);
  assert.match(resourcePolicy, /BUILT_IN_RESOURCE_HOSTS = new Set\(\['fonts\.googleapis\.com', 'fonts\.gstatic\.com'\]\)/);
  assert.match(resourcePolicy, /BUILT_IN_RESOURCE_SUFFIXES = \['\.amazonaws\.com', '\.cloudfront\.net'\]/);
  assert.match(resourcePolicy, /REPORT_PDF_RESOURCE_HOSTS/);
  assert.match(reportLogo, /isAllowedReportResourceUrl\(cleanedLogoUrl, requestUrl\) \? cleanedLogoUrl : fallbackLogoUrl/);
  assert.match(renderer, /policy\.sameOrigin && sameOriginCookie/);
  assert.match(renderer, /delete headers\.cookie/);
  assert.match(resourcePolicy, /value\.endsWith\('\.internal'\)/);
  assert.match(renderer, /document\.fonts\?\.ready/);
  assert.match(renderer, /image\.decode\(\)/);
  assert.match(renderer, /waitUntil: 'domcontentloaded'/);
  assert.match(renderer, /printBackground: true/);
  assert.match(renderer, /preferCSSPageSize: true/);
  assert.match(renderer, /displayHeaderFooter: false/);
  assert.match(renderer, /waitForFonts: false/);
  assert.match(renderer, /MAX_CONCURRENT_RENDERS/);
  assert.match(renderer, /MAX_QUEUED_RENDERS/);
  assert.match(renderer, /withTimeout\(page\.close\(\), CLEANUP_TIMEOUT_MS/);
  assert.match(renderer, /details\.size === 0/);
  assert.match(renderer, /resolve\(executablePath\) === defaultCachedExecutablePath/);
  assert.match(renderer, /await unlink\(defaultCachedExecutablePath\)/);
  assert.doesNotMatch(renderer, /buildBrandedReportPdfFromHtml/);
});

test('normal report routes return their own HTML builders as canonical PDFs and retain exact XLSX paths', async () => {
  const routePaths = [
    '../app/api/asset-register/scan-report/route.ts',
    '../app/api/maintenance/report/route.ts',
    '../app/api/my-invoices/report/route.ts',
  ];
  const routes = await Promise.all(routePaths.map((path) => readFile(new URL(path, import.meta.url), 'utf8')));

  for (const route of routes) {
    assert.match(route, /renderReportHtmlToPdf\(html, \{[\s\S]*?baseUrl: request\.url,[\s\S]*?cookie: request\.headers\.get\('cookie'\) \?\? '',[\s\S]*?\}\)/);
    assert.match(route, /'Content-Type': 'application\/pdf'/);
    assert.match(route, /'Content-Length': String\(pdf\.length\)/);
    assert.match(route, /'Content-Type': 'application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet'/);
    assert.match(route, /format === 'html'/);
    assert.match(route, /'Content-Type': 'text\/html; charset=utf-8'/);
    assert.doesNotMatch(route, /buildBrandedReportPdfFromHtml/);
  }

  assert.match(routes[0], /buildDepreciationReport\([\s\S]*?return buildReportDocumentResponse\(html, request, baseFileName, reportFormat\)/);
  assert.match(routes[0], /buildFuelReport\([\s\S]*?buildMaintenanceReport\([\s\S]*?return buildReportDocumentResponse\(html, request, baseFileName, reportFormat\)/);
  assert.match(routes[1], /const html = buildAssetMaintenanceReportHtml\(options\);[\s\S]*?renderReportHtmlToPdf\(html/);
  assert.match(routes[2], /const html = buildMyInvoicesReportHtml\(options\);[\s\S]*?renderReportHtmlToPdf\(html/);
});

test('deployment keeps the compatible Chromium runtime external to the Next server bundle', async () => {
  const [packageJson, nextConfig] = await Promise.all([
    readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../next.config.mjs', import.meta.url), 'utf8'),
  ]);

  assert.equal(packageJson.dependencies['@sparticuz/chromium'], '138.0.2');
  assert.equal(packageJson.dependencies['puppeteer-core'], '24.15.0');
  assert.match(nextConfig, /serverComponentsExternalPackages: \['@sparticuz\/chromium', 'puppeteer-core'\]/);
});
