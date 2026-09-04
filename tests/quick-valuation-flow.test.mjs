import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [client, publicPage, dealerPage, ownerPage, serverValuation] = await Promise.all([
  read('app/valuation/quick-valuation-client.tsx'),
  read('app/valuation/page.tsx'),
  read('app/dealer/valuation/page.tsx'),
  read('app/owner-app/valuation/page.tsx'),
  read('lib/server-valuation.ts'),
]);

test('plain Get Estimate and Owner app use Quick while specialist and Dealer workflows keep mature fallbacks', () => {
  assert.match(publicPage, /QuickValuationClient/);
  assert.match(publicPage, /ValuationClient/);
  assert.match(publicPage, /hasSpecialistValuationContext/);
  assert.match(publicPage, /return <ValuationClient \/>/);
  assert.match(publicPage, /return <QuickValuationClient \/>/);
  assert.match(dealerPage, /<ValuationClient dealerAppMode \/>/);
  assert.match(ownerPage, /QuickValuationClient/);
  assert.match(ownerPage, /mode === 'detailed'/);
  assert.match(ownerPage, /<ValuationClient ownerAppMode \/> : <QuickValuationClient ownerAppMode \/>/);
});

test('specialist valuation URLs retain register, accountant, conversion and Marketplace behaviour', () => {
  for (const param of [
    'accountantShareId',
    'registerId',
    'dealerRegisterMode',
    'convertAssetId',
    'conversionAssetId',
    'conversion',
    'marketplace',
    'marketplaceListing',
  ]) {
    assert.match(publicPage, new RegExp(`"${param}"`));
  }
});

test('quick estimate removes the customer-facing path/spec decision', () => {
  assert.match(client, /Asset.*Details.*Replacement.*Estimate/s);
  assert.doesNotMatch(client, /label: 'Path'/);
  assert.doesNotMatch(client, /label: 'Specs'/);
  assert.match(client, /Detailed Estimate/);
  assert.match(client, /Coming soon/);
});

test('model is optional, free text and can be unknown without blocking the flow', () => {
  assert.match(client, /Model.*\(optional\)/s);
  assert.match(client, /onModelInputChange/);
  assert.match(client, /I don't know the model/);
  assert.match(client, /saveModelCandidate/);
  assert.match(client, /equipmentModelId: selectedModel\?\.id \?\? null/);
});

test('basic details retain required popularity and tractor extras', () => {
  assert.match(client, /if \(popularityStars < 1 \|\| popularityStars > 5\)/);
  assert.match(client, /Popularity/);
  assert.match(client, /Tractor extras/);
  assert.match(client, /Front PTO/);
  assert.match(client, /Front loader/);
  assert.match(client, /GPS/);
  assert.match(client, /Other extra/);
});

test('replacement price is confirmed before the existing valuation APIs run', () => {
  const replacementPosition = client.indexOf('function renderReplacementStep');
  const calculatePosition = client.indexOf('async function calculateEstimate');
  assert.ok(replacementPosition > -1);
  assert.ok(calculatePosition > -1);
  assert.match(client, /replacement-price-bands/);
  assert.match(client, /type="range"/);
  assert.match(client, /Replacement price excl\. VAT/);
  assert.match(client, /Confirm or enter a replacement price before calculating the estimate/);
  assert.match(client, /\/api\/tractor-valuations/);
  assert.match(client, /\/api\/generic-valuations/);
});

test('tractor engine keeps Aim4price basis when model price falls back to a broad saved band', () => {
  assert.match(serverValuation, /left join lateral/);
  assert.match(serverValuation, /public\.replacement_price_bands/);
  assert.match(serverValuation, /nullif\(em\.aim4price_replacement_price_ex_vat, 0\)/);
  assert.match(serverValuation, /coalesce\(rpb\.spec_match_json, '\{\}'::jsonb\) = '\{\}'::jsonb/);
  assert.match(serverValuation, /replacementPriceBasis: Result\['replacementPriceBasis'\] = userReplacementPriceExVat \? 'user' : 'aim4price'/);
});

test('saving still uses the existing valuation run to Asset Register path', () => {
  assert.match(client, /\/api\/valuation-runs/);
  assert.match(client, /selectedMethod: 'aim4price'/);
  assert.match(client, /Save to Asset Register/);
});
