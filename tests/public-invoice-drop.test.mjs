import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('public Invoice Drop is discoverable without crowding the header', async () => {
  const [home, homeStyles, footer, header] = await Promise.all([
    read('app/page.tsx'),
    read('app/page.module.css'),
    read('components/AppFooter.tsx'),
    read('components/AppHeader.tsx'),
  ]);

  assert.match(home, /Have an invoice for an Aim4price asset\?/);
  assert.match(home, /href="\/drop-invoice"/);
  assert.ok(home.indexOf('invoiceDropSection') > home.indexOf('heroSection'));
  assert.ok(home.indexOf('invoiceDropSection') < home.indexOf('productSection'));
  assert.match(homeStyles, /\.invoiceDropCard \{[\s\S]*?grid-template-columns: auto minmax\(0, 1fr\) auto/);
  assert.match(homeStyles, /@media \(max-width: 520px\)[\s\S]*?\.invoiceDropCard \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(footer, /label: 'Explore'[\s\S]*?\/drop-invoice[\s\S]*?Drop an Invoice/);
  assert.doesNotMatch(header, /href: '\/drop-invoice'/);
});

test('Invoice Drop page supports private code and serial fallbacks with a clear receipt', async () => {
  const [page, client, styles] = await Promise.all([
    read('app/drop-invoice/page.tsx'),
    read('app/drop-invoice/invoice-drop-client.tsx'),
    read('app/drop-invoice/page.module.css'),
  ]);

  assert.match(page, /title: 'Invoice Drop'/);
  assert.match(client, /No Aim4price account is needed/);
  assert.match(client, /Invoice Drop Code/);
  assert.match(client, /A4P-X7KD-29MQ-P6TW/);
  assert.match(client, /Serial or VIN/);
  assert.match(client, /PDF, JPG, PNG or WEBP/);
  assert.match(client, /Your submission reference/);
  assert.match(client, /Create a free dealer profile/);
  assert.match(client, /name="website"[\s\S]*?tabIndex=\{-1\}/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('security helper verifies bytes instead of trusting file names or MIME headers', async () => {
  const security = await import('../lib/public-invoice-drop-security.ts');

  assert.equal(
    security.detectPublicInvoiceMime(Buffer.from('%PDF-1.7\n', 'ascii')),
    'application/pdf',
  );
  assert.equal(
    security.detectPublicInvoiceMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
    'image/jpeg',
  );
  assert.equal(
    security.detectPublicInvoiceMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/png',
  );
  assert.equal(
    security.detectPublicInvoiceMime(Buffer.from('RIFF0000WEBP', 'ascii')),
    'image/webp',
  );
  assert.equal(security.detectPublicInvoiceMime(Buffer.from('<script>alert(1)</script>')), null);
  assert.equal(
    security.sanitizePublicInvoiceFileName('../unsafe\u0000/name.exe', 'application/pdf', 0),
    'unsafe name.pdf',
  );
});

test('public intake security keeps origin checks and request throttling fail-closed', async () => {
  const security = await import('../lib/public-invoice-drop-security.ts');
  const allowedOrigins = ['https://aim4price.com'];

  assert.equal(security.isTrustedPublicInvoiceOrigin({
    originHeader: 'https://aim4price.com',
    secFetchSite: 'same-origin',
    requestOrigin: 'https://aim4price.com',
    allowedOrigins,
    production: true,
  }), true);
  assert.equal(security.isTrustedPublicInvoiceOrigin({
    originHeader: 'https://attacker.example',
    secFetchSite: 'cross-site',
    requestOrigin: 'https://aim4price.com',
    allowedOrigins,
    production: true,
  }), false);
  assert.equal(security.isTrustedPublicInvoiceOrigin({
    originHeader: null,
    secFetchSite: null,
    requestOrigin: 'https://aim4price.com',
    allowedOrigins,
    production: true,
  }), false);

  const key = `test-${Date.now()}-${Math.random()}`;
  assert.equal(security.checkPublicInvoiceRateLimit(key, { now: 1_000, limit: 1, windowMs: 10_000 }).allowed, true);
  assert.equal(security.checkPublicInvoiceRateLimit(key, { now: 1_001, limit: 1, windowMs: 10_000 }).allowed, false);

  const previousNodeEnv = process.env.NODE_ENV;
  const previousRateSecret = process.env.PUBLIC_INVOICE_RATE_LIMIT_SECRET;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.PUBLIC_INVOICE_RATE_LIMIT_SECRET;
    assert.throws(
      () => security.createPublicInvoiceRateLimitKey({ ipAddress: '192.0.2.1' }),
      /PUBLIC_INVOICE_RATE_LIMIT_SECRET_MISSING/,
    );
    process.env.PUBLIC_INVOICE_RATE_LIMIT_SECRET = 'r'.repeat(32);
    assert.match(
      security.createPublicInvoiceRateLimitKey({ ipAddress: '192.0.2.1' }),
      /^[0-9a-f]{64}$/,
    );
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousRateSecret === undefined) delete process.env.PUBLIC_INVOICE_RATE_LIMIT_SECRET;
    else process.env.PUBLIC_INVOICE_RATE_LIMIT_SECRET = previousRateSecret;
  }
});

test('public intake derives identity from the trusted end of the proxy chain', async () => {
  const security = await import('../lib/public-invoice-drop-security.ts');

  assert.equal(security.resolvePublicInvoiceClientAddress({
    runtimeAddress: '192.0.2.20',
    forwardedFor: '203.0.113.99',
    production: true,
    trustProxyHeaders: false,
  }), '192.0.2.20');
  assert.equal(security.resolvePublicInvoiceClientAddress({
    forwardedFor: '203.0.113.99, 198.51.100.22',
    production: true,
    trustProxyHeaders: true,
    trustedProxyHops: 1,
  }), '198.51.100.22');
  assert.equal(security.resolvePublicInvoiceClientAddress({
    forwardedFor: '203.0.113.99, 198.51.100.22',
    production: true,
    trustProxyHeaders: true,
    trustedProxyHops: 2,
  }), '203.0.113.99');
  assert.throws(() => security.resolvePublicInvoiceClientAddress({
    forwardedFor: '203.0.113.99',
    production: true,
    trustProxyHeaders: false,
  }), /PUBLIC_INVOICE_PROXY_IDENTITY_NOT_CONFIGURED/);
});

test('public multipart parsing enforces the actual streamed byte count without Content-Length', async () => {
  const security = await import('../lib/public-invoice-drop-security.ts');
  const boundary = 'aim4price-test-boundary';
  const validBody = Buffer.from([
    `--${boundary}`,
    'Content-Disposition: form-data; name="senderName"',
    '',
    'Test sender',
    `--${boundary}--`,
    '',
  ].join('\r\n'));
  const validRequest = new Request('https://aim4price.com/api/public/invoice-drop', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: validBody,
  });
  assert.equal(validRequest.headers.get('content-length'), null);
  const parsed = await security.readPublicInvoiceFormData(validRequest, {
    maximumBytes: validBody.length,
  });
  assert.equal(parsed.get('senderName'), 'Test sender');

  const oversizedRequest = new Request('https://aim4price.com/api/public/invoice-drop', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.alloc(65, 1),
  });
  await assert.rejects(
    security.readPublicInvoiceFormData(oversizedRequest, { maximumBytes: 64 }),
    /PUBLIC_INVOICE_REQUEST_TOO_LARGE/,
  );
});

test('public route always uses the generic accepted shape for matched and unmatched codes', async () => {
  const [route, storage, migration, durableRateLimit] = await Promise.all([
    read('app/api/public/invoice-drop/route.ts'),
    read('lib/capture-quarantine-storage.ts'),
    read('database/migrations/83-assisted-document-capture.sql'),
    read('lib/public-invoice-drop-rate-limit.ts'),
  ]);

  assert.match(route, /status: 202/);
  assert.match(route, /resolveInvoiceDropCode\(invoiceDropCode\)/);
  assert.match(route, /resolvedCode \? null : invoiceDropCode/);
  assert.match(route, /return accepted\(captureRequest\.publicReference\)/);
  assert.doesNotMatch(route, /assetTitle|ownerName|ownerEmail/);
  assert.match(route, /validatePublicInvoiceFiles\(formFiles\(formData\)\)/);
  assert.match(route, /readPublicInvoiceFormData\(request\)/);
  assert.match(route, /resolvePublicInvoiceClientAddress/);
  assert.doesNotMatch(route, /cf-connecting-ip|x-real-ip/);
  assert.match(route, /await consumePublicInvoiceDropRateLimit\(rateKey\)/);
  assert.match(route, /storeCaptureQuarantineFile/);
  assert.match(route, /transitionCaptureRequest\(createdRequestId, 'rejected'/);
  assert.match(route, /if \(requestSafelyClosed\)/);
  assert.match(storage, /v1\/capture-quarantine/);
  assert.match(storage, /AIM4PRICE_ALLOW_CAPTURE_QUARANTINE_WRITES/);
  assert.doesNotMatch(storage, /AIM4PRICE_ALLOW_BUCKET_WRITES/);
  assert.match(storage, /IfNoneMatch: '\*'/);
  assert.match(storage, /aim4price-security-status': 'pending'/);
  assert.match(migration, /security_status text not null default 'pending'/);
  assert.match(migration, /public_invoice_drop_rate_limits/);
  assert.match(durableRateLimit, /on conflict \(rate_key\) do update/);
  assert.doesNotMatch(durableRateLimit, /ipAddress|userAgent/);
});
