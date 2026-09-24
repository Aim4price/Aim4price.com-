import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { selectReportLogoUrl } from '../lib/report-branding.ts';

const business = 'data:image/png;base64,QlVTSU5FU1M=';
const registerLogo = 'data:image/png;base64,UkVHSVNURVI=';
const hiddenRegister = { id: 'asset-register', logoUrls: [registerLogo], showLogosOnRegister: false };
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const compile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
} }).outputText;

function functionsFrom(path, names) {
  const source = read(path);
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  return ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join('\n');
}
function brandingLookup({ profileLogo = business, assetExists = true } = {}) {
  const queries = [], selected = [];
  const names = ['cleanText', 'normalizeRegisterName', 'normalizePhone', 'normalizeAddress', 'normalizeLogoUrls', 'readProfileDefaults', 'getAssetRegisterReportLogoUrl'];
  const exports = {};
  vm.runInNewContext(compile(functionsFrom('lib/asset-registers.ts', names) + '\nexports.normalizeLogoUrls = normalizeLogoUrls;'), {
    exports, Set, selectReportLogoUrl, MAX_ASSET_REGISTER_LOGOS: 1, MAX_ASSET_REGISTER_LOGO_URL_LENGTH: 8000000,
    getDb: () => ({ query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('account_profiles')) return { rows: [{ logo_url: profileLogo }] };
      assert.match(sql, /where user_id = \$1 and id::text = \$2/);
      return { rows: assetExists ? [{ register_id: 'asset-register' }] : [] };
    } }),
    getAssetRegisterForUser: async (userId, registerId) => { selected.push({ userId, registerId }); return hiddenRegister; },
    getSelectedAssetRegister: async userId => { selected.push({ userId, registerId: 'selected' }); return hiddenRegister; },
  });
  return { ...exports, queries, selected };
}

test('business logo has priority; register visibility does not suppress report branding', () => {
  assert.equal(selectReportLogoUrl(business, hiddenRegister), business);
  assert.equal(selectReportLogoUrl(' ', hiddenRegister), registerLogo);
  assert.equal(selectReportLogoUrl('', null), '');
});
test('embedded profile logos preserve the comma and image bytes', () => {
  const lookup = brandingLookup();
  assert.deepEqual(Array.from(lookup.normalizeLogoUrls(business)), [business]);
  assert.deepEqual(Array.from(lookup.normalizeLogoUrls(JSON.stringify([registerLogo]))), [registerLogo]);
});
test('server reports use the business logo without borrowing another register logo', async () => {
  const lookup = brandingLookup();
  assert.equal(await lookup.getAssetRegisterReportLogoUrl('owner', 'asset-register'), business);
  assert.equal(lookup.selected.length, 0);
  assert.deepEqual(Array.from(lookup.queries[0].params), ['owner']);
});
test('single-asset fallback uses the asset register rather than the currently selected register', async () => {
  const lookup = brandingLookup({ profileLogo: '' });
  assert.equal(await lookup.getAssetRegisterReportLogoUrl('owner', null, 'asset-123'), registerLogo);
  assert.deepEqual(lookup.selected, [{ userId: 'owner', registerId: 'asset-register' }]);
  assert.deepEqual(Array.from(lookup.queries[1].params), ['owner', 'asset-123']);
});
test('register fallback is scoped to the owner and still works when card logos are hidden', async () => {
  const lookup = brandingLookup({ profileLogo: '' });
  assert.equal(await lookup.getAssetRegisterReportLogoUrl('owner', 'requested-register'), registerLogo);
  assert.deepEqual(lookup.selected, [{ userId: 'owner', registerId: 'requested-register' }]);
});
test('an inaccessible asset cannot select another register logo', async () => {
  const lookup = brandingLookup({ profileLogo: '', assetExists: false });
  assert.equal(await lookup.getAssetRegisterReportLogoUrl('owner', null, 'other-owner-asset'), '');
  assert.equal(lookup.selected.length, 0);
});

