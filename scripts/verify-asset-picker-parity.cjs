/* Render the real chooser flows with fixture API responses; never writes user data. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/picker-validation');
const output = process.env.PICKER_OUTPUT_DIR || path.join(root, '.next/picker-validation');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const scenarios = [
  ['manual', 'costs', ['+Add Cost', 'Enter cost manually']],
  ['capture', 'costs', ['+Add Cost', 'Upload for Aim4price capture']],
  ['budget', 'budgets', ['Add Budget', 'Choose assets']],
  ['recurring', 'costs', ['+Add Cost', 'Add recurring commitment', 'Choose assets']],
  ['invoice-drop', 'costs', ['Invoice Drop', 'One asset', 'Next', 'Choose an asset']],
  ['maintenance', 'maintenance', ['+Add Maintenance']],
  ['checklist', 'maintenance', ['Checklists']],
  ['maintenance-report', 'maintenance', ['Download', 'Specific asset']],
  ['exclusions', 'fuel', ['Exclusions']],
  ['fuel-manual', 'fuel', ['Fuel Slips', 'Add fuel slip', 'Enter slip manually']],
  ['fuel-capture', 'fuel', ['Fuel Slips', 'Add fuel slip', 'Upload for Aim4price capture']],
  ['export', 'register', ['Download', 'PDF report', 'Next', 'Choose Specific Assets']],
];
const assets = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1), userId: 'test', registerId: null, title: '2023 Toyota Hilux',
  meta: 'Year Model: 2023 · Usage: 115 739 km · Condition: Good',
  serialNumber: `SKB ${i + 1}`, categoryLabel: 'Bakkies / LDVs',
  selectedMethod: 'basic', yearModel: 2023, usage: 115739, hours: 115739,
  usageMetric: 'km', usageReading: 115739, condition: 'Good', value: 300000,
  selectedValueExVat: 300000, replacementPriceExVat: 500000,
  kind: 'motor', specsJson: {}, brandName: 'Toyota', modelName: 'Hilux',
  assetTypeLabel: 'Bakkies / LDVs', equipmentFamilyKey: '', equipmentFamilyLabel: '',
  fuelType: 'diesel', canReceiveFuel: true, isActive: true, workUseExcluded: false,
  photos: [], documents: [], maintenanceStatuses: [], publicAssetCode: '', plateLabel: '',
  note: '', createdAtIso: '2026-09-01T00:00:00Z', updatedAtIso: '2026-09-01T00:00:00Z',
}));
async function click(page, label) {
  await page.evaluate(label => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(element => element.getBoundingClientRect().width);
    const scope = dialogs.at(-1) || document;
    const button = [...scope.querySelectorAll('button')].find(element =>
      element.getBoundingClientRect().width && !element.disabled &&
      element.textContent.trim().toLowerCase().startsWith(label.toLowerCase()));
    if (!button) throw new Error(`Missing button: ${label}; available: ${[...scope.querySelectorAll('button')].map(button => button.textContent.trim()).join('|')}`);
    button.click();
  }, label);
  await delay(150);
}
async function appearance(page) {
  return page.evaluate(() => {
    const modal = document.querySelector('[data-asset-choice-modal="true"]');
    const selectors = {
      modal: null, header: '[data-asset-choice-header]', heading: '[data-asset-choice-header] :is(h2,h3)',
      headingCopy: '[data-asset-choice-header]>div', subtitle: '[data-asset-choice-header] p', close: '[data-asset-choice-header]>button',
      search: '[data-asset-choice-toolbar] input', row: '[data-asset-choice-row]',
      title: '[data-asset-choice-copy] strong', meta: '[data-asset-choice-copy] small', marker: '[data-asset-choice-value] i',
      secondary: '[data-asset-choice-footer] button:not([data-asset-choice-action="primary"])',
    };
    const properties = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
      'color', 'borderColor', 'backgroundColor', 'backgroundImage', 'borderRadius', 'padding'];
    if (!modal) throw new Error('No asset chooser rendered');
    return Object.fromEntries(Object.entries(selectors).map(([key, selector]) => {
      const element = selector ? modal.querySelector(selector) : modal;
      if (!element) throw new Error(`Missing chooser part: ${key}`);
      const style = getComputedStyle(element);
      return [key, Object.fromEntries((key === 'headingCopy' ? [...properties, 'display', 'gap'] : properties).map(property => [property, style[property]]))];
    }));
  });
}
(async () => {
  let server, browser, fixtureCreated = false;
  try {
    await fs.mkdir(fixture); // Refuse to overwrite an existing route.
    fixtureCreated = true;
    await fs.copyFile(path.join(root, 'tests/fixtures/asset-picker-parity-page.tsx'), path.join(fixture, 'page.tsx'));
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
      executablePath: process.env.PICKER_BROWSER_PATH || await chromium.executablePath(),
      args: chromium.args.filter(arg => !['--single-process', '--hide-scrollbars'].includes(arg)),
      ignoreDefaultArgs: ['--hide-scrollbars'], headless: true, pipe: true,
    });
    const page = await browser.newPage();
    const errors = [];
    const mismatches = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        assert.equal(request.method(), 'GET', `Unexpected data mutation: ${request.url()}`);
        const body = { ok: true, signedIn: true, user: { id: 'test', accountType: 'owner', name: 'Test owner' },
          profile: { userId: 'test', accountType: 'owner', name: 'Test owner' }, assets,
          items: url.pathname === '/api/asset-register' ? assets : [], invoices: [], records: [],
          budgets: [], requests: [], commitments: [], notifications: [], groups: [], registers: [],
          storages: [], recentEvents: [], recentFuelSlips: [] };
        return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      }
      if (request.resourceType() === 'media') return request.abort();
      return request.continue();
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window, 'outerWidth', { get: () => innerWidth });
      localStorage.setItem('aim4price.website-canvas.v2.intro', 'seen');
    });
    for (const width of (process.env.PICKER_WIDTHS || '1440,430').split(',').map(Number)) {
      await page.setViewport({ width, height: 1000 });
      let reference;
      for (const [name, mode, clicks] of scenarios.filter(([name]) => !process.env.PICKER_SCENARIOS || name === 'manual' || process.env.PICKER_SCENARIOS.split(',').includes(name))) {
        await page.goto(`http://localhost:3036/picker-validation?mode=${mode}`, { waitUntil: 'networkidle2', timeout: 120000 });
        for (const label of clicks) await click(page, label);
        await page.waitForSelector('[data-asset-choice-row]');
        await page.evaluate(() => document.activeElement?.blur());
        await page.mouse.move(0, 0);
        await delay(200);
        const styles = await appearance(page);
        if (name === 'manual') reference = styles;
        else {
          try { assert.deepEqual(styles, reference); }
          catch (error) { mismatches.push(`${name} at ${width}px`); console.error(error.message); }
        }
        assert.equal(await page.$$eval('[data-asset-choice-row]', rows => rows.length), 12);
        await page.screenshot({ path: path.join(output, `${name}-${width}.png`) });
        const search = '[data-asset-choice-toolbar] input';
        await page.type(search, 'SKB 2');
        assert.equal(await page.$$eval('[data-asset-choice-row]', rows => rows.length), 1, `${name}: serial search`);
        await page.type(search, ' no-match');
        assert.equal(await page.$$eval('[data-asset-choice-row]', rows => rows.length), 0, `${name}: empty state`);
        await click(page, 'Clear');
        await page.waitForFunction(() => document.querySelectorAll('[data-asset-choice-row]').length === 12);
        if (['budget', 'recurring', 'exclusions', 'export'].includes(name)) {
          await page.click('[data-asset-choice-row]');
          assert.equal(await page.$$eval('[data-asset-choice-selected="true"]', rows => rows.length), 1, `${name}: selected state`);
          assert.equal(await page.$eval('[data-asset-choice-action="primary"]', button => button.disabled), false);
          await page.click('[data-asset-choice-row]');
          assert.equal(await page.$$eval('[data-asset-choice-selected="true"]', rows => rows.length), 0, `${name}: deselect`);
        }
        if (name === 'checklist') {
          await page.click('[data-asset-choice-row]');
          await click(page, 'Service items');
          await click(page, 'Inspection checks');
          await click(page, 'Change asset');
          assert.equal(await page.$$eval('[data-asset-choice-row]', rows => rows.length), 12);
        }
        assert.deepEqual(errors, [], `${name}: browser errors`);
        console.log(`${mismatches.includes(`${name} at ${width}px`) ? 'FAIL' : 'PASS'} ${name} at ${width}px: design, search and selection`);
      }
    }
    assert.deepEqual(mismatches, [], 'Chooser design mismatches');
  } finally {
    if (browser) await browser.close();
    if (fixtureCreated) {
      await fs.unlink(path.join(fixture, 'page.tsx')).catch(() => {});
      await fs.rmdir(fixture).catch(() => {});
      await fs.unlink(path.join(root, '.next/types/app/picker-validation/page.ts')).catch(() => {});
    }
    if (server) server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
