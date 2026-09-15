const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname,'..');
const fixture = path.join(root,'app/budget-validation');
const native = path.join(root,'app/owner-app/budget-validation');
const base={id:'budget-one',assetId:'tractor',assetTitle:'New Holland TT4.90',period:'monthly',periodLabel:'September 2026',periodKey:'2026-09',periodStart:'2026-09-01',periodEnd:'2026-10-01',amount:50000,spent:10000,remaining:40000,overBy:0,percentUsed:20,warningPercent:80,includeFuelSlipCosts:false,status:'on_track',revision:1};
let budgets=[base,{...base,id:'budget-two',assetId:'truck',assetTitle:'Toyota Hilux',spent:45000,remaining:5000,percentUsed:90,status:'warning'},{...base,id:'budget-three',assetId:null,assetTitle:'All saved assets',period:'annual',periodLabel:'2026',periodKey:'2026',spent:60000,remaining:0,overBy:10000,percentUsed:120,status:'over_budget'}];
const assets=[{id:'tractor',title:'New Holland TT4.90',kind:'tractor',categoryLabel:'Tractor',yearModel:2022,usageReading:1276,usageMetric:'hours',condition:'Good',value:200000,serialNumber:'TEST-001',meta:''},{id:'truck',title:'Toyota Hilux',kind:'vehicle',categoryLabel:'Vehicle',yearModel:2020,usageReading:100000,usageMetric:'km',condition:'Good',value:200000,serialNumber:'TEST-002',meta:''}];
async function main(){let server,browser;const created=[];try{
 await fs.mkdir(fixture);created.push(fixture);await fs.mkdir(native);created.push(native);
 await fs.writeFile(path.join(fixture,'page.tsx'),`'use client';\nimport {useSearchParams} from 'next/navigation';\nimport MyInvoicesClient from '../my-invoices/my-invoices-client';\nexport default function Page(){const params=useSearchParams();return <MyInvoicesClient budgetsPage={params.get('page')!=='cost'} showAppHeader={false}/>;}`);
 await fs.writeFile(path.join(native,'page.tsx'),"export {default} from '../../budget-validation/page';");
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3031'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGUSER:'budget_fixture',PGPASSWORD:'local-fixture-only',PGDATABASE:'budget_fixture',BETTER_AUTH_SECRET:'local-budget-fixture-secret'},stdio:['ignore','pipe','pipe']});
 const logs=[];server.stdout.on('data',d=>logs.push(String(d)));server.stderr.on('data',d=>logs.push(String(d)));
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),60000);server.stdout.on('data',d=>{if(String(d).includes('Ready')){clearTimeout(timer);resolve();}});server.once('exit',()=>reject(Error(logs.join(''))));});
 browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH || await require('@sparticuz/chromium').executablePath(),headless:true,pipe:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']});
 const page=await browser.newPage(),errors=[],requests=[];const pdfBytes=await page.pdf({format:'A4'});page.on('pageerror',e=>errors.push(e.message));
 await page.evaluateOnNewDocument(()=>{Object.defineProperty(window,'outerWidth',{configurable:true,get:()=>innerWidth});localStorage.setItem('aim4price.website-canvas.v2.intro','seen');});
 await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/')){
 requests.push(u.pathname+u.search);
 if(u.pathname==='/api/my-invoices/budgets/report')return r.respond({status:200,contentType:'application/pdf',body:pdfBytes});
 const user={id:'fixture',name:'Test Owner',email:'fixture@example.invalid',accountType:'owner'};
 let body={ok:true,assets,items:[],invoices:[],requests:[],notifications:[],groups:[],registers:[],budgets};
 if(u.pathname==='/api/my-invoices/budgets' && r.method()==='POST'){const input=JSON.parse(r.postData());budgets.push({...base,...input,id:'new-budget',assetTitle:'New budget'});body={ok:true,budgets,assets};}
 if(u.pathname.startsWith('/api/my-invoices/budgets/') && r.method()==='DELETE'){budgets=budgets.filter(b=>b.id!==u.pathname.split('/').pop());body={ok:true};}
 if(u.pathname==='/api/me')body={ok:true,signedIn:true,user};
 if(u.pathname==='/api/account-profile')body={ok:true,profile:{...user,userId:user.id,displayName:user.name,extraPhotoUrls:[]}};
 if(u.pathname==='/api/my-invoices') body={ok:true,assets,invoices:[{id:'invoice-one',assetId:'tractor',invoiceNumber:'INV-001',supplierName:'Workshop',invoiceDate:'2026-09-10',totalIncVat:10000,source:'manual',assetTitle:'New Holland TT4.90',blocks:[]},{id:'invoice-fuel',assetId:'tractor',invoiceNumber:'FUEL-001',supplierName:'Fuel depot',invoiceDate:'2026-09-11',totalIncVat:500,source:'fuel_slip',blocks:[]}]};
 return r.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
 }if(r.resourceType()==='media')return r.abort();r.continue();});
 const click=async text=>{assert.ok(await page.evaluate(t=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===t&&!x.disabled);if(!b)return false;b.click();return true;},text),`Button ${text}`);};
 await page.setViewport({width:1440,height:1000});await page.goto('http://localhost:3031/budget-validation',{waitUntil:'networkidle0',timeout:120000});await page.waitForSelector('article[data-status]');
 assert.equal(await page.$$eval('article[data-status]',e=>e.length),3);
 await page.screenshot({path:'/tmp/budget-desktop.png',fullPage:true});
 await click('Alerts (2)');assert.equal(await page.$$eval('article[data-status]',e=>e.length),2);await click('Clear filters');
 await click('Filter');await page.waitForSelector('[role=combobox]');await page.click('[role=combobox]');await page.waitForSelector('[role=option]');await page.evaluate(()=>[...document.querySelectorAll('[role=option]')].find(e=>e.textContent.includes('Toyota')).click());await click('Apply filters');assert.equal(await page.$$eval('article[data-status]',e=>e.length),1);await click('Clear filters');
 await click('Manage');await page.waitForSelector('[role=dialog]');await click('Edit budget & alerts');await page.waitForFunction(()=>document.querySelector('[role=dialog]')?.textContent.includes('budget'));await page.keyboard.press('Escape');
 await click('Manage');await page.waitForSelector('[role=dialog]');await click('Delete budget');await page.waitForSelector('[role=alertdialog]');await page.keyboard.press('Escape');assert.equal(await page.$('[role=alertdialog]'),null);
 await click('Add Budget');await page.waitForSelector('[role=dialog]');await page.keyboard.press('Escape');
 await click('Download');await page.waitForSelector('[role=dialog]');assert.match(await page.$eval('[role=dialog]',e=>e.textContent),/PDF report.*Excel workbook/);await click('PDF report');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));assert.ok(requests.some(u=>u.includes('/budgets/report?')&&u.includes('format=pdf')));
 await click('View details');await page.waitForSelector('[aria-label="Allocated costs"]');
 assert.match(await page.$eval('[aria-label="Allocated costs"]',e=>e.textContent),/Workshop/);
 assert.doesNotMatch(await page.$eval('[aria-label="Allocated costs"]',e=>e.textContent),/Fuel depot/);
 assert.ok(requests.some(u=>u.includes('assetId=tractor')&&u.includes('year=2026')&&u.includes('month=9')));
 assert.match(page.url(),/budget-validation$/);
 await page.screenshot({path:'/tmp/budget-expanded.png',fullPage:true});
 await click('Hide details');assert.equal(await page.$('[aria-label="Allocated costs"]'),null);
 await page.setViewport({width:430,height:932});await page.goto('http://localhost:3031/owner-app/budget-validation',{waitUntil:'networkidle0'});await page.waitForSelector('article[data-status]');await page.screenshot({path:'/tmp/budget-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No mobile horizontal overflow');
 assert.deepEqual(errors,[]);
 console.log('PASS: desktop/mobile cards, alerts, asset filter, add/edit modal launch, export choices and inline allocated costs');
 }finally{for(const dir of created){await fs.rm(dir,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types',path.relative(root,dir)),{recursive:true,force:true});}if(browser)await browser.close();if(server)server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
