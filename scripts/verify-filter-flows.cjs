/* Real filter components with local API fixtures. Never contacts production data. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/filter-validation');
const nativeFixture = path.join(root, 'app/owner-app/filter-validation');
const source = `'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import FilterFlow, { FilterQuestion } from '../../components/FilterFlow';
import FuelClient from '../../app/fuel/fuel-client';
import MyInvoicesClient from '../../app/my-invoices/my-invoices-client';
import MaintenanceClient from '../../app/maintenance/maintenance-client';
export default function Page() {
 const page = useSearchParams().get('page');
 const [open, setOpen] = useState(false);
 const [value, setValue] = useState('all');
 const [applied, setApplied] = useState('all');
 if(page === 'fuel') return <FuelClient addedByLabel="Test Owner" />;
 if(page === 'cost') return <MyInvoicesClient />;
 if(page === 'maintenance') return <MaintenanceClient />;
 return <main><button id="launch" onClick={() => {setValue(applied);setOpen(true)}}>Filter</button><output>{applied}</output>{open ? <FilterFlow title="Filter records" onClose={() => setOpen(false)} onClear={() => setApplied('all')} onApply={() => {setApplied(value);setOpen(false)}}>
 <FilterQuestion label="Which asset?" value={value} onChange={setValue} searchable options={[{value:'all', label:'All assets'}, {value:'tractor', label:'Tractor'}, {value:'truck', label:'Truck'}]} />
 <FilterQuestion label="Which year?" value="all" onChange={() => {}} options={[{value:'all',label:'All years'}]} />
 </FilterFlow> : null}</main>;
}`;
async function main() {
 let server, browser;
 const created=[];
 try {
  await fs.mkdir(fixture); created.push(fixture); await fs.mkdir(nativeFixture); created.push(nativeFixture);
  await fs.writeFile(path.join(fixture,'page.tsx'),source);
  await fs.writeFile(path.join(nativeFixture,'page.tsx'),"export { default } from '../../filter-validation/page';");
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3030'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'filter_test',PGPASSWORD:'local-fixture-only',PGDATABASE:'filter_test',BETTER_AUTH_SECRET:'local-filter-validation-secret-only'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timed out')),60000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve()}});server.once('exit',code=>reject(Error(`Next exited: ${code}`)));});
  browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH || await chromium.executablePath(),args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true,pipe:true});
  const page=await browser.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(window, 'outerWidth', { configurable: true, get: () => innerWidth });
    localStorage.setItem('aim4price.website-canvas.v2.intro', 'seen');
  });
  await page.setRequestInterception(true);
  page.on('request',request=>{
   const url=new URL(request.url());
   if(url.pathname.startsWith('/api/')) {
    const user={id:'fixture',name:'Test Owner',email:'test@example.invalid',accountType:'owner'};
    const body=url.pathname==='/api/me'?{ok:true,signedIn:true,user}:url.pathname==='/api/account-profile'?{ok:true,profile:{...user,userId:user.id,displayName:user.name,extraPhotoUrls:[]}}:{ok:true,items:[],assets:[],records:[],groups:[],registers:[],notifications:[],storages:[],recentEvents:[],recentFuelSlips:[],requests:[],budgets:[],fieldManagers:[]};
    return request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
   }
   if(request.resourceType()==='media')return request.abort();request.continue();
  });
  const click=async text=>{assert.ok(await page.evaluate(t=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t&&!b.disabled);if(!b)return false;b.click();return true;},text),`Missing button: ${text}`)};
  for(const [route,width] of [['/filter-validation',1440],['/owner-app/filter-validation',430]]) {
   await page.setViewport({width,height:900});await page.goto('http://127.0.0.1:3030'+route,{waitUntil:'networkidle0',timeout:120000});
   await click('Filter');await page.waitForSelector('[role="dialog"] select');
   assert.equal(await page.$$eval('[role="dialog"] select',es=>es.length),1);
   await page.type('[role="dialog"] input','Tractor');await page.select('[role="dialog"] select','tractor');
   await click('Next');assert.match(await page.$eval('[role="dialog"]',e=>e.textContent),/Question 2 of 2/);
   await click('Back');assert.equal(await page.$eval('[role="dialog"] select',e=>e.value),'tractor');
   await page.keyboard.press('Escape');assert.equal(await page.$eval('output',e=>e.textContent),'all');
   await click('Filter');await page.select('[role="dialog"] select','truck');await click('Apply filters');assert.equal(await page.$eval('output',e=>e.textContent),'truck');
   await click('Filter');const last=await page.$('[role="dialog"] footer button:last-child');await last.focus();await page.keyboard.press('Tab');assert.equal(await page.$eval('[role="dialog"] button',e=>e===document.activeElement),true);
   const box=await page.$eval('[role="dialog"]',e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right}});assert.ok(box.left>=0&&box.right<=width+1,'Dialog fits viewport');
   await fs.mkdir(path.join(root,'.next/filter-validation'),{recursive:true});await page.screenshot({path:path.join(root,`.next/filter-validation/filter-${width}.png`)});
   await click('Clear filters');assert.equal(await page.$eval('output',e=>e.textContent),'all');
   console.log(`PASS ${width}: search, Back/Next, cancellation, apply, clear, focus containment, viewport`);
  }
  for(const kind of ['cost','maintenance','fuel']) {
   await page.setViewport({width:1440,height:1000});await page.goto(`http://127.0.0.1:3030/filter-validation?page=${kind}&view=slips`,{waitUntil:'networkidle0',timeout:120000});
   if(kind==='fuel') {await click('Exclusions');await page.waitForSelector('[aria-label="Fuel ledger exclusions"]');await page.click('[aria-label="Close exclusions"]');}
   await click('Filter');await page.waitForSelector('[role="dialog"] select');
   for(let i=1;i<=4;i++){assert.match(await page.$eval('[role="dialog"]',e=>e.textContent),new RegExp(`Question ${i} of 4`));if(i<4)await click('Next');}
   await click('Apply filters');assert.equal(await page.$('[role="dialog"]'),null);
   console.log(`PASS ${kind}: real client launches shared four-question flow${kind==='fuel'?' and exclusions':''}`);
  }
  assert.deepEqual(errors,[],'Browser errors');
 } finally {
  for(const dir of created){await fs.unlink(path.join(dir,'page.tsx')).catch(()=>{});await fs.rmdir(dir).catch(()=>{});
    const generated=path.join(root,'.next/types',path.relative(root,dir),'page.ts');
    await fs.unlink(generated).catch(()=>{});
  }
  if(browser) await browser.close().catch(()=>{});
  if(server) server.kill();
 }
}
main().catch(error=>{console.error(error);process.exitCode=1});
