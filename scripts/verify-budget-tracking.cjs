const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname,'..');
const fixture = path.join(root,'app/budget-validation');
const native = path.join(root,'app/owner-app/budget-validation');
const base={id:'budget-one',assetId:'tractor',assetTitle:'New Holland TT4.90',period:'monthly',periodLabel:'September 2026',periodKey:'2026-09',periodStart:'2026-09-01',periodEnd:'2026-10-01',amount:50000,spent:0,remaining:50000,overBy:0,percentUsed:0,warningPercent:80,includeFuelSlipCosts:false,status:'on_track',revision:1};
let budgets=[base,{...base,id:'budget-two',categories:['insurance','repair'],assetId:'truck',assetTitle:'Toyota Hilux',spent:45000,remaining:5000,percentUsed:90,status:'warning'},{...base,id:'budget-three',assetId:null,assetTitle:'All saved assets',period:'annual',periodLabel:'2026',periodKey:'2026',spent:60000,remaining:0,overBy:10000,percentUsed:120,status:'over_budget'}];
const assets=[{id:'tractor',title:'New Holland TT4.90',kind:'tractor',categoryLabel:'Tractor',yearModel:2022,usageReading:1276,usageMetric:'hours',condition:'Good',value:200000,serialNumber:'TEST-001',meta:''},{id:'truck',title:'Toyota Hilux',kind:'vehicle',categoryLabel:'Vehicle',yearModel:2020,usageReading:100000,usageMetric:'km',condition:'Good',value:200000,serialNumber:'TEST-002',meta:''}];
async function main(){let server,browser;const created=[];try{
 await fs.mkdir(fixture);created.push(fixture);await fs.mkdir(native);created.push(native);
 await fs.writeFile(path.join(fixture,'page.tsx'),`'use client';\nimport {useSearchParams} from 'next/navigation';\nimport MyInvoicesClient from '../my-invoices/my-invoices-client';\nexport default function Page(){const params=useSearchParams();return <MyInvoicesClient budgetsPage={params.get('page')!=='cost'} showAppHeader={false}/>;}`);
 await fs.writeFile(path.join(native,'page.tsx'),"export {default} from '../../budget-validation/page';");
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3031'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGUSER:'budget_fixture',PGPASSWORD:'local-fixture-only',PGDATABASE:'budget_fixture',BETTER_AUTH_SECRET:'local-budget-fixture-secret'},stdio:['ignore','pipe','pipe']});
 const logs=[];server.stdout.on('data',d=>logs.push(String(d)));server.stderr.on('data',d=>logs.push(String(d)));
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),60000);server.stdout.on('data',d=>{if(String(d).includes('Ready')){clearTimeout(timer);resolve();}});server.once('exit',()=>reject(Error(logs.join(''))));});
 browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH || await require('@sparticuz/chromium').executablePath(),headless:true,pipe:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']});
 const page=await browser.newPage(),errors=[],requests=[],savedCosts=[];const pdfBytes=await page.pdf({format:'A4'});page.on('pageerror',e=>errors.push(e.message));
 await page.evaluateOnNewDocument(()=>{Object.defineProperty(window,'outerWidth',{configurable:true,get:()=>innerWidth});localStorage.setItem('aim4price.website-canvas.v2.intro','seen');});
 await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/')){
 requests.push(u.pathname+u.search);
 if(u.pathname==='/api/my-invoices/budgets/report')return r.respond({status:200,contentType:'application/pdf',body:pdfBytes});
 const user={id:'fixture',name:'Test Owner',email:'fixture@example.invalid',accountType:'owner'};
 let body={ok:true,assets,items:[],invoices:[],requests:[],notifications:[],groups:[],registers:[],budgets};
 if(u.pathname==='/api/my-invoices/budgets' && r.method()==='POST'){const input=JSON.parse(r.postData());budgets.push({...base,...input,id:'new-budget',assetTitle:input.groupName || 'New budget',members:input.groupAssetIds?.map(id=>({id,title:assets.find(asset=>asset.id===id).title,spent:id==='truck'?5:0}))});body={ok:true,budgets,assets};}
 if(u.pathname.startsWith('/api/my-invoices/budgets/') && r.method()==='DELETE'){budgets=budgets.filter(b=>b.id!==u.pathname.split('/').pop());body={ok:true};}
 if(u.pathname==='/api/my-invoices/budgets/budget-two' && r.method()==='PATCH'){
   budgets.find(b=>b.id==='budget-two').includeRecurringCosts=JSON.parse(r.postData()).includeRecurringCosts;
 }
 if(u.pathname==='/api/recurring-commitments/test-cost' && r.method()==='DELETE'){
   const budget=budgets.find(b=>b.id==='budget-two');budget.recurringCosts=[];budget.expected=0;
 }
 if(u.pathname==='/api/recurring-commitments' && r.method()==='POST'){
   const input=JSON.parse(r.postData());savedCosts.push(input);
   const budget=budgets.find(b=>b.assetId===input.assetIds[0]);
   budget.expected=Number(input.amount);
   budget.recurringCosts=[{...input,id:'test-cost',count:1,expected:budget.expected,editableAmount:budget.expected,instalment:budget.expected}];
   body={ok:true};
 }
 if(u.pathname==='/api/me')body={ok:true,signedIn:true,user};
 if(u.pathname==='/api/account-profile')body={ok:true,profile:{...user,userId:user.id,displayName:user.name,extraPhotoUrls:[]}};
 if(u.pathname==='/api/my-invoices') body={ok:true,assets,invoices:[{id:'invoice-one',assetId:'tractor',invoiceNumber:'INV-001',supplierName:'Workshop',invoiceDate:'2026-09-10',totalIncVat:10000,source:'manual',assetTitle:'New Holland TT4.90',blocks:[]},{id:'invoice-fuel',assetId:'tractor',invoiceNumber:'FUEL-001',supplierName:'Fuel depot',invoiceDate:'2026-09-11',totalIncVat:500,source:'fuel_slip',blocks:[]}]};
 return r.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
 }if(r.resourceType()==='media')return r.abort();r.continue();});
 const click=async text=>{assert.ok(await page.evaluate(t=>{const b=[...document.querySelectorAll('button')].find(x=>!x.disabled && x.getClientRects().length && (x.textContent.trim()===t || x.querySelector('strong')?.textContent.trim()===t));if(!b)return false;b.click();return true;},text),`Button ${text}`);};
 await page.setViewport({width:1440,height:1000});await page.goto('http://localhost:3031/budget-validation',{waitUntil:'networkidle0',timeout:120000});await page.waitForSelector('article[data-status]');
 assert.equal(await page.$$eval('article[data-status]',e=>e.length),3);
 await page.screenshot({path:'/tmp/budget-desktop.png',fullPage:true});
 await click('Alerts (2)');assert.equal(await page.$$eval('article[data-status]',e=>e.length),2);await click('Clear filters');
 await page.type('input[aria-label="Search budgets"]','Toyota');await page.waitForFunction(()=>document.querySelectorAll('article[data-status]').length===1);await click('Clear filters');
 await click('Manage');await page.waitForSelector('[role=dialog]');await click('Edit budget & alerts');await page.waitForFunction(()=>document.querySelector('[role=dialog]')?.textContent.includes('budget'));await page.keyboard.press('Escape');
 await click('Manage');await page.waitForSelector('[role=dialog]');await click('Delete budget');await page.waitForSelector('[role=alertdialog]');await page.keyboard.press('Escape');assert.equal(await page.$('[role=alertdialog]'),null);
 await click('Add Budget');await page.waitForSelector('[role=dialog]');await page.keyboard.press('Escape');
 await click('Add Budget');
 assert.equal(await page.$('[data-asset-choice-list]'),null);
 await click('Next');await page.waitForSelector('[data-asset-choice-list]');
 await click('Back');await click('Multiple assets');await click('Next');
 assert.equal(await page.$$eval('[role=dialog] input', inputs=>inputs.length),1);
 await click('Select all shown (2)');await click('Next');await click('Next');
 assert.match(await page.$eval('[role=dialog]', e=>e.textContent), /One shared limit for 2 assets/);
 await click('Next');await page.type('input[placeholder="50 000.00"]','50000');await click('Next');
 assert.match(await page.$eval('[role=dialog]',e=>e.textContent),/Enter a group name/);
 await page.type('input[placeholder="e.g. Delivery fleet"]','Delivery fleet');await click('Next');
 assert.match(await page.$eval('[role=dialog]', e=>e.textContent), /for the group/);
 const assetSummary='[role=dialog] details summary';
 assert.equal(await page.$eval(assetSummary,e=>e.textContent),'View 2 assets');
 assert.equal(await page.$eval('[role=dialog] details',e=>e.open),false);
 await page.click(assetSummary);
 assert.equal(await page.$$eval('[role=dialog] details li',items=>items.length),2);
 await page.click(assetSummary);
 await click('Save budget');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
 const group=budgets.find(b=>b.groupName==='Delivery fleet');
 assert.deepEqual(group.groupAssetIds,['tractor','truck']);assert.equal(group.assetId,null);
 assert.equal(budgets.length,4);
 await page.click('button[aria-controls="budget-details-new-budget"]');
 const breakdown='#budget-details-new-budget section[aria-label="Spending by asset"]';
 await page.waitForSelector(breakdown);
 assert.match(await page.$eval(breakdown,e=>e.innerText),/Toyota Hilux/);
 assert.doesNotMatch(await page.$eval(breakdown,e=>e.innerText),/New Holland/);
 await page.click(breakdown+' summary');
 assert.match(await page.$eval(breakdown,e=>e.innerText),/New Holland/);
 await page.click('button[aria-controls="budget-details-new-budget"]');
 await click('Download');await click('All budgets');await click('Next');
 assert.match(await page.$eval('[role=dialog]',e=>e.textContent),/PDF report.*XLSX workbook/);
 await click('PDF report');await click('Open PDF report');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
 assert.ok(requests.some(u=>u.includes('/budgets/report?')&&u.includes('format=html')));

 const checkDetails = async id => {
   const details = '#budget-details-' + id;
   const trigger = 'button[aria-controls="budget-details-' + id + '"]';
   const start = requests.length;
   await page.click(trigger);
   await page.waitForSelector(details + ' [role="switch"]');
   const panel = await page.$eval(details, section => ({
     label: section.lastElementChild.getAttribute('aria-label'),
     text: section.innerText,
   }));
   assert.equal(panel.label, 'Recurring costs');
   assert.match(panel.text, /Expected this period/);
   assert.match(panel.text, /Add recurring cost/);
   assert.doesNotMatch(panel.text, /Recorded costs|No costs allocated|Workshop|Fuel depot/);
   assert.ok(!requests.slice(start).some(u=>u.split('?')[0]==='/api/my-invoices'), 'Expanding a budget should not fetch ledger rows');
   await page.click(trigger);
   await page.waitForSelector(details, {hidden:true});
 };
 await checkDetails('budget-one');
 await checkDetails('budget-two');
 // Start from the second card to catch accidental selection of the first saved asset.
 await page.click('button[aria-controls="budget-details-budget-two"]');
 await click('Add recurring cost');
 assert.deepEqual(await page.$$eval('[data-category]', buttons => buttons.map(b=>b.dataset.category)), ['repair','insurance']);
 await page.click('[data-category="insurance"]');
 await page.waitForSelector('#recurring-modal-title');
 assert.match(await page.$eval('[role="dialog"]', e=>e.textContent), /Recurring cost details.*Toyota Hilux/);
 await page.type('input[placeholder="e.g. Monthly insurance premium"]','Fleet cover');
 await page.type('input[inputmode="decimal"]','1800');
 await click('Back');
 await page.click('[data-category="repair"]');
 assert.equal(await page.$eval('input[placeholder="e.g. Monthly insurance premium"]', e=>e.value), 'Fleet cover');
 await click('Next');await click('Monthly');await click('Next');
 assert.match(await page.$eval('[role="dialog"] dl',e=>e.textContent), /AssetsToyota Hilux/);
 await click('Save recurring cost');
 await page.waitForFunction(()=>document.querySelector('#budget-details-budget-two')?.textContent.includes('Fleet cover'));
 assert.equal(savedCosts.length,1);
 assert.deepEqual(savedCosts[0].assetIds,['truck']);
 assert.equal(savedCosts[0].category,'repair');
 await click('Manage recurring costs');
 const recurring='#budget-details-budget-two section[aria-label="Recurring costs"]';
 const toggle=recurring+' [role="switch"]';
 await page.click(toggle);
 await page.waitForSelector(toggle+'[aria-checked="false"]');
 assert.equal(await page.$eval(recurring,e=>e.children.length),1);
 await page.click(toggle);
 await page.waitForSelector(toggle+'[aria-checked="true"]');
 await click('Manage recurring costs');await click('Delete');await click('Cancel');
 assert.match(await page.$eval(recurring,e=>e.innerText),/Fleet cover/);
 await click('Delete');await click('Delete recurring cost');
 await page.waitForFunction(selector=>!document.querySelector(selector).textContent.includes('Fleet cover'),{},recurring);
 await click('Add recurring cost');await click('Cancel');
 await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));

 // Budgets spanning more than one asset still need the coverage picker.
 await page.click('button[aria-controls="budget-details-budget-three"]');await click('Add recurring cost');
 await page.click('[data-category="insurance"]');await click('Choose assets');
 assert.equal(await page.$$eval('[data-asset-choice-row]',rows=>rows.length),2);
 await page.click('[aria-label="Back to recurring cost"]');await page.click('[aria-label="Close recurring cost"]');
 await page.goto('http://localhost:3031/budget-validation?page=cost&view=costs',{waitUntil:'networkidle0'});
 await click('+Add Cost');await click('Add recurring cost');await page.click('[data-category="insurance"]');
 await click('Choose assets');await click('Select all shown (2)');await click('Done');
 assert.match(await page.$eval('#recurring-modal-title',e=>e.textContent),/Recurring cost details/);
 await page.click('[aria-label="Close recurring cost"]');
 assert.equal(savedCosts.length,1,'Cancelling a draft should not create another cost');
 await page.setViewport({width:430,height:932});await page.goto('http://localhost:3031/owner-app/budget-validation',{waitUntil:'networkidle0'});await page.waitForSelector('article[data-status]');await page.screenshot({path:'/tmp/budget-mobile.png',fullPage:true});
 await checkDetails('budget-one');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No mobile horizontal overflow');
 assert.deepEqual(errors,[]);
 console.log('PASS: desktop/mobile cards, alerts, asset filter, add/edit modal launch, export choices and budget details ending at the recurring-costs panel');
 }finally{for(const dir of created){await fs.rm(dir,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types',path.relative(root,dir)),{recursive:true,force:true});}if(browser)await browser.close();if(server)server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
