/* Verify Add asset chooses a register without navigation or server mutations. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/register-chooser-validation');
const output = process.env.REPORT_OUTPUT_DIR || path.join(root, '.next/register-chooser-validation');
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
  lastKnownLat:-33.96,lastKnownLng:22.46,lastKnownLocationText:'George',photos: [], documents: [], maintenanceStatuses: [], publicAssetCode: '', plateLabel: '',
  note: '', createdAtIso: '2026-09-01T00:00:00Z', updatedAtIso: '2026-09-01T00:00:00Z',
}));

async function click(page, text) {
 await page.waitForFunction(text => {
   const roots=[...document.querySelectorAll('[role="dialog"], [data-download-dialog="true"]')].filter(e=>e.getBoundingClientRect().width);
   return [...(roots.at(-1)||document).querySelectorAll('button')].some(e=>e.textContent.trim().startsWith(text)&&!e.disabled&&Object.keys(e).some(key=>key.startsWith('__reactProps$')));
 }, {timeout:15000}, text);
 await page.evaluate(text => {
   const roots = [...document.querySelectorAll('[role="dialog"], [data-download-dialog="true"]')].filter(e=>e.getBoundingClientRect().width);
   const root = roots.at(-1) || document;
   const button = [...root.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith(text));
   if(!button) throw new Error(`Missing button ${text}`);
   button.click();
 }, text);
 await delay(250);
}
(async () => {
  let server, browser, fixtureCreated = false;
  try {
    await fs.mkdir(fixture); // Refuse to overwrite an existing route.
    fixtureCreated = true;
    await fs.writeFile(path.join(fixture, 'page.tsx'), "import Register from '../asset-register/asset-register-client'; export default function Page(){return <Register/>}");
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
      executablePath: process.env.REPORT_BROWSER_PATH || await chromium.executablePath(),
      args: chromium.args.filter(arg => !['--single-process', '--hide-scrollbars'].includes(arg)),
      ignoreDefaultArgs: ['--hide-scrollbars'], headless: true, pipe: true,
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let combined = false;
    let empty = false;
    const registers = [
      {id:'farm',businessName:'Farm equipment',assetCount:25,totalValue:7500000},
      {id:'transport',businessName:'Transport',assetCount:8,totalValue:1200000},
    ];
    const mutations = [];
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        if(request.method() !== 'GET') mutations.push(request.method()+' '+url.pathname);
        const body = {ok:true,signedIn:true,user:{id:'test',accountType:'owner'},
          profile:{userId:'test',accountType:'owner',name:'Test owner'},
          items:empty?[]:assets,assets:empty?[]:assets,groups:[],
          register:empty?null:combined?{id:'__combined_asset_registers__',businessName:'Combined'}:registers[0],
          registers:empty?[]:registers};
        return request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
      }
      if(request.resourceType()==='media') return request.abort();
      return request.continue();
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window,'outerWidth',{get:()=>innerWidth});
      localStorage.setItem('aim4price.website-canvas.v2.intro','seen');
    });
    for(const width of [1920,430]) {
      await page.setViewport({width,height:1000});
      for(combined of [false,true]) {
        const url='http://localhost:3036/register-chooser-validation'+(combined?'?scope=combined':'?registerId=farm');
        await page.goto(url,{waitUntil:'networkidle2',timeout:120000});
        let navigations=0;
        const onNavigation=frame=>{if(frame===page.mainFrame())navigations++};
        page.on('framenavigated',onNavigation);
        await click(page,'Add Asset');
        await page.waitForSelector('[aria-labelledby="add-asset-destination-title"]');
        const modal='[aria-labelledby="add-asset-destination-title"]';
        const trigger=modal+' button[aria-haspopup="listbox"]';
        assert.equal(await page.$eval(trigger,e=>e.textContent.trim()),combined?'Choose a register':'Farm equipment');
        assert.equal(await page.$eval(modal,e=>[...e.querySelectorAll('button')].find(b=>b.textContent.trim()==='Continue').disabled),combined);
        await page.click(trigger);
        await page.waitForSelector('[role="listbox"]');
        assert.equal(await page.$$eval('[role="option"]',els=>els.length),2);
        await page.screenshot({path:path.join(output,`chooser-${combined?'combined':'single'}-${width}.png`)});
        await page.evaluate(()=>[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.includes('Transport')).click());
        await click(page,'Continue');
        await page.waitForSelector('#add-asset-choice-title');
        assert.ok(await page.$eval('[aria-labelledby="add-asset-choice-title"]',e=>e.textContent.includes('Transport')));
        const valuation=await page.$eval('[aria-labelledby="add-asset-choice-title"] a',e=>e.href);
        assert.equal(new URL(valuation).searchParams.get('registerId'),'transport');
        await click(page,'Manual Entry');
        await page.waitForSelector('#new-acquisition-title');
        assert.ok(await page.$eval('[aria-labelledby="new-acquisition-title"]',e=>e.textContent.includes('Transport')));
        assert.equal(page.url(),url);
        assert.equal(navigations,0,'Choosing a destination must not reload or navigate');
        assert.deepEqual(mutations,[],'Choosing a destination must not change the active register on the server');
        assert.deepEqual(errors,[]);
        page.off('framenavigated',onNavigation);
        console.log(`PASS ${combined?'combined':'single'} ${width}px: chooser, target propagation, no navigation`);
      }
    }
    empty=true;
    await page.goto('http://localhost:3036/register-chooser-validation',{waitUntil:'networkidle2'});
    await click(page,'Add Asset');
    assert.equal(await page.$('[aria-labelledby="add-asset-destination-title"]'),null);
    assert.ok(await page.$eval('body',e=>e.textContent.includes('Create an Asset Register before adding an asset.')));
    console.log('PASS empty register guard');
  } finally {
    if (fixtureCreated) {
      await fs.unlink(path.join(fixture, 'page.tsx')).catch(() => {});
      await fs.rmdir(fixture).catch(() => {});
      await fs.unlink(path.join(root, '.next/types/app/register-chooser-validation/page.ts')).catch(() => {});
    }
    if (browser) await browser.close();
    if (server) server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
