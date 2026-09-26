/* Real SiteWorkspaceZoom component in Chromium, Firefox and WebKit.
 * Feature profiles exercise API fallbacks; they are not real-device certification.
 * Install Playwright separately (see website validation workflow). */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const playwright = require(process.env.PHONE_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/phone-rotation-validation');
const base = 'http://127.0.0.1:3037';
const gate = '[data-mobile-landscape-entry]';
async function main() {
  let server;
  try {
    await fs.mkdir(fixture, { recursive: true });
    await fs.writeFile(path.join(fixture, 'page.tsx'), 'export default function Page(){return <main><h1>Phone rotation validation</h1><input aria-label="Keyboard test" /></main>}');
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '3037'], {
      cwd: root, env: { ...process.env, PGHOST: '127.0.0.1', PGPORT: '5432', PGUSER: 'validation', PGPASSWORD: 'local-only', PGDATABASE: 'validation', BETTER_AUTH_SECRET: 'local-validation-only-secret' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Server startup timed out')), 60000);
      server.stdout.on('data', data => { if (data.toString().includes('Ready')) { clearTimeout(timer); resolve(); } });
      server.once('exit', code => { clearTimeout(timer); reject(Error(`Server exited: ${code}`)); });
      server.stderr.on('data', data => process.stderr.write(data));
    });
    for (const engine of (process.env.PHONE_BROWSER_ENGINES || 'chromium,firefox,webkit').split(',')) {
      const browser = await playwright[engine].launch({ headless: true });
      try {
        for (const profile of ['modern', 'legacy', 'layout-only', 'desktop-mode', 'blocked-storage', 'desktop', 'tablet']) {
          console.log(`Checking ${engine}: ${profile}`);
          const context = await browser.newContext({ viewport: { width: profile === 'desktop-mode' ? 980 : 390, height: 844 } });
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.route('**/api/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, signedIn: false, user: null, notifications: [] }) }));
          await page.addInitScript(profile => {
            const legacy = profile === 'legacy';
            const layoutOnly = profile === 'layout-only';
            const screenWidth = profile === 'desktop' ? 1920 : profile === 'tablet' ? 768 : 390;
            Object.defineProperty(screen, 'width', { configurable: true, value: screenWidth });
            Object.defineProperty(screen, 'height', { configurable: true, value: profile === 'tablet' ? 1024 : 844 });
            Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: profile === 'desktop' ? 0 : 5 });
            const orientation = new EventTarget();
            orientation.type = 'portrait-primary';
            Object.defineProperty(screen, 'orientation', { configurable: true, value: legacy || layoutOnly ? undefined : orientation });
            Object.defineProperty(window, 'orientation', { configurable: true, writable: true, value: legacy ? 0 : undefined });
            // Report no coarse primary pointer: maxTouchPoints must still detect a phone.
            const matchMedia = window.matchMedia.bind(window);
            window.matchMedia = query => {
              const media = matchMedia(query);
              if (query.includes('pointer')) Object.defineProperty(media, 'matches', { value: false });
              if (legacy) {
                Object.defineProperty(media, 'addEventListener', { value: undefined });
                Object.defineProperty(media, 'removeEventListener', { value: undefined });
              }
              return media;
            };
            if (legacy || layoutOnly) Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
            if (profile === 'blocked-storage') for (const key of ['sessionStorage', 'localStorage']) {
              Object.defineProperty(window, key, { configurable: true, get() { throw new DOMException('Blocked', 'SecurityError'); } });
            }
            window.rotateTestPhone = landscape => {
              if (legacy) window.orientation = landscape ? 90 : 0;
              else orientation.type = landscape ? 'landscape-primary' : 'portrait-primary';
              // Only the modern orientation event is dispatched for modern profiles.
              if (!legacy && !layoutOnly) orientation.dispatchEvent(new Event('change'));
              else window.dispatchEvent(new Event('orientationchange'));
            };
          }, profile);
          await page.goto(base + '/phone-rotation-validation', { waitUntil: 'networkidle', timeout: 120000 });
          await page.waitForSelector('[data-website-canvas]');
          if (profile === 'desktop' || profile === 'tablet') {
            assert.equal(await page.locator(gate).count(), 0, `${engine}/${profile} must not show phone gate`);
          } else {
            await page.locator(gate).waitFor({ state: 'visible' });
            // A short viewport (keyboard/browser UI) must not override actual orientation.
            if (profile !== 'layout-only') {
              await page.setViewportSize({ width: 390, height: 300 });
              await page.waitForTimeout(350);
              assert.equal(await page.locator(gate).count(), 1);
            }
            await page.setViewportSize({ width: 844, height: 390 });
            await page.evaluate(() => window.rotateTestPhone(true));
            await page.locator(gate).waitFor({ state: 'hidden' });
            assert.equal(await page.locator('[data-website-canvas]').getAttribute('inert'), null);
            await page.setViewportSize({ width: 390, height: 844 });
            await page.evaluate(() => window.rotateTestPhone(false));
            await page.locator(gate).waitFor({ state: 'visible' });
            await page.getByRole('button', { name: 'Continue in portrait' }).click();
            await page.locator(gate).waitFor({ state: 'hidden' });
            await page.evaluate(() => { window.dispatchEvent(new Event('pageshow')); window.rotateTestPhone(false); });
            await page.waitForTimeout(350);
            assert.equal(await page.locator(gate).count(), 0, 'Bypass survives subsequent geometry events');
            if (profile !== 'blocked-storage') {
              await page.reload({ waitUntil: 'networkidle' });
              assert.equal(await page.locator(gate).count(), 0, 'Bypass survives reload in this tab');
            }
          }
          assert.deepEqual(errors, [], `${engine}/${profile} runtime errors`);
          console.log(`PASS ${engine}: ${profile}`);
          await context.close();
        }
      } finally { await browser.close(); }
    }
  } finally {
    if (server && server.exitCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve));
      server.kill('SIGTERM');
      await exited;
    }
    await fs.rm(fixture, { recursive: true, force: true });
    await fs.rm(path.join(root, '.next/types/app/phone-rotation-validation'), { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
