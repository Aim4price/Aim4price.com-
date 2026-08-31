import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const route = await readFile(
  new URL('../app/api/asset-register/export/route.ts', import.meta.url),
  'utf8',
);

const responseHelper = route.slice(
  route.indexOf('function buildRegisterSummaryHtmlResponse'),
  route.indexOf('export async function GET'),
);
const getHandler = route.slice(route.indexOf('export async function GET'));

test('asset register summary supports a canonical HTML report response', () => {
  assert.match(getHandler, /format !== 'xlsx' && format !== 'pdf' && format !== 'html'/);
  assert.match(getHandler, /format === 'html' && reportKind !== 'summary'/);
  assert.match(responseHelper, /'Content-Type': 'text\/html; charset=utf-8'/);
  assert.match(responseHelper, /'Content-Disposition': `inline; filename="\$\{fileName\}"`/);
  assert.match(responseHelper, /'Cache-Control': 'private, no-store'/);
  assert.match(responseHelper, /'X-Content-Type-Options': 'nosniff'/);
});

test('both scoped and single-register summaries bypass Chromium for browser printing', () => {
  const htmlBranches = getHandler.match(/if \(format === 'html'\) \{/g) ?? [];
  const htmlResponses = getHandler.match(/return buildRegisterSummaryHtmlResponse\(html, fileName\);/g) ?? [];

  assert.equal(htmlBranches.length, 2);
  assert.equal(htmlResponses.length, 2);
  assert.match(getHandler, /const summaryItems = bundles\.flatMap[\s\S]*?renderRegisterSummaryReportHtml\(summaryItems/);
  assert.match(getHandler, /renderRegisterSummaryReportHtml\(items, exportProfile, generatedAt, request\.url\)/);
});

test('explicit server PDF summaries remain available for external consumers', () => {
  const chromiumCalls = getHandler.match(/renderReportHtmlToPdf\(html,/g) ?? [];

  assert.equal(chromiumCalls.length, 2);
  assert.match(getHandler, /'Content-Type': 'application\/pdf'/);
});

test('canonical summary HTML opens the browser print dialog after resources settle', () => {
  assert.match(route, /<button[^>]+onclick="window\.print\(\)"[^>]*>Save PDF \/ Print<\/button>/);
  assert.match(route, /Promise\.all\(\[waitForImages\(\), waitForFonts\(\)\]\)/);
  assert.match(route, /Promise\.race\(\[\s*imagesReady,[\s\S]*?window\.setTimeout\(resolve, 1200\)/);
  assert.match(route, /window\.addEventListener\('load', openPrintDialog, \{ once: true \}\)/);
});
