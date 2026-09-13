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
  const writes=[];
  await page.setRequestInterception(true);
  page.on('request',request=>{
    const target=new URL(request.url());
    if(target.pathname.startsWith('/api/')) {
      if(request.method()==='PUT')writes.push({path:target.pathname,body:JSON.parse(request.postData()||'{}')});
      if(target.pathname==='/api/asset-register' && request.method()==='PUT') { const data=JSON.parse(request.postData());return request.respond({status:200,contentType:'application/json',body:JSON.stringify({ok:true,item:{...assets.find(a=>a.id===data.assetId),...data,id:data.assetId}})}); }
      if(target.pathname==='/api/asset-groups' && request.method()==='PATCH') {const data=JSON.parse(request.postData());groups=groups.map(g=>({...g,isFlagged:data.isFlagged}));}
      const body=target.pathname==='/api/me'?{ok:true,signedIn:true,user}:target.pathname==='/api/account-profile'?{ok:true,profile}:{ok:true,register:{id:'canvas-register',name:'Test farm'},items:assets,assets,groups,registers:[{id:'canvas-register',name:'Test farm'}],notifications:[],listings:[],storages:[],recentEvents:[],recentFuelSlips:[],requests:[],budgets:[],scanPin:{enabled:false,hasPin:false},enabled:false,hasPin:false};
      return request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
    }
    if(request.resourceType()==='media')return request.abort();return request.continue();
  });
  const choose = async (selector, text) => {
    await page.$eval(selector+' button',e=>e.click());
    await page.waitForSelector('[role="option"]');
    await page.$$eval('[role="option"]',(es,t)=>es.find(e=>e.textContent.includes(t)).click(),text);
  };
  for (const width of [1440,430]) {
    await page.setViewport({width,height:1100,deviceScaleFactor:1});
    await page.goto(url+'/canvas-validation?page=register',{waitUntil:'networkidle2',timeout:120000});
    await page.waitForSelector('#asset-card-normal');
    await page.$eval('[aria-label="VAT display for all asset values"] button:last-child',e=>e.click());
    await page.$eval('#asset-card-normal [class*="cardViewDetailsButton"]',e=>e.click());
    const trigger='#asset-card-normal [data-asset-return-action="detail-replacement"]';
    await page.waitForSelector(trigger);
    assert.match(await page.$eval(trigger,e=>e.textContent.replace(/[\s,]/g,'')),/575000Incl.VAT/);
    await page.$eval(trigger,e=>e.click());
    const field='[data-asset-detail-edit-target="replacement"]';
    await page.waitForFunction(sel=>document.activeElement===document.querySelector(sel+' input'),{},field);
    assert.equal(await page.$eval(field+' input',e=>e.value.replace(/\s/g,'')),'575000');
    const before=writes.length;
    for(let i=0;i<3;i++) {
      await choose(field,'Excl. VAT');
      assert.equal(await page.$eval(field+' input',e=>e.value.replace(/\s/g,'')),'500000');
      await choose(field,'Incl. VAT');
      assert.equal(await page.$eval(field+' input',e=>e.value.replace(/\s/g,'')),'575000');
    }
    await delay(1200);assert.equal(writes.length,before,'VAT switching must not save');
    await page.$eval(field,e=>e.scrollIntoView({block:'center'}));await delay(500);
    await page.screenshot({path:path.join(output,`vat-editor-${width}.png`)});
    await page.focus(field+' input');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');
    assert.equal(await page.$eval(field+' input',e=>e.value),'');
    await page.type(field+' input','115000');
    assert.equal(await page.$eval(field+' input',e=>e.value.replace(/\s/g,'')),'115000');
    await choose(field,'Excl. VAT');
    assert.equal(await page.$eval(field+' input',e=>e.value.replace(/\s/g,'')),'100000');
    await delay(1600);
    assert.ok(writes.some(w=>w.path==='/api/asset-register' && w.body.assetId==='normal' && w.body.replacementPriceExVat===100000),'Inclusive entry saved as excl. VAT');
    console.log(`PASS VAT ${width}: top toggle, input conversion, empty entry and drift-free switching`);
  }
  assert.deepEqual(errors,[]);await page.close();
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

