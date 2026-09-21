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
const output = process.env.CANVAS_OUTPUT_DIR || path.join(root, '.next/directory-sharing-validation');
const user = { id:'canvas-fixture', name:'Canvas Test Owner', email:'canvas@example.invalid', accountType:'owner', accountSubtype:null };
const profile = { userId:user.id,name:user.name,displayName:user.name,email:user.email,accountType:'owner',accountSubtype:'',logoUrl:'',extraPhotoUrls:[],businessName:'Test farm',phone:'',province:'Gauteng',townCity:'Test town',addressLine1:'',addressLine2:'',websiteUrl:'',vatNumber:'',notes:'',marketplaceSellerName:'',marketplacePhone:'',marketplaceEmail:'',marketplaceLocation:'',partnerServices:'',partnerBrandFocus:'',partnerDescription:'',partnerDirectoryStatus:'inactive',partnerLatitude:null,partnerLongitude:null,partnerServiceRadiusKm:null,discoveryParticipationEnabled:false,partnerDirectoryEnabled:false,createdAtIso:null,updatedAtIso:null };
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function check(browser, url) {
  const page=await browser.newPage(); const errors=[]; const requests=[];page.on('pageerror',e=>errors.push(e.message));
  const make=(id,title,value,extra={})=>({id,userId:user.id,registerId:'canvas-register',title,kind:'tractor',value,selectedValueExVat:value,aim4priceValueExVat:value,replacementPriceExVat:500000,selectedMethod:'aim4price',specsJson:{},brandName:'New Holland',modelName:'TT4.90',equipmentFamilyKey:'tractor',equipmentFamilyLabel:'Tractors',yearModel:2022,hours:1276,condition:'good',note:'',serialNumber:'',marketplaceStatus:'draft',photos:[],documents:[],createdAtIso:'2026-09-13T00:00:00Z',updatedAtIso:'2026-09-13T00:00:00Z',...extra});
  const assets=[make('member','2018 Massey Ferguson 4708',194438),make('member2','Farm trailer',15000,{specsJson:{assetFlagged:true}}),make('normal','2022 New Holland TT4.90 4WD Openstation',327133),make('live','Year Unknown Zimmatic 6-Tower + Overhang',459000,{marketplaceStatus:'live',isPublishedToMarketplace:true})];
  let groups=[{id:'umbrella',userId:user.id,registerId:'canvas-register',name:'Asset umbrella',valueMode:'separate',isFlagged:false,members:[{assetId:'member',role:'primary',relationship:'primary',countsTowardTotal:true,sortOrder:0},{assetId:'member2',role:'member',relationship:'works_with',countsTowardTotal:true,sortOrder:1}],createdAtIso:'2026-09-13T00:00:00Z',updatedAtIso:'2026-09-13T00:00:00Z'}];
  await page.evaluateOnNewDocument(()=>{Object.defineProperty(window,'outerWidth',{configurable:true,get:()=>innerWidth}); localStorage.setItem('aim4price.website-canvas.v2',JSON.stringify({mode:'auto'}));});
  await page.setRequestInterception(true);
  page.on('request',request=>{
    const target=new URL(request.url());
    if(target.pathname.startsWith('/api/')) {
      requests.push(target.pathname);
      if(target.pathname==='/api/partners') return request.respond({status:200,contentType:'application/json',body:JSON.stringify({ok:true,partners:[{userId:'external:fixture',businessName:'Garden Route Repairs',displayName:'Garden Route Repairs',partnerType:'dealer',isExternalBusiness:true,email:'repairs@example.invalid',phone:'082 123 4567',latitude:-33.96,longitude:22.46,townCity:'George',province:'Western Cape',services:'Tractor repairs',description:'Local equipment workshop',logoUrl:'',extraPhotoUrls:[],websiteUrl:'',addressLine1:'Test Street',serviceRadiusKm:100}]})});
      if(target.pathname==='/api/asset-groups' && request.method()==='PATCH') {const data=JSON.parse(request.postData());groups=groups.map(g=>({...g,isFlagged:data.isFlagged}));}
      const body=target.pathname==='/api/me'?{ok:true,signedIn:true,user}:target.pathname==='/api/account-profile'?{ok:true,profile}:{ok:true,register:{id:'canvas-register',name:'Test farm'},items:assets,assets,groups,registers:[{id:'canvas-register',name:'Test farm'}],notifications:[],listings:[],storages:[],recentEvents:[],recentFuelSlips:[],requests:[],budgets:[],scanPin:{enabled:false,hasPin:false},enabled:false,hasPin:false};
      return request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
    }
    if(request.resourceType()==='media')return request.abort();return request.continue();
  });
  const click = async text => {
    assert.ok(await page.evaluate(t => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t && !b.disabled); if (!button) return false; button.click(); return true; }, text), `Missing button: ${text}`);
  };
  for (const width of [1440, 430]) {
    await page.setViewport({width,height:1100,deviceScaleFactor:1});
    await page.goto(url+'/directory-sharing-validation?page=register',{waitUntil:'networkidle2',timeout:120000});
    await page.waitForSelector('[aria-label="Share Asset umbrella"]');
    await page.click('[aria-label="Share Asset umbrella"]');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b=>b.textContent.includes('Inside Aim4price')));
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Inside Aim4price')).click());
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.querySelector('strong')?.textContent==='Dealer'));
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.querySelector('strong')?.textContent==='Dealer').click());
    await page.waitForSelector('#asset-quote-location-input');
    await page.$eval('#asset-quote-location-input',e=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,'George');e.dispatchEvent(new Event('input',{bubbles:true}));});
    await click('Show businesses');
    await page.waitForSelector('[aria-label="View Garden Route Repairs"]');
    await page.click('[aria-label="View Garden Route Repairs"]');
    await page.waitForSelector('[aria-label="Selected business"]');
    assert.match(await page.$eval('[aria-label="Selected business"]',e=>e.textContent), /Directory listing/);
    const geometry = await page.$eval('[aria-label="Selected business"]', e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right};});
    assert.ok(geometry.left >= -1 && geometry.right <= width+1, 'business profile fits the viewport');
    await page.screenshot({path:path.join(output,`directory-${width}.png`)});
    await click('Send message');
    await page.waitForFunction(()=>document.body.textContent.includes('To: Garden Route Repairs'));
    assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='WhatsApp')&&[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Email')));
    assert.equal(requests.filter(p=>p.includes('business-network/share')||p.includes('asset-leads')).length,0,'external handoff must not send server leads or emails');
    await page.screenshot({path:path.join(output,`directory-external-${width}.png`)});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS directory profile, external sharing handoff, viewport fit and no server delivery at 1440px and 430px');
  await page.close();
}

