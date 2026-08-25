import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const APPROVED_REPORT_STYLES = [
  {
    path: '../app/api/valuation/report/route.ts',
    styleIndexes: [0],
    fingerprints: ['8283:e09e9b447c606d13'],
  },
  {
    path: '../lib/report-print.ts',
    // The final two style blocks are the shared asset sheet and register report.
    // Earlier blocks are legacy builders and are intentionally outside this lock.
    styleIndexes: [2, 3],
    fingerprints: ['9788:ad65a7d539dad737', '10394:914e553bb8f8ab3b'],
  },
  {
    path: '../lib/asset-maintenance-report.ts',
    styleIndexes: [0],
    fingerprints: ['7436:a78a45af9af43474'],
  },
  {
    path: '../lib/my-invoices-report.ts',
    styleIndexes: [0],
    fingerprints: ['10462:6c3e7638fe498a95'],
  },
  {
    path: '../app/api/fuel/report/route.ts',
    styleIndexes: [0],
    fingerprints: ['10702:d1bfc5906350f892'],
  },
  {
    path: '../app/api/asset-map/report/route.ts',
    styleIndexes: [0],
    fingerprints: ['11113:becf9a153e53580e'],
  },
  {
    path: '../app/api/asset-register/scan-report/route.ts',
    styleIndexes: [0],
    fingerprints: ['17342:1e8489f357da3afe'],
  },
];

function normaliseCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    .trim();
}

function utf8Bytes(value) {
  return Buffer.from(value, 'utf8');
}

function fingerprint(value) {
  let hash = 0xcbf29ce484222325n;

  for (const byte of utf8Bytes(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }

  return `${value.length}:${hash.toString(16).padStart(16, '0')}`;
}

function styleBlocks(source) {
  return [...source.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((match) => normaliseCss(match[1]));
}

test('approved report CSS remains visually locked to the reference PDFs', async () => {
  for (const contract of APPROVED_REPORT_STYLES) {
    const source = await readFile(new URL(contract.path, import.meta.url), 'utf8');
    const blocks = styleBlocks(source);
    const selected = contract.styleIndexes.map((index) => {
      assert.ok(blocks[index], `${contract.path} is missing approved style block ${index}.`);
      return fingerprint(blocks[index]);
    });

    assert.deepEqual(
      selected,
      contract.fingerprints,
      [
        `The approved styling changed in ${contract.path}.`,
        'Do not update this fingerprint for an incidental report change.',
        'Only update it after an explicitly approved report redesign and visual PDF comparison.',
      ].join(' '),
    );
    assert.match(source, /Montserrat/i, `${contract.path} must retain the approved Montserrat typography.`);
    assert.match(source, /Powered by Aim4price\.com/i, `${contract.path} must retain the approved footer branding.`);
  }
});

test('valuation and maintenance reports retain the approved reference structure', async () => {
  const [valuation, maintenance, sharedReports] = await Promise.all([
    readFile(new URL('../app/api/valuation/report/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/asset-maintenance-report.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/report-print.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(valuation, /Asset Estimate Report/);
  assert.match(valuation, /Aim4price estimate report/);
  assert.match(valuation, /class="assetReportHeader"/);
  assert.match(valuation, /class="assetReportOverview"/);
  assert.match(valuation, /class="assetReportValuationCard"/);
  assert.match(valuation, /Page 1 of 1/);

  assert.match(maintenance, /const reportTitle = 'Maintenance Report'/);
  assert.match(maintenance, /class="topbar"/);
  assert.match(maintenance, /class="hero"/);
  assert.match(maintenance, /class="detailsGrid"/);
  assert.match(maintenance, /class="footer"/);

  assert.match(sharedReports, /Asset Valuation Report/);
  assert.match(sharedReports, /class="assetReportHeader"/);
  assert.match(sharedReports, /class="assetReportOverview"/);
  assert.match(sharedReports, /class="assetReportFooter"/);
});

test('PDF generation cannot silently substitute a second report design', async () => {
  const renderer = await readFile(new URL('../lib/report-pdf.ts', import.meta.url), 'utf8');

  assert.match(renderer, /REPORT DESIGN CONTRACT/);
  assert.match(renderer, /export async function renderReportHtmlToPdf\(/);
  assert.equal((renderer.match(/page\.pdf\(/g) ?? []).length, 1);
  assert.doesNotMatch(renderer, /buildBrandedReportPdfFromHtml/);
  assert.doesNotMatch(renderer, /common PDF fallback|using .*fallback|Prepared from the standard Aim4price report/i);

  await assert.rejects(
    readFile(new URL('../lib/branded-report-pdf.ts', import.meta.url), 'utf8'),
    (error) => error?.code === 'ENOENT',
    'The alternate generic PDF layout must remain deleted.',
  );
});
