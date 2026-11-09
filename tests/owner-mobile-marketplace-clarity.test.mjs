import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../app/marketplace/marketplace-client.tsx', import.meta.url), 'utf8');
const names = ['isListingTitleMetaPart', 'cleanListingTitleMeta', 'listingDisplayTitle', 'formatLocation', 'formatPercent', 'getListingWorkedPercent', 'getResolvedUsageUnit', 'formatUsage'];
const ast = ts.createSourceFile('client.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const selected = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join('\n');
const code = ts.transpileModule(selected, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const helpers = new Function(`${code}; return { ${names.join(',')} };`)();
test('listing locations do not repeat provinces or lose useful area information', () => {
  assert.equal(helpers.formatLocation({ area: 'Western Cape', province: 'Western Cape' }), 'Western Cape');
  assert.equal(helpers.formatLocation({ area: 'George, Western Cape Za', province: 'Western Cape' }), 'George, Western Cape Za');
  assert.equal(helpers.formatLocation({ area: 'George', province: 'Western Cape' }), 'George, Western Cape');
  assert.equal(helpers.formatLocation({ area: 'western cape', province: 'Western Cape' }), 'western cape');
});
test('legacy summary fragments leave the actual advert title intact', () => {
  assert.equal(helpers.listingDisplayTitle({ title: '2.5-Cube Dam Scoop · Year not set · 60%' }), '2.5-Cube Dam Scoop');
  assert.equal(helpers.listingDisplayTitle({ title: 'Year Unknown Zimmatic 6-Tower + Overhang' }), 'Zimmatic 6-Tower + Overhang');
  assert.equal(helpers.listingDisplayTitle({ title: '2014 Agrico Track Filler PT · 30% · Includes trailer' }), '2014 Agrico Track Filler PT · Includes trailer');
  assert.equal(helpers.listingDisplayTitle({ title: 'Tractor · Limited edition' }), 'Tractor · Limited edition');
});
test('missing percentage readings never become a false zero, while saved zero remains valid', () => {
  for (const lifeWorkedPercent of [null, undefined, '', ' ', 'invalid']) {
    assert.equal(helpers.getListingWorkedPercent({ lifeWorkedPercent }), null);
    assert.equal(helpers.formatUsage({ usageUnit: 'percent', lifeWorkedPercent }), 'Percentage not set');
  }
  assert.equal(helpers.formatUsage({ usageUnit: 'percent', lifeWorkedPercent: 0 }), '0% worked');
  assert.equal(helpers.formatUsage({ usageUnit: 'percent', lifeWorkedPercent: 30 }), '30% worked');
  assert.equal(helpers.formatUsage({ usageUnit: 'km', hours: 123000, lifeWorkedPercent: null }), '123\u00a0000 km');
});
