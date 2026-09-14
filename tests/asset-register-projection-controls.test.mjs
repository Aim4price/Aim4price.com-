import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const client = read('app/asset-register/asset-register-client.tsx');
const styles = read('app/asset-register/page.module.css');
const route = read('app/api/asset-register/projection/route.ts');
const projection = read('lib/asset-register-projection.ts');
const sharedValuation = read('lib/valuation/shared.ts');

test('quick inflation offers 3%, shows the active choice, and advances to usage', () => {
  assert.match(client, /PROJECTION_INFLATION_PRESETS\s*=\s*\['3', '5', '8', '10'\]/);
  assert.match(client, /advanceProjectionStep\(\{ inflationRatePct: rate \}\)/);
  assert.match(client, /aria-pressed=/);
  assert.match(client, /void requestProjection\(projectionAsset, nextForm\)/);
  assert.match(styles, /\.projectionPresetButtonActive/);
});

test('future condition uses the same retained-value percentages as the estimate page', () => {
  for (const [condition, factor] of [
    ['excellent', '1'],
    ['good', '0.9'],
    ['fair', '0.7'],
    ['used', '0.45'],
    ['serious', '0.25'],
  ]) {
    assert.match(sharedValuation, new RegExp(`${condition}:\\s*${factor.replace('.', '\\.')}\\b`));
  }

  assert.match(client, /PROJECTION_CONDITION_OPTIONS\s*=\s*conditionOptions\.map/);
  assert.match(client, /What will its future condition be\?/);
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

test('the future price wizard validates inputs and submits the final condition without stale state', async () => {
  const { createRequire } = await import('node:module');
  const ts = createRequire(import.meta.url)('typescript');
  const source = client.slice(client.indexOf('  function advanceProjectionStep('), client.indexOf('  function handlePageSizeChange('));
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const run = new Function('state', `
    let { projectionStep, projectionForm, projectionAsset } = state;
    const projectionRequestRef = {current: 1};
    const assetUsesPercentUsage = asset => asset.percent;
    const getAssetLifeWorkedPercent = asset => asset.worked;
    const setProjectionError = value => { state.error = value; };
    const setProjectionResult = value => { state.result = value; };
    const setIsLoadingProjection = value => { state.loading = value; };
    const updateProjectionForm = patch => { state.form = {...projectionForm, ...patch}; state.error = null; };
    const setProjectionStep = value => { state.step = value; };
    const requestProjection = (asset, form) => { state.request = form; };
    ${js}
    if(state.back) goBackProjection(); else advanceProjectionStep(state.patch);
    return state;
  `);
  const base = { projectionForm: {targetYear:'2028', inflationRatePct:'5', extraHours:'', targetLifeWorkedPercent:'50', targetCondition:'good'}, projectionAsset:{percent:false,worked:40} };
  assert.equal(run({...base,projectionStep:1,patch:{targetYear:'2030'}}).step,2);
  const rate = run({...base,projectionStep:2,patch:{inflationRatePct:'8'}});
  assert.equal(rate.step,3);
  assert.equal(rate.request,undefined);
  assert.ok(run({...base,projectionStep:2,patch:{inflationRatePct:''}}).error);
  assert.ok(run({...base,projectionStep:3,patch:{extraHours:'-1'}}).error);
  assert.equal(run({...base,projectionStep:3,patch:{extraHours:'0'}}).step,4);
  assert.ok(run({...base,projectionAsset:{percent:true,worked:40},projectionStep:3,patch:{targetLifeWorkedPercent:'39'}}).error);
  assert.equal(run({...base,projectionAsset:{percent:true,worked:40},projectionStep:3,patch:{targetLifeWorkedPercent:'60'}}).step,4);
  const final = run({...base,projectionStep:4,patch:{targetCondition:'fair'}});
  assert.equal(final.step,'result');
  assert.equal(final.request.targetCondition,'fair');
  assert.equal(final.request.inflationRatePct,'5');
  const back = run({...base,projectionStep:'result',back:true});
  assert.equal(back.step,4);
  assert.equal(back.loading,false);
  assert.equal(back.result,null);
});
