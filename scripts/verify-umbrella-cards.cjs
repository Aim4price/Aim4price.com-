/* Populated Asset Register browser checks; all account and asset responses are local fixtures.
 * Run separately from verify-website-canvas.cjs because both own the temporary fixture route.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
const output = process.env.CANVAS_OUTPUT_DIR || path.join(root, '.next/canvas-validation');
const user = { id:'canvas-fixture', name:'Canvas Test Owner', email:'canvas@example.invalid', accountType:'owner', accountSubtype:null };
const profile = { userId:user.id,name:user.name,displayName:user.name,email:user.email,accountType:'owner',accountSubtype:'',logoUrl:'',extraPhotoUrls:[],businessName:'Test farm',phone:'',province:'Gauteng',townCity:'Test town',addressLine1:'',addressLine2:'',websiteUrl:'',vatNumber:'',notes:'',marketplaceSellerName:'',marketplacePhone:'',marketplaceEmail:'',marketplaceLocation:'',partnerServices:'',partnerBrandFocus:'',partnerDescription:'',partnerDirectoryStatus:'inactive',partnerLatitude:null,partnerLongitude:null,partnerServiceRadiusKm:null,discoveryParticipationEnabled:false,partnerDirectoryEnabled:false,createdAtIso:null,updatedAtIso:null };
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function check(browser, url) {
  const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const make=(id,title,value,extra={})=>({id,userId:user.id,registerId:'canvas-register',title,kind:'tractor',value,selectedValueExVat:value,aim4priceValueExVat:value,replacementPriceExVat:500000,selectedMethod:'aim4price',specsJson:{},brandName:'New Holland',modelName:'TT4.90',equipmentFamilyKey:'tractor',equipmentFamilyLabel:'Tractors',yearModel:2022,hours:1276,condition:'good',note:'',serialNumber:'',marketplaceStatus:'draft',photos:[],documents:[],createdAtIso:'2026-09-13T00:00:00Z',updatedAtIso:'2026-09-13T00:00:00Z',...extra});
  const assets=[make('member','2018 Massey Ferguson 4708',194438),make('member2','Farm trailer',15000,{specsJson:{assetFlagged:true}}),make('normal','2022 New Holland TT4.90 4WD Openstation',327133),make('live','Year Unknown Zimmatic 6-Tower + Overhang',459000,{marketplaceStatus:'live',isPublishedToMarketplace:true})];
  let groups=[{id:'umbrella',userId:user.id,registerId:'canvas-register',name:'Asset umbrella',valueMode:'separate',isFlagged:false,members:[{assetId:'member',role:'primary',relationship:'primary',countsTowardTotal:true,sortOrder:0},{assetId:'member2',role:'member',relationship:'works_with',countsTowardTotal:true,sortOrder:1}],createdAtIso:'2026-09-13T00:00:00Z',updatedAtIso:'2026-09-13T00:00:00Z'}];
  await page.evaluateOnNewDocument(()=>{Object.defineProperty(window,'outerWidth',{configurable:true,get:()=>innerWidth}); localStorage.setItem('aim4price.website-canvas.v2',JSON.stringify({mode:'auto'}));});
  await page.setRequestInterception(true);
  page.on('request',request=>{
    const target=new URL(request.url());
    if(target.pathname.startsWith('/api/')) {
      if(target.pathname==='/api/asset-groups' && request.method()==='PATCH') {const data=JSON.parse(request.postData());groups=groups.map(g=>({...g,isFlagged:data.isFlagged}));}
      const body=target.pathname==='/api/me'?{ok:true,signedIn:true,user}:target.pathname==='/api/account-profile'?{ok:true,profile}:{ok:true,register:{id:'canvas-register',name:'Test farm'},items:assets,assets,groups,registers:[{id:'canvas-register',name:'Test farm'}],notifications:[],listings:[],storages:[],recentEvents:[],recentFuelSlips:[],requests:[],budgets:[],scanPin:{enabled:false,hasPin:false},enabled:false,hasPin:false};
      return request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
    }
    if(request.resourceType()==='media')return request.abort();return request.continue();
  });
  for(const width of [1440,430]) {
    await page.setViewport({width,height:1100,deviceScaleFactor:1});
    await page.goto(url+'/canvas-validation?page=register',{waitUntil:'networkidle2',timeout:120000});
    await page.waitForSelector('[data-asset-group-id="umbrella"]');
    await page.$eval('[data-asset-group-id="umbrella"]',e=>e.scrollIntoView({block:'start'}));
    await page.screenshot({path:path.join(output,`umbrella-design-${width}.png`)});
    const geometry=await page.evaluate(()=>[...document.querySelectorAll('[class*="assetGroupHeaderRow"], [class*="assetCardRow"]')].filter(e=>e.querySelector('h2')).map(row=>{
      const title=row.querySelector('h2'),price=row.querySelector('[class*="assetValueVatAmountRow"] strong'),rail=row.querySelector('[class*="assetSideActions"]'),r=title.getBoundingClientRect(),p=price.getBoundingClientRect(),f=rail.firstElementChild.getBoundingClientRect();
      return {title:title.textContent,titleY:r.y+parseFloat(getComputedStyle(title).lineHeight)*(r.height/title.offsetHeight)/2,priceY:p.y+p.height/2,flagY:f.y+f.height/2,umbrella: getComputedStyle(rail.lastElementChild).backgroundColor};
    }));console.log(width,JSON.stringify(geometry));
    for(const g of geometry) {assert.ok(Math.abs(g.titleY-g.priceY)<8,`${g.title}: price alignment`); assert.ok(Math.abs(g.titleY-g.flagY)<8,`${g.title}: flag alignment`);}
    assert.equal(await page.$eval('#asset-card-live [class*="marketplaceLiveStatus"]',e=>e.textContent),'Live on Marketplace');
    assert.equal(await page.$eval('[aria-label="Edit Asset umbrella"]',e=>e.getAttribute('data-tooltip')),'Edit umbrella');
    await page.click('[aria-label="Edit Asset umbrella"]');
    await page.waitForFunction(()=>document.querySelector('#asset-group-title')?.textContent.includes('Edit umbrella'));
    await page.click('[aria-label="Close umbrella manager"]');
    await page.click(`[aria-label="${groups[0].isFlagged?'Unflag':'Flag'} Asset umbrella"]`);
    await page.waitForFunction(()=>document.querySelector('[aria-label="Unflag Asset umbrella"]'));
    assert.equal(await page.$eval('#asset-card-normal [class*="assetGroupButton"]',e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
    const groupDetails = '[class*="assetGroupHeaderRow"] [class*="cardViewDetailsButton"]';
    const details = id => `#asset-card-${id} [class*="cardViewDetailsButton"]`;
    const isOpen = async id => page.$eval(details(id), e => e.getAttribute('aria-expanded') === 'true');
    const outside = async () => { await page.mouse.click(2,1000); await delay(100); };
    const red = async selector => {
      await page.waitForFunction(sel => getComputedStyle(document.querySelector(sel)).borderTopColor === 'rgb(223, 67, 77)', {}, selector);
      return page.$eval(selector,e=>getComputedStyle(e).borderTopColor);
    };
    assert.equal(await red('[class*="assetGroupHeaderFlagged"]'),'rgb(223, 67, 77)');
    await page.click(groupDetails);
    await page.waitForSelector('#asset-card-member');
    for (const id of ['member','member2']) {
      assert.equal(await page.$eval(`#asset-card-${id} [class*="assetFlagButton"]`, e=>e.getAttribute('aria-pressed')),'true');
      assert.equal(await red(`#asset-card-${id}`),'rgb(223, 67, 77)');
    }
    await page.click(details('member'));
    await page.waitForFunction(()=>document.querySelector('#asset-card-member [aria-expanded="true"]'));
    assert.equal(await red('#asset-card-member'),'rgb(223, 67, 77)');
    await page.click('#asset-card-member h2');
    assert.equal(await isOpen('member'),true,'inside clicks keep details open');
    await page.screenshot({path:path.join(output,`umbrella-red-expanded-${width}.png`)});
    await outside();
    assert.equal(await page.$('#asset-card-member'),null,'outside closes umbrella and member details');
    await page.click(groupDetails);
    await page.waitForSelector('#asset-card-member');
    assert.equal(await isOpen('member'),false,'reopening umbrella does not restore stale member details');
    await page.click(details('member'));
    await page.click('#asset-card-member2 h2');
    assert.equal(await page.$('#asset-card-member'),null,'clicking a muted card outside the active card dismisses the focused group');
    await page.click(groupDetails);
    await page.waitForSelector('#asset-card-member');
    await page.click('#asset-card-member [class*="assetFlagButton"]');
    await page.waitForSelector('[aria-label="Flag Asset umbrella"]');
    assert.equal(await page.$eval('#asset-card-member [class*="assetFlagButton"]',e=>e.getAttribute('aria-pressed')),'false');
    assert.equal(await page.$eval('#asset-card-member2 [class*="assetFlagButton"]',e=>e.getAttribute('aria-pressed')),'true','unflagging umbrella preserves individual flags');
    await outside();
    await page.click(details('normal'));
    await page.waitForFunction(()=>document.querySelector('#asset-card-normal [aria-expanded="true"]'));
    await page.click('#asset-card-normal h2');
    assert.equal(await isOpen('normal'),true);
    await page.click('#asset-card-normal [class*="cardManageButton"]');
    await page.waitForSelector('[role="dialog"]');
    await page.$eval('[role="dialog"]',e=>e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));
    assert.equal(await isOpen('normal'),true,'modal interaction preserves expanded asset');
    await page.keyboard.press('Escape');
    await outside();
    assert.equal(await isOpen('normal'),false,'outside closes standalone details');
    await page.click('[aria-label="Flag Asset umbrella"]');
    await page.waitForSelector('[aria-label="Unflag Asset umbrella"]');
    await page.screenshot({path:path.join(output,`umbrella-flagged-${width}.png`)});
    await page.reload({waitUntil:'networkidle2'});
    await page.waitForSelector('[aria-label="Unflag Asset umbrella"]');
    groups[0].isFlagged=false;
  }
  assert.deepEqual(errors,[]);console.log('PASS card layout, inherited red flags, independent flag preservation, outside dismissal and modal/inside-click preservation');await page.close();
}
async function main() {
  await fs.mkdir(output,{recursive:true});
  const external=process.env.CANVAS_TEST_URL;let server,browser;const fixture=path.join(root,'app/canvas-validation');
  try {
    if(!external) {
      await fs.mkdir(fixture);await fs.copyFile(path.join(root,'tests/fixtures/website-canvas-page.tsx'),path.join(fixture,'page.tsx'));
      server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3030'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'canvas_validation',PGPASSWORD:'local-validation-only',PGDATABASE:'canvas_validation',BETTER_AUTH_SECRET:'canvas-local-validation-secret-not-for-production'},stdio:['ignore','pipe','pipe']});
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Next startup timed out')),90000);server.stdout.on('data',data=>{if(data.toString().includes('Ready')){clearTimeout(timer);resolve()}});server.stderr.on('data',data=>process.stderr.write(data));server.once('exit',code=>{clearTimeout(timer);reject(Error(`Next exited ${code}`))})});
    }
    await fs.mkdir(output,{recursive:true});
    browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});
    await check(browser,external||'http://127.0.0.1:3030');
  } finally {
    if(browser) await browser.close();
    if(server) {
      // Remove only the files this runner owns, before stopping Next's worker.
      for(const file of [path.join(fixture,'page.tsx'),path.join(root,'.next/types/app/canvas-validation/page.ts')]) {
        await fs.unlink(file).catch(error=>{if(error.code!=='ENOENT')throw error});
      }
      await fs.rmdir(fixture).catch(error=>{if(error.code!=='ENOENT')throw error});
      server.kill();
    }
  }
}
main().catch(error=>{console.error(error);process.exitCode=1});

