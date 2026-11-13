import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const nativeRequire = createRequire(import.meta.url);
const source = readFileSync(new URL('../lib/recent-marketplace-adverts.ts', import.meta.url), 'utf8') + '\nexports.mapAdvert = mapAdvert;';
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('require', 'exports', code)(name => name.startsWith('node:') ? nativeRequire(name) : new Proxy({}, {get: () => () => ''}), exports);
const row = {id:'fixture', advert_status:'available', primary_image_url:'https://example.com/one.jpg', image_urls:['https://example.com/one.jpg','https://example.com/two.jpg','javascript:bad'], condition_label:'used'};
test('eligible live adverts expose ordered unique safe gallery photos', () => {
  assert.deepEqual(exports.mapAdvert(row, true).imageUrls, ['https://example.com/one.jpg','https://example.com/two.jpg']);
});
test('public live adverts match signed-in advert details while identity stays hidden', () => {
  const fixture = {...row, source_asset_id:'asset-id', title:'2013 Landini 5-100H',
    brand_name:'Landini', model_name:'5-100H', year_label:'2013',
    type_label:'Tractors', advertiser_name:'Private seller', area:'Private area',
    description:'Private contact copy'};
  const guest = exports.mapAdvert(fixture, false);
  const member = exports.mapAdvert(fixture, true);
  for (const key of ['title','brand','model','year','usage','condition','type','imageUrl','imageUrls','marketplaceHref']) {
    assert.deepEqual(guest[key], member[key], key);
  }
  assert.equal(guest.marketplaceHref, '/marketplace/browse?listing=asset-asset-id');
  assert.equal(guest.sourceAssetId, null);
  assert.notEqual(guest.id, fixture.id);
  assert.equal(guest.advertiserName, 'Advertiser details hidden');
  assert.equal(guest.area, 'Area hidden');
  assert.equal(guest.description, '');
  assert.equal(exports.mapAdvert(row, false).marketplaceHref, '/marketplace/browse?listing=fixture');
});
test('archived adverts never expose gallery photos or listing links', () => {
  for (const advert_status of ['sold','ended']) {
    for (const identityVisible of [true,false]) {
      const advert = exports.mapAdvert({...row, advert_status}, identityVisible);
      assert.deepEqual(advert.imageUrls, []);
      assert.equal(advert.imageUrl, '');
      assert.equal(advert.marketplaceHref, null);
    }
    const guest = exports.mapAdvert({...row, advert_status, title:'Private title', brand_name:'Private brand'}, false);
    assert.notEqual(guest.title, 'Private title');
    assert.notEqual(guest.brand, 'Private brand');
  }
});
