import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('public Invoice Drop is discoverable in the signed-out header without a duplicate homepage banner', async () => {
  const [home, homeStyles, footer, header] = await Promise.all([
    read('app/page.tsx'),
    read('app/page.module.css'),
    read('components/AppFooter.tsx'),
    read('components/AppHeader.tsx'),
  ]);

  assert.match(header, /const PUBLIC_NAV_ITEMS:[\s\S]*?key: 'invoices', href: '\/drop-invoice', label: 'Invoices'/);
  assert.match(header, /accountType === 'public'[\s\S]*?return PUBLIC_NAV_ITEMS/);
  assert.match(header, /const DEFAULT_NAV_ITEMS:[\s\S]*?key: 'asset-register', href: '\/asset-register', label: 'Asset Register'/);
  assert.doesNotMatch(home, /Have an invoice for an Aim4price asset\?|invoiceDropSection|InvoiceDropIcon/);
  assert.doesNotMatch(homeStyles, /\.invoiceDrop/);
  assert.match(footer, /label: 'Explore'[\s\S]*?\/drop-invoice[\s\S]*?Drop an Invoice/);
});

test('Invoice Drop uses the homepage typography, photo hero and a gated three-step modal', async () => {
  const [page, client, styles] = await Promise.all([
    read('app/drop-invoice/page.tsx'),
    read('app/drop-invoice/invoice-drop-client.tsx'),
    read('app/drop-invoice/page.module.css'),
  ]);

  assert.match(page, /title: 'Invoice Drop'/);
  assert.match(page, /<AppHeader active="invoices" \/>/);
  assert.doesNotMatch(client, /HomeHeroVideo|heroEyebrow/);
  assert.match(client, /className=\{styles\.heroUploadAction\}/);
  assert.match(client, /Add invoice/);
  assert.match(client, /Aim4price will verify it and route it to the correct asset\./);
  assert.doesNotMatch(client, /route it to the correct record\./);
  assert.doesNotMatch(client, /AIM4PRICE INVOICES|styles\.modalEyebrow/);
  assert.match(client, /Private and owner-controlled\.<\/strong> Sending a document never grants access to an asset record\./);
  assert.match(client, /aria-modal="true"/);
  assert.match(client, /const WIZARD_STEPS:[\s\S]*?Identify asset[\s\S]*?Add invoice[\s\S]*?Your details/);
  assert.doesNotMatch(client, /STEP [123] OF 3/);
  assert.match(client, /const completeContributionCode = \/\^A4P/);
  assert.match(client, /const codeStepComplete = contributionCodeScope === 'asset'[\s\S]*?contributionCodeScope === 'all'[\s\S]*?assetSearchAccepted !== null/);
  assert.match(client, /const stepOneComplete = lookupMode === 'code'[\s\S]*?completeContributionCode && codeStepComplete[\s\S]*?assetDescription\.trim\(\)\.length >= 3/);
  assert.match(client, /const stepTwoComplete = files\.length === 1/);
  assert.match(client, /disabled=\{currentStep === 1 \? !stepOneComplete : !stepTwoComplete\}/);
  assert.doesNotMatch(client, /styles\.formSection/);
  assert.match(client, /Invoice Drop Code/);
  assert.match(client, /A4P-X7KD-29MQ-P6TW/);
  assert.match(client, /Serial or VIN/);
  assert.match(client, /Asset make and model/);
  assert.match(client, /For example Massey Ferguson 290/);
  assert.match(client, /privately link an exact, unique match/);
  assert.match(client, /This broad code does not show an asset list/);
  assert.match(client, /Aim4price returns at most one specific match/);
  assert.match(client, /Use these details for admin review/);
  assert.match(client, /\/api\/public\/invoice-drop\/asset-search/);
  assert.doesNotMatch(client, /<select name="senderType"/);
  assert.match(client, /name="senderType" value=\{senderType\}/);
  assert.match(client, /aria-haspopup="listbox"/);
  assert.match(client, /role="option"/);
  assert.match(client, /Equipment or vehicle dealer/);
  assert.match(styles, /\.senderSelectMenu \{[\s\S]*?background: #ffffff;[\s\S]*?box-shadow:/);
  assert.match(client, /PDF, JPG, PNG or WEBP/);
  assert.match(client, /Your submission reference/);
  assert.match(client, /Create a free dealer profile/);
  assert.match(client, /name="website"[\s\S]*?tabIndex=\{-1\}/);
  assert.match(styles, /background-image: url\('\/brand\/invoice-drop-hero\.webp'\)/);
  assert.doesNotMatch(styles, /\.heroEyebrow|\.heroPrimaryButton|\.modalEyebrow/);
  assert.match(styles, /\.heroGrid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(16rem, 19rem\)/);
  assert.match(styles, /\.heroTitle \{[\s\S]*?max-width: 56rem;[\s\S]*?font-size: clamp\(3\.8rem, 4\.9vw, 5\.25rem\);[\s\S]*?line-height: 0\.96;[\s\S]*?letter-spacing: -0\.055em;[\s\S]*?font-weight: 800;/);
  assert.match(styles, /\.heroText \{[\s\S]*?max-width: 53rem;[\s\S]*?font-size: clamp\(1\.12rem, 1\.3vw, 1\.28rem\);[\s\S]*?line-height: 1\.55;[\s\S]*?letter-spacing: -0\.005em;/);
  assert.match(styles, /\.modalDialog \{[\s\S]*?--modal-gutter: clamp\(1\.25rem, 2\.5vw, 1\.75rem\);[\s\S]*?max-height: min\(92dvh, 56rem\)/);
  assert.match(styles, /\.wizardProgress \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
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

test('public route privately auto-links unique serial, VIN or owner-scoped broad-code matches', async () => {
  const [route, searchRoute, storage, migration, ownerWideMigration, durableRateLimit, captureStore] = await Promise.all([
    read('app/api/public/invoice-drop/route.ts'),
    read('app/api/public/invoice-drop/asset-search/route.ts'),
    read('lib/capture-quarantine-storage.ts'),
    read('database/migrations/83-assisted-document-capture.sql'),
    read('database/migrations/87-owner-wide-invoice-drop-codes.sql'),
    read('lib/public-invoice-drop-rate-limit.ts'),
    read('lib/capture-requests.ts'),
  ]);

  assert.match(route, /status: 202/);
  assert.match(route, /resolveInvoiceDropCode\(invoiceDropCode\)/);
  assert.match(route, /resolveUniqueAssetSerialOrVin\(assetReference\)/);
  assert.match(route, /resolveUniqueOwnerInvoiceDropAsset\([\s\S]*?resolvedCode\.ownerUserId,[\s\S]*?assetSearchQuery/);
  assert.match(route, /resolvedAsset\?\.ownerUserId/);
  assert.match(route, /resolvedAsset\?\.assetId/);
  assert.match(route, /submittedAssetDescription/);
  assert.match(route, /submittedAssetSearch/);
  assert.match(route, /exact_unique_serial_or_vin/);
  assert.match(route, /invoice_drop_code_owner_search/);
  assert.match(route, /invoice_drop_code_owner_review/);
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
  assert.match(ownerWideMigration, /idx_asset_invoice_drop_codes_one_active_owner/);
  assert.match(durableRateLimit, /on conflict \(rate_key\) do update/);
  assert.doesNotMatch(durableRateLimit, /ipAddress|userAgent/);
  assert.match(captureStore, /resolveUniqueAssetSerialOrVin/);
  assert.match(captureStore, /cross join lateral \([\s\S]*?serial_number[\s\S]*?serial[\s\S]*?vin[\s\S]*?serialNumber/);
  assert.match(captureStore, /matched_identifier\.identifier as serial_or_vin/);
  assert.match(captureStore, /identifiers\.identifier[\s\S]*?regexp_replace\([\s\S]*?\) = \$1/);
  assert.doesNotMatch(
    captureStore,
    /where upper\(regexp_replace\([\s\S]*?coalesce\([\s\S]*?serial_number[\s\S]*?vin/,
  );
  assert.match(captureStore, /limit 2/);
  assert.match(captureStore, /result\.rows\.length !== 1/);

  assert.match(searchRoute, /isTrustedPublicInvoiceOrigin/);
  assert.match(searchRoute, /MAXIMUM_BODY_BYTES = 4_096/);
  assert.match(searchRoute, /consumePublicInvoiceDropRateLimit\(searchRateKey/);
  assert.match(searchRoute, /status: 'asset_specific'/);
  assert.match(searchRoute, /status: 'matched'/);
  assert.match(searchRoute, /cannot be used to infer the size of an owner/);
  assert.match(searchRoute, /status: 'needs_detail'/);
  assert.match(searchRoute, /asset: \{[\s\S]*?title:[\s\S]*?meta,/);
  assert.match(searchRoute, /result\.match\.modelName/);
  assert.match(searchRoute, /Year Model \$\{result\.match\.yearModel\}/);
  assert.match(searchRoute, /formatUsageReading\(result\.match\.usageReading, result\.match\.usageMetric\)/);
  assert.match(captureStore, /as model_name/);
  assert.match(captureStore, /as usage_reading/);
  assert.match(captureStore, /as usage_metric/);
  assert.match(captureStore, /usageReading,/);
  assert.match(captureStore, /usageMetric:/);
  assert.doesNotMatch(searchRoute, /ownerUserId|assetId|assets:/);
});
