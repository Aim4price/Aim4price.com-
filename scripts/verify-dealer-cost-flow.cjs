// Runs the real client against fixture APIs; never writes live client costs.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/cost-flow-validation');
async function main() {
 let server, browser;
 try {
  await fs.mkdir(fixture, {recursive:true});
  await fs.writeFile(path.join(fixture, 'page.tsx'), `'use client';
import MyInvoicesClient from '../my-invoices/my-invoices-client';
export default function Page(){return <MyInvoicesClient dealerMode showAppHeader />;}`);
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next','dev','-p','3041'], {cwd:root, env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'fixture',PGPASSWORD:'fixture-only',PGDATABASE:'fixture',BETTER_AUTH_SECRET:'fixture-only-cost-flow'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Startup timed out')),90000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timeout);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));});
  browser = await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH || await require('@sparticuz/chromium').executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});
  const page = await browser.newPage(), errors=[], writes=[], allowanceIds=[];
  const asset={id:'10000000-0000-4000-8000-000000000001',ownerUserId:'owner',ownerName:'Test Farm',canAddCosts:true,title:'2017 Toyota Hilux',kind:'vehicle',categoryLabel:'Vehicle',yearModel:2017,usageReading:42000,usageMetric:'km',condition:'good',value:350000,selectedMethod:'manual',meta:'Test vehicle'};
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',r=>{
   const u=new URL(r.url());if(!u.pathname.startsWith('/api/'))return r.continue();
   if(r.method()==='POST')writes.push({path:u.pathname,body:r.postData()||''});
   let data={ok:true,requests:[],notifications:[],items:[]};
   if(u.pathname==='/api/me')data={ok:true,signedIn:true,user:{id:'dealer',name:'Test Dealer',email:'dealer@example.invalid',accountType:'dealer'}};
   if(u.pathname==='/api/account-profile')data={ok:true,profile:{accountType:'dealer',accountStatus:'active',businessName:'Test Dealer'}};
   if(u.pathname==='/api/dealer/cost')data={ok:true,assets:[asset,{...asset,id:'no-cost-access',title:'Read only tractor',canAddCosts:false}],invoices:[],dealerDefaults:{supplierName:'Test Dealer',address:'Test address',vatNumber:''}};
   if(u.pathname==='/api/capture-allowance'){allowanceIds.push(u.searchParams.get('assetId'));data={ok:true,blocked:false,used:0,bypass:false};}
   if(u.pathname==='/api/dealer/capture-requests/invoice')data={ok:true,request:{referenceCode:'A4P-INV-TEST'}};
   return r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.evaluateOnNewDocument(()=>{Object.defineProperty(window,'outerWidth',{configurable:true,get:()=>innerWidth});localStorage.setItem('aim4price.website-canvas.v2.intro','seen');});
  async function click(text){await page.$$eval('button',(nodes,text)=>{const b=nodes.find(n=>n.textContent.trim().replace(/^\+\s*/, '')===text||n.querySelector('strong')?.textContent===text);if(!b)throw Error('Missing '+text);b.click();},text);}
  async function open(width){await page.setViewport({width,height:900});await page.goto('http://127.0.0.1:3041/cost-flow-validation',{waitUntil:'networkidle0',timeout:120000});await page.waitForFunction(()=>document.body.textContent.includes('No asset costs saved yet'));}
  async function choose(){await click('Add Cost');await page.waitForFunction(()=>document.body.textContent.includes('Choose client business'));assert.equal(await page.$('[data-cost-choice-modal]'),null);await click('Test Farm');await page.waitForFunction(()=>document.body.textContent.includes('Choose client asset'));assert(!await page.evaluate(()=>document.body.textContent.includes('Read only tractor')));await click(asset.title);await page.waitForSelector('[data-cost-choice-modal]');}
  await open(1920);await page.screenshot({path:'/tmp/dealer-cost-page.png'});
  const geometry=await page.$eval('main[class*="dealerCostsPage"] > section',e=>({width:e.offsetWidth,padding:parseFloat(getComputedStyle(e).paddingLeft)}));assert(geometry.width<=1180&&geometry.padding>0);
  await choose();await click('Enter cost manually');await page.waitForFunction(()=>document.body.textContent.includes('Add the invoice details'));
  assert(!await page.evaluate(()=>document.body.textContent.includes('Dealer details pulled')));
  await page.$$eval('label',nodes=>{const input=nodes.find(n=>n.querySelector('span')?.textContent==='Total incl. VAT').querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'1150');input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.screenshot({path:'/tmp/dealer-cost-manual.png'});await click('Next');await page.waitForFunction(()=>document.body.textContent.includes('Describe the work'));await click('Next');await page.waitForFunction(()=>document.body.textContent.includes('Supporting document'));await click('Skip for now');await page.waitForSelector('[role="dialog"][aria-label="Review cost"]');
  assert.equal(await page.$('[role="dialog"][aria-label="Review cost"] [class*="assetIcon"]'),null);
  await page.screenshot({path:'/tmp/dealer-cost-review.png'});await click('Save cost');await page.waitForFunction(()=>!document.querySelector('[role="dialog"][aria-label="Review cost"]'));
  const saved=writes.find(w=>w.path==='/api/dealer/cost');assert(saved);assert.equal(JSON.parse(saved.body).assetId,asset.id);
  await choose();await click('Automatic upload');await page.waitForFunction(()=>document.body.textContent.includes('0 of 10'));
  await click('Back');await page.waitForSelector('[data-cost-choice-modal]');await click('Change asset');await page.waitForFunction(()=>document.body.textContent.includes('Choose client asset'));await click(asset.title);await click('Automatic upload');await page.waitForFunction(()=>document.body.textContent.includes('0 of 10'));
  const pdf=await require('pdf-lib').PDFDocument.create();pdf.addPage();await fs.writeFile('/tmp/dealer-cost-invoice.pdf',await pdf.save());await (await page.$('input[type=file]')).uploadFile('/tmp/dealer-cost-invoice.pdf');
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Continue'&&!b.disabled));await page.screenshot({path:'/tmp/dealer-cost-upload.png'});await click('Continue');await click('Upload automatically');await page.waitForFunction(()=>document.body.textContent.includes('A4P-INV-TEST received'));
  assert(writes.some(w=>w.path==='/api/dealer/capture-requests/invoice'));assert(allowanceIds.length>=2);assert(allowanceIds.every(id=>id===asset.id));
  await open(1024);await choose();assert(await page.$eval('[data-cost-choice-modal]',e=>e.scrollHeight<=e.clientHeight+1));
  assert.deepEqual(errors,[]);console.log('PASS: eligible asset first, manual save, review without icon, upload, back/change asset, correct allowance IDs, desktop/tablet layout.');
 } finally {
  if(browser)await browser.close();if(server){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}
  await fs.rm(fixture,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types/app/cost-flow-validation'),{recursive:true,force:true});
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
