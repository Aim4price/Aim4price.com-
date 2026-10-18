import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { splitReplacementTotal, normalizeEstimateReplacementPrice } from '../lib/estimate-replacement.ts';
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.000001, `${a} != ${b}`);

test('reported Mahindra example retains base price and adds the extra exactly once', () => {
  const base = 354499 / 1.15;
  const extra = 20000;
  const total = base + extra;
  close(total * 1.15, 377499);
  const parts = splitReplacementTotal(total, extra);
  close(parts.basic_asset_replacement_price_ex_vat * 1.15, 354499);
  close(parts.basic_total_replacement_price_ex_vat * 1.15, 377499);
  close(parts.basic_asset_replacement_price_ex_vat + parts.basic_extra_replacement_price_ex_vat, total);
});

test('adjusting a total and returning to step 5 does not re-add extras to that total', () => {
  for (const extra of [0, 20000, 37500.25]) {
    let total = 400000 / 1.15;
    for (let i = 0; i < 10; i++) {
      const parts = splitReplacementTotal(total, extra);
      const step5InclVat = parts.basic_asset_replacement_price_ex_vat * 1.15;
      total = step5InclVat / 1.15 + extra;
      close(total * 1.15, 400000);
    }
  }
});

test('invalid totals cannot create a negative or zero asset price', () => {
  for (const [total, extra] of [[20000, 20000], [19999, 20000], [0, 0], [NaN, 0], [Infinity, 0], [100, -1]]) {
    assert.throws(() => splitReplacementTotal(total, extra));
  }
});

test('calculation, result and save retain the VAT choice and calculated snapshot', () => {
  const client = readFileSync(new URL('../app/valuation/valuation-client.tsx', import.meta.url), 'utf8');
  const calculate = client.slice(client.indexOf('async function calculateValuation()'), client.indexOf('function buildValuationSavePayload'));
  assert.match(calculate, /setVatDisplayMode\(basicEstimateActive \? basicReplacementVatMode/);
  assert.match(client, /specsJson: \{ \.\.\.enrichedSpecsJson, \.\.\.replacementParts \}/);
  assert.match(client, /specsJson: resultState.result.specsJson/);
  assert.match(client, /money\(getVatDisplayValue\(finalSaveReplacementPrice, vatDisplayMode\)\)/);
  assert.match(client, /money\(getVatDisplayValue\(headlineValue, vatDisplayMode\)\)/);
  assert.match(client, /vatMode=\{vatDisplayMode\} label="Replacement price"/);
});


test('preview and save normalize fractional VAT amounts identically without whole-rand drift', () => {
  const preview = normalizeEstimateReplacementPrice(354499 / 1.15 + 20000);
  const saved = normalizeEstimateReplacementPrice(preview);
  assert.equal(saved, preview);
  assert.equal(Math.round(saved * 1.15), 377499);
  for (const file of ['app/api/generic-valuations/route.ts', 'app/api/valuation-runs/route.ts']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /normalizeEstimateReplacementPrice\(body.userReplacementPriceExVat\)/);
  }
  for (const invalid of [null, '', -1, Infinity, 'invalid']) assert.equal(normalizeEstimateReplacementPrice(invalid), null);
});
