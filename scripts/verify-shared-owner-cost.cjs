/* Real owner wizard in shared context, fixture APIs only. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process'),puppeteer=require('puppeteer-core');
const root=path.resolve(__dirname,'..'),fixture=path.join(root,'app/business/shared-cost-validation');
async function main(){let server,browser;try{
 await fs.mkdir(fixture,{recursive:true});await fs.writeFile(path.join(fixture,'page.tsx'),`'use client';
import {useState} from 'react';
import SharedAssetContributionDialog from '../../../components/leads/SharedAssetContributionDialog';
export default function Page(){const [open,setOpen]=useState(true);return <><button onClick={()=>setOpen(true)}>Open cost</button>{open&&<SharedAssetContributionDialog kind="costs" endpoint="/api/fixture-cost" assetTitle="2023 Toyota Hilux" onClose={()=>setOpen(false)}/>}</>}`);
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3038'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'fixture',PGPASSWORD:'fixture-only',PGDATABASE:'fixture',BETTER_AUTH_SECRET:'fixture-only-shared-cost'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Next startup timed out')),90000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timeout);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));});
 browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await require('@sparticuz/chromium').executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});
 const page=await browser.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
 const asset={id:'10000000-0000-4000-8000-000000000001',title:'2023 Toyota Hilux',kind:'vehicle',categoryLabel:'Vehicle',yearModel:2023,usageReading:42000,usageMetric:'km',condition:'good',value:350000,selectedMethod:'manual',serialNumber:'TEST-001',meta:'TEST-001'};
 page.on('request',r=>{const u=new URL(r.url());if(!u.pathname.startsWith('/api/'))return r.continue();if(r.method()==='POST')writes.push({path:u.pathname,body:r.postData()||''});let data={};if(u.pathname==='/api/fixture-cost')data=r.method()==='GET'?{ok:true,asset}:{ok:true};else if(u.pathname==='/api/fixture-cost/allowance')data={ok:true,blocked:false,used:0,bypass:false};else if(u.pathname==='/api/fixture-cost/capture')data={ok:true,request:{referenceCode:'A4P-INV-TEST123456'}};else if(u.pathname.includes('session'))data=null;return r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});});
 async function click(text){await page.$$eval('button',(nodes,text)=>{const button=nodes.find(n=>n.textContent.trim()===text||n.querySelector('strong')?.textContent===text);if(!button)throw Error('Missing '+text);button.click();},text);}
 async function open(width,height){await page.setViewport({width,height});await page.goto('http://127.0.0.1:3038/business/shared-cost-validation',{waitUntil:'networkidle0',timeout:120000});await page.waitForSelector('[data-cost-choice-modal]');}
 await open(1440,900);await page.screenshot({path:'/tmp/shared-owner-cost-choice.png'});assert(await page.$eval('[data-cost-choice-modal]',e=>e.scrollHeight<=e.clientHeight+1));
 await click('Enter cost manually');await page.waitForFunction(()=>document.body.textContent.includes('Add the invoice details'));
 await page.$$eval('label',nodes=>{const label=nodes.find(n=>n.querySelector('span')?.textContent==='Total incl. VAT');const input=label.querySelector('input');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'1150');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.screenshot({path:'/tmp/shared-owner-manual-cost.png'});
 await click('Next');await page.waitForFunction(()=>document.body.textContent.includes('Describe the work'));await click('Next');await page.waitForFunction(()=>document.body.textContent.includes('Review your cost'));await click('Save cost record');await page.waitForFunction(()=>document.body.textContent.includes('Cost record saved to the asset.'));
 assert.equal(writes.filter(r=>r.path==='/api/fixture-cost').length,1);assert(!writes.some(r=>r.path.startsWith('/api/my-invoices')));
 await open(1440,900);await click('Upload for Aim4price capture');await page.waitForSelector('input[type=file]');await page.waitForFunction(()=>document.body.textContent.includes('0 of 10'));
 const pdf=await require('pdf-lib').PDFDocument.create();pdf.addPage();await fs.writeFile('/tmp/shared-owner-invoice.pdf',await pdf.save());await (await page.$('input[type=file]')).uploadFile('/tmp/shared-owner-invoice.pdf');await page.screenshot({path:'/tmp/shared-owner-capture.png'});
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Send')&&!b.disabled));
 await page.$$eval('button',nodes=>nodes.find(n=>n.textContent.includes('Send')&&!n.disabled).click());await page.waitForFunction(()=>document.body.textContent.includes('A4P-INV-TEST123456 received'));
 assert.equal(writes.filter(r=>r.path==='/api/fixture-cost/capture').length,1);
 await open(1024,768);assert(await page.$eval('[data-cost-choice-modal]',e=>e.scrollHeight<=e.clientHeight+1));assert.deepEqual(errors,[]);console.log('PASS owner cost choice, complete manual wizard, assisted upload and scoped requests; desktop fit');
 }finally{if(browser)await browser.close();if(server){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}await fs.rm(fixture,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types/app/business/shared-cost-validation'),{recursive:true,force:true});}}
main().catch(e=>{console.error(e);process.exitCode=1;});
