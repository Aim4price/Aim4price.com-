import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
async function loadModule(path) {
  const source = await readFile(new URL(`../lib/${path}.ts`, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const { assetDisplayTitle } = await loadModule('asset-display-title');
const { resolveAssetUsage, formatResolvedAssetUsage } = await loadModule('asset-usage');

test('legacy family suffix is removed without losing model specifications', () => {
  assert.equal(assetDisplayTitle({
    title: '2022 New Holland TT4.90 4WD Openstation Small Field Tractor',
    modelName: 'TT4.90 4WD Openstation', familyLabel: 'Small Field Tractor',
  }), '2022 New Holland TT4.90 4WD Openstation');
  assert.equal(assetDisplayTitle({ title: '2022 Example Tractor', modelName: 'Tractor', familyLabel: 'Tractor' }), '2022 Example Tractor');
  assert.equal(assetDisplayTitle({ title: 'North field irrigation', modelName: '6-Tower', familyLabel: 'Irrigation systems' }), 'North field irrigation');
  assert.equal(assetDisplayTitle({ title: '2022 Example X Small Field Tractor', specsJson: { basic_family_label: 'Small Field Tractor' } }), '2022 Example X');
});

test('legacy advanced wear-class assets use percentage despite stale meter metadata', () => {
  for (const hours of [0, null, 1200]) {
    const usage = resolveAssetUsage({ kind: 'equipment', hours, lifeWorkedPercent: 50,
      specsJson: { usageBasis: 'reading', usageMetric: 'hours', usageMetricType: 'wear_class' } });
    assert.deepEqual(usage, { value: 50, metric: 'percentage' });
    assert.equal(formatResolvedAssetUsage(usage), '50%');
  }
  assert.equal(formatResolvedAssetUsage(resolveAssetUsage({ hours: 0, specsJson: { usage_metric_type: 'wear_class' } })), 'Not captured');
  assert.equal(formatResolvedAssetUsage(resolveAssetUsage({ hours: 0, lifeWorkedPercent: 0, specsJson: { usage_metric_type: 'wear_class' } })), '0%');
});

test('real meters and explicit Basic and not-applicable choices are preserved', () => {
  assert.deepEqual(resolveAssetUsage({ kind: 'tractor', hours: 1276, lifeWorkedPercent: 20, specsJson: { usageBasis: 'reading', usageMetricType: 'hours' } }), { value: 1276, metric: 'hours' });
  assert.deepEqual(resolveAssetUsage({ kind: 'vehicle', hours: 50000, specsJson: { usageBasis: 'reading', usageMetric: 'km' } }), { value: 50000, metric: 'km' });
  assert.deepEqual(resolveAssetUsage({ hours: 0, specsJson: { basic_catalogue_release: 'v1', usageBasis: 'reading', usageMetricType: 'wear_class' } }), { value: 0, metric: 'hours' });
  assert.deepEqual(resolveAssetUsage({ specsJson: { usageBasis: 'not_applicable', usageMetricType: 'wear_class' } }), { value: null, metric: 'not_applicable' });
});
