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

test('confirmed usage changes override legacy family defaults and require a fresh reading', async () => {
  const { confirmedUsageTypeChange } = await loadModule('asset-usage');
  const old = {kind:'equipment', hours:5000, specsJson:{usageBasis:'reading', usageMetric:'hours'}};
  const next = {kind:'equipment', hours:120, specsJson:{usageBasis:'reading', usageMetric:'km', usageTypeConfirmed:true}};
  assert.deepEqual(confirmedUsageTypeChange(old,next,true), {metric:'km',value:120});
  assert.equal(confirmedUsageTypeChange(old,next,false), null);
  assert.equal(confirmedUsageTypeChange(old,{...old,hours:10},true), null, 'confirmation must not bypass same-unit decrease protection');
  assert.throws(()=>confirmedUsageTypeChange(old,{...next,hours:null},true), /USAGE_TYPE_READING_REQUIRED/);
  const percent={lifeWorkedPercent:35,specsJson:{usageBasis:'percent',usageTypeConfirmed:true}};
  assert.deepEqual(confirmedUsageTypeChange(old,percent,true),{metric:'percentage',value:35});
  assert.throws(()=>confirmedUsageTypeChange(old,{...percent,lifeWorkedPercent:101},true),/USAGE_TYPE_READING_REQUIRED/);
  assert.deepEqual(confirmedUsageTypeChange(old,{hours:null,specsJson:{usageBasis:'not_applicable'}},true),{metric:'not_applicable',value:null});
  assert.deepEqual(resolveAssetUsage({kind:'vehicle',hours:42,specsJson:{usageBasis:'reading',usageMetric:'hours',usageTypeConfirmed:true}}),{metric:'hours',value:42});
  assert.deepEqual(resolveAssetUsage({...next, specsJson:{...next.specsJson,usageMetricType:'wear_class'}}),{metric:'km',value:120});
});
