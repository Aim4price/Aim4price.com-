/* Local document fixtures only; exercise draft preservation and chooser focus. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/document-type-validation');
async function main() {
 let server, browser;
 try {
  await fs.mkdir(fixture, {recursive:true});
  await fs.writeFile(path.join(fixture,'page.tsx'), "import DocumentsClient from '../documents/documents-client';\nexport default function Page(){return <DocumentsClient />;}\n");
  await fs.mkdir(path.join(fixture, 'asset'), {recursive:true});
  await fs.writeFile(path.join(fixture, 'asset/page.tsx'), `'use client';
import {useState} from 'react';
import {AssetDocumentUploadFlow} from '../../documents/documents-client';
export default function Page(){const [open,setOpen]=useState(true),[saved,setSaved]=useState(0);return <><button onClick={()=>setOpen(true)}>Add document</button><p data-saved>{saved} saved</p>{open&&<AssetDocumentUploadFlow assetId="asset-fixture" assetTitle="2022 New Holland TT4.90" onClose={()=>setOpen(false)} onUploaded={(_,outcome)=>{setSaved(outcome.totalUploaded);if(outcome.complete)setOpen(false);}}/>}</>}`);
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3049'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGUSER:'fixture',PGPASSWORD:'fixture',PGDATABASE:'fixture',BETTER_AUTH_SECRET:'document-picker-fixture-only'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),90000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));});
  browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await require('@sparticuz/chromium').executablePath(),args:['--no-sandbox','--disable-gpu'],pipe:true,headless:true});
  const page=await browser.newPage(), errors=[], uploads=[];
  let failNextUpload=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1440,height:900});
  await page.setRequestInterception(true);
  page.on('request',async r=>{
   const u=new URL(r.url());if(!u.pathname.startsWith('/api/'))return r.continue();
   const user={id:'fixture',name:'Test Owner',email:'test@example.invalid',accountType:'owner'};
   const doc={id:'fixture',title:'Saved title',category:'insurance',documentType:'insurance-policy',notes:'Keep these notes',expiryDate:null,fileName:'policy.pdf',contentType:'application/pdf',byteSize:100,assetLinks:[],createdAtIso:'2026-10-01',updatedAtIso:'2026-10-01',deletedAtIso:null};
   if(u.pathname==='/api/documents'&&r.method()==='POST') {
    uploads.push(await r.fetchPostData());
    if(failNextUpload){failNextUpload=false;return r.respond({status:500,contentType:'application/json',body:JSON.stringify({ok:false,error:'Fixture upload failure'})});}
    return r.respond({status:200,contentType:'application/json',body:JSON.stringify({ok:true,document:doc})});
   }
   const data=u.pathname==='/api/me'?{ok:true,signedIn:true,user}:u.pathname==='/api/documents'?{ok:true,documents:[doc],assets:[]}:{ok:true,items:[],notifications:[],profile:{...user,userId:user.id,displayName:user.name,extraPhotoUrls:[]}};
   r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  async function click(text){await page.$$eval('button',(buttons,text)=>{const b=buttons.find(b=>b.textContent.trim()===text);if(!b)throw Error('Missing '+text);b.click();},text);}
  await page.goto('http://127.0.0.1:3049/document-type-validation',{waitUntil:'networkidle0',timeout:120000});
  await click('Edit');await page.waitForSelector('#document-type-trigger');
  await page.click('#document-type-trigger');await page.waitForSelector('#document-type-title');
  assert.equal(await page.$$eval('[role=dialog]',nodes=>nodes.length),1);
  await page.waitForFunction(()=>document.querySelector('[aria-label="Search document types"]')===document.activeElement);
  await page.type('[aria-label="Search document types"]','licence');
  await page.keyboard.press('Escape');await page.waitForSelector('#document-type-trigger');
  assert.match(await page.$eval('#document-type-trigger',e=>e.textContent),/Insurance policy/);
  // Closing restores focus on the next animation frame, after the parent remounts.
  await page.waitForFunction(()=>document.querySelector('#document-type-trigger')===document.activeElement);
  await page.click('#document-type-trigger');await page.waitForSelector('#document-type-title');
  await page.type('[aria-label="Search document types"]','licence');await click('Licence disc');
  await page.waitForSelector('#document-type-trigger');
  assert.match(await page.$eval('#document-type-trigger',e=>e.textContent),/Licence disc/);
  assert.equal(await page.$eval('textarea',e=>e.value),'Keep these notes');
  await page.click('[aria-label="Close dialog"]');
  await click('Upload documents');await page.waitForSelector('input[type=file]');
  await fs.writeFile('/tmp/document-picker-fixture.txt','Local test document');
  await (await page.$('input[type=file]')).uploadFile('/tmp/document-picker-fixture.txt');await click('Continue');await page.waitForSelector('#document-type-trigger');
  await page.click('#document-type-trigger');await page.waitForSelector('#document-type-title');await click('Insurance policy');
  await page.waitForSelector('#document-type-trigger');assert.match(await page.$eval('#document-type-trigger',e=>e.textContent),/Insurance policy/);
  // Asset cards use this same wizard, with a fixed link and no vault page underneath.
  for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
   uploads.length=0;failNextUpload=true;
   await page.setViewport(viewport);
   await page.goto('http://127.0.0.1:3049/document-type-validation/asset',{waitUntil:'networkidle0',timeout:120000});
   await page.waitForSelector('input[type=file]');
   assert.equal(await page.$('#document-vault-title'),null);
   await click('Continue');await page.waitForFunction(()=>document.body.textContent.includes('Select at least one document'));
   await fs.writeFile('/tmp/document-picker-second.txt','Second local document');
   await (await page.$('input[type=file]')).uploadFile('/tmp/document-picker-fixture.txt','/tmp/document-picker-second.txt');
   await click('Continue');await page.waitForSelector('#document-type-trigger');
   await page.click('#document-type-trigger');await page.waitForSelector('#document-type-title');await click('Insurance policy');
   await page.waitForSelector('#document-type-trigger');
   await click('Continue');await page.waitForSelector('#linked-asset-heading');
   assert.match(await page.$eval('#linked-asset-heading',e=>e.textContent),/2022 New Holland/);
   assert(!await page.$$eval('button',buttons=>buttons.some(b=>b.textContent.includes('Choose assets')||b.textContent.includes('Change assets'))));
   await page.screenshot({path:'/tmp/asset-document-confirm-'+viewport.width+'.png'});
   await click('Back');await page.waitForSelector('#document-type-trigger');assert.match(await page.$eval('#document-type-trigger',e=>e.textContent),/Insurance policy/);
   await click('Continue');await page.waitForSelector('#linked-asset-heading');await click('Upload 2 documents');
   await page.waitForFunction(()=>document.body.textContent.includes('1 file remains'));
   assert.equal(uploads.length,2);assert.equal(await page.$eval('[data-saved]',e=>e.textContent),'1 saved');
   await click('Upload document');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
   assert.equal(await page.$eval('[data-saved]',e=>e.textContent),'2 saved');assert.equal(uploads.length,3);
   for(const body of uploads){assert.match(body,/asset-fixture/);assert.match(body,/name="assetIds"/);assert.match(body,/insurance-policy/);}
   // Only the failed file is retried, and its request ID remains stable.
   assert.match(uploads[2],/filename="document-picker-fixture.txt"/);
   const requestId=body=>body.match(/name="requestId"\r\n\r\n([^\r]+)/)?.[1];
   assert(requestId(uploads[0]));assert.equal(requestId(uploads[0]),requestId(uploads[2]));
   await click('Add document');await page.waitForSelector('input[type=file]');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
  }
  assert.deepEqual(errors,[]);
  console.log('PASS vault and asset-card wizard, chooser, fixed links, partial retry, cumulative totals, Escape and desktop/mobile flow');
 } finally {if(browser)await browser.close();if(server){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}await fs.rm(fixture,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types/app/document-type-validation'),{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
