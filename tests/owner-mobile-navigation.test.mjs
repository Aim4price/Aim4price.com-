import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source = readFileSync('app/owner-app/owner-navigation.ts', 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function('exports', output)(loaded.exports);
const { ownerNavigationSection } = loaded.exports;

test('main and nested browsing screens highlight their destination', () => {
  for (const [path, expected] of [
    ['/owner-app', 'home'], ['/owner-app/', 'home'], ['/owner-app/notifications', 'home'],
    ['/owner-app/assets', 'assets'], ['/owner-app/assets/asset-123', 'assets'], ['/owner-app/assets/asset-123/details', 'assets'],
    ['/owner-app/operations/fuel/storage', 'work'], ['/owner-app/report-problem', 'work'],
    ['/owner-app/more', 'more'], ['/owner-app/marketplace', 'more'], ['/owner-app/discovery', 'more'],
  ]) assert.equal(ownerNavigationSection(path), expected, path);
});
test('login, capture flows, shared routes and unrelated apps never show global navigation', () => {
  for (const path of ['/owner-app/login', '/owner-app/assets/add', '/owner-app/assets/add/manual', '/owner-app/valuation', '/owner-app/marketplace/create', '/owner-app/assets/a/manage', '/owner-app/assets/a/manage/usage', '/owner-app/assets/a/options', '/owner-app/assets/a/maintenance', '/owner-app/operations/maintenance/a', '/owner-app/operations/fuel/petrol-station', '/owner-app/operations/fuel/FUEL-123', '/dealer', '/owner-application']) assert.equal(ownerNavigationSection(path), null, path);
});