function clientLogoPreparation(failed = []) {
  const requests = [], exports = {};
  vm.runInNewContext(compile(functionsFrom('app/asset-register/asset-register-client.tsx', ['prepareReportLogo']) + '\nexports.prepareReportLogo = prepareReportLogo;'), {
    exports, selectReportLogoUrl, PRINT_LOGO_MAX_DIMENSION: 900,
    toAbsoluteUrl: value => value,
    preparePrintableImageUrl: async (url, options) => {
      requests.push(url);
      assert.equal(options.requireEmbedded, true);
      return failed.includes(url) ? null : 'embedded:' + url;
    },
  });
  return { ...exports, requests };
}
test('client valuation embeds the business logo first', async () => {
  const client = clientLogoPreparation();
  assert.equal(await client.prepareReportLogo(business, hiddenRegister), 'embedded:' + business);
  assert.deepEqual(client.requests, [business]);
});
test('unloadable business logos fall back to the embedded register logo', async () => {
  const client = clientLogoPreparation([business]);
  assert.equal(await client.prepareReportLogo(business, hiddenRegister), 'embedded:' + registerLogo);
  assert.deepEqual(client.requests, [business, registerLogo]);
});
test('reports keep the Aim4price fallback when neither custom logo can load', async () => {
  const client = clientLogoPreparation([business, registerLogo]);
  assert.equal(await client.prepareReportLogo(business, hiddenRegister), 'embedded:/brand/aim4price-mark-black.png');
});

test('authenticated estimate reports load branding from the account, not the submitted payload', async () => {
  const exports = {};
  class NextResponse extends Response { static json(body, init) { return new Response(JSON.stringify(body), init); } }
  const seen = [];
  let signedIn = true;
  const mocks = {
    'next/server': { NextResponse },
    '../../../../lib/estimate-breakdown-access': { canUseEstimateBreakdown: () => assert.fail('Ordinary reports must not request private access') },
    '../../../../lib/estimate-breakdown-token': { verifyEstimateBreakdown: () => assert.fail('Ordinary reports have no breakdown token') },
    '../../../../lib/estimate-breakdown-report': { appendEstimateBreakdownHtml: () => assert.fail('Ordinary reports must retain the original template') },
    '../../../../lib/private-estimate-settings': { privateEstimateSettingsNotes: () => assert.fail('Ordinary reports have no custom settings') },
    '../../../../lib/report-theme.ts': { REPORT_THEME_CSS: '' },
    '../../../../lib/auth-session': { getServerSession: async () => signedIn ? { user: { id: 'owner' } } : null },
    '../../../../lib/asset-registers': { getAssetRegisterReportLogoUrl: async userId => { seen.push(userId); return business; } },
    '../../../../lib/report-logo': { resolveReportLogoUrlForHtml: async url => url || 'data:image/png;base64,RkFMTEJBQ0s=' },
  };
  vm.runInNewContext(compile(read('app/api/valuation/report/route.ts')), { exports, require: name => {
    assert.ok(mocks[name], 'Unexpected dependency ' + name); return mocks[name];
  }, console, URL, Intl });
  const request = () => new Request('https://www.aim4price.com/api/valuation/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedValueExVat: 100000, logoUrl: 'https://untrusted.example/logo' }) });
  const response = await exports.POST(request());
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes(`src="${business}"`));
  assert.deepEqual(seen, ['owner']);
  signedIn = false;
  const guest = await exports.POST(request());
  assert.equal(guest.status, 200);
  assert.ok((await guest.text()).includes('src="data:image/png;base64,RkFMTEJBQ0s="'));
  assert.deepEqual(seen, ['owner']);
});

test('uploaded register logos are embedded in report HTML without a browser session', async () => {
  const exports = {};
  const imageBytes = Buffer.from('89504e470d0a1a0a', 'hex');
  const mocks = {
    'node:fs/promises': { readFile: async () => imageBytes },
    'node:path': (await import('node:path')).default,
    './asset-register-uploads': { resolveAssetRegisterUploadBytes: async id => {
      assert.equal(id, 'saved-logo');
      return { status: 'ready', upload: { data: imageBytes, mimeType: 'image/png', fileName: 'register.png' } };
    } },
    './report-resource-policy': { isAllowedReportResourceUrl: () => false },
  };
  vm.runInNewContext(compile(read('lib/report-logo.ts')), {
    exports, require: name => mocks[name], Buffer, Map, console, URL, process,
  });
  const embedded = await exports.resolveReportLogoUrlForHtml('/api/asset-register/uploads/saved-logo', 'https://www.aim4price.com/report');
  assert.equal(embedded, `data:image/png;base64,${imageBytes.toString('base64')}`);
  assert.equal(await exports.resolveReportLogoUrlForHtml(business), business);
});
