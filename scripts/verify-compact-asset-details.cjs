/* Exercise the real register dialogs, including tracking at the user’s 106% page size. */
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
        const body = url.pathname.endsWith('/tracking') ? (request.method()==='POST' ? {code:'ABCD-EF01-2345-6789',expiresInMinutes:15} : {device:null,assetTitle:assets[0].title}) : {asset:assets[0],ok:true,signedIn:true,user:{id:'test',accountType:'owner'},
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
    for(const {width,kind} of [{width:1920,kind:'vehicle'},{width:1536,kind:'vehicle'},{width:1366,kind:'vehicle'},{width:430,kind:'vehicle'},{width:1366,kind:'manual'},{width:1366,kind:'property'},{width:1366,kind:'stock'}]) {
      assets[0].kind=kind;
      const sections=['identity',...(['manual','property','stock'].includes(kind)?['classification']:[]),...(kind==='stock'?[]:['condition']),'values','notes'];
      await page.setViewport({width,height:width===1536?696:width===1366?768:width===1920?870:900,deviceScaleFactor:width===1536?1.25:1});
      await page.goto('http://localhost:3036/compact-details-validation?registerId=farm',{waitUntil:'networkidle2',timeout:120000});
      await page.waitForSelector('#asset-card-1 [data-tooltip="Manage asset"]');
      if(width===1920||width===1536) {
        await page.click('[aria-label="Zoom in"]');
        await page.waitForSelector('#website-zoom-slider',{visible:true});
        await page.$eval('#website-zoom-slider',e=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'106');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
        await page.click('[aria-label="Close page size"]');
        await page.waitForFunction(()=>Number(document.querySelector('[data-website-canvas]')?.dataset.websiteScale)===1.06);
      }
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
      if(kind==='vehicle') {
        async function checkTracking(stage) {
          await delay(600); // Also catch unintended smooth scrolling after code creation.
          const geometry=await page.evaluate(()=>{
            const dialog=[...document.querySelectorAll('[role="dialog"]')].filter(e=>e.getBoundingClientRect().width).at(-1);
            const box=dialog.getBoundingClientRect(), header=dialog.firstElementChild.getBoundingClientRect();
            const step=dialog.querySelector('[data-tracker-step]');
            const scrollers=[dialog,...dialog.querySelectorAll('div')].filter(e=>e.getBoundingClientRect().width&&['auto','scroll'].includes(getComputedStyle(e).overflowY));
            return {top:box.top,bottom:box.bottom,height:innerHeight,horizontal:dialog.scrollWidth-dialog.clientWidth,overflow:Math.max(0,...scrollers.map(e=>e.scrollHeight-e.clientHeight)),scrollTop:Math.max(0,...scrollers.map(e=>e.scrollTop)),headingVisible:!step||step.getBoundingClientRect().top>=header.bottom};
          });
          await page.screenshot({path:path.join(output,stage+'-'+width+'.png')});
          assert(geometry.overflow<=2&&geometry.horizontal<=2&&geometry.top>=-2&&geometry.bottom<=geometry.height+2,stage+' fits '+JSON.stringify(geometry));
          assert(geometry.headingVisible&&geometry.scrollTop<=2,stage+' keeps its heading visible '+JSON.stringify(geometry));
        }
        await click(page,'Use a tracking phone');await checkTracking('prepare');
        await click(page,'Next');await checkTracking('install');
        await click(page,'Share app link');await page.waitForSelector('[data-tracker-install]');await checkTracking('share-install');
        await page.click('[aria-label="Close Install Tracker"]');await checkTracking('install-return');
        await click(page,'Next');await checkTracking('connect');
        await click(page,'Create pairing code');await page.waitForSelector('[data-tracker-pairing]');await checkTracking('pairing');
        assert.equal(await page.$eval('[data-tracker-pairing]',e=>e===document.activeElement),true,'Pairing card receives focus without scrolling');
        await click(page,'Back');await checkTracking('pairing-back');await click(page,'Next');await checkTracking('pairing-return');
      }
    }
    assert.deepEqual(mutations,Array(4).fill('POST /api/asset-register/1/tracking'),'Only explicit pairing requests mutate data');
    assert.deepEqual(errors,[]);
    console.log('PASS details pages, visible controls, no scrolling at 1920/1366/430, back navigation, 106% tracking setup including 125% browser sizing, visible pairing headings, app sharing, back navigation and no accidental mutations');
  } finally {
    if(browser)await browser.close();
    if(server&&server.exitCode===null){const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await stopped;}
    if(fixtureCreated)await fs.rm(fixture,{recursive:true,force:true});
    await fs.rm(path.join(root,'.next/types/app/compact-details-validation'),{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
