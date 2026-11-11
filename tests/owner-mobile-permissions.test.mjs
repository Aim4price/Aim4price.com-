import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
function load(path, dependencies) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type, props) => ({ type, props });
  new Function('require', 'exports', js)((name) => dependencies[name] ?? (name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : { __esModule: true, default: name.endsWith('.css') ? {} : name }), exports);
  return exports;
}
function links(node) {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(links);
  if (typeof node !== 'object') return [];
  return [...(node.props?.href ? [node.props.href] : []), ...links(node.props?.children)];
}
for (const [role, permissions] of [['admin', ['view', 'operate', 'manage_assets', 'manage_marketplace']], ['operations', ['view', 'operate']], ['view_only', ['view']]]) {
  test(`${role} home and More expose only permitted actions`, async () => {
    const access = { ownerUserId: 'owner', displayName: 'Test owner', permissions };
    const auth = { requireOwnerAppPageAccess: async () => access, ownerAppCan: (_, permission) => permissions.includes(permission) || (permissions.includes('operate') && ['recordFuelIssues','addFuel','recordMaintenance','viewMaintenance'].includes(permission)) };
    const home = load('app/owner-app/page.tsx', { '../../lib/owner-app-access': auth });
    const more = load('app/owner-app/more/page.tsx', { '../../../lib/owner-app-access': auth });
    const homeLinks = links(await home.default());
    const moreLinks = links(await more.default());
    assert.equal(homeLinks.includes('/owner-app/operations/fuel'), permissions.includes('operate'));
    assert.equal(homeLinks.includes('/owner-app/report-problem'), permissions.includes('operate'));
    assert.equal(homeLinks.includes('/owner-app/assets/add'), permissions.includes('manage_assets'));
    assert.equal(moreLinks.includes('/owner-app/valuation'), permissions.includes('manage_assets'));
    assert.equal(moreLinks.includes('/owner-app/marketplace'), permissions.includes('manage_marketplace'));
    assert.ok(homeLinks.includes('/owner-app/assets'));
    assert.ok(moreLinks.includes('/owner-app/discovery'));
  });
}
test('maintenance shortcut preserves scope and operation permissions', async () => {
  for (const [canOperate, canAccess, expected] of [[true, true, '/owner-app/operations/maintenance/a'], [false, true, null], [true, false, 'notFound']]) {
    const page = load('app/owner-app/assets/[assetId]/page.tsx', {
      '../../../../lib/owner-app-access': { requireOwnerAppPageAccess: async () => ({}), ownerAppCan: () => canOperate, ownerAppCanAccessAsset: () => canAccess },
      'next/navigation': { redirect: path => { throw new Error(path); }, notFound: () => { throw new Error('notFound'); } },
    });
    const run = () => page.default({ params: { assetId: 'a' }, searchParams: { action: 'record' } });
    if (expected) await assert.rejects(run, error => error.message === expected); else await run();
  }
});
test('manual capture keeps not-applicable usage empty and enforces create permission', async () => {
  let saved;
  let allowed = true;
  const route = load('app/api/owner-app/assets/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    '../../../../lib/owner-app-access': { getOwnerAppAccess: async () => ({ ownerUserId: 'owner' }), ownerAppCan: () => allowed },
    '../../../../lib/asset-register-db': { createManualAssetRegisterItem: async (_, input) => { saved = input; return { id: 'new' }; } },
  });
  const request = metric => ({ json: async () => ({ title: 'Test asset', value: 100, replacementPriceExVat: 200, usageMetric: metric, hours: 123, registerId: 'register' }) });
  assert.equal((await route.POST(request('not_applicable'))).status, 200);
  assert.equal(saved.hours, null);
  assert.equal(saved.usageMetric, null);
  assert.equal(saved.specsJson.usageApplicable, false);
  assert.equal(saved.specsJson.usageTypeConfirmed, true);
  assert.equal((await route.POST(request('km'))).status, 200);
  assert.equal(saved.hours, 123);
  assert.equal(saved.usageMetric, 'km');
  saved = null;
  allowed = false;
  assert.equal((await route.POST(request('hours'))).status, 403);
  assert.equal(saved, null);
});
