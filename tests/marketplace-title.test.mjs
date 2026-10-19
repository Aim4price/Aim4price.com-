import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const module = { exports: {} };
new Function('exports', compile(readFileSync(new URL('../lib/marketplace-title.ts', import.meta.url), 'utf8')))(module.exports);
const normalize = module.exports.normalizeMarketplaceTitle;
const source = readFileSync(new URL('../lib/marketplace-db.ts', import.meta.url), 'utf8');
const start = source.indexOf('  if (marketplaceTitle !== undefined) {');
const code = compile(source.slice(start, source.indexOf('  const incomingPhotos', start)));
function update(value) {
  const assignments = [], values = ['owner', 'asset'];
  new Function('marketplaceTitle', 'updateValues', 'updateAssignments', code)(normalize(value), values, assignments);
  return { assignments, values };
}
test('advert titles are trimmed, without losing punctuation or Unicode', () => {
  assert.equal(normalize('  JCB   3DX – excellent condition  '), 'JCB 3DX – excellent condition');
});
test('blank, invalid and overlong titles are rejected', () => {
  for (const value of ['', '  ', null, 123, 'a'.repeat(161)]) assert.throws(() => normalize(value));
  assert.equal(normalize('a'.repeat(160)).length, 160);
});
test('older callers that omit a title preserve the saved advert title', () => {
  assert.deepEqual(update(undefined), { assignments: [], values: ['owner', 'asset'] });
});
test('custom titles are parameterized and never update the asset name', () => {
  assert.deepEqual(update("Owner's tractor"), { assignments: ['marketplace_title = $3'], values: ['owner', 'asset', "Owner's tractor"] });
});
test('marketplace cards and history snapshots use the stored advert title', () => {
  const start = source.indexOf('function buildMarketplaceListingTitle(');
  const body = source.slice(start, source.indexOf('async function createMarketplaceListingSnapshot', start));
  const build = new Function('asText', 'deriveBrandAndModel', 'assetDisplayTitle', 'pick', 'pickJsonObject', `${compile(body)}; return buildMarketplaceListingTitle;`)(v=>String(v??'').trim(), ()=>({brandName:'',modelName:''}), v=>v.title, (row,keys)=>row[keys[0]], ()=>({}));
  assert.equal(build({title:'Register tractor',marketplace_title:'Tractor for sale'}), 'Tractor for sale');
  assert.equal(build({title:'Register tractor'}), 'Register tractor');
});
