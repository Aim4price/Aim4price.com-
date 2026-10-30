import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../lib/showroom-presentation.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
new Function('exports', js)(exports);
const { showroomListingTitle: title, showroomListingDetails: details } = exports;
const listing = { title: '2013 Landini 5-100H · 2013 · 14 056 hours · Fair', yearModel: 2013, hours: 14056, usageUnit: 'hours', conditionLabel: 'Fair' };
test('showroom separates generated metadata from title without changing stored listing', () => {
 const before = JSON.stringify(listing);
 assert.equal(title(listing), 'Landini 5-100H');
 assert.equal(details(listing), '2013 · 14 056 hours · Fair');
 assert.equal(JSON.stringify(listing), before);
});
test('unknown fields and legacy zero defaults do not invent asset details', () => {
 const missing = { title: 'Forklift · Year not set · Usage not set · Used', yearModel: 0, hours: 0, usageUnit: 'hours', conditionLabel: 'Used' };
 assert.equal(title(missing), 'Forklift'); assert.equal(details(missing), 'Used');
 assert.equal(details({...missing, hours: NaN, conditionLabel: 'Condition not set'}), '');
});
test('percentage and kilometre readings retain their correct units', () => {
 assert.equal(details({...listing, usageUnit: 'percent', lifeWorkedPercent: 60}), '2013 · 60% worked · Fair');
 assert.equal(title({...listing, title: 'Scoop · Year Unknown · 60% · Fair', yearModel: 0, usageUnit: 'percent', lifeWorkedPercent: 60}), 'Scoop');
 assert.equal(details({...listing, hours: 200, usageUnit: 'km'}), '2013 · 200 km · Fair');
});
test('custom title fragments and model numbers are preserved', () => {
 assert.equal(title({...listing, title: 'Volvo 2013 · Recently serviced'}), 'Volvo 2013 · Recently serviced');
 assert.equal(title({...listing, title: 'Fair'}), 'Fair');
});
