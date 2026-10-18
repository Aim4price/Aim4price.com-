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
test('public and archived adverts do not expose gallery photos', () => {
  assert.deepEqual(exports.mapAdvert(row, false).imageUrls, []);
  for (const advert_status of ['sold','ended']) assert.deepEqual(exports.mapAdvert({...row, advert_status}, true).imageUrls, []);
});
