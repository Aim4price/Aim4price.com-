import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createExternalShareArchive,
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

test('multi-file fallback builds a valid ZIP and safely de-duplicates filenames', async () => {
  const archive = await createExternalShareArchive([
    new File(['first'], 'report.pdf', { type: 'application/pdf', lastModified: Date.UTC(2026, 0, 2) }),
    new File(['second'], 'report.pdf', { type: 'application/pdf', lastModified: Date.UTC(2026, 0, 2) }),
  ]);
  const bytes = new Uint8Array(await archive.arrayBuffer());
  const text = new TextDecoder().decode(bytes);

  assert.equal(archive.type, 'application/zip');
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assert.match(text, /report\.pdf/);
  assert.match(text, /report \(2\)\.pdf/);
  assert.deepEqual([...bytes.slice(-22, -18)], [0x50, 0x4b, 0x05, 0x06]);
});

test('file sizes are formatted for concise UI labels', () => {
  assert.equal(formatExternalShareFileSize(0), '0 KB');
  assert.equal(formatExternalShareFileSize(1200), '1 KB');
  assert.equal(formatExternalShareFileSize(1.5 * 1024 * 1024), '1.5 MB');
  assert.equal(formatExternalShareFileSize(12 * 1024 * 1024), '12 MB');
});
