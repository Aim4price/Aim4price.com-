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
  let legacyDocument=false;
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
   const doc={id:'fixture',title:'Saved title',category:'insurance',documentType:legacyDocument ? null : 'insurance-policy',notes:'Keep these notes',expiryDate:'2027-01-30',fileName:'policy.pdf',contentType:'application/pdf',byteSize:100,assetLinks:[assets[0]],createdAtIso:'2026-10-01',updatedAtIso:'2026-10-01',deletedAtIso:null};
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
  const row = '[data-asset-choice-row]';
  const search = '[aria-label="Search assets"]';
  await click('Edit');await click('Next');await page.waitForSelector('textarea');
  assert.match(await page.$eval('[role=dialog] header',el=>el.textContent),/Tractor 1/);
  await click('Change document type, currently Insurance policy');await click('Back');await page.waitForSelector('textarea');
  await click('Back');await click('Change asset');await page.waitForSelector(row);
  assert.equal(await page.$eval(row+' input',el=>el.checked),true);
  for(const [width,height] of [[1440,900],[1920,870],[1366,650],[390,844]]) {
    await page.setViewport({width,height});
    assert.equal(await page.$$eval(row,els=>els.length),assets.length);
    assert.equal(await page.$('[aria-label="Asset pages"]'),null);
    assert(await page.$eval('[data-asset-choice-list]',el=>{el.scrollTop=el.scrollHeight;return el.scrollTop>0;}));
  }
  await page.setViewport({width:1440,height:900});
  await page.type(search,'SN-23');await page.click(row);
  await page.click('[data-asset-choice-action="primary"]');await page.waitForSelector('#document-type-title');
  assert.equal(await page.$$eval('[role=dialog]',nodes=>nodes.length),1);
  await page.waitForFunction(()=>document.querySelector('[aria-label="Search document types"]')===document.activeElement);
  async function checkTypeLabelFit() {
   const clipped=await page.$$eval('[data-document-types] strong',labels=>labels.filter(label=>
    label.scrollWidth > label.clientWidth+1 || label.offsetHeight > parseFloat(getComputedStyle(label).lineHeight)+1
   ).map(label=>label.textContent));
   assert.deepEqual(clipped,[]);
  }
  assert.equal(await page.$$eval('[data-download-footer] button',bs=>bs.map(b=>b.textContent).join()),'Back');
  await checkTypeLabelFit();
  await click('Insurance');
  assert.deepEqual(await page.$$eval('[data-document-types] strong',ls=>ls.map(l=>l.textContent)),['Policy','Schedule','Claim']);
  await click('Back');
  assert.equal(await page.$$eval('[data-document-types] strong',ls=>ls.some(l=>l.textContent==='Company registration')),false);
  await page.keyboard.press('Escape');await page.waitForSelector(row);
  await page.click('[data-asset-choice-action="primary"]');await page.waitForSelector('#document-type-title');
  await page.type('[aria-label="Search document types"]','licence');await click('Licence disc');
  await page.waitForSelector('[data-upload-slide="details"]');
  assert.equal(await page.$('input[type=file]'),null);
  await page.waitForSelector('textarea');
  assert.equal(await page.$eval('textarea',el=>el.value),'Keep these notes');
  assert.equal(await page.$eval('input[maxlength="180"]',el=>el.value),'Saved title');
  assert(await page.$('#document-expiry-date'));
  for(const [width,height] of [[1440,900],[1920,870],[1366,650],[390,844]]) {
    await page.setViewport({width,height});
    await fits('[data-upload-slide="details"] [class*="modalScroll"]');
  }
  await page.setViewport({width:1440,height:900});
  await click('Back');await click('Next');
  assert.equal(edits.length,0);
  await click('Save changes');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
  assert.deepEqual(edits[0].assetIds.sort(),['tractor-1','tractor-23']);
  assert.equal(edits[0].documentType,'licence-disc');
  assert.equal(edits[0].expiryDate,'2027-01-30');
  await click('Edit');await click('Change to general document');await click('Company registration');
  await click('Save changes');
  await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
  assert.deepEqual(edits[1].assetIds,[]);
  legacyDocument=true;
  await page.reload({waitUntil:'networkidle0'});
  await click('Edit');await click('Change to general document');await click('Keep unclassified');
  await click('Save changes');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
  assert.equal(edits[2].documentType,'');
  legacyDocument=false;
  async function fits(selector) {
    const geometry=await page.$eval(selector,el=>[el.scrollHeight-el.clientHeight,el.scrollWidth-el.clientWidth]);
    assert(geometry.every(delta=>delta<=1),selector+' overflows: '+geometry);
  }
  async function chooseInsurance() {
   await page.waitForSelector('#document-type-title');
   await page.type('[aria-label="Search document types"]','insurance');
   await click('Insurance policy');
   await page.waitForSelector('input[type=file]');
  }
  await page.setViewport({width:1920,height:870});
  await page.click('[aria-label="Zoom in"]');
  await page.waitForSelector('#website-zoom-slider');
  await page.$eval('#website-zoom-slider',el=>{
   Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'106');
   el.dispatchEvent(new Event('input',{bubbles:true}));
   el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForFunction(()=>Number(document.querySelector('[data-website-canvas]').dataset.websiteScale)===1.06);
  await page.click('[aria-label="Close page size"]');
  await click('Upload documents');await click('Related to an asset');await page.waitForSelector(search);
  await page.type(search,'SN-23');await page.click(row);
  await page.click('[data-asset-choice-action="primary"]');await page.waitForSelector('#document-type-title');
  const headerAsset = () => page.$eval('[role=dialog] header p', el => el.textContent);
  assert.equal(await headerAsset(),'Tractor 23');
  await fits('[data-download-dialog]');await checkTypeLabelFit();await click('Insurance');await click('Policy');await page.waitForSelector('input[type=file]');
  await fs.writeFile('/tmp/document-picker-fixture.txt','Local test document');
  await (await page.$('input[type=file]')).uploadFile('/tmp/document-picker-fixture.txt');
  await click('Next');await page.waitForSelector('[data-upload-slide="details"]');
  assert.equal(await headerAsset(),'Tractor 23');
  async function checkExpiryAlignment() {
    const boxes = await page.$eval('[data-upload-slide="details"]', form => {
      const title = form.querySelector('input[maxlength="180"]').getBoundingClientRect();
      const toggle = form.querySelector('input[type="checkbox"]').closest('label').getBoundingClientRect();
      return ['width','height','top'].map(key => Math.abs(title[key] - toggle[key]));
    });
    assert(boxes.every(delta => delta <= 1), 'Title and expiry alignment: '+boxes);
  }
  await checkExpiryAlignment();
  await page.click('[aria-controls="document-expiry-date"]');
  await page.waitForSelector('#document-expiry-date');
  await checkExpiryAlignment();
  await fits('[data-upload-slide="details"] [class*="modalScroll"]');
  await fits('[data-upload-slide="details"] textarea');
  await click('Upload document');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
  assert.equal(uploads.length,1);assert.match(uploads[0],/tractor-23/);
  await click('Upload documents');await click('Related to an asset');await page.waitForSelector(row);
  await page.click(row);await click('Back');await click('General document');
  await page.waitForSelector('#document-type-title');
  assert.equal(await page.$('[data-download-header] p'),null);
  const generalTypes=await page.$$eval('[data-document-types] strong',ls=>ls.map(l=>l.textContent));
  await fits('[data-download-dialog]');await checkTypeLabelFit();
  assert.equal(generalTypes.length,12);
  assert(generalTypes.includes('Operating permit') && generalTypes.includes('Company registration') && !generalTypes.includes('Licence disc'));
  await click('Back');await click('General document');
  await chooseInsurance();
  await (await page.$('input[type=file]')).uploadFile('/tmp/document-picker-fixture.txt');
  await click('Next');await click('Upload document');
  await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
  assert.equal(uploads.length,2);assert.match(uploads[1],/name="assetIds"\r\n\r\n\[\]/);
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
  console.log('PASS scrollable document asset list, search, bulk selection, edit and upload, fixed links, partial retry, and desktop/mobile fit');
 } finally {if(browser)await browser.close();if(server){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}await fs.rm(fixture,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types/app/document-type-validation'),{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
