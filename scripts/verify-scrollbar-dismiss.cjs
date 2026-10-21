/* Exercise the production scrollbar guard against document-level dismissal. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const puppeteer = require('puppeteer-core');
const chromiumModule = require('@sparticuz/chromium');
const chromium = chromiumModule.default || chromiumModule;
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/scrollbar-interaction.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
(async () => {
  const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(),
    args: chromium.args.filter(arg => arg !== '--hide-scrollbars'),
    ignoreDefaultArgs: ['--hide-scrollbars'], headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 650 });
    for (const zoom of [1, 1.25]) {
      await page.setContent(`<!doctype html><style>
        ::-webkit-scrollbar{width:18px;height:18px}::-webkit-scrollbar-thumb{background:#648e7d}
        body{margin:0;height:1800px;width:1200px}#scroller{position:fixed;left:40px;top:40px;width:400px;height:350px;overflow:auto;border:2px solid black;zoom:${zoom}}
        #card{background:white;height:900px;padding:20px}button{padding:20px}
        </style><div id="scroller"><div id="card"><button id="close">Close</button></div></div>`);
      await page.evaluate(code => {
        const exports = {}; new Function('exports', code)(exports);
        window.cleanup = exports.installScrollbarInteractionGuard();
        window.cardClosed = false;
        document.addEventListener('pointerdown', event => {
          if (!document.querySelector('#card').contains(event.target)) window.cardClosed = true;
        });
        document.querySelector('#scroller').addEventListener('click', event => {
          if (event.target === event.currentTarget) window.cardClosed = true;
        });
        document.querySelector('#close').onclick = () => { window.cardClosed = true; };
      }, source);
      // Native scrollbar hit testing uses the compositor's painted geometry.
      // setContent/layout alone can finish before the first frame is presented.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const points = await page.evaluate(() => {
        const el = document.querySelector('#scroller'), r = el.getBoundingClientRect();
        return { viewportX: innerWidth - 5, viewportY: innerHeight - 5,
          nestedX: r.right - 8, nestedY: r.top + 80, nestedBottom: r.bottom - 30,
          gutter: el.offsetWidth - el.clientWidth };
      });
      assert(points.gutter > 4, 'fixture must have a real native scrollbar');
      // Hold each native track press until it scrolls, then release. A zero-delay
      // down/up can be coalesced before Chromium processes a native scrollbar.
      async function pressTrack(x, y, hasScrolled) {
        await page.mouse.move(x, y);
        await page.mouse.down();
        try { await page.waitForFunction(hasScrolled, { timeout: 3000 }); }
        finally {
          await page.mouse.up();
          // Let Chromium deliver the native release before another press.
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }
      // Native track clicks must still scroll, and never dismiss the card.
      await pressTrack(points.viewportX, 500, () => scrollY > 0);
      assert.equal(await page.evaluate(() => window.cardClosed), false);
      await pressTrack(700, points.viewportY, () => scrollX > 0);
      assert.equal(await page.evaluate(() => window.cardClosed), false);
      await pressTrack(points.nestedX, points.nestedBottom, () => document.querySelector('#scroller').scrollTop > 0);
      assert.equal(await page.evaluate(() => window.cardClosed), false);
      await page.evaluate(() => { document.querySelector('#scroller').scrollTop = 0; });
      await page.mouse.move(points.nestedX - 60, points.nestedY);
      await page.mouse.wheel({ deltaY: 200 });
      await page.waitForFunction(() => document.querySelector('#scroller').scrollTop > 0, { timeout: 3000 });
      // Release/click can land outside the scrollbar after dragging off the thumb.
      await page.evaluate(({ nestedX, nestedY }) => {
        const el = document.querySelector('#scroller');
        const down = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: nestedX, clientY: nestedY });
        el.dispatchEvent(down);
        if (down.defaultPrevented) throw Error('Native scrolling must not be cancelled');
        document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 700, clientY: 200 }));
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, clientX: 700, clientY: 200 }));
      }, points);
      assert.equal(await page.evaluate(() => window.cardClosed), false);
      // A subsequent genuine outside click must still dismiss.
      await page.mouse.click(750, 200);
      assert.equal(await page.evaluate(() => window.cardClosed), true);
      await page.evaluate(() => { window.cardClosed = false; document.querySelector('#scroller').scrollTop = 0; });
      await page.click('#close');
      assert.equal(await page.evaluate(() => window.cardClosed), true);
      await page.evaluate(() => window.cleanup());
    }
    console.log('PASS: viewport and nested scrollbar scrolling, zoom, drag release, outside dismissal and close button');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
