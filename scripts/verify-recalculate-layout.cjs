/* Real register wizard, synthetic requests: viewport fit, VAT, Back and explicit-save behavior. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/recalculate-validation');
const output = process.env.REPORT_OUTPUT_DIR || path.join(root, '.next/recalculate-validation');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const assets = Array.from({ length: 25 }, (_, i) => ({
  id: String(i + 1), userId: 'test', registerId: null, title: `Vehicle ${String(i + 1).padStart(2, '0')}`,
  meta: 'Year Model: 2023 · Usage: 115 739 km · Condition: Good',
  serialNumber: `SKB ${i + 1}`, categoryLabel: 'Bakkies / LDVs',
  selectedMethod: 'aim4price', valuationRunId: 1, yearModel: 2023, usage: 115739, hours: 115739,
  usageMetric: 'km', usageReading: 115739, condition: 'Good', value: 300000,
  selectedValueExVat: 300000, replacementPriceExVat: 500000,
  kind: 'vehicle', specsJson: { basic_recovery: true, maxLifetimeUsage: 350000 }, brandName: 'Toyota', modelName: 'Hilux',
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
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '3038'], {
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
    const writes = [];
    let mode = 'km', failPreview = false, warning = null;
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        const asset = assets[0];
        if (url.pathname === '/api/asset-register/revalue') {
          const data = JSON.parse(request.postData());
          writes.push(data);
          const replacement = data.replacementPriceExVat ?? asset.replacementPriceExVat;
          const newValue = Math.round(asset.value * replacement / asset.replacementPriceExVat);
          return request.respond({status: failPreview ? 422 : 200, contentType:'application/json',body:JSON.stringify(failPreview ? {error:'The asset could not be recalculated. Please check the replacement price.'} : {
            ok:true,item:{...asset,value:newValue},oldValueExVat:asset.value,newValueExVat:newValue,replacementPriceExVat:replacement,warning,
          })});
        }
        if (request.method() !== 'GET') writes.push({unexpected:url.pathname});
        const register={id:'farm',businessName:'Farm equipment',assetCount:assets.length,totalValue:7500000};
        return request.respond({status:200,contentType:'application/json',body:JSON.stringify({
          asset,ok:true,signedIn:true,user:{id:'test',accountType:'owner'},profile:{userId:'test',accountType:'owner',name:'Test owner'},
          items:assets,assets,groups:[],register,registers:[register],
        })});
      }
      if(request.resourceType()==='media') return request.abort();
      return request.continue();
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window,'outerWidth',{get:()=>innerWidth});
      localStorage.setItem('aim4price.website-canvas.v2.intro','seen');
    });
    const dialog='[role="dialog"][aria-labelledby="pricing-preview-title"]';
    async function fill(value) {
      await page.$eval(dialog+' input',(input,value)=>{
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
        input.dispatchEvent(new Event('input',{bubbles:true}));
      },value);
    }
    async function fit(stage,width) {
      await delay(150);
      const geometry=await page.$eval(dialog,dialog=>{
        const box=dialog.getBoundingClientRect();
        const body=dialog.querySelector('[aria-label="Recalculate value"]');
        const header=dialog.firstElementChild.getBoundingClientRect();
        const heading=body.querySelector('h4')?.getBoundingClientRect();
        const footer=dialog.lastElementChild.getBoundingClientRect();
        return {top:box.top,bottom:box.bottom,height:innerHeight,horizontal:dialog.scrollWidth-dialog.clientWidth,overflow:body.scrollHeight-body.clientHeight,
          headingVisible:!heading||heading.top>=header.bottom,footerVisible:footer.bottom<=innerHeight,scrollTop:body.scrollTop,
          documentOverflow:getComputedStyle(document.documentElement).overflowY};
      });
      await page.screenshot({path:path.join(output,`${stage}-${mode}-${width}.png`)});
      console.log(stage,mode,width,JSON.stringify(geometry));
      assert(geometry.overflow<=2&&geometry.horizontal<=2&&geometry.top>=-2&&geometry.bottom<=geometry.height+2,stage+' fits '+JSON.stringify(geometry));
      assert(geometry.headingVisible&&geometry.footerVisible&&geometry.scrollTop<=2,stage+' keeps headings and actions visible '+JSON.stringify(geometry));
      assert.equal(geometry.documentOverflow,'hidden','No page scrollbar behind dialog');
    }
    async function advancePreview() {
      if (mode==='km') {await fill('350000');await click(page,'Continue');}
      await page.waitForFunction(()=>document.querySelector('[aria-labelledby="pricing-preview-title"]')?.textContent.includes('Preview and save'));
    }
    async function open(width,metric) {
      mode=metric;
      assets[0]={...assets[0],title:metric==='percentage'?'2006 Yamaha Kodiak':'2023 Toyota Hilux',yearModel:metric==='percentage'?2006:2023,condition:metric==='percentage'?'fair':'good',usageMetric:metric,usageReading:metric==='percentage'?50:115739,
        lifeWorkedPercent:metric==='percentage'?50:null,hours:metric==='percentage'?null:115739,usage:metric==='percentage'?50:115739,
        specsJson:{basic_recovery:true,usageTypeConfirmed:true,usageMetric:metric,lifeWorkedPercent:metric==='percentage'?50:null,maxLifetimeUsage:350000}};
      await page.setViewport({width,height:width===1536?696:width===1366?768:width===1920?870:900,deviceScaleFactor:width===1536?1.25:1});
      await page.goto('http://localhost:3038/recalculate-validation?registerId=farm',{waitUntil:'networkidle2',timeout:120000});
      await page.waitForSelector('#asset-card-1 [data-tooltip="Manage asset"]');
      if(width===1920||width===1536) {
        await page.click('[aria-label="Zoom in"]');await page.waitForSelector('#website-zoom-slider',{visible:true});
        await page.$eval('#website-zoom-slider',e=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'106');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
        await page.click('[aria-label="Close page size"]');
        await page.waitForFunction(()=>Number(document.querySelector('[data-website-canvas]')?.dataset.websiteScale)===1.06);
      }
      await page.$eval('#asset-card-1 [data-tooltip="Manage asset"]',e=>e.click());
      await click(page,'Manage pricing');await click(page,'Recalculate value');await page.waitForSelector(dialog);
    }
    for (const width of (process.env.RECALCULATE_WIDTHS || '1920,1536,1366,430').split(',').map(Number)) {
      for (const metric of ['percentage','km']) {
        await open(width,metric);await fit('saved-price',width);
        await click(page,'Use this price');
        if(mode==='km')await fit('lifetime',width);
        await advancePreview();await fit('saved-preview',width);
        assert.equal(await page.$$eval(dialog+' strong',nodes=>nodes.filter(n=>n.textContent.replace(/\D/g,'')==='300000').length),1,'New value has one prominent result');
        await click(page,'Back');if(mode==='km')await click(page,'Back');
        await click(page,'Enter different price');await fit('enter-price',width);
        await click(page,'Continue');await page.waitForSelector(dialog+' [role="alert"]');await fit('validation-error',width);
        await click(page,'Incl. VAT');await fill('690000');await click(page,'Continue');await fit('replacement-choice',width);
        await click(page,'Use for this calculation only');await advancePreview();await fit('custom-preview',width);
        assert.equal(writes.at(-1).replacementPriceExVat,600000,'Incl. VAT input is converted once');
        assert.equal(writes.at(-1).previewOnly,true,'Choosing an option only previews');
        await click(page,'Excl. VAT');
        assert(await page.$eval(dialog,e=>e.textContent.replace(/[ ,\u00a0]/g,'').includes('360000')),'Preview display converts VAT without another request');
        await click(page,'Back');if(mode==='km')await click(page,'Back');await click(page,'Back');
        assert.equal(await page.$eval(dialog+' input',e=>e.value.replace(/\D/g,'')),'600000','Back preserves canonical replacement price');
        await click(page,'Continue');await click(page,'Save with the new value');await advancePreview();await fit('save-both-preview',width);
        assert.equal(writes.filter(w=>!w.previewOnly).length,0,'Navigation never saves a value');
        await page.click('[aria-label="Close value preview"]');
      }
    }
    // The longest summary plus a server warning still fits at the user’s zoom.
    warning='This estimate uses the replacement price and lifetime supplied. Review these details before saving.';
    await open(1536,'km');await click(page,'Enter different price');await fill('600000');await click(page,'Continue');await click(page,'Save with the new value');await advancePreview();await fit('warning-preview',1536);
    await click(page,'Save value and replacement price');
    await page.waitForFunction(()=>!document.querySelector('[aria-labelledby="pricing-preview-title"]'));
    assert.deepEqual(writes.at(-1),{assetId:'1',selectedMethod:'aim4price',replacementPriceExVat:600000,saveReplacementPrice:true,advancedAssumptions:{maxLifetimeUsage:350000}},'Explicit save keeps the existing persistence payload');
    warning=null;failPreview=true;
    await open(1536,'percentage');await click(page,'Use this price');await page.waitForFunction(()=>document.body.textContent.includes('Could not calculate preview'));await fit('server-error',1536);
    assert.equal(await page.$eval(dialog+' > div:last-child > button:last-child',e=>e.disabled),true,'Failed preview cannot be saved');
    assert.deepEqual(errors,[]);
    console.log('PASS: saved/custom price, VAT, lifetime, validation, preview, warning, Back, explicit save and error paths. Viewports:', process.env.RECALCULATE_WIDTHS || '1920,1536,1366,430', '(106% page size and 125% browser size included).');
  } finally {
    if(browser)await browser.close();
    if(server&&server.exitCode===null){const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await stopped;}
    if(fixtureCreated)await fs.rm(fixture,{recursive:true,force:true});
    await fs.rm(path.join(root,'.next/types/app/recalculate-validation'),{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
