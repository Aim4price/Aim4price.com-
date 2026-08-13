import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const client = read('app/asset-register/asset-register-client.tsx');
const styles = read('app/asset-register/page.module.css');
const route = read('app/api/asset-register/projection/route.ts');
const projection = read('lib/asset-register-projection.ts');
const sharedValuation = read('lib/valuation/shared.ts');

test('quick inflation offers 3%, shows the active choice, and recalculates immediately', () => {
  assert.match(client, /PROJECTION_INFLATION_PRESETS\s*=\s*\['3', '5', '8', '10'\]/);
  assert.match(client, /Choose a rate to recalculate instantly\./);
  assert.match(client, /aria-pressed=/);
  assert.match(client, /void requestProjection\(projectionAsset, nextForm\)/);
  assert.match(styles, /\.projectionPresetButtonActive/);
});

test('future condition uses the same retained-value percentages as the estimate page', () => {
  for (const [condition, factor] of [
    ['excellent', '0.95'],
    ['good', '0.85'],
    ['fair', '0.75'],
    ['used', '0.65'],
    ['serious', '0.55'],
  ]) {
    assert.match(sharedValuation, new RegExp(`${condition}:\\s*${factor.replace('.', '\\.')}\\b`));
  }

  assert.match(client, /PROJECTION_CONDITION_OPTIONS\s*=\s*conditionOptions\.map/);
  assert.match(client, /Future condition/);
  assert.doesNotMatch(client, /option\.retainedPercent/);
  assert.match(route, /CONDITION_KEYS:[^\n]*\['excellent', 'good', 'fair', 'used', 'serious'\]/);
  assert.match(route, /Choose a valid future condition\./);
  assert.match(route, /calculateFuturePriceForAsset\(\{[\s\S]*targetCondition/);
});

test('projection anchoring keeps the saved condition current and applies the selected future condition', () => {
  assert.equal((projection.match(/condition: currentCondition/g) ?? []).length, 3);
  assert.equal((projection.match(/condition: targetCondition/g) ?? []).length, 3);
  assert.match(projection, /currentCondition:\s*input\.currentCondition/);
  assert.match(projection, /targetCondition:\s*input\.targetCondition/);
});

test('front-loader projections use the saved loader year and replacement price independently', () => {
  assert.match(projection, /input\.valuationInput\.frontLoaderYear/);
  assert.match(projection, /input\.valuationInput\.frontLoaderReplacementPriceExVat/);
  assert.match(projection, /input\.valuationOutput\.frontLoaderReplacementPriceExVat/);
  assert.match(projection, /loaderValueAtYear\([\s\S]*?input\.frontLoaderYear/);
  assert.doesNotMatch(projection, /loaderValueAtYear\(input\.powerKw, input\.yearModel/);
});
