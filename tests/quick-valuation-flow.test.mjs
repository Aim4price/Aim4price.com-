import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const quickFlow = await readFile(new URL('../app/valuation/quick-valuation-client.tsx', import.meta.url), 'utf8');
const publicPage = await readFile(new URL('../app/valuation/page.tsx', import.meta.url), 'utf8');
const dealerPage = await readFile(new URL('../app/dealer/valuation/page.tsx', import.meta.url), 'utf8');
const ownerPage = await readFile(new URL('../app/owner-app/valuation/page.tsx', import.meta.url), 'utf8');

test('valuation entry points use the streamlined quick flow', () => {
  assert.match(publicPage, /quick-valuation-client/);
  assert.match(dealerPage, /quick-valuation-client/);
  assert.match(ownerPage, /quick-valuation-client/);
  assert.match(dealerPage, /<ValuationClient dealerAppMode \/>/);
  assert.match(ownerPage, /<ValuationClient ownerAppMode \/>/);
});

test('quick and detailed estimate coexist without a second valuation engine', () => {
  assert.match(quickFlow, /Quick Estimate/);
  assert.match(quickFlow, /Detailed Estimate/);
  assert.match(quickFlow, /Coming soon/);
  assert.doesNotMatch(quickFlow, /Choose estimate path/);
  assert.match(quickFlow, /\/api\/generic-valuations/);
  assert.match(quickFlow, /\/api\/tractor-valuations/);
  assert.match(quickFlow, /\/api\/valuation-runs/);
});

test('model is typed or unknown instead of blocking on a complete catalogue', () => {
  assert.match(quickFlow, /Model <small[^>]*>\(optional\)<\/small>/);
  assert.match(quickFlow, /I don’t know the model/);
  assert.match(quickFlow, /modelMode === 'manual'/);
  assert.match(quickFlow, /saveModelCandidate: modelMode === 'manual'/);
});

test('popularity and tractor extras remain mandatory before replacement price', () => {
  assert.match(quickFlow, /Choose a popularity rating from 1 to 5 stars/);
  assert.match(quickFlow, /Confirm the tractor extras before getting an estimate/);
  assert.match(quickFlow, /No listed extras/);
  assert.match(quickFlow, /Front PTO/);
  assert.match(quickFlow, /Front Loader/);
  assert.match(quickFlow, />GPS</);
  assert.match(quickFlow, /advancedAssumptions: \{ popularityStars \}/);
});

test('replacement price is confirmed before the existing valuation calculation', () => {
  assert.match(quickFlow, /prepareReplacementPrice/);
  assert.match(quickFlow, /Aim4price replacement-price position/);
  assert.match(quickFlow, /Replacement price excl\. VAT/);
  assert.match(quickFlow, /no false range is being shown/i);
  assert.match(quickFlow, /replacementEdited \? Math\.round\(selectedReplacement\) : null/);
});
