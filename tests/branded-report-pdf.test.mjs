import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBrandedReportPdfFromHtml } from '../lib/branded-report-pdf.ts';

test('standard Aim4price HTML reports become genuine branded PDF files', () => {
  const pdf = buildBrandedReportPdfFromHtml(`<!doctype html>
    <html><head><style>.hidden{display:none}</style></head><body>
      <div class="assetReportScreenBar">This toolbar must not appear</div>
      <main class="assetReportPage">
        <h1>Maintenance Report</h1>
        <p>2021 Krone Fortima 1250MC Baler</p>
        <h2>Asset Details</h2>
        <div class="assetReportRow"><span>Serial number</span><strong>RPS601S1</strong></div>
        <div class="assetReportRow"><span>Condition</span><strong>Good</strong></div>
        <h2>Maintenance Records</h2>
        <table><tr><th>Date</th><th>Work</th></tr><tr><td>23 Aug 2026</td><td>Annual service</td></tr></table>
      </main>
    </body></html>`, { subtitle: 'Prepared from the standard Aim4price report' });

  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 8).toString('ascii'), '%PDF-1.4');
  assert.match(pdf.toString('ascii'), /AIM4PRICE/);
  assert.match(pdf.toString('ascii'), /Maintenance Report/);
  assert.match(pdf.toString('ascii'), /Serial number/);
  assert.match(pdf.toString('ascii'), /RPS601S1/);
  assert.doesNotMatch(pdf.toString('ascii'), /toolbar must not appear/i);
  assert.match(pdf.toString('ascii'), /\/Type \/Pages \/Kids \[[^\]]+\] \/Count 1 >>/);
  assert.equal((pdf.toString('ascii').match(/\/Type \/Page \/Parent/g) ?? []).length, 1);
  assert.match(pdf.toString('ascii'), /%%EOF$/);
});

test('long reports are rendered as valid multipage PDFs', () => {
  const rows = Array.from({ length: 180 }, (_, index) => (
    `<div class="assetReportRow"><span>Record ${index + 1}</span><strong>Service entry ${index + 1}</strong></div>`
  )).join('');
  const pdf = buildBrandedReportPdfFromHtml(`<main><h1>Cost of Ownership Report</h1>${rows}</main>`);
  const source = pdf.toString('ascii');

  assert.equal(source.slice(0, 8), '%PDF-1.4');
  assert.match(source, /\/Count ([2-9]|[1-9][0-9]+)/);
  assert.match(source, /Page 1 of/);
  assert.match(source, /Powered by Aim4price\.com/);
  assert.match(source, /%%EOF$/);
});

test('wide report tables retain every late column and long cell value', () => {
  const headers = [
    'Asset',
    'Fuel Issued On',
    'Source / Activity',
    'Storage Unit',
    'Litres Issued',
    'Before Fill',
    'Usage Reading',
    'Operator',
    'Activity',
    'Work Area',
    'GPS',
    'Notes / Evidence',
  ];
  const values = [
    'Krone Baler',
    '23 Aug 2026',
    'Asset filled',
    'Main tank',
    '125 litres',
    '30 litres',
    '1 420 hours',
    'Operator One',
    'Baling',
    'North field',
    '-29.123, 30.456',
    `${Array.from({ length: 180 }, (_, index) => `evidence-${index + 1}`).join(' ')} final-tail-marker`,
  ];
  const pdf = buildBrandedReportPdfFromHtml(`<main>
    <h1>Fuel Report</h1>
    <table>
      <tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>
      <tr>${values.map((value) => `<td>${value}</td>`).join('')}</tr>
    </table>
  </main>`);
  const source = pdf.toString('ascii');

  assert.match(source, /Activity/);
  assert.match(source, /Work Area/);
  assert.match(source, /GPS/);
  assert.match(source, /Notes \/ Evidence/);
  assert.match(source, /North field/);
  assert.match(source, /-29\.123, 30\.456/);
  assert.match(source, /final-tail-marker/);
  assert.match(source, /Page 2 of/);
  assert.match(source, /%%EOF$/);
});
