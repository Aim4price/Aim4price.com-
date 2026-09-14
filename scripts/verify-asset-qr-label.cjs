/* Exercise the production label template without deployment credentials.
 * Run: node scripts/verify-asset-qr-label.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const QRCode = require('qrcode');
const { PDFDocument } = require('pdf-lib');

const moduleFixture = { exports: {} };
const source = fs.readFileSync(path.join(__dirname, '../lib/asset-qr-label-print.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
new Function('exports', 'module', code)(moduleFixture.exports, moduleFixture);
const { buildAssetQrLabelHtml } = moduleFixture.exports;
const evidence = path.join(__dirname, '../.next/qr-label-validation');

(async () => {
  fs.mkdirSync(evidence, { recursive: true });
  const fallback = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '../public/brand/aim4price-mark-black.png')).toString('base64');
  const customLogo = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="16" fill="#10382f"/><text x="60" y="74" fill="white" font-family="Arial" font-size="36" text-anchor="middle">KG</text></svg>').toString('base64');
  const qrImageUrl = await QRCode.toDataURL('https://www.aim4price.com/scan/A4P-LABEL-TEST', { width: 640, margin: 4, errorCorrectionLevel: 'M' });
  const options = { accountName: 'Kuyler Farms', assetTitle: '2022 New Holland TT4.90 4WD Openstation', yearModel: 2022, modelName: 'TT4.90 4WD Openstation', serialNumber: 'NH-TT490-2022-001309', qrImageUrl, logoUrl: customLogo, fallbackLogoUrl: fallback };
  const browser = await puppeteer.launch({ executablePath: process.env.CANVAS_BROWSER_PATH || await chromium.executablePath(), args: chromium.args, headless: true, pipe: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    let currentOptions = options;
    page.on('request', request => {
      if (request.url() === 'https://label.test/') return request.respond({ contentType: 'text/html', body: buildAssetQrLabelHtml(currentOptions) });
      if (request.url().endsWith('/field-manager/montserrat-latin.woff')) return request.respond({ contentType: 'font/woff', body: fs.readFileSync(path.join(__dirname, '../public/field-manager/montserrat-latin.woff')) });
      if (request.url().startsWith('data:')) return request.continue();
      return request.abort();
    });
    async function open(opts = options) {
      currentOptions = opts;
      await page.goto('https://label.test/');
      await page.waitForFunction(() => !document.querySelector('#printLabel').disabled);
    }
    async function checkGeometry() {
      const result = await page.evaluate(() => {
        const label = document.querySelector('.qrLabel').getBoundingClientRect();
        const elements = [...document.querySelectorAll('.qrLabel *')];
        const qr = document.querySelector('#assetQr').getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          clipped: elements.some(element => { const box = element.getBoundingClientRect(); return box.left < label.left || box.right > label.right + 1 || box.bottom > label.bottom + 1; }),
          squareQr: Math.abs(qr.width - qr.height) < 1,
          loaded: [...document.images].every(image => image.complete && image.naturalWidth > 0),
          qrWidth: qr.width,
        };
      });
      assert.equal(result.overflow, false, 'no horizontal page overflow');
      assert.equal(result.clipped, false, 'label content stays inside its border');
      assert.equal(result.squareQr, true, 'QR remains square');
      assert.equal(result.loaded, true, 'QR and logo loaded');
      assert.ok(result.qrWidth >= 160, 'QR remains large enough to scan');
    }
    for (const width of [1280, 1024, 768, 520, 390, 320]) {
      await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
      await open();
      await checkGeometry();
      await page.screenshot({ path: path.join(evidence, `label-${width}.png`), fullPage: true });
      await open({ ...options, assetTitle: 'Long asset title '.repeat(12), serialNumber: 'SERIAL'.repeat(18), accountName: 'Long account name '.repeat(8) });
      await checkGeometry();
      console.log(`PASS ${width}px, standard and long title/serial`);
    }
    await page.setViewport({ width: 1280, height: 900 });
    await open({ ...options, logoUrl: '', serialNumber: '' });
    assert.equal(await page.$('.serialBlock'), null);
    assert.equal(await page.$eval('#accountLogo', element => element.dataset.originalSrc), fallback);
    await page.screenshot({ path: path.join(evidence, 'label-fallback.png'), fullPage: true });
    await open({ ...options, logoUrl: 'https://broken.test/logo.png' });
    assert.equal(await page.$eval('#accountLogo', element => element.dataset.originalSrc), fallback);
    console.log('PASS absent logo, failed logo fallback and absent serial');
    const paddedLogo = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="1000" height="1000" fill="white"/><rect x="400" y="400" width="200" height="200" fill="#10382f"/></svg>').toString('base64');
    await open({ ...options, logoUrl: paddedLogo, serialNumber: '' });
    assert.equal(await page.$eval('#accountLogo', element => element.naturalWidth), 200, 'empty logo margins are trimmed');
    const heading = await page.evaluate(() => {
      const label = document.querySelector('.qrLabel').getBoundingClientRect();
      const logo = document.querySelector('.logoFrame').getBoundingClientRect();
      const title = document.querySelector('.assetTitle').getBoundingClientRect();
      const details = document.querySelector('.labelDetails').getBoundingClientRect();
      const qr = document.querySelector('.qrFrame').getBoundingClientRect();
      const titleHeader = document.querySelector('.labelTitle').getBoundingClientRect();
      return {
        titleAbove: title.bottom < qr.top && title.bottom < logo.top,
        titleSpans: titleHeader.left <= qr.left && titleHeader.right >= logo.right,
        qrLeft: qr.right < logo.left,
        below: details.top >= logo.bottom,
        accountName: document.querySelector('.accountName').textContent,
        details: [...document.querySelectorAll('.detailRow')].map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]),
        blankLines: document.querySelectorAll('.writingLines').length,
      };
    });
    assert.deepEqual(heading, { titleAbove: true, titleSpans: true, qrLeft: true, below: true, accountName: 'Kuyler Farms', details: [['Year model', '2022'], ['Model', 'TT4.90 4WD Openstation']], blankLines: 0 });
    await open({ ...options, assetTitle: 'Year Unknown Zimmatic 6-Tower + Overhang', yearModel: null, modelName: '6-Tower + Overhang', serialNumber: '' });
    assert.equal(await page.$eval('.assetTitle', element => element.textContent), 'Year Unknown Zimmatic 6-Tower + Overhang');
    await checkGeometry();
    await page.screenshot({ path: path.join(evidence, 'label-approved-layout.png'), fullPage: true });
    await open({ ...options, accountName: '' });
    assert.equal(await page.$('.accountName'), null, 'missing account name does not show a placeholder');
    await open({ ...options, yearModel: null, modelName: '', serialNumber: '' });
    assert.equal(await page.$('.labelDetails'), null, 'no empty detail section');
    await checkGeometry();
    console.log('PASS actual asset detail rows, hidden missing fields and no blank lines');
    await open();
    await page.evaluate(() => { window.print = () => { window.printInvoked = true; }; });
    await page.click('#printLabel');
    assert.equal(await page.evaluate(() => window.printInvoked), true);
    await page.focus('#printLabel');
    await page.keyboard.press('Enter');
    assert.equal(await page.$eval('#printLabel', element => element.matches(':focus-visible')), true);
    await page.emulateMediaType('print');
    const desktopPrint = await page.$eval('.qrLabel', element => element.getBoundingClientRect().width);
    assert.ok(Math.abs(desktopPrint - 186 * 96 / 25.4) < 1);
    assert.equal(await page.$eval('.toolbar', element => getComputedStyle(element).display), 'none');
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: false, path: path.join(evidence, 'label.pdf') });
    assert.equal((await PDFDocument.load(pdf)).getPageCount(), 1, 'label prints on one A4 page');
    await page.screenshot({ path: path.join(evidence, 'label-print.png'), fullPage: true });
    // Screen-only breakpoints must not turn a phone-initiated print into a stacked label.
    await page.setViewport({ width: 390, height: 900 });
    const mobilePrintColumns = await page.$eval('.qrLabel', element => getComputedStyle(element).gridTemplateColumns);
    assert.equal(mobilePrintColumns.split(' ').length, 2);
    const mobilePdf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
    assert.equal((await PDFDocument.load(mobilePdf)).getPageCount(), 1);
    assert.deepEqual(errors, []);
    console.log('PASS print action, keyboard focus, A4 single-page output, phone print layout');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
