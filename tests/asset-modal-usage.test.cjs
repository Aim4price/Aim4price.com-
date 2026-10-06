const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const output = ts.transpileModule(fs.readFileSync('lib/asset-modal-usage.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const fixture = { exports: {} };
new Function('exports', 'module', output)(fixture.exports, fixture);
const { assetModalUsage } = fixture.exports;
test('asset modal metadata displays usage without year or condition', () => {
 assert.equal(assetModalUsage('Year Model: 2023 • Usage: 140 676 km • Condition: Good'), '140 676 km');
 assert.equal(assetModalUsage('Year Model: 2022 · Usage: 0 hours · Condition: New'), '0 hours');
 assert.equal(assetModalUsage('Current Usage: 60% • Condition: Used'), '60%');
 assert.equal(assetModalUsage('Year Model: 2023 • Condition: Good'), '');
 assert.equal(assetModalUsage(undefined), '');
});
test('group and workflow descriptions remain meaningful', () => {
 assert.equal(assetModalUsage('3 assets • Register value: R 100'), '3 assets • Register value: R 100');
 assert.equal(assetModalUsage('Choose a report to attach.'), 'Choose a report to attach.');
 assert.equal(assetModalUsage('140 676 km'), '140 676 km');
});
