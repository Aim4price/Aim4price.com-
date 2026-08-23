import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  MAX_REPORT_PDF_REQUEST_BYTES,
  normaliseReportPdfFileName,
  parseReportPdfRenderRequest,
  reportPdfRequestExceedsDeclaredLimit,
} from '../lib/report-pdf-request.ts';

test('rich report request parser preserves canonical HTML byte-for-byte', () => {
  const html = `<!doctype html>\n<html><head><style>.value { color: #10382f; }</style></head>\n<body><main class="assetReportPage">  R 420 750  </main></body></html>`;
  const payload = parseReportPdfRenderRequest(JSON.stringify({
    html,
    fileName: '2021 Krone / valuation: final',
  }));

  assert.equal(payload.html, html);
  assert.equal(payload.fileName, '2021 Krone - valuation- final.pdf');
});

test('rich report request bounds and filename safety are enforced before Chromium rendering', () => {
  assert.equal(reportPdfRequestExceedsDeclaredLimit(String(MAX_REPORT_PDF_REQUEST_BYTES)), false);
  assert.equal(reportPdfRequestExceedsDeclaredLimit(String(MAX_REPORT_PDF_REQUEST_BYTES + 1)), true);
  assert.equal(reportPdfRequestExceedsDeclaredLimit('invalid'), false);
  assert.equal(normaliseReportPdfFileName('../../report\r\n.pdf'), 'report-.pdf');
  assert.throws(
    () => parseReportPdfRenderRequest('{not-json'),
    /not valid JSON/,
  );
  assert.throws(
    () => parseReportPdfRenderRequest(JSON.stringify({ html: '', fileName: 'report.pdf' })),
    /HTML is required/,
  );
  assert.throws(
    () => parseReportPdfRenderRequest(JSON.stringify({
      html: '<!doctype html><html><body>Not a standard report</body></html>',
      fileName: 'report.pdf',
    })),
    /standard report flow/,
  );
});

test('authenticated endpoint renders posted canonical HTML with safe PDF headers', async () => {
  const route = await readFile(new URL('../app/api/reports/render-pdf/route.ts', import.meta.url), 'utf8');

  assert.match(route, /getServerSession\(\{ requireActive: true, allowOwnerApp: true \}\)/);
  assert.match(route, /content-type'[\s\S]*?split\(';', 1\)\[0\]\?\.trim\(\) !== 'application\/json'/);
  assert.match(route, /reportPdfRequestExceedsDeclaredLimit\(request\.headers\.get\('content-length'\)\)/);
  assert.match(route, /request\.body\.getReader\(\)/);
  assert.match(route, /totalBytes > MAX_REPORT_PDF_REQUEST_BYTES/);
  assert.match(route, /reader\.cancel\(\)/);
  assert.match(route, /parseReportPdfRenderRequest\(await readBoundedRequestText\(request\)\)/);
  assert.match(route, /renderReportHtmlToPdf\(payload\.html, \{[\s\S]*?baseUrl: request\.url,[\s\S]*?cookie: request\.headers\.get\('cookie'\) \?\? '',[\s\S]*?\}\)/);
  assert.match(route, /'Content-Type': 'application\/pdf'/);
  assert.match(route, /'Content-Length': String\(pdf\.length\)/);
  assert.match(route, /'Content-Disposition': `attachment; filename="\$\{payload\.fileName\}"`/);
  assert.match(route, /'Cache-Control': 'no-store, private'/);
  assert.match(route, /'X-Content-Type-Options': 'nosniff'/);
  assert.doesNotMatch(route, /buildAsset|build.*ReportHtml/);
});
