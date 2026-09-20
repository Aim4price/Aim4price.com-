/* Real browser storage, encryption and service workers; fake account APIs, no customer data. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
const roots = { owner: '/owner-app', field: '/field-manager', dealer: '/dealer', middleman: '/middleman' };
const received = [], writes = new Map();
let rejectNext = false;
function snapshot(app) {
  const operational = ['owner','field'].includes(app);
  return { ok: true, identity: app + ':account:actor', displayName: app + ' tester', savedAt: new Date().toISOString(), canRecordWork: app !== 'middleman', canRecordFuel: operational, canRefillFuel: operational, canRecordNotes: !operational,
    assets: app === 'middleman' ? [] : [{ id: 'asset', title: 'Test tractor', publicAssetCode: 'A4P-TEST', usageMetric: 'hours', usageReading: 100, usageLabel: '100 hours', canReceiveFuel: true }, { id: 'excluded', title: 'Excluded implement', publicAssetCode: 'A4P-NOFUEL', usageMetric: 'none', canReceiveFuel: false }],
    tasks: [{ id: 'task', assetId: 'asset', maintenanceType: 'service', title: 'Oil service' }],
    storages: operational ? [{ id: 'tank', name: 'Farm tank', publicFuelStorageCode: 'FUEL-TEST', currentLitres: 800, fuelType: 'Diesel' }] : [],
    listings: !operational ? [{ id: 'listing', title: 'Saved showroom tractor', note: 'Saved description', price: 200000 }] : [],
    leads: app === 'dealer' ? [{ id: 'lead', title: 'Tractor enquiry', note: 'Please call', name: 'Test customer' }] : [], notes: [] };
}
async function main() {
  const server = http.createServer(async (req,res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/app-offline/')) {
        const app = url.pathname.split('/')[3];
        assert.equal(req.headers['x-aim4price-client-realm'], app);
        res.setHeader('Content-Type','application/json');
        if (req.method === 'GET') return res.end(JSON.stringify(url.searchParams.has('identityOnly') ? { ok:true, identity:snapshot(app).identity } : snapshot(app)));
        assert.equal(req.headers['x-aim4price-offline-identity'], snapshot(app).identity);
        let body = ''; for await (const part of req) body += part;
        if (url.pathname.endsWith('/upload')) return res.end(JSON.stringify({ok:true,uploads:[{url:'/photo/test',uploadId:'upload',fileName:'slip.png',contentType:'image/png',byteSize:68}]}));
        const item = JSON.parse(body); received.push({app,...item});
        if (rejectNext) { rejectNext=false; res.statusCode=409; return res.end('{"ok":false,"error":"Reading changed. Review saved work."}'); }
        writes.set(app + ':' + item.payload.clientEventId,item);
        return res.end('{"ok":true,"asset":{"id":"asset"},"scheduledMaintenanceCompletion":{"completed":true}}');
      }
      const allowed = url.pathname.startsWith('/app-offline/') || Object.values(roots).some(r => url.pathname === r+'/offline.html') || url.pathname.endsWith('-sw.js') || ['/app-theme.css','/app-push-worker.js','/field-manager/montserrat-latin.woff'].includes(url.pathname);
      if (!allowed) return req.socket.destroy();
      const file = path.join(root,'public',url.pathname);
      res.setHeader('Content-Type',url.pathname.endsWith('.html')?'text/html':url.pathname.endsWith('.css')?'text/css':url.pathname.endsWith('.woff')?'font/woff':'application/javascript');
      res.end(await fs.readFile(file));
    } catch(e) {res.statusCode=500;res.end(String(e));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser=await puppeteer.launch({executablePath:process.env.OFFLINE_TEST_CHROMIUM || await chromium.executablePath(),args:chromium.args.filter(a=>a!=='--single-process'),headless:true,pipe:true});
    for (const [app,appRoot] of Object.entries(roots)) {
      const context=await browser.createBrowserContext(); await context.overridePermissions(origin,['geolocation']);
      const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await page.setGeolocation({latitude:-25.7,longitude:28.2,accuracy:10});
      page.setDefaultTimeout(12000);
      const ready=()=>page.waitForFunction(()=>!document.querySelector('#sync').disabled);
      const set=async(values)=>page.evaluate(v=>{for(const [id,value] of Object.entries(v)) document.getElementById(id).value=value;},values);
      await page.evaluateOnNewDocument(root => localStorage.setItem('aim4price-app-theme:' + root.slice(1), 'dark'), appRoot);
      await page.goto(origin+appRoot+'/offline.html');assert.equal(await page.$eval('html', n => n.dataset.appTheme), 'dark');await page.type('#pin','12345678');await page.type('#confirm-pin','12345678');await page.click('#unlock-button');
      await page.waitForSelector('#workspace:not([hidden])');await ready();await page.setOfflineMode(true);
      if (['owner','field'].includes(app)) {
        await page.click('#open-fuel');
        assert.equal(await page.$eval('#fuel-asset',n=>n.options.length),1);
        for (const kind of ['fuel-issue','fuel-slip','fuel-refill','fuel-dipstick']) {
          if(kind !== 'fuel-issue') await page.click('#open-fuel');
          await page.select('#fuel-action',kind);
          await set({'fuel-litres':'20','fuel-before':'25','fuel-after':'50','fuel-reading':'105','station':'Test station','slip-date':'2026-09-18','fuel-total':'500','fuel-activity':'Orchard work','fuel-area':'North block','fuel-notes':'Physical dipstick check'});
          await page.click('#fuel-gps');await page.waitForFunction(()=>document.getElementById('fuel-gps-status').textContent.includes('captured'));
          await page.click('#fuel-form button[type=submit]');await page.waitForSelector('#workspace:not([hidden])');await ready();
        }
        assert.equal(await page.$eval('#pending-count',n=>n.textContent),'(4)');
      } else {
        if(app==='dealer') {
          await page.click('.asset'); await page.select('#action','Serviced'); await page.select('#task','task');
          await set({company:'Test workshop',mechanic:'Test mechanic',usage:'110',notes:'Oil changed'});
          await page.click('#gps');await page.waitForFunction(()=>document.getElementById('gps-status').textContent.includes('captured'));await page.click('#save');await page.waitForSelector('#workspace:not([hidden])');await ready();
        }
        await page.click('#new-note');await set({'note-title':'Call customer','note-text':'Discuss the saved tractor tomorrow'});await page.click('#note-form button[type=submit]');await page.waitForSelector('#workspace:not([hidden])');await ready();
      }
      // A cold navigation returns the public shell and requires the PIN again.
      await page.goto(origin+appRoot+'/unavailable-offline');await page.waitForSelector('#pin');await page.type('#pin','12345678');await page.click('#unlock-button');await page.waitForSelector('#workspace:not([hidden])');await ready();
      assert.equal(await page.$eval('html', n => n.dataset.appTheme), 'dark');
      assert.equal(await page.$eval('#gate', n => getComputedStyle(n).backgroundColor), 'rgb(32, 56, 47)');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await fs.mkdir(path.join(root,'.next/app-offline-validation'),{recursive:true});await page.screenshot({path:path.join(root,'.next/app-offline-validation',app+'.png'),fullPage:true});
      if(app==='owner') {
        rejectNext=true;await page.setOfflineMode(false);await page.click('#sync');await ready();
        await page.waitForFunction(()=>document.getElementById('queue').textContent.includes('Edit saved update'));
        const firstEvent=received.find(w=>w.app==='owner').payload.clientEventId;
        await page.evaluate(()=>[...document.querySelectorAll('#queue button')].find(b=>b.textContent==='Edit saved update').click());
        await set({'fuel-reading':'120'});await page.click('#fuel-gps');await page.waitForFunction(()=>document.getElementById('fuel-gps-status').textContent.includes('captured'));
        await page.click('#fuel-form button[type=submit]');await page.waitForFunction(()=>document.getElementById('pending-count').textContent==='(0)');
        assert.equal(received.filter(w=>w.app==='owner')[1].payload.clientEventId,firstEvent);
      } else { await page.setOfflineMode(false);await page.click('#sync');await page.waitForFunction(()=>document.getElementById('pending-count').textContent==='(0)'); }
      await ready(); assert.deepEqual(errors,[]);
      const expected=['owner','field'].includes(app)?4:app==='dealer'?2:1;
      assert.equal([...writes.keys()].filter(k=>k.startsWith(app+':')).length,expected);
      console.log('PASS '+app+': offline preparation, capture, cold reopen, PIN unlock, scoped sync and mobile layout');
      await context.close();
    }
  } finally {if(browser) await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
