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
  const edits=[];
  const assets=Array.from({length:23},(_,i)=>({
    id:'tractor-'+(i+1), title:i===12 ? '2022 New Holland TT4.90 4WD Openstation with front loader and pallet forks' : 'Tractor '+(i+1), serialNumber:'SN-'+(i+1),
    meta:'Year Model: 2022 · Usage: 3 200 hours · Condition: Good',
    categoryLabel:'Agricultural',methodLabel:'Basic valuation'
  }));
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1440,height:900});
  await page.evaluateOnNewDocument(()=>localStorage.setItem('aim4price.website-canvas.v2.intro','seen'));
  await page.setRequestInterception(true);
  page.on('request',async r=>{
   const u=new URL(r.url());if(!u.pathname.startsWith('/api/'))return r.continue();
   const user={id:'fixture',name:'Test Owner',email:'test@example.invalid',accountType:'owner'};
   const doc={id:'fixture',title:'Saved title',category:'insurance',documentType:'insurance-policy',notes:'Keep these notes',expiryDate:null,fileName:'policy.pdf',contentType:'application/pdf',byteSize:100,assetLinks:[assets[0]],createdAtIso:'2026-10-01',updatedAtIso:'2026-10-01',deletedAtIso:null};
   if(u.pathname==='/api/documents'&&r.method()==='POST') {
    uploads.push(await r.fetchPostData());
    if(failNextUpload){failNextUpload=false;return r.respond({status:500,contentType:'application/json',body:JSON.stringify({ok:false,error:'Fixture upload failure'})});}
    return r.respond({status:200,contentType:'application/json',body:JSON.stringify({ok:true,document:doc})});
   }
   if(u.pathname==='/api/documents/fixture' && r.method()==='PATCH') {
    edits.push(JSON.parse(r.postData()));
    return r.respond({status:200,contentType:'application/json',body:JSON.stringify({ok:true,document:doc})});
   }
   const data=u.pathname==='/api/me'?{ok:true,signedIn:true,user}:u.pathname==='/api/documents'?{ok:true,documents:[doc],assets}:{ok:true,items:[],notifications:[],profile:{...user,userId:user.id,displayName:user.name,extraPhotoUrls:[]}};
   r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  async function click(text){await page.$$eval('button',(buttons,text)=>{const b=buttons.find(b=>b.textContent.trim()===text || b.getAttribute("aria-label")===text);if(!b)throw Error('Missing '+text);b.click();},text);}
  await page.goto('http://127.0.0.1:3049/document-type-validation',{waitUntil:'networkidle0',timeout:120000});
  await click('Edit');await page.waitForSelector('#document-type-trigger');
  await page.click('#document-type-trigger');await page.waitForSelector('#document-type-title');
  assert.equal(await page.$$eval('[role=dialog]',nodes=>nodes.length),1);
  await page.waitForFunction(()=>document.querySelector('[aria-label="Search document types"]')===document.activeElement);
  async function checkTypeLabelFit() {
   const clipped=await page.$$eval('[data-document-types] strong',labels=>labels.filter(label=>
    label.scrollWidth > label.clientWidth+1 || label.offsetHeight > parseFloat(getComputedStyle(label).lineHeight)+1
   ).map(label=>label.textContent));
   assert.deepEqual(clipped,[]);
  }
  await checkTypeLabelFit();
  await click('Next');
  await page.waitForFunction(()=>document.querySelector('[data-download-footer]')?.textContent.includes('Page 2'));
  await checkTypeLabelFit();
  await click('Previous');
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
  const row = '[data-asset-choice-row]';
  const search = '[aria-label="Search assets"]';
  const next = '[aria-label="Next asset page"]';
  async function fits(selector) {
    const geometry=await page.$eval(selector,el=>[el.scrollHeight-el.clientHeight,el.scrollWidth-el.clientWidth]);
    assert(geometry.every(delta=>delta<=1),selector+' overflows: '+geometry);
  }
  for(const [width,height] of [[1440,900],[1920,870],[1366,650],[390,844]]) {
    await page.setViewport({width,height});
    await fits('[class*="editDocumentModal"] [class*="modalScroll"]');
    await click('Next');
    await page.waitForSelector(row);
    assert.equal(await page.$eval(row+' input',el=>el.checked),true,'Existing link on first page at '+width);
    await fits('[data-asset-choice-list]');
    await page.click(next);
    await page.waitForFunction(()=>document.querySelector('[aria-label="Asset pages"]').textContent.includes('Page 2 of'));
    await fits('[data-asset-choice-list]');
    await click('Back');
    await page.waitForSelector('#document-type-trigger');
  }
  await page.setViewport({width:1440,height:900});
  await click('Next');await page.waitForSelector(row);
  await page.type(search,'SN-23');
  await page.waitForFunction(()=>document.querySelectorAll('[data-asset-choice-row]').length===1);
  await page.click(row);
  await page.focus(search);
  await page.keyboard.press('Enter');
  assert.equal(edits.length,0);
  await click('Back');await page.waitForSelector('#document-type-trigger');
  assert.equal(await page.$eval('textarea',el=>el.value),'Keep these notes');
  await click('Next');await page.waitForSelector(row);
  await page.type(search,'unmatched');await page.waitForFunction(()=>document.body.textContent.includes('No assets match'));
  await click('Save changes');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
  assert.deepEqual(edits[0].assetIds.sort(),['tractor-1','tractor-23']);
  assert.equal(edits[0].documentType,'licence-disc');
  await click('Edit');await click('Next');await page.waitForSelector(row);
  const visited=new Set();
  do {
    await fits('[data-asset-choice-list]');
    for(const label of await page.$$eval(row+' [data-asset-choice-copy] > strong',els=>els.map(el=>el.textContent))) visited.add(label);
    if(await page.$eval(next,el=>el.disabled)) break;
    await page.click(next);
  } while(visited.size<assets.length);
  assert.equal(visited.size,assets.length);
  await page.type(search,'SN-2');
  await click('Select all 5 matches');
  assert.match(await page.$eval('[data-asset-choice-footer]',el=>el.textContent),/6 assets selected/);
  await click('Clear');
  await click('Save changes');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
  assert.deepEqual(edits[1].assetIds,[]);
  async function chooseInsurance() {
   await page.waitForSelector('#document-type-title');
   await page.type('[aria-label="Search document types"]','insurance');
   await click('Insurance policy');
   await page.waitForSelector('input[type=file]');
  }
  await click('Upload documents');await page.waitForSelector(search);
  await page.type(search,'SN-23');await page.click(row);
  await page.click('[data-asset-choice-action="primary"]');await chooseInsurance();
  await fs.writeFile('/tmp/document-picker-fixture.txt','Local test document');
  await (await page.$('input[type=file]')).uploadFile('/tmp/document-picker-fixture.txt');
  await click('Next');await page.waitForSelector('[data-upload-slide="details"]');
  await click('Upload document');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
  assert.equal(uploads.length,1);assert.match(uploads[0],/tractor-23/);
  // Asset cards use this same wizard, with a fixed link and no vault page underneath.
  for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
   uploads.length=0;failNextUpload=true;
   await page.setViewport(viewport);
   await page.goto('http://127.0.0.1:3049/document-type-validation/asset',{waitUntil:'networkidle0',timeout:120000});
   await page.waitForSelector('#linked-asset-heading');
   assert.match(await page.$eval('#linked-asset-heading',e=>e.textContent),/2022 New Holland/);
   await click('Next');await chooseInsurance();
   await click('Next');await page.waitForFunction(()=>document.body.textContent.includes('Select at least one document'));
   await fs.writeFile('/tmp/document-picker-second.txt','Second local document');
   await (await page.$('input[type=file]')).uploadFile('/tmp/document-picker-fixture.txt','/tmp/document-picker-second.txt');
   await click('Next file');await click('Previous file');
   await click('Next');await page.waitForSelector('[data-upload-slide="details"]');
   await click('Back');await page.waitForSelector('input[type=file]');
   await click('Next');await click('Upload 2 documents');
   await page.waitForFunction(()=>document.body.textContent.includes('1 file remains'));
   assert.equal(uploads.length,2);assert.equal(await page.$eval('[data-saved]',e=>e.textContent),'1 saved');
   await click('Upload document');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
   assert.equal(await page.$eval('[data-saved]',e=>e.textContent),'2 saved');assert.equal(uploads.length,3);
   for(const body of uploads){assert.match(body,/asset-fixture/);assert.match(body,/name="assetIds"/);assert.match(body,/insurance-policy/);}
   // Only the failed file is retried, and its request ID remains stable.
   assert.match(uploads[2],/filename="document-picker-fixture.txt"/);
   const requestId=body=>body.match(/name="requestId"\r\n\r\n([^\r]+)/)?.[1];
   assert(requestId(uploads[0]));assert.equal(requestId(uploads[0]),requestId(uploads[2]));
   await click('Add document');await page.waitForSelector('#linked-asset-heading');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
  }
  assert.deepEqual(errors,[]);
  console.log('PASS paged document links, search, bulk selection, edit and upload, fixed links, partial retry, and desktop/mobile fit');
 } finally {if(browser)await browser.close();if(server){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}await fs.rm(fixture,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types/app/document-type-validation'),{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
