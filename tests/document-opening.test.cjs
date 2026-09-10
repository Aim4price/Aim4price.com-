const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
function load(file, mocks) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText;
  new Function('require', 'exports', code)(name => name in mocks ? mocks[name] : require(name), exports);
  return exports;
}
function fixture({ rows = [{ asset_id: 'asset', upload_id: 'legacy-id' }], denied = false, signedIn = true, status = 'ready' } = {}) {
  const calls = [];
  const route = load('app/api/fuel/documents/download/route.ts', {
    '../../../../../lib/owner-workspace-access': {
      resolveOwnerWorkspaceContext: async () => signedIn ? { ok: true, context: { ownerUserId: 'owner' } } : { ok: false, response: new NextResponse('', { status: 401 }) },
      assertWorkspaceAssetAccess: async () => { if (denied) throw Error('Access denied'); },
    },
    '../../../../../lib/db': { getDb: () => ({ query: async (sql, params) => { calls.push({ sql, params }); return { rows }; } }) },
    '../../../../../lib/asset-register-uploads': { resolveAssetRegisterUploadBytes: async id => { calls.push(id); return { status, upload: { data: Buffer.from('%PDF-test'), mimeType: 'application/pdf', fileName: 'old receipt.pdf' } }; } },
    '../../../../../lib/my-invoices': { getInvoiceDocumentUpload: async args => { calls.push(args); return { data: Buffer.from('%PDF-invoice'), contentType: 'application/pdf', fileName: 'invoice.pdf' }; } },
  });
  return { calls, open: source => route.GET(new NextRequest('https://www.aim4price.com/api/fuel/documents/download?source=' + encodeURIComponent(source))) };
}
test('saved legacy fuel attachment opens by stored upload ID with actual byte length', async () => {
  const { open, calls } = fixture();
  const source = 'https://old.aim4price.com/api/asset-register/uploads/legacy-id?download=1';
  const response = await open(source);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '%PDF-test');
  assert.equal(response.headers.get('content-length'), '9');
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(calls[0].params, ['owner', source]);
  assert.match(calls[0].sql, /public.fuel_storage_events/);
  assert.equal(calls[1], 'legacy-id');
});
test('fuel storage attachments without upload ID resolve their historical source', async () => {
  const { open, calls } = fixture({ rows: [{ asset_id: 'asset', upload_id: null }] });
  const source = '/api/asset-register/uploads/old-id';
  assert.equal((await open(source)).status, 200);
  assert.equal(calls[1], source);
});
test('invoice-backed fuel attachment retains invoice ownership resolution', async () => {
  const { open, calls } = fixture({ rows: [{ asset_id: 'asset', upload_id: null }] });
  assert.equal((await open('/api/my-invoices/documents/invoice-id/download')).status, 200);
  assert.deepEqual(calls[1], { userId: 'owner', documentId: 'invoice-id' });
});
test('unsigned, unrelated and out-of-register requests cannot read file bytes', async () => {
  for (const [options, expected] of [[{ signedIn: false }, 401], [{ rows: [] }, 404], [{ denied: true }, 404]]) {
    const { open, calls } = fixture(options);
    assert.equal((await open('https://untrusted.example/file')).status, expected);
    assert.ok(calls.every(call => typeof call === 'object' && 'sql' in call));
  }
});
test('storage outage differs from a genuinely missing original', async () => {
  assert.equal((await fixture({ status: 'unavailable' }).open('/api/asset-register/uploads/id')).status, 503);
  assert.equal((await fixture({ status: 'not_found' }).open('/api/asset-register/uploads/id')).status, 404);
});
test('file opener fetches with explicit app or website credentials before navigating', async () => {
  const prior = { window: global.window, fetch: global.fetch };
  try {
    for (const [pathname, realm] of [['/documents', 'website'], ['/owner-app/documents', 'owner']]) {
      const states = [], navigations = [], requests = [];
      global.window = { location: { origin: 'https://www.aim4price.com', pathname, href: 'https://www.aim4price.com' + pathname + '?accountantShareId=share' },
        open: () => ({ document: { body: {} }, location: { replace: value => navigations.push(value) }, close() {} }),
        setTimeout: callback => { callback(); },
      };
      global.fetch = async (url, options) => { requests.push({ url, options }); return new Response('%PDF-test', { headers: { 'content-type': 'application/pdf' } }); };
      const { default: Link } = load('components/DocumentFileLink.tsx', {
        react: { useState: value => [value, value => states.push(value)] },
        '../lib/app-realm': { appRealmForPath: path => path.startsWith('/owner-app') ? 'owner' : null },
      });
      const element = Link({ href: 'https://old.example/api/documents/doc/download', children: 'Open' });
      await element.props.children[0].props.onClick({ preventDefault() {} });
      assert.equal(requests[0].url.origin, 'https://www.aim4price.com');
      assert.equal(requests[0].options.headers['x-aim4price-client-realm'], realm);
      assert.equal(requests[0].options.credentials, 'include');
      assert.equal(requests[0].url.searchParams.get('accountantShareId'), 'share');
      assert.match(navigations[0], /^blob:/);
      assert.deepEqual(states, ['', true, false]);
    }
  } finally { global.window = prior.window; global.fetch = prior.fetch; }
});
