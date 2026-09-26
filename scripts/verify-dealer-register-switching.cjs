/* Real register component with intercepted account/asset APIs; no production writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/dealer-register-validation');
const base = 'http://127.0.0.1:3036';
const user = { id: 'fixture-dealer', name: 'Test Dealer', email: 'dealer@example.invalid', accountType: 'dealer' };
const registers = ['dealer', 'client'].map((kind, index) => ({ id: kind + '-register', userId: user.id, businessName: index ? 'Client Farm' : 'Dealer Stock', isPrimary: !index, isSelected: !index, assetCount: 1, totalValue: 100000, totalReplacementPrice: 200000, createdAtIso: '2026-09-25T00:00:00Z', updatedAtIso: '2026-09-25T00:00:00Z' }));
async function main() {
 let server, browser;
 try {
  await fs.mkdir(fixture, {recursive:true});
  await fs.writeFile(path.join(fixture,'page.tsx'), `import AssetRegisterClient from '../asset-register/asset-register-client';
export default function Fixture({searchParams}:{searchParams:{dealerView?:string}}){return <AssetRegisterClient dealerRegisterMode={searchParams.dealerView==='client'?'client':'dealer'} dealerRegisterBaseHref="/dealer-register-validation"/>}`);
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3036'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'validation',PGPASSWORD:'local-only',PGDATABASE:'validation',BETTER_AUTH_SECRET:'local-validation-only-secret'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timed out')),60000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve()}});server.stderr.on('data',d=>process.stderr.write(d));});
  browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await require('@sparticuz/chromium').executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true,pipe:true});
  const page=await browser.newPage(),errors=[],writes=[],groups=new Map();
  page.on('pageerror',e=>errors.push(e.message));
  await page.evaluateOnNewDocument(()=>Object.defineProperty(window,'outerWidth',{configurable:true,get:()=>innerWidth}));
  await page.setRequestInterception(true);
  page.on('request',req=>{
   const url=new URL(req.url());
   if(!url.pathname.startsWith('/api/'))return req.continue();
   const registerId=url.searchParams.get('registerId')||new URL(page.url()).searchParams.get('registerId')||registers[0].id;
   const register=registers.find(r=>r.id===registerId)||registers[0];
   const asset={id:register.id+'-asset',userId:user.id,registerId:register.id,title:register.businessName+' tractor',kind:'tractor',value:100000,selectedValueExVat:100000,replacementPriceExVat:200000,specsJson:{},condition:'good',photos:[],documents:[],createdAtIso:'2026-09-25T00:00:00Z',updatedAtIso:'2026-09-25T00:00:00Z'};
   let body={ok:true,register,registers,items:[asset],assets:[asset],groups:groups.get(register.id)||[],notifications:[],listings:[],storages:[],recentEvents:[],recentFuelSlips:[],requests:[],budgets:[],scanPin:{enabled:false,hasPin:false}};
   if(url.pathname==='/api/me')body={ok:true,signedIn:true,user};
   if(url.pathname==='/api/account-profile')body={ok:true,profile:{...user,userId:user.id,businessName:'Test Dealer',accountStatus:'active'}};
   if(url.pathname==='/api/asset-groups'&&req.method()==='POST'){
    const data=JSON.parse(req.postData());writes.push(data);
    assert.equal(data.registerId,register.id);assert.equal(data.scope,'register');assert.deepEqual(data.memberIds,[asset.id]);
    const group={id:register.id+'-umbrella',userId:user.id,registerId:register.id,name:data.name,valueMode:'separate',members:[{assetId:asset.id,role:'member',relationship:'works_with',countsTowardTotal:true,sortOrder:0}],createdAtIso:'2026-09-25T00:00:00Z',updatedAtIso:'2026-09-25T00:00:00Z'};
    groups.set(register.id,[group]);body={ok:true,group,groups:[group]};
   }
   return req.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  const click=async text=>{await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===t&&!b.disabled),{},text);await page.evaluate(t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t&&!b.disabled).click(),text)};
  for(const width of [1440,430]){
   groups.clear();await page.setViewport({width,height:1000});
   await page.goto(base+'/dealer-register-validation?dealerView=dealer&registerId=dealer-register',{waitUntil:'networkidle2',timeout:120000});
   for(const kind of ['dealer','client']){
    await page.waitForSelector('[aria-label="Create an umbrella with '+(kind==='dealer'?'Dealer Stock':'Client Farm')+' tractor"]');
    await page.click('[aria-label^="Create an umbrella with"]');
    await page.click('input[placeholder="Example: Farm transport set"]',{clickCount:3});
    await page.keyboard.press('Backspace');
    await page.type('input[placeholder="Example: Farm transport set"]',kind+' umbrella');
    await click('Next');await click('Next');await click('Create umbrella');
    await page.waitForSelector('[aria-label="Edit '+kind+' umbrella"]');
    await page.click('[aria-label="Switch Asset Register"]');
    await page.waitForSelector('[aria-label="Search asset registers"]');
    const list=await page.$eval('[aria-labelledby="asset-register-change-title"]',e=>e.textContent);
    assert.match(list,/Dealer Stock/);assert.match(list,/Client Farm/);assert.doesNotMatch(list,/Combined Asset Registers/);
    const target=kind==='dealer'?'Client Farm':'Dealer Stock',nextMode=kind==='dealer'?'client':'dealer';
    await page.type('[aria-label="Search asset registers"]',target);
    await Promise.all([page.waitForNavigation({waitUntil:'networkidle2'}),page.evaluate(t=>[...document.querySelectorAll('[aria-labelledby="asset-register-change-title"] button')].find(b=>b.querySelector('strong')?.textContent===t).click(),target)]);
    assert.equal(new URL(page.url()).searchParams.get('dealerView'),nextMode);
    assert.equal(new URL(page.url()).searchParams.get('registerId'),nextMode+'-register');
   }
   await page.waitForSelector('[aria-label="Edit dealer umbrella"]');
  }
  assert.equal(writes.length,4);assert.deepEqual(errors,[]);
  console.log('PASS dealer/client umbrella creation stays register-scoped; searchable top switcher navigates both ways at 1440px and 430px.');
 } finally {
  if(browser)await browser.close();
  await fs.unlink(path.join(fixture,'page.tsx')).catch(()=>{});await fs.rmdir(fixture).catch(()=>{});
  await fs.unlink(path.join(root,'.next/types/app/dealer-register-validation/page.ts')).catch(()=>{});
  if(server)server.kill();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
