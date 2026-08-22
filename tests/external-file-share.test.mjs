import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchExternalShareFile,
  formatExternalShareFileSize,
} from '../lib/external-file-share.ts';

const source = {
  id: 'report:register:pdf',
  kind: 'report',
  label: 'Asset Register · PDF',
  description: 'Polished report',
  fileName: 'asset-register.pdf',
  url: '/api/asset-register/export?format=pdf',
  contentType: 'application/pdf',
  credentials: 'include',
};

test('authenticated report responses become actual File objects and keep the server filename', async () => {
  const requests = [];
  const file = await fetchExternalShareFile(source, async (url, init) => {
    requests.push({ url, init });
    return new Response(new Blob(['%PDF-1.7 test'], { type: 'application/pdf' }), {
      status: 200,
      headers: { 'content-disposition': "attachment; filename*=UTF-8''Aim4price%20Valuation.pdf" },
    });
  });

  assert.equal(file.name, 'Aim4price Valuation.pdf');
  assert.equal(file.type, 'application/pdf');
  assert.equal(await file.text(), '%PDF-1.7 test');
  assert.deepEqual(requests, [{
    url: source.url,
    init: { credentials: 'include', cache: 'no-store' },
  }]);
});

test('an authentication HTML response is rejected instead of being shared as a fake report', async () => {
  await assert.rejects(
    fetchExternalShareFile(source, async () => new Response('<html>Sign in</html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })),
    /sign-in page instead of a file/,
  );
});

test('a report response with the wrong MIME type is never attached', async () => {
  await assert.rejects(
    fetchExternalShareFile(source, async () => new Response('{"ok":false}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })),
    /returned the wrong file type/,
  );
});

test('named Aim4price reports keep their selected filename when the endpoint uses a generic name', async () => {
  const file = await fetchExternalShareFile({
    ...source,
    fileName: 'harvest-fleet-insurance-report.pdf',
    preferSourceFileName: true,
  }, async () => new Response(new Blob(['%PDF-1.7'], { type: 'application/pdf' }), {
    status: 200,
    headers: { 'content-disposition': 'attachment; filename="aim4price-full-asset-register.pdf"' },
  }));

  assert.equal(file.name, 'harvest-fleet-insurance-report.pdf');
});

test('a failed attachment response is rejected atomically before sharing', async () => {
  await assert.rejects(
    fetchExternalShareFile(source, async () => new Response('Missing', { status: 404 })),
    /Could not prepare “Asset Register · PDF”/,
  );
});

test('file sizes are formatted for concise UI labels', () => {
  assert.equal(formatExternalShareFileSize(0), '0 KB');
  assert.equal(formatExternalShareFileSize(1200), '1 KB');
  assert.equal(formatExternalShareFileSize(1.5 * 1024 * 1024), '1.5 MB');
  assert.equal(formatExternalShareFileSize(12 * 1024 * 1024), '12 MB');
});
