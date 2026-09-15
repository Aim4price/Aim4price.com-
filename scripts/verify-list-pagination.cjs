/* Exercise pagination on real page clients with 25 fixture records; never writes user data. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/pagination-validation');
const output = process.env.PAGINATION_OUTPUT_DIR || path.join(root, '.next/pagination-validation');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const assets = Array.from({ length: 25 }, (_, i) => ({
  id: String(i + 1), userId: 'test', registerId: null, title: `Vehicle ${String(i + 1).padStart(2, '0')}`,
  meta: 'Year Model: 2023 · Usage: 115 739 km · Condition: Good',
  serialNumber: `SKB ${i + 1}`, categoryLabel: 'Bakkies / LDVs',
  selectedMethod: 'basic', yearModel: 2023, usage: 115739, hours: 115739,
  usageMetric: 'km', usageReading: 115739, condition: 'Good', value: 300000,
  selectedValueExVat: 300000, replacementPriceExVat: 500000,
  kind: 'vehicle', specsJson: {}, brandName: 'Toyota', modelName: 'Hilux',
  assetTypeLabel: 'Bakkies / LDVs', equipmentFamilyKey: '', equipmentFamilyLabel: '',
  fuelType: 'diesel', canReceiveFuel: true, isActive: true, workUseExcluded: false,
  photos: [], documents: [], maintenanceStatuses: [], publicAssetCode: '', plateLabel: '',
  note: '', createdAtIso: '2026-09-01T00:00:00Z', updatedAtIso: '2026-09-01T00:00:00Z',
}));

const name = i => `Record ${String(i + 1).padStart(2, '0')}`;
const times = { createdAtIso: '2026-09-01T00:00:00Z', updatedAtIso: '2026-09-01T00:00:00Z' };
const invoices = assets.map((asset, i) => ({ ...times, id: asset.id, assetId: asset.id, assetTitle: name(i), assetCategoryLabel: '', assetYearModel: 2023, assetUsageReading: 100, assetUsageMetric: 'km', assetCondition: 'good', ownerName: 'Test', createdByDisplayName: 'Test', ownerStorageStatus: 'stored', document: null, supplierName: name(i), invoiceNumber: name(i), invoiceDate: '2026-09-01', subtotalExVat: 100, vatAmount: 15, totalIncVat: 115, usageReading: 100, usageMetric: 'km', source: 'manual', notes: '', maintenanceWorkDone: '', partsSupplied: '', repairWorkDone: '', blocks: [] }));
const budgets = assets.map((asset, i) => ({ id: asset.id, assetId: asset.id, assetTitle: name(i), period: 'monthly', periodLabel: 'September 2026', periodKey: '2026-09', amount: 1000, spent: 100, remaining: 900, overBy: 0, percentUsed: 10, warningPercent: 80, includeFuelSlipCosts: false, status: i === 24 ? 'warning' : 'on_track' }));
const records = assets.map((asset, i) => ({ ...times, id: asset.id, userId: 'test', assetId: asset.id, assetTitle: name(i), assetKind: 'vehicle', assetCategoryLabel: '', assetYearModel: 2023, assetUsageReading: 100, assetUsageMetric: 'km', assetCondition: 'good', assetValue: 1000, assetMeta: '', maintenanceType: 'service', triggerType: 'date', status: 'upcoming', computedStatus: 'scheduled', computedStatusLabel: 'Scheduled', title: name(i), notes: '', assignedFieldManagerId: null, assignedName: '', dueDate: '2026-10-01', dueUsage: null, usageMetric: 'km', currentUsage: 100, remainingUsage: null, daysUntilDue: 16, alertBeforeValue: 7, alertBeforeUnit: 'days', recurringEnabled: false, recurringIntervalValue: null, recurringIntervalUnit: null, generatedFromMaintenanceId: null, completedAtIso: null, completedUsage: null, completedNotes: '', completedBy: '', alertNotedAtIso: null }));
const storages = assets.map((asset, i) => ({ ...times, id: asset.id, name: name(i), fuelType: 'diesel', capacityLitres: 1000, currentLitres: 500, stockPercent: 50, reorderLevelLitres: 100, locationLabel: '', notes: '', dipstickNote: '', dipstickNoteUpdatedAtIso: null, status: 'active', publicFuelStorageCode: '', pinEnabled: false, hasPin: false, pinUpdatedAtIso: null }));
const slips = assets.map((asset, i) => ({ ...times, id: asset.id, sourceType: 'fuel_slip', sourceLabel: 'Fuel Slip', targetType: 'asset', assetId: asset.id, assetTitle: name(i), storageId: '', storageName: '', supplierName: name(i), slipNumber: name(i), transactionNumber: '', documentDate: '2026-09-01', documentTime: '12:00', fuelType: 'diesel', litres: 10, pricePerLitre: 20, totalAmount: 200, vatAmount: 0, vatIncluded: true, vatRate: 15, paymentMethod: '', cardType: '', cardNumberMasked: '', cardLast4: '', operatorName: '', activityText: '', workAreaText: '', note: '', extractionStatus: 'manual', ocrConfidence: null, reviewRequired: false, rawExtractedText: '', extractionWarnings: [], workUseExcluded: false, workUseExclusionReason: '', recordStatus: 'active', voidedAtIso: null, voidedByName: '', voidReason: '' }));
const scenarios = [
  ['register', 'Asset register pagination', 'article[class*="assetCard"]', 'input[placeholder="Search by asset, brand, model or serial"]'],
  ['budgets', 'Budgets pagination', 'article[id^="cost-budget-"]', 'input[aria-label="Search budgets"]'],
  ['costs', 'Cost records pagination', 'article[class*="invoiceRow"]', 'input[aria-label="Search saved cost records"]'],
  ['maintenance', 'Maintenance record pages', 'article', 'input[aria-label="Search maintenance records"]'],
  ['fuel', 'Fuel ledger pagination', 'article[class*="storageCard"]', 'input[aria-label="Search by storage name, type or serial"]'],
  ['fuel&view=slips', 'Fuel slips pagination', 'article[aria-label$="fuel slip"]', 'input[aria-label="Search saved fuel slips"]'],
];

async function appearance(page, selector) {
  return page.$eval(selector, el => {
    const read = node => {
      const css = getComputedStyle(node);
      return Object.fromEntries([
        'backgroundImage', 'borderRadius', 'borderColor', 'padding', 'fontSize',
        'fontWeight', 'color', 'minHeight', 'gap',
      ].map(key => [key, css[key]]));
    };
    const container = read(el);
    // The container's inherited text styles do not paint any text; compare the actual labels below.
    delete container.color;
    delete container.fontSize;
    delete container.fontWeight;
    return [
      container, read(el.querySelector('[aria-live]')),
      read(el.querySelector('button[aria-pressed="true"]')),
      read(el.querySelector('button[aria-pressed="false"]')),
    ];
  });
}

(async () => {
  let server, browser, fixtureCreated = false;
  try {
    await fs.mkdir(fixture); // Refuse to overwrite an existing route.
    fixtureCreated = true;
    await fs.copyFile(path.join(root, 'tests/fixtures/list-pagination-page.tsx'), path.join(fixture, 'page.tsx'));
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '3036'], {
      cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: process.env,
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Next.js startup timed out')), 60000);
      server.stdout.on('data', data => { if (data.toString().includes('Ready in')) { clearTimeout(timer); resolve(); } });
      server.stderr.on('data', () => {});
      server.once('error', reject);
      server.once('exit', code => reject(new Error(`Next.js exited: ${code}`)));
    });
    await fs.mkdir(output, { recursive: true });
    browser = await puppeteer.launch({
      executablePath: process.env.PAGINATION_BROWSER_PATH || await chromium.executablePath(),
      args: chromium.args.filter(arg => !['--single-process', '--hide-scrollbars'].includes(arg)),
      ignoreDefaultArgs: ['--hide-scrollbars'], headless: true, pipe: true,
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        assert.equal(request.method(), 'GET', `Unexpected data mutation: ${request.url()}`);
        const body = { ok: true, signedIn: true, user: { id: 'test', accountType: 'owner', name: 'Test owner' },
          profile: { userId: 'test', accountType: 'owner', name: 'Test owner' }, assets,
          items: url.pathname === '/api/asset-register' ? assets : [], invoices, records,
          budgets, requests: [], commitments: [], notifications: [], groups: [], registers: [],
          storages, recentEvents: [], recentFuelSlips: slips };
        return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      }
      if (request.resourceType() === 'media') return request.abort();
      return request.continue();
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window, 'outerWidth', { get: () => innerWidth });
      localStorage.setItem('aim4price.website-canvas.v2.intro', 'seen');
    });
    for (const width of [1440, 430]) {
      await page.setViewport({ width, height: 1000 });
      await page.goto('http://localhost:3036/pagination-validation?mode=reference', {waitUntil:'networkidle2', timeout:120000});
      const reference = await appearance(page, '[data-original-pagination]');
      for (const [mode, label, rows, search] of scenarios) {
        await page.goto(`http://localhost:3036/pagination-validation?mode=${mode}`, { waitUntil: 'networkidle2', timeout: 120000 });
        const nav = `nav[aria-label="${label}"]`;
        await page.waitForSelector(nav, {timeout: 30000});
        const count = () => page.$$eval(rows, elements => elements.length);
        assert.equal(await count(), 6, `${mode}: default page size`);
        const clickButton = async text => {
          await page.$eval(nav, (el, text) => {
            const button = [...el.querySelectorAll('button')].find(b => b.textContent.trim() === text);
            if (!button) throw new Error(`Missing button ${text}`);
            button.click();
          }, text);
          await delay(150);
        };
        const status = () => page.$eval(`${nav} [aria-live]`, el => el.textContent);
        assert.deepEqual(await appearance(page, nav), reference, `${mode}: rendered Asset Register styling`);
        assert.equal(await status(), 'Page 1 of 5');
        await clickButton('Next');
        assert.equal(await status(), 'Page 2 of 5');
        await clickButton('5');
        assert.equal(await count(), 1);
        await clickButton('12');
        assert.equal(await count(), 12);
        assert.equal(await status(), 'Page 1 of 3');
        await clickButton('18');
        assert.equal(await count(), 18);
        await clickButton('All');
        assert.equal(await count(), 25);
        assert.equal(await status(), 'Page 1 of 1');
        await clickButton('6');
        await clickButton('Next');
        if (mode === 'budgets') {
          await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Download').click());
          await page.waitForSelector('[role="dialog"][aria-label="Download budgets"]');
          assert.match(await page.$eval('[role="dialog"]', el => el.textContent), /25 matching budgets/);
          await page.click('[role="dialog"] button[aria-label="Close"]');
          await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Alerts')).click());
          await delay(200);
          assert.equal(await count(), 1, 'Budget alerts filter the full set');
          assert.equal(await status(), 'Page 1 of 1');
          await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Clear filters').click());
          await delay(200);
          assert.equal(await count(), 6);
          await clickButton('Next');
        }
        await page.type(search, mode === 'register' ? 'Vehicle 25' : 'Record 25');
        await delay(300);
        assert.equal(await count(), 1, `${mode}: search full data from a later page`);
        assert.equal(await status(), 'Page 1 of 1');
        await page.type(search, ' no-match');
        await delay(200);
        assert.equal(await count(), 0, `${mode}: empty search`);
        assert.equal(await page.$(nav), null);
        await page.$eval(search, el => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, ''); el.dispatchEvent(new Event('input', {bubbles:true})); });
        await delay(200);
        assert.equal(await count(), 6);
        await page.evaluate(() => { document.activeElement?.blur(); document.documentElement.style.scrollBehavior = 'auto'; });
        await page.$eval(nav, el => el.scrollIntoView({block:'center', behavior:'instant'}));
        await delay(600);
        await (await page.$(nav)).screenshot({path:path.join(output, `${mode.replace('&view=', '-')}-${width}-bar.png`)});
        await page.screenshot({path:path.join(output, `${mode.replace('&view=', '-')}-${width}.png`)});
        assert.deepEqual(errors, [], `${mode}: browser errors`);
        console.log(`PASS ${mode} at ${width}px: styles, sizes, page navigation, full-data search and empty state`);
      }
    }
  } finally {
    if (fixtureCreated) {
      await fs.unlink(path.join(fixture, 'page.tsx')).catch(() => {});
      await fs.rmdir(fixture).catch(() => {});
      await fs.unlink(path.join(root, '.next/types/app/pagination-validation/page.ts')).catch(() => {});
    }
    if (browser) await browser.close();
    if (server) server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
