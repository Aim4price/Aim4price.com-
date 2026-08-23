import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildAssetRegisterSummaryReportHtml,
  buildAssetSheetReportHtml,
  openAssetRegisterSummaryPrint,
  openAssetSheetPrint,
} from '../lib/report-print.ts';

function captureOpenedHtml(openReport) {
  let writtenHtml = '';
  const previousWindow = globalThis.window;
  globalThis.window = {
    open() {
      return {
        document: {
          title: '',
          open() {},
          write(value) {
            writtenHtml = value;
          },
          close() {},
        },
      };
    },
  };

  try {
    assert.equal(openReport(), true);
    return writtenHtml;
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

test('normal asset valuation uses exactly the exported canonical HTML builder', () => {
  const payload = {
    logoUrl: 'data:image/png;base64,logo',
    generatedAt: '23 August 2026',
    assetBadge: 'Baler',
    heroTitle: '2021 Krone Fortima 1250MC Baler',
    heroMeta: 'Krone · Fortima 1250MC',
    valueLabel: 'Estimated Value',
    value: 'R 420 750',
    valueNote: 'Aim4price',
    statusLabel: 'Updated today',
    facts: [
      { label: 'Serial Number', value: 'RPS601S1' },
      { label: 'Year', value: '2021' },
      { label: 'Usage', value: '30%' },
      { label: 'Condition', value: 'Good' },
      { label: 'Replacement Price', value: 'R 825 000 excl. VAT' },
    ],
    photoUrls: ['data:image/jpeg;base64,photo'],
    notes: [],
    methodCards: [{ label: 'Aim4price', value: 'R 420 750', note: 'Pricing engine output.', selected: true }],
  };

  const canonicalHtml = buildAssetSheetReportHtml(payload);
  const normalHtml = captureOpenedHtml(() => openAssetSheetPrint(payload));

  assert.equal(normalHtml, canonicalHtml);
  assert.match(canonicalHtml, /<main class="assetReportPage">/);
  assert.match(canonicalHtml, /RPS601S1/);
  assert.match(canonicalHtml, /R 825 000 excl\. VAT/);
});

test('normal register and umbrella valuation use exactly the exported canonical HTML builder', () => {
  const payload = {
    logoUrl: '',
    generatedAt: '23 August 2026',
    reportTitle: 'Balers - Umbrella Report',
    reportSubtitle: 'Aim4price asset register',
    ownerName: 'Aim4price owner',
    ownerMeta: 'South Africa',
    intro: 'Only the chosen umbrella assets are included.',
    registerValue: 'R 420 750',
    stats: [{ label: 'Assets', value: '1', note: 'Grouped asset.' }],
    rows: [{
      asset: '2021 Krone Fortima 1250MC Baler',
      type: 'Baler',
      method: 'Aim4price',
      detail: 'Umbrella: Balers',
      value: 'R 420 750',
      replacementPrice: 'R 825 000',
      status: 'Updated today',
      serial: 'RPS601S1',
      year: '2021',
      usage: '30%',
      condition: 'Good',
    }],
  };

  const canonicalHtml = buildAssetRegisterSummaryReportHtml(payload);
  const normalHtml = captureOpenedHtml(() => openAssetRegisterSummaryPrint(payload));

  assert.equal(normalHtml, canonicalHtml);
  assert.match(canonicalHtml, /<main class="fullRegisterPage">/);
  assert.match(canonicalHtml, /Balers - Umbrella Report/);
  assert.match(canonicalHtml, /RPS601S1/);
});

test('asset register normal open and external attachment reuse one rich report source object', async () => {
  const client = await readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');

  assert.match(client, /html: buildAssetSheetReportHtml\(reportPayload\)/);
  assert.match(client, /html: buildAssetRegisterSummaryReportHtml\(reportPayload\)/);
  assert.match(client, /request: \{[\s\S]*?method: 'POST' as const,[\s\S]*?body: JSON\.stringify\(\{ html, fileName \}\)/);
  assert.match(client, /const reportSource = buildExternalReportSource\([\s\S]*?if \(externalShareReportScope === 'asset'\) \{[\s\S]*?addExternalShareReport\(reportSource\)[\s\S]*?openPreparedExternalReport\(reportSource\)/);
  assert.match(client, /const reportSource = buildExternalReportSource\([\s\S]*?externalShareReportScope === 'register' \|\| externalShareReportScope === 'group'[\s\S]*?addExternalShareReport\(reportSource\)[\s\S]*?openPreparedExternalReport\(reportSource\)/);
  assert.doesNotMatch(client, /\/api\/reports\/share-pdf/);
});
