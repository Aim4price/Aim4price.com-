/* Verify report dialog design on real page clients with fixture records; never writes user data. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/report-validation');
const output = process.env.REPORT_OUTPUT_DIR || path.join(root, '.next/report-validation');
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

const name = i => `Record ${String(i + 1).padStart(2, '0')}`;
const times = { createdAtIso: '2026-09-01T00:00:00Z', updatedAtIso: '2026-09-01T00:00:00Z' };
const invoices = assets.map((asset, i) => ({ ...times, id: asset.id, assetId: asset.id, assetTitle: name(i), assetCategoryLabel: '', assetYearModel: 2023, assetUsageReading: 100, assetUsageMetric: 'km', assetCondition: 'good', ownerName: 'Test', createdByDisplayName: 'Test', ownerStorageStatus: 'stored', document: null, supplierName: name(i), invoiceNumber: name(i), invoiceDate: '2026-09-01', subtotalExVat: 100, vatAmount: 15, totalIncVat: 115, usageReading: 100, usageMetric: 'km', source: 'manual', notes: '', maintenanceWorkDone: '', partsSupplied: '', repairWorkDone: '', blocks: [] }));
const budgets = assets.map((asset, i) => ({ id: asset.id, assetId: asset.id, assetTitle: name(i), period: 'monthly', periodLabel: 'September 2026', periodKey: '2026-09', amount: 1000, spent: 100, remaining: 900, overBy: 0, percentUsed: 10, warningPercent: 80, includeFuelSlipCosts: false, status: i === 24 ? 'warning' : 'on_track' }));
const records = assets.map((asset, i) => ({ ...times, id: asset.id, userId: 'test', assetId: asset.id, assetTitle: name(i), assetKind: 'vehicle', assetCategoryLabel: '', assetYearModel: 2023, assetUsageReading: 100, assetUsageMetric: 'km', assetCondition: 'good', assetValue: 1000, assetMeta: '', maintenanceType: 'service', triggerType: 'date', status: 'upcoming', computedStatus: 'scheduled', computedStatusLabel: 'Scheduled', title: name(i), notes: '', assignedFieldManagerId: null, assignedName: '', dueDate: '2026-10-01', dueUsage: null, usageMetric: 'km', currentUsage: 100, remainingUsage: null, daysUntilDue: 16, alertBeforeValue: 7, alertBeforeUnit: 'days', recurringEnabled: false, recurringIntervalValue: null, recurringIntervalUnit: null, generatedFromMaintenanceId: null, completedAtIso: null, completedUsage: null, completedNotes: '', completedBy: '', alertNotedAtIso: null }));
const storages = assets.map((asset, i) => ({ ...times, id: asset.id, name: name(i), fuelType: 'diesel', capacityLitres: 1000, currentLitres: 500, stockPercent: 50, reorderLevelLitres: 100, locationLabel: '', notes: '', dipstickNote: '', dipstickNoteUpdatedAtIso: null, status: 'active', publicFuelStorageCode: '', pinEnabled: false, hasPin: false, pinUpdatedAtIso: null }));
const slips = assets.map((asset, i) => ({ ...times, id: asset.id, sourceType: 'fuel_slip', sourceLabel: 'Fuel Slip', targetType: 'asset', assetId: asset.id, assetTitle: name(i), storageId: '', storageName: '', supplierName: name(i), slipNumber: name(i), transactionNumber: '', documentDate: '2026-09-01', documentTime: '12:00', fuelType: 'diesel', litres: 10, pricePerLitre: 20, totalAmount: 200, vatAmount: 0, vatIncluded: true, vatRate: 15, paymentMethod: '', cardType: '', cardNumberMasked: '', cardLast4: '', operatorName: '', activityText: '', workAreaText: '', note: '', extractionStatus: 'manual', ocrConfidence: null, reviewRequired: false, rawExtractedText: '', extractionWarnings: [], workUseExcluded: false, workUseExclusionReason: '', recordStatus: 'active', voidedAtIso: null, voidedByName: '', voidReason: '' }));
const scenarios = [
 ['map','map',['Download']], ['register','register',['Download']],
 ['registers','registers',['Download']], ['budgets','budgets',['Download']],
 ['costs','costs',['Download']], ['maintenance-scope','maintenance',['Download']],
 ['maintenance-format','maintenance',['Download','All maintenance']],
 ['fuel','fuel',['Download']], ['slips','fuel&view=slips',['Download']],
 ['asset-reports','register',['@asset-manage','Reports']], ['leads','leads',['Open','@asset-manage','Reports']],
 ['dealer-costs','dealer-costs',[]], ['dealer-maintenance','dealer-maintenance',[]],
 ['accountant','accountant',[]], ['group','group',[]], ['owner','owner',[]],
 ['register-options','register',['Download','PDF report','Next']],
 ['registers-format','registers',['Download','All asset registers']],
 ['cost-timeline','costs',['Download','PDF','Next']],
 ['slip-timeline','fuel&view=slips',['Download','Next']],
 ['group-format','group',['Maintenance report']],
 ['owner-format','owner',['Maintenance report']], ['owner-open','owner-open',['Maintenance report']],
];
async function click(page, text) {
 if(text === '@asset-manage') {
   await page.waitForFunction(()=>[...document.querySelectorAll('article button')].some(e=>e.textContent.trim()==='Manage'));
   await page.evaluate(()=>[...document.querySelectorAll('article button')].find(e=>e.textContent.trim()==='Manage').click());
   await delay(250);return;
 }

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
async function appearance(page, selector, original=false) {
 return page.$eval(selector,(root,original)=>{
   const read=(node, keys)=>{const css=getComputedStyle(node);return Object.fromEntries(keys.map(k=>[k,css[k].replace(/^start$/, 'left').replace(/\d+(?:\.\d+)?px/g, v=>`${Math.round(parseFloat(v)*10)/10}px`)]));};
   const header=root.querySelector(original?'header':'[data-download-header]');
   const title=header.querySelector('h2,h3');
   const card=root.querySelector(original?'button[aria-pressed="true"]':'[data-download-option]');
   const value={shell:read(root,['width','padding','borderRadius','backgroundImage']),title:read(title,['fontSize','fontWeight','lineHeight','color','textAlign']),close:read(header.querySelector('button'),['width','height','borderRadius'])};
   if(card){const icon=card.querySelector('[data-download-icon]') || card.firstElementChild;if(icon)value.icon=read(icon,['width','height','borderRadius']);value.card=read(card,['padding','borderRadius','backgroundImage','gridTemplateColumns']);delete value.card.gridTemplateColumns;value.strong=read(card.querySelector('strong'),['fontSize','fontWeight','lineHeight','color']);const small=card.querySelector('small');if(small)value.small=read(small,['fontSize','fontWeight','lineHeight','color']);}
   return value;
 },original);
}
async function details(page, original=false) {
 return page.$eval(original?'[data-original-report]':'[data-download-dialog="true"]',(root,original)=>{
  const read=(el,keys)=>Object.fromEntries(keys.map(key=>[key,getComputedStyle(el)[key].replace(/ 0%/g,'').replace(/ 100%/g,'')]));
  const header=root.querySelector(original?'header':'[data-download-header]');
  const cards=[...root.querySelectorAll(original?'button[aria-pressed]':'[data-download-option]')];
  const footer=root.querySelector(original?'[class*="exportActions"]':'[data-download-footer]');
  return {
   backdrop:read(original?root.parentElement:root.closest('[class*="ReportDownload_backdrop"]'),['backgroundColor','backdropFilter']),
   header:read(header,['paddingBottom','borderBottomWidth','borderBottomColor','columnGap']),
   cards:cards.map(card=>({
    selected:card.getAttribute('aria-pressed')==='true',
    style:read(card,['padding','borderRadius','columnGap','backgroundImage','borderTopColor']),
    title:read(card.querySelector('strong'),['fontSize','fontWeight','lineHeight','color','letterSpacing']),
    small:card.querySelector('small')?read(card.querySelector('small'),['fontSize','fontWeight','lineHeight','color']):null,
    icon:read(card.querySelector('[data-download-icon]')||card.firstElementChild,['width','height','borderRadius','boxSizing']),
    iconBounds:(()=>{const rect=(card.querySelector('[data-download-icon]')||card.firstElementChild).getBoundingClientRect();return {width:Math.round(rect.width*10)/10,height:Math.round(rect.height*10)/10};})(),
   })),
   footer:footer?read(footer,['justifyContent','backgroundColor','borderTopWidth']):null,
   buttons:footer?[...footer.querySelectorAll('button,a')].map(button=>read(button,['minWidth','minHeight','borderRadius','fontSize','fontWeight','lineHeight','letterSpacing'])):[],
   secondary:footer?[...footer.querySelectorAll('button,a')].filter(button=>!button.hasAttribute('data-download-primary')).map(button=>read(button,['color','backgroundColor','backgroundImage','borderTopColor','boxShadow'])):[],
   overflow:root.scrollWidth>root.clientWidth+1,
   overflowingCopy:[...root.querySelectorAll('[data-download-option] strong,[data-download-option] small')].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.textContent),
  };
 },original);
}
async function hoverStyle(page, selector) {
 const card=await page.$(selector);
 if(!card)return null;
 await card.hover();await delay(220);
 return card.evaluate(card=>{
  const css=getComputedStyle(card);
  return Object.fromEntries(['backgroundImage','borderTopColor','boxShadow','transform'].map(key=>[key,css[key].replace(/ 0%/g,'').replace(/ 100%/g,'')]));
 });
}
function verifyDetails(actual, reference, name) {
 // All page CSS is loaded in this fixture; legacy global overlay rules can alter the unscoped reference.
 assert.deepEqual(actual.backdrop,{backgroundColor:'rgba(12, 24, 35, 0.42)',backdropFilter:'blur(12px) saturate(0.9)'},`${name} canonical Asset Map backdrop`);
 assert.deepEqual(actual.header,reference.header,`${name} header divider and spacing`);
 assert.equal(actual.overflow,false,`${name} horizontal overflow`);
 assert.deepEqual(actual.overflowingCopy,[],`${name} concise card copy fits without truncation`);
 for(const [index,card] of actual.cards.entries()) {
  const expected=reference.cards.find(option=>option.selected===card.selected);
  assert.deepEqual(card.style,expected.style,`${name} card ${index+1} spacing and selected background`);
  assert.deepEqual(card.title,expected.title,`${name} card ${index+1} title`);
  if(card.small)assert.deepEqual(card.small,expected.small,`${name} card ${index+1} description`);
  assert.deepEqual(card.icon,expected.icon,`${name} card ${index+1} icon`);
  assert.deepEqual(card.iconBounds,expected.iconBounds,`${name} card ${index+1} rendered icon bounds`);
 }
 assert.ok(actual.footer,`${name} footer exists`);
 assert.deepEqual(actual.footer,reference.footer,`${name} footer layout`);
 assert.ok(actual.buttons.length,`${name} footer buttons exist`);
 for(const button of actual.secondary)assert.deepEqual(button,reference.secondary[0],`${name} secondary button colors`);
 for(const button of actual.buttons)assert.deepEqual(button,reference.buttons[0],`${name} footer button dimensions and typography`);
}
(async () => {
  let server, browser, fixtureCreated = false;
  try {
    await fs.mkdir(fixture); // Refuse to overwrite an existing route.
    fixtureCreated = true;
    await fs.copyFile(path.join(root, 'tests/fixtures/report-download-page.tsx'), path.join(fixture, 'page.tsx'));
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
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        assert.equal(request.method(), 'GET', `Unexpected data mutation: ${request.url()}`);
        const body = { ok: true, signedIn: true, user: { id: 'test', accountType: 'owner', name: 'Test owner' },
          profile: { userId: 'test', accountType: 'owner', name: 'Test owner' }, assets: url.pathname === '/api/dealer/maintenance' ? [{accessId:'test',assetId:'1',assetTitle:'Test tractor',permissions:{canViewMaintenanceReports:true},maintenanceRecords:[],loggedProblems:[],records:[],createdAtIso:'2026-09-01',updatedAtIso:'2026-09-01'}] : assets,
          items: url.pathname === '/api/asset-register' ? assets : [], invoices, records,
          budgets, requests: [], commitments: [], notifications: [], groups: [], registers: [{id:"test",name:"Test register",assetCount:25,totalValue:1000,createdAtIso:"2026-09-01",updatedAtIso:"2026-09-01"}],
          storages, recentEvents: [], recentFuelSlips: slips };
        return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      }
      if (request.resourceType() === 'media') return request.abort();
      return request.continue();
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window, 'outerWidth', { get: () => innerWidth });
      localStorage.setItem('aim4price.website-canvas.v2.intro', 'seen');
    });
    const failures = [];
    for (const width of (process.env.REPORT_WIDTHS || '1440,430').split(',').map(Number)) {
      await page.setViewport({width,height:1000});
      await page.goto('http://localhost:3036/report-validation?mode=reference',{waitUntil:'networkidle2',timeout:120000});
      const reference=await appearance(page,'[data-original-report]',true);
      const referenceDetails=await details(page,true);
      const referenceHover=await hoverStyle(page,'[data-original-report] button[aria-pressed="false"]');
      await page.mouse.move(0,0);
      for(const [name,mode,clicks] of scenarios.filter(([name])=>!process.env.REPORT_SCENARIOS||process.env.REPORT_SCENARIOS.split(',').includes(name))){
        try {
          await page.goto(`http://localhost:3036/report-validation?mode=${mode}`,{waitUntil:'networkidle2',timeout:120000});
          for(const text of clicks)await click(page,text);
          await page.waitForSelector('[data-download-dialog="true"]',{timeout:15000});
          if(name==='dealer-maintenance')await page.waitForSelector('[data-download-option]',{timeout:15000});
          await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(0,0);await delay(200);
          const actual=await appearance(page,'[data-download-dialog="true"]');
          const expected={...reference};
          if(!actual.card){delete expected.card;delete expected.strong;delete expected.small;delete expected.icon;}
          if(!actual.small)delete expected.small;
          // Option selection varies by workflow; both backgrounds are canonical.
          if(actual.card)delete actual.card.backgroundImage;
          if(expected.card){expected.card={...expected.card};delete expected.card.backgroundImage;}
          await page.screenshot({path:path.join(output,`${name}-${width}.png`)});
          assert.deepEqual(actual,expected,`${name} rendered style parity`);
          verifyDetails(await details(page),referenceDetails,name);
          const hovered=await hoverStyle(page,'[data-download-dialog="true"] [data-download-option]:not(:disabled)');
          if(hovered)assert.deepEqual(hovered,referenceHover,`${name} option hover`);
          assert.deepEqual(errors,[],`${name} runtime errors`);
          console.log(`PASS ${name} ${width}px`);
        }catch(error){failures.push(name+' '+width);console.error('FAIL '+name+' '+width+' '+error.message, errors);console.error(await page.$eval('body', el=>el.innerText.slice(-1800)));errors.length=0;}
      }
    }
    assert.deepEqual(failures,[]);
  } finally {
    if (fixtureCreated) {
      await fs.unlink(path.join(fixture, 'page.tsx')).catch(() => {});
      await fs.rmdir(fixture).catch(() => {});
      await fs.unlink(path.join(root, '.next/types/app/report-validation/page.ts')).catch(() => {});
    }
    if (browser) await browser.close();
    if (server) server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
