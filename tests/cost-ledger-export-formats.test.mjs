import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/api/my-invoices/report/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadRoute(resolveWorkspace) {
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: module.exports,
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: Response.json.bind(Response) } };
      if (name.endsWith('owner-workspace-access')) return { resolveOwnerWorkspaceContext: resolveWorkspace };
      return {};
    },
    console,
  });
  return module.exports.GET;
}

test('retired accounting CSV requests are rejected before loading report data', async () => {
  const get = loadRoute(async () => ({ ok: true, context: { ownerUserId: 'owner' } }));
  for (const format of ['csv', 'CSV']) {
    const response = await get({ nextUrl: new URL(`https://example.test/api/my-invoices/report?format=${format}`) });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Choose PDF or XLSX/);
  }
});

test('workspace authorization still precedes format validation', async () => {
  const denied = new Response('Unauthorized', { status: 401 });
  const get = loadRoute(async () => ({ ok: false, response: denied }));
  assert.equal(await get({ nextUrl: new URL('https://example.test/api/my-invoices/report?format=csv') }), denied);
});

test('accounting settings endpoint and CSV implementation have been removed', () => {
  assert.equal(existsSync(new URL('../app/api/my-invoices/accounting-settings/route.ts', import.meta.url)), false);
  assert.equal(existsSync(new URL('../lib/my-invoices-accounting.ts', import.meta.url)), false);
});
