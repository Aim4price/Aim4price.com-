/* Verify Add asset chooses a register without navigation or server mutations. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/compact-details-validation');
const output = process.env.REPORT_OUTPUT_DIR || path.join(root, '.next/compact-details-validation');
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
        const body = {asset:assets[0],ok:true,signedIn:true,user:{id:'test',accountType:'owner'},
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
    for(const {width,kind} of [{width:1920,kind:'vehicle'},{width:1366,kind:'vehicle'},{width:430,kind:'vehicle'},{width:1366,kind:'manual'},{width:1366,kind:'property'},{width:1366,kind:'stock'}]) {
      assets[0].kind=kind;
      const sections=['identity',...(['manual','property','stock'].includes(kind)?['classification']:[]),...(kind==='stock'?[]:['condition']),'values','notes'];
      await page.setViewport({width,height:width===1366?768:900});
      await page.goto('http://localhost:3036/compact-details-validation?registerId=farm',{waitUntil:'networkidle2',timeout:120000});
      await page.waitForSelector('#asset-card-1 [data-tooltip="Manage asset"]');
      await page.$eval('#asset-card-1 [data-tooltip="Manage asset"]',e=>e.click());
      await page.waitForSelector('[data-manage-action="details"]');
      await page.$eval('[data-manage-action="details"]',e=>e.click());
      await page.waitForSelector('[data-asset-update-section="2"]');
      await page.$eval('[data-asset-update-section="2"]',e=>e.click());
      for(const section of sections) {
        await page.waitForSelector(`[data-details-page="${section}"]`);
        const fits=await page.$eval('[role="dialog"][aria-label="Update asset"]',dialog=>{
          const r=dialog.getBoundingClientRect();
          const scrollers=[dialog,...dialog.querySelectorAll('div')].filter(e=>e.getBoundingClientRect().width&&['auto','scroll'].includes(getComputedStyle(e).overflowY));
          return {bottom:r.bottom,height:innerHeight,horizontal:dialog.scrollWidth-dialog.clientWidth,overflow:Math.max(0,...scrollers.map(e=>e.scrollHeight-e.clientHeight))};
        });
        await page.screenshot({path:path.join(output,section+'-'+kind+'-'+width+'.png')});
        assert(fits.horizontal<=2 && fits.overflow<=2 && fits.bottom<=fits.height+2,'Details fit '+section+' '+width+' '+JSON.stringify(fits));
        assert.equal(await page.$eval('html',e=>getComputedStyle(e).overflowY),'hidden','No page scrollbar behind the modal');
        if(section!=='notes')await click(page,'Next');
      }
      for(const section of sections.slice(0,-1).reverse()){await click(page,'Back');await page.waitForSelector(`[data-details-page="${section}"]`);}
      assert.equal(await page.$eval('[data-details-section="identity"] input',e=>e.value),'Vehicle 01');
      await page.click('[aria-label="Advanced asset settings"]');
      await page.waitForSelector('[data-settings-action="location"]');
      await page.click('[data-settings-action="location"]');
      await click(page,'Tracking device');
      await page.waitForSelector('[data-tracking-options="choice"]');
      const backs=await page.$$eval('[aria-labelledby="asset-settings-title"] button',els=>els.filter(e=>e.getBoundingClientRect().width&&/^Back/.test(e.textContent.trim())).length);
      assert.equal(backs,1,'One back action in the register tracking chooser');
      await page.screenshot({path:path.join(output,'tracking-'+width+'.png')});
    }
    assert.deepEqual(mutations,[],'Moving between pages does not alter asset data');
    assert.deepEqual(errors,[]);
    console.log('PASS details pages, visible controls, no scrolling at 1920/1366/430, back navigation, one tracking back action and no accidental mutations');
  } finally {
    if(browser)await browser.close();
    if(server&&server.exitCode===null){const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await stopped;}
    if(fixtureCreated)await fs.rm(fixture,{recursive:true,force:true});
    await fs.rm(path.join(root,'.next/types/app/compact-details-validation'),{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
