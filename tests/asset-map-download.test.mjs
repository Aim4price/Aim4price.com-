import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../lib/asset-map-download.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { downloadAssetMapReport } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

for (const outcome of ['success', 'unauthorized', 'unexpected-json', 'network-error', 'blocked-popup']) {
  test(`PDF download: ${outcome}`, async () => {
    let written = '', closed = false, fetched = false;
    const reportWindow = { opener: {}, document: { body: {}, open() {}, write(html) { written = html; }, close() {} }, close() { closed = true; } };
    const previousWindow = globalThis.window;
    const previousFetch = globalThis.fetch;
    globalThis.window = { open: () => outcome === 'blocked-popup' ? null : reportWindow };
    globalThis.fetch = async (href, options) => {
      fetched = true;
      assert.equal(href, '/api/asset-map/report?format=pdf&assetCode=A1');
      assert.equal(options.headers['x-aim4price-client-realm'], 'website');
      assert.equal(options.credentials, 'same-origin');
      assert.equal(options.cache, 'no-store');
      if (outcome === 'network-error') throw new Error('Network unavailable');
      return new Response(outcome === 'success' ? '<html>Report</html>' : '{"ok":false}', {
        status: outcome === 'unauthorized' ? 401 : 200,
        headers: { 'Content-Type': outcome === 'unexpected-json' ? 'application/json' : 'text/html' },
      });
    };
    try {
      const action = downloadAssetMapReport('/api/asset-map/report?format=pdf&assetCode=A1', 'pdf');
      if (outcome === 'success') {
        await action;
        assert.equal(written, '<html>Report</html>');
        assert.equal(reportWindow.opener, null);
        assert.equal(closed, false);
      } else {
        await assert.rejects(action, outcome === 'unauthorized' ? /sign in again/ : undefined);
        assert.equal(written, '');
        assert.equal(closed, outcome !== 'blocked-popup');
      }
      assert.equal(fetched, outcome !== 'blocked-popup');
    } finally {
      globalThis.window = previousWindow;
      globalThis.fetch = previousFetch;
    }
  });
}

test('XLSX saves the authenticated workbook with its server filename', async () => {
  const originals = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch };
  let clicked = false, removed = false;
  const link = { click() { clicked = true; }, remove() { removed = true; } };
  globalThis.window = { setTimeout(fn) { fn(); } };
  globalThis.document = { createElement: () => link, body: { appendChild() {} } };
  globalThis.fetch = async (_href, options) => {
    assert.equal(options.headers['x-aim4price-client-realm'], 'website');
    return new Response('workbook', { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="register-gps.xlsx"',
    } });
  };
  try {
    await downloadAssetMapReport('/api/asset-map/report?format=xlsx', 'xlsx');
    assert.equal(link.download, 'register-gps.xlsx');
    assert.equal(clicked, true);
    assert.equal(removed, true);
  } finally { Object.assign(globalThis, originals); }
});
