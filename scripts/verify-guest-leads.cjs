/* Local component fixtures and intercepted APIs only. Never sends email or writes production data. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/asset-share/guest-validation');
const output = path.join(root, '.next/guest-lead-validation');
const token = 'g'.repeat(43);
async function main() {
 let server, browser;
 try {
  await fs.mkdir(fixture,{recursive:true});
  await fs.writeFile(path.join(fixture,'page.tsx'), `'use client';
import {useState} from 'react';
import AssetExternalShare from '../../../components/asset-register/AssetExternalShare';
import GuestLeadComposer from '../../../components/asset-register/GuestLeadComposer';
import GuestLeadActions from '../../../components/asset-register/GuestLeadActions';
import BusinessAcceptanceForm from '../../../components/business-network/BusinessAcceptanceForm';
import DirectoryAdminAccess from '../../../components/business-network/DirectoryAdminAccess';
export default function Validation(){
 const [mode,setMode]=useState('accept'),[access,setAccess]=useState<any>('sign-in'),[link,setLink]=useState(''),[selection,setSelection]=useState('one');
 const details={recipientName:'George Workshop',recipientEmail:'business@example.com',request:'Please quote for servicing.',replyName:'Asset Owner',replyEmail:'owner@example.com',replyPhone:'',allowReply:true};
 return <main style={{maxWidth:900,margin:'auto',padding:16}}><nav>{['accept','compose','recipient','admin','external'].map(x=><button key={x} onClick={()=>setMode(x)}>{x}</button>)}</nav>
 {mode==='accept'&&<BusinessAcceptanceForm/>}
 {mode==='compose'&&<><button onClick={()=>{setSelection('two');setLink('')}}>Change report selection</button><GuestLeadComposer selectionKey={selection} assetIds={['10000000-0000-4000-8000-000000000001']} includePhotos={true} recipient={{name:'George Workshop',email:'business@example.com',phone:''}} reports={[{label:'Valuation report',file:new File(['%PDF-1.4 fixture'],'valuation.pdf',{type:'application/pdf'})}]} ready onChange={setLink}/><output data-link>{link}</output></>}
 {mode==='recipient'&&<><button onClick={()=>setAccess('payment-required')}>Fixture verified</button><button onClick={()=>setAccess('active')}>Fixture activated</button><GuestLeadActions token={'g'.repeat(43)} details={details} reports={[{id:'10000000-0000-4000-8000-000000000002',label:'Valuation report'}]} access={access}/></>}
 {mode==='external'&&<AssetExternalShare shareName="Test tractor" assets={[{assetId:'10000000-0000-4000-8000-000000000001',title:'Test tractor',photoUrls:[],serialNumber:'TEST-1',yearModel:2022,usage:'120 hours',condition:'Good',replacementPriceExVat:500000,valueExVat:300000,publicUrl:null}]} recipient={{name:'George Workshop',email:'business@example.com',phone:'27820000000'}} reportFiles={[{id:'pdf',kind:'report',label:'Valuation report',description:'Selected report',fileName:'valuation.pdf',url:'/api/fixture-pdf',contentType:'application/pdf'}]} onAddAim4priceReport={()=>{}} onRemoveAim4priceReport={()=>{}}/>}
 {mode==='admin'&&<DirectoryAdminAccess onAdd={b=>setLink(b.email)}/>}
 </main>;
}
`);
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3033'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'validation',PGPASSWORD:'local-only',PGDATABASE:'validation',BETTER_AUTH_SECRET:'local-validation-secret-not-for-production'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timed out')),60000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));});
  browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await require('@sparticuz/chromium').executablePath(),args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true,pipe:true});
  const page=await browser.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  let history=[],activated=false;
  await page.setRequestInterception(true);
  page.on('request',req=>{
   const p=new URL(req.url()).pathname;
   if(!p.startsWith('/api/'))return req.continue();
   if(p==='/api/fixture-pdf')return req.respond({status:200,contentType:'application/pdf',body:'%PDF-1.4 fixture'});
   let body={ok:true};requests.push({path:p,method:req.method(),data:req.postData()});
   if(p==='/api/asset-share-links/leads'){
    if(req.method()==='POST'){history=[{token,recipient_name:'George Workshop',recipient_email:'business@example.com',created_at:'2026-09-22T00:00:00Z'}];body={share:{token}};}
    else body={leads:history,replyName:'Asset Owner',replyEmail:'owner@example.com'};
   }
   if(p==='/api/asset-share-links'&&req.method()==='DELETE')history=history.map(x=>({...x,revoked_at:'2026-09-22T00:00:00Z'}));
   if(p==='/api/admin/guest-businesses'){
    if(req.method()==='POST')activated=JSON.parse(req.postData()).action==='activate';
    body={acceptances:[{id:'acceptance',business_name:'George Workshop',contact_name:'Sam',email:'business@example.com',accepted_at:'2026-09-22T00:00:00Z'}],guests:[{email:'business@example.com',business_name:'George Workshop',contact_name:'Sam',active:activated,suspended:false,access_until:null}]};
   }
   return req.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  const click=async text=>assert.ok(await page.evaluate(t=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===t&&!e.disabled);b?.click();return !!b},text),`Missing button: ${text}`);
  const fill=async(selector,value)=>{await page.$eval(selector,(e,v)=>{const setter=Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));},value);};
  const labelInput=async(label,value)=>{const handle=await page.evaluateHandle(t=>[...document.querySelectorAll('label')].find(e=>e.textContent.trim()===t)?.querySelector('input,textarea'),label);assert.ok(handle.asElement(),`Missing input ${label}`);await handle.asElement().type(value);await handle.dispose();};
  await fs.mkdir(output,{recursive:true});
  for(const width of [1440,430]){
   history=[];
   await page.setViewport({width,height:1000,deviceScaleFactor:1});
   await page.goto('http://127.0.0.1:3033/asset-share/guest-validation',{waitUntil:'networkidle2'});
   await page.type('[name=businessName]','George Workshop');await page.type('[name=contactName]','Sam');await page.type('[name=email]','business@example.com');await page.click('[name=accepted]');await click('Accept free listing');
   await page.waitForFunction(()=>document.body.textContent.includes('your acceptance is recorded'));
   await click('compose');await page.waitForFunction(()=>document.querySelector('input[value="owner@example.com"]'));
   await labelInput('Your request','Please quote for servicing.');
   await click('Create lead link');await page.waitForSelector('a[href$="'+token+'"]');
   assert.ok(await page.$eval('[data-link]',e=>e.textContent.endsWith('g'.repeat(43))));
   await click('Change report selection');assert.equal(await page.$eval('[data-link]',e=>e.textContent),'');
   assert.equal(await page.$eval('textarea',e=>e.value),'Please quote for servicing.','Report changes preserve request draft');
   await click('Create lead link');await page.waitForFunction(()=>document.querySelector('[data-link]').textContent.length>0);
   await page.screenshot({path:path.join(output,`owner-${width}.png`),fullPage:true});
   await page.click('details summary');await click('Disable');await page.waitForFunction(()=>document.body.textContent.includes('Lead disabled'));
   await click('recipient');await page.click('details summary');
   assert.equal(await page.$$eval('a[href*="/reports/"]',els=>els.length),0,'Locked reports expose no download link');
   await click('Sign up / sign in with email');await page.type('[name=contactName]','Sam');await click('Email me a sign-in code');await page.waitForSelector('[name=code]');await page.type('[name=code]','123456');await click('Confirm email');
   await page.waitForFunction(()=>!document.querySelector('[name=code]'));
   await click('Fixture verified');assert.equal(await page.$$eval('a[href*="/reports/"]',els=>els.length),0);
   await page.waitForSelector('a[href^="mailto:aim4price"]');
   await page.screenshot({path:path.join(output,`locked-${width}.png`),fullPage:true});
   await click('Fixture activated');await page.waitForSelector('a[href*="/reports/"]');
   assert.ok(await page.$eval('a[href*="/reports/"]',e=>e.getAttribute('href').includes('g'.repeat(43))));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Guest page fits viewport');
   await page.screenshot({path:path.join(output,`active-${width}.png`),fullPage:true});
   await click('admin');await page.waitForFunction(()=>document.body.textContent.includes('Business acceptances (1)'));
   await page.$$eval('details',els=>els.forEach(e=>e.open=true));await click('Prepare listing');
   await fill('[name=until]','2099-12-31');await page.type('[name=note]','Manual test payment');await click('Activate paid access');await page.waitForFunction(()=>document.body.textContent.includes('Guest access updated'));
   assert.ok(activated);await click('Suspend access');await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Suspend access'&&!b.disabled));assert.equal(activated,false);
  }
  await click('external');
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Create lead link'&&!b.disabled));
  await labelInput('Your request','Please quote.');
  await click('Create lead link');await page.waitForSelector('a[href$="'+token+'"]');
  await page.evaluate(()=>{window.__opened=[];window.__nativeShares=0;window.open=url=>{window.__opened.push(url);return null};Object.defineProperty(navigator,'share',{configurable:true,value:()=>{window.__nativeShares++;return Promise.resolve()}});});
  await click('WhatsApp');
  let sent=await page.evaluate(()=>({opened:window.__opened,native:window.__nativeShares}));
  assert.equal(sent.native,0,'Protected reports never go to the native attachment share sheet');
  assert.match(decodeURIComponent(sent.opened[0]),new RegExp('/asset-share/'+token));
  assert.match(sent.opened[0],/27820000000/);
  await fill('input[type=email]','other@example.com');await click('Create lead link');await page.waitForSelector('a[href$="'+token+'"]');await click('WhatsApp');
  sent=await page.evaluate(()=>({opened:window.__opened,native:window.__nativeShares}));
  assert.doesNotMatch(sent.opened.at(-1),/27820000000/,'Changing recipient must not keep the original WhatsApp target');
  assert.equal(sent.native,0);
  assert.equal(requests.filter(r=>r.path==='/api/business-network/accept'&&r.method==='POST').length,2);
  assert.equal(requests.filter(r=>r.path==='/api/guest-access'&&r.method==='POST').length,4);
  assert.deepEqual(errors,[]);
  console.log('PASS acceptance, lead creation/revocation, preserved drafts, verified/paid report states and manual admin activation at desktop and mobile widths');
 }finally{
  if(browser)await browser.close();if(server)server.kill();
  await fs.rm(fixture,{recursive:true,force:true});
  await fs.rm(path.join(root,'.next/types/app/asset-share/guest-validation'),{recursive:true,force:true});
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