async function main() {
  await fs.mkdir(output,{recursive:true});
  const external=process.env.CANVAS_TEST_URL;let server,browser;const fixture=path.join(root,'app/directory-sharing-validation');
  try {
    if(!external) {
      await fs.mkdir(fixture);await fs.writeFile(path.join(fixture,'page.tsx'), "'use client';\nimport AssetRegisterClient from '../asset-register/asset-register-client';\nexport default function DirectoryValidation() { return <AssetRegisterClient />; }\n");
      server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3030'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'canvas_validation',PGPASSWORD:'local-validation-only',PGDATABASE:'canvas_validation',BETTER_AUTH_SECRET:'canvas-local-validation-secret-not-for-production'},stdio:['ignore','pipe','pipe']});
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Next startup timed out')),90000);server.stdout.on('data',data=>{if(data.toString().includes('Ready')){clearTimeout(timer);resolve()}});server.stderr.on('data',data=>process.stderr.write(data));server.once('exit',code=>{clearTimeout(timer);reject(Error(`Next exited ${code}`))})});
    }
    await fs.mkdir(output,{recursive:true});
    browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true,pipe:true});
    await check(browser,external||'http://127.0.0.1:3030');
  } finally {
    if(browser) await browser.close().catch(() => {});
    if(server) {
      // Remove only the files this runner owns, before stopping Next's worker.
      for(const file of [path.join(fixture,'page.tsx'),path.join(root,'.next/types/app/directory-sharing-validation/page.ts')]) {
        await fs.unlink(file).catch(error=>{if(error.code!=='ENOENT')throw error});
      }
      await fs.rmdir(fixture).catch(error=>{if(error.code!=='ENOENT')throw error});
      server.kill();
    }
  }
}
main().catch(error=>{console.error(error);process.exitCode=1});

