/* Browser-level offline tests with a local public shell and fake authenticated APIs. No customer data. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
async function main() {
  let identity = 'owner:manager', uploads = 0, attempts = 0, dropNext = true;
  const events = new Map();
  const snapshot = () => ({ ok: true, identity, displayName: 'Offline Test Manager', savedAt: new Date().toISOString(), canRecordWork: true,
    assets: [{ id: 'asset', publicAssetCode: 'A4P-TEST', title: 'Test tractor', registrationNumber: 'TEST123', usageMetric: 'hours', usageReading: 100, usageLabel: '100 hours', note: 'Private asset note' }],
    tasks: [{ id: 'task', assetId: 'asset', title: 'Oil service', notes: 'Change oil', maintenanceType: 'service', dueDate: '2026-09-20', status: 'Upcoming' }] });
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        if (req.method === 'GET') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(url.searchParams.has('identityOnly') ? { ok: true, identity } : snapshot())); return; }
        if (req.headers['x-aim4price-offline-identity'] !== identity) { res.writeHead(409, { 'Content-Type': 'application/json' }); res.end('{"ok":false,"error":"Wrong account"}'); return; }
        let body = ''; for await (const part of req) body += part;
        if (url.pathname.endsWith('/upload')) { uploads++; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, uploads: [{ url: '/api/asset-register/uploads/photo-' + uploads }] })); return; }
        const data = JSON.parse(body); attempts++; events.set(data.clientEventId, data);
        if (dropNext) { dropNext = false; res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"ok":false,"error":"Confirmation interrupted"}'); return; }
        res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true,"asset":{"id":"asset"},"scheduledMaintenanceCompletion":{"completed":true}}'); return;
      }
      const allowed = ['/field-manager/offline.html', '/field-manager/offline.css', '/field-manager/montserrat-latin.woff', '/field-manager/offline.mjs', '/field-manager/offline-store.mjs', '/field-manager-sw.js', '/app-push-worker.js'];
      if (!allowed.includes(url.pathname)) { req.socket.destroy(); return; }
      const file = path.join(root, 'public', url.pathname);
      res.setHeader('Content-Type', url.pathname.endsWith('.woff') ? 'font/woff' : url.pathname.endsWith('.html') ? 'text/html' : url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript');
      res.setHeader('Cache-Control', 'no-store'); res.end(await fs.readFile(file));
    } catch (error) { res.writeHead(500); res.end(String(error)); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true, pipe: true });
    const context = browser.defaultBrowserContext(); await context.overridePermissions(origin, ['geolocation']);
    const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.setGeolocation({ latitude: -25.7, longitude: 28.2, accuracy: 10 });
    const notice = () => page.$eval('#notice', n => n.textContent);
    await page.goto(origin + '/field-manager/offline.html');
    await page.evaluate(async () => { const old = await caches.open('aim4price-field-offline-shell-v1'); await old.put('/old-shell-marker', new Response('old')); });
    await page.type('#pin', '12345678'); await page.type('#confirm-pin', '12345678'); await page.click('#unlock-button');
    await page.waitForSelector('#workspace:not([hidden])');
    await page.waitForFunction(() => !document.querySelector('#sync').disabled);
    assert.match(await page.$eval('#assets', n => n.textContent), /Test tractor/);
    await page.waitForFunction(async () => !(await caches.keys()).includes('aim4price-field-offline-shell-v1'));
    assert.equal(await page.evaluate(async () => !!await caches.match('/field-manager/montserrat-latin.woff', { cacheName: 'aim4price-field-offline-shell-v2' })), true);
    console.log('PASS preparation, snapshot, upgraded shell and locally cached font');
    await page.setOfflineMode(true);
    await page.click('.asset'); await page.select('#action', 'Serviced'); await page.select('#task', 'task');
    await page.type('#usage', '105'); await page.type('#notes', 'Changed engine oil offline');
    await page.evaluate(() => {
      const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='), c => c.charCodeAt(0));
      const transfer = new DataTransfer(); transfer.items.add(new File([bytes], 'oil.png', { type: 'image/png' }));
      document.querySelector('#photos').files = transfer.files; document.querySelector('#photos').dispatchEvent(new Event('change'));
    });
    await page.click('#gps'); await page.waitForFunction(() => document.querySelector('#gps-status').textContent.includes('captured'));
    await page.click('#save'); await page.waitForFunction(() => document.querySelector('#pending-count').textContent === '(1)');
    assert.match(await notice(), /Saved on this phone/);
    const encrypted = await page.evaluate(async () => {
      const db = await new Promise(resolve => { const req = indexedDB.open('aim4price-field-offline-v1', 1); req.onsuccess = () => resolve(req.result); });
      const record = await new Promise(resolve => { const req = db.transaction('vault').objectStore('vault').get('current'); req.onsuccess = () => resolve(req.result); }); db.close();
      return { keys: Object.keys(record), plaintext: new TextDecoder().decode(record.bytes) };
    });
    assert.deepEqual(encrypted.keys.sort(), ['bytes', 'iv', 'salt', 'version']);
    assert.ok(!encrypted.plaintext.includes('Changed engine oil offline'));
    await page.goto(origin + '/field-manager/assets/A4P-TEST');
    await page.waitForFunction(() => document.querySelector('#unlock-button')?.textContent === 'Unlock');
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.fonts.check('800 16px Montserrat')), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.type('#pin', '99999999'); await page.click('#unlock-button');
    await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('could not unlock'));
    await page.$eval('#pin', n => n.value = ''); await page.type('#pin', '12345678'); await page.click('#unlock-button');
    await page.waitForSelector('#workspace:not([hidden])');
    assert.equal(await page.$eval('#pending-count', n => n.textContent), '(1)');
    console.log('PASS offline navigation/reload, PIN encryption, persisted maintenance + reading + photo');
    await page.waitForFunction(() => !document.querySelector('#sync').disabled);
    await page.click('.asset'); await page.select('#action', 'Serviced');
    assert.equal(await page.$eval('#usage', n => n.min), '105');
    await page.click('#back');
    identity = 'other-owner:other-manager';
    await page.setOfflineMode(false);
    await page.click('#sync');
    await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('account that captured'));
    assert.equal(attempts, 0); assert.equal(uploads, 0);
    console.log('PASS account switching sends no work or photos to another account');
    identity = 'owner:manager';
    await page.click('#sync');
    await page.waitForFunction(() => !document.querySelector('#sync').disabled);
    assert.equal(events.size, 1); assert.equal(uploads, 1);
    assert.equal(await page.$eval('#pending-count', n => n.textContent), '(1)');
    await page.click('#sync'); await page.waitForFunction(() => document.querySelector('#pending-count').textContent === '(0)');
    assert.equal(events.size, 1); assert.equal(attempts, 2); assert.equal(uploads, 1);
    const saved = [...events.values()][0]; assert.equal(saved.hours, '105'); assert.equal(saved.scheduledMaintenanceId, 'task'); assert.equal(saved.photoUrls.length, 1); assert.equal(saved.latitude, -25.7);
    console.log('PASS interrupted response retry keeps event ID, reuses uploaded photo and removes only confirmed work');
    // A second tab cannot unlock or mutate the same vault concurrently.
    const second = await browser.newPage(); await second.goto(origin + '/field-manager/offline.html');
    await second.type('#pin', '12345678'); await second.click('#unlock-button');
    await second.waitForFunction(() => document.querySelector('#notice').textContent.includes('another tab'));
    assert.equal(await second.$eval('#workspace', n => n.hidden), true); await second.close();
    console.log('PASS one unlocked tab protects the encrypted queue from concurrent writers');
    // Simulate blocked/full device storage. No false success and no discarded form.
    await page.waitForFunction(() => !document.querySelector('#sync').disabled);
    await page.setOfflineMode(true); await page.click('.asset'); await page.type('#notes', 'Unsaved note stays in form');
    await page.click('#gps'); await page.waitForFunction(() => document.querySelector('#gps-status').textContent.includes('captured'));
    await page.evaluate(() => { window.originalVaultPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function() { throw new DOMException('Full', 'QuotaExceededError'); }; });
    await page.click('#save'); await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('has not been saved'));
    assert.equal(await page.$eval('#notes', n => n.value), 'Unsaved note stays in form');
    assert.equal(await page.$eval('#pending-count', n => n.textContent), '(0)');
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.originalVaultPut; document.querySelector('#notes').value = ''; });
    await page.click('#back');
    console.log('PASS full storage preserves the unsaved form and does not report success');
    const cacheEntries = await page.evaluate(async () => { const keys = await caches.keys(); const urls = []; for (const key of keys) for (const req of await (await caches.open(key)).keys()) urls.push(req.url); return urls; });
    assert.ok(cacheEntries.length >= 4); assert.ok(cacheEntries.every(url => !url.includes('/api/') && !url.includes('/assets/')));
    assert.deepEqual(errors, []);
    await fs.mkdir(path.join(root, '.next/field-offline-validation'), { recursive: true });
    await page.screenshot({ path: path.join(root, '.next/field-offline-validation/mobile.png'), fullPage: true });
    console.log('PASS public-only service worker cache and no browser runtime errors');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
