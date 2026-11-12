const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
module.exports = async function checkBrowser(e) {
  for (const [role, account] of Object.entries(e.accounts)) {
    // Keep Chromium's normal Origin behavior; the package default disables web security.
    const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args.filter(a => !['--single-process', '--disable-web-security'].includes(a)), pipe: true, headless: true, protocolTimeout: 120000 });
    try {
      const page = await browser.newPage();
      console.log('Browser starting ' + role);
      page.setDefaultTimeout(60000);
      await page.setViewport({ width: 393, height: 852 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.setBypassServiceWorker(true);

      // Synthetic local credentials; exercise the real form, origin checks and signed cookie.
      await page.goto(e.origin + '/owner-app/login', {waitUntil:'domcontentloaded',timeout:120000});
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Continue to login')));
      await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Continue to login')).click());
      await page.locator('#owner-app-username').fill(account.username);
      await page.locator('#owner-app-password').fill(account.password);
      await page.evaluate(() => document.querySelector('form').requestSubmit());
      await page.waitForFunction(() => location.pathname === '/owner-app', {polling:250,timeout:15000});
      await page.goto(e.origin + '/owner-app/assets/' + e.assets.tractor + '/details', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForFunction(() => document.body.innerText.includes('QA tractor tractor') && !document.body.innerText.includes('Loading asset'));
      assert(await page.$('[data-app-shell="owner"]'), role + ': retains native app shell');
      const restricted = await page.$('[aria-label="Value restricted"]');
      assert.equal(Boolean(restricted), !account.permissions.viewValues, role + ': values restriction matches role');
      if (restricted) {
        assert(await page.$eval('[aria-label="Value restricted"] [aria-hidden="true"]', el => getComputedStyle(el).filter.includes('blur')), role + ': placeholder visibly blurred');
        assert(!/987\s?654|1\s?234\s?567/.test(await page.$eval('body', el => el.innerText)), role + ': actual money never rendered');
      }
      const files = await page.$$eval('input[type="file"]', inputs => inputs.map(i => !i.disabled));
      assert.deepEqual(files, [account.permissions.uploadPhotos, account.permissions.uploadDocuments], role + ': upload gates');
      for (const width of [320,393]) {
        await page.setViewport({ width, height: 852 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), role + ': no horizontal overflow at ' + width);
      }
      await page.screenshot({ path: e.dir + '/' + role + '-details.png', fullPage: true });
      if (account.permissions.updateUsage) {
        await page.goto(e.origin + '/owner-app/assets/' + e.assets.tractor + '/manage/usage', {waitUntil:'domcontentloaded',timeout:120000});
        await page.waitForSelector('input[type="number"]');
        const nextUsage = 3000 + Object.keys(e.accounts).indexOf(role);
        // Replace the whole numeric value; locator.fill can append to a controlled number input.
        const input = await page.$('input[type="number"]');
        await input.focus();
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
        await input.type(String(nextUsage), {delay:30});
        await page.waitForFunction(value => document.querySelector('input[type="number"]').value === value, {}, String(nextUsage));
        await page.evaluate(() => document.querySelector('form').requestSubmit());
        await page.waitForFunction(() => document.body.textContent.includes('Asset changes saved.'), {polling:250,timeout:15000});
        const stored = await e.db.query('SELECT hours FROM asset_register_items WHERE id=$1',[e.assets.tractor]);
        assert.equal(Number(stored.rows[0].hours), nextUsage, role + ': browser edit persisted');
      }
      assert.deepEqual(errors, [], role + ': no browser errors');

      console.log('PASS browser ' + role + ': login, details, blur, uploads, 320/393px' + (account.permissions.updateUsage ? ', saved edit verified' : ''));
    } finally { await browser.close(); }
  }
};
