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

function nodes(node) {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node !== 'object') return [];
  return [node, ...nodes(node.props?.children)];
}
for (const role of ['admin', 'manager', 'office', 'workshop', 'operator', 'view_only']) {
  test(`${role} uses the original mobile asset directory, never the desktop workspace`, async () => {
    const page = load('app/owner-app/assets/page.tsx', {
      '../../../lib/owner-app-access': {
        requireOwnerAppPageAccess: async () => ({ accessRole: role, sessionKind: role === 'admin' ? 'account' : 'owner-app-user' }),
        ownerAppCan: () => role === 'admin',
      },
    });
    const result = nodes(await page.default({searchParams: {q: 'Baler'}}));
    const directory = result.find(n => n.type === './owner-assets-client');
    assert.ok(directory);
    assert.equal(directory.props.initialQuery, 'Baler');
    assert.equal(directory.props.canAddAssets, role === 'admin');
    assert.ok(result.every(n => !String(n.type).includes('team-workspace')));
  });
}
test('restricted home actions keep the same mobile layout without actionable links', async () => {
  const render = async allowed => {
    const page = load('app/owner-app/page.tsx', {'../../lib/owner-app-access': {
      requireOwnerAppPageAccess: async () => ({ displayName: 'Staff' }), ownerAppCan: () => allowed,
    }});
    return nodes(await page.default());
  };
  const allowed = await render(true), restricted = await render(false);
  const labels = list => list.filter(n => n.type === 'strong').map(n => n.props.children);
  assert.deepEqual(labels(restricted), labels(allowed));
  assert.equal(restricted.filter(n => n.props?.['aria-disabled']).length, 4);
  assert.ok(!restricted.some(n => n.props?.href === '/owner-app/operations/fuel'));
});
test('saved workspace links stay in mobile flows and never mount desktop pages', async () => {
  for (const [section, destination] of Object.entries({fuel:'operations/fuel',maintenance:'attention',costs:'more',budgets:'more',map:'assets',documents:'assets'})) {
    const page = load('app/owner-app/workspace/[section]/page.tsx', {
      '../../../../lib/owner-app-access': {requireOwnerAppPageAccess: async () => ({})},
      'next/navigation': {redirect: value => {throw Error(value)}, notFound: () => {throw Error('notFound')}},
    });
    await assert.rejects(() => page.default({params:{section}}), {message:'/owner-app/' + destination});
  }
  for (const path of ['app/owner-app/assets/page.tsx','app/owner-app/workspace/[section]/page.tsx']) {
    assert.doesNotMatch(readFileSync(path,'utf8'), /TeamWorkspaceClient|DesktopWorkspaceProvider|import .* from ['"].*(?:fuel-client|my-invoices-client|documents-client|asset-map-client|maintenance-client)/);
  }
  assert.doesNotMatch(readFileSync('app/owner-app/more/page.tsx','utf8'), /\/owner-app\/workspace\//);
});
