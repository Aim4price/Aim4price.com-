import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createExternalShareFileCache,
  fetchExternalShareFile,
  formatExternalShareFileSize,
  prepareExternalShareFiles,
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

test('canonical rich report HTML is sent through the authenticated POST transport unchanged', async () => {
  const html = '<!doctype html><html><body><main class="assetReportPage">Exact report</main></body></html>';
  const body = JSON.stringify({ html, fileName: 'Asset valuation.pdf' });
  const postSource = {
    ...source,
    url: '/api/reports/render-pdf',
    request: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  };
  const requests = [];

  const file = await fetchExternalShareFile(postSource, async (url, init) => {
    requests.push({ url, init });
    return new Response(new Blob(['%PDF-1.7 exact bytes'], { type: 'application/pdf' }), {
      status: 200,
      headers: { 'content-disposition': 'attachment; filename="Asset valuation.pdf"' },
    });
  });

  assert.equal(file.name, 'Asset valuation.pdf');
  assert.equal(await file.text(), '%PDF-1.7 exact bytes');
  assert.deepEqual(requests, [{
    url: postSource.url,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      credentials: 'include',
      cache: 'no-store',
    },
  }]);
  assert.equal(JSON.parse(requests[0].init.body).html, html);
});

test('PDF and Excel response bytes pass into attachments without any regeneration', async () => {
  const cases = [
    {
      source,
      bytes: Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x10, 0x0a]),
      type: 'application/pdf',
      fileName: 'canonical.pdf',
    },
    {
      source: {
        ...source,
        id: 'report:register:xlsx',
        fileName: 'asset-register.xlsx',
        url: '/api/asset-register/export?format=xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      bytes: Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0x7f, 0x01]),
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: 'canonical.xlsx',
    },
  ];

  for (const fixture of cases) {
    const file = await fetchExternalShareFile(fixture.source, async () => new Response(
      new Blob([fixture.bytes], { type: fixture.type }),
      {
        status: 200,
        headers: { 'content-disposition': `attachment; filename="${fixture.fileName}"` },
      },
    ));

    assert.deepEqual(
      new Uint8Array(await file.arrayBuffer()),
      fixture.bytes,
      `${fixture.fileName} bytes must remain unchanged`,
    );
    assert.equal(file.type, fixture.type);
    assert.equal(file.name, fixture.fileName);
  }
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

test('the canonical endpoint filename wins even when a share-only filename was requested', async () => {
  const file = await fetchExternalShareFile({
    ...source,
    fileName: 'harvest-fleet-insurance-report.pdf',
    preferSourceFileName: true,
  }, async () => new Response(new Blob(['%PDF-1.7'], { type: 'application/pdf' }), {
    status: 200,
    headers: { 'content-disposition': 'attachment; filename="aim4price-full-asset-register.pdf"' },
  }));

  assert.equal(file.name, 'aim4price-full-asset-register.pdf');
});

test('the canonical endpoint MIME type is preserved without rebuilding the File', async () => {
  const file = await fetchExternalShareFile(source, async () => new Response('%PDF-1.7', {
    status: 200,
    headers: {
      'content-type': 'application/octet-stream',
      'content-disposition': 'attachment; filename="canonical-register.pdf"',
    },
  }));

  assert.equal(file.name, 'canonical-register.pdf');
  assert.equal(file.type, 'application/octet-stream');
});

test('prepared report Files are immutable cache entries across attachment selection changes', async () => {
  const reportSource = {
    ...source,
    id: 'report:canonical',
    url: '/api/reports/canonical?format=pdf',
  };
  const photoSource = {
    id: 'photo:one',
    kind: 'photo',
    label: 'Asset photo',
    description: 'Saved photo',
    fileName: 'asset-photo.jpg',
    url: '/uploads/asset-photo.jpg',
    contentType: 'image/jpeg',
    credentials: 'include',
  };
  const fetchCounts = new Map();
  const cache = createExternalShareFileCache(async (url) => {
    fetchCounts.set(url, (fetchCounts.get(url) ?? 0) + 1);
    if (url === reportSource.url) {
      return new Response(new Blob(['%PDF-1.7 canonical bytes'], { type: 'application/pdf' }), {
        status: 200,
        headers: { 'content-disposition': 'attachment; filename="canonical-register.pdf"' },
      });
    }
    return new Response(new Blob(['photo bytes'], { type: 'image/jpeg' }), {
      status: 200,
      headers: { 'content-disposition': 'attachment; filename="canonical-photo.jpg"' },
    });
  });

  const [firstReport] = await prepareExternalShareFiles([reportSource], cache);
  const [photo, reportWithPhoto] = await prepareExternalShareFiles([photoSource, reportSource], cache);
  const [reportAfterPhotoRemoval] = await prepareExternalShareFiles([reportSource], cache);

  assert.equal(fetchCounts.get(reportSource.url), 1, 'adding or removing a photo must not refetch the report');
  assert.equal(fetchCounts.get(photoSource.url), 1);
  assert.strictEqual(reportWithPhoto, firstReport, 'the exact same File object must be reused');
  assert.strictEqual(reportAfterPhotoRemoval, firstReport, 'removing another attachment must not mutate the report');
  assert.equal(reportWithPhoto.name, 'canonical-register.pdf');
  assert.equal(await reportWithPhoto.text(), '%PDF-1.7 canonical bytes');
  assert.equal(photo.name, 'canonical-photo.jpg');
});

test('adding another report does not refetch reports that are already prepared', async () => {
  const secondReport = {
    ...source,
    id: 'report:second',
    label: 'Second report',
    url: '/api/reports/second?format=pdf',
  };
  const requests = [];
  const cache = createExternalShareFileCache(async (url) => {
    requests.push(url);
    return new Response(new Blob([`bytes:${url}`], { type: 'application/pdf' }), {
      status: 200,
      headers: { 'content-disposition': `attachment; filename="${url === source.url ? 'first' : 'second'}.pdf"` },
    });
  });

  const [first] = await prepareExternalShareFiles([source], cache);
  const [firstAgain, second] = await prepareExternalShareFiles([source, secondReport], cache);

  assert.deepEqual(requests, [source.url, secondReport.url]);
  assert.strictEqual(firstAgain, first);
  assert.notStrictEqual(second, first);
});

test('the immutable cache distinguishes different rich report HTML posted to the same route', async () => {
  const makeSource = (html) => ({
    ...source,
    url: '/api/reports/render-pdf',
    request: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, fileName: 'valuation.pdf' }),
    },
  });
  const firstSource = makeSource('<html><body>first valuation</body></html>');
  const secondSource = makeSource('<html><body>updated valuation</body></html>');
  const requests = [];
  const cache = createExternalShareFileCache(async (_url, init) => {
    requests.push(init.body);
    return new Response(new Blob([`%PDF:${init.body}`], { type: 'application/pdf' }), {
      status: 200,
      headers: { 'content-disposition': 'attachment; filename="valuation.pdf"' },
    });
  });

  const first = await cache.prepare(firstSource);
  const firstAgain = await cache.prepare(firstSource);
  const second = await cache.prepare(secondSource);

  assert.strictEqual(firstAgain, first);
  assert.notStrictEqual(second, first);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests, [firstSource.request.body, secondSource.request.body]);
});

test('a failed cache entry can be retried without refetching successful attachments', async () => {
  let attempts = 0;
  const cache = createExternalShareFileCache(async () => {
    attempts += 1;
    if (attempts === 1) return new Response('Not ready', { status: 503 });
    return new Response(new Blob(['%PDF-1.7'], { type: 'application/pdf' }), {
      status: 200,
      headers: { 'content-disposition': 'attachment; filename="ready.pdf"' },
    });
  });

  await assert.rejects(cache.prepare(source), /Could not prepare/);
  const retried = await cache.prepare(source);

  assert.equal(attempts, 2);
  assert.equal(retried.name, 'ready.pdf');
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
