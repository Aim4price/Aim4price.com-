/* Local component fixtures and intercepted APIs only. Never sends email or writes production data. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/business-network/guest-validation');
const canonicalFixture = path.join(root, 'app/business/send-link-validation');
const output = path.join(root, '.next/guest-lead-validation');
const token = 'g'.repeat(43);
async function main() {
 let server, browser;
 const pdf=await require('pdf-lib').PDFDocument.create();pdf.addPage();const reportPdf=Buffer.from(await pdf.save());
 try {
  await fs.mkdir(fixture,{recursive:true});
  await fs.mkdir(canonicalFixture,{recursive:true});
  await fs.writeFile(path.join(canonicalFixture,'page.tsx'), "export {default} from '../../business-network/guest-validation/page';\n");
  await fs.writeFile(path.join(fixture,'page.tsx'), `'use client';
import {useEffect,useState,useRef} from 'react';
import GroupReports from '../../../components/asset-register/AssetGroupManagerModal';
import SharedEnquiryRequest from '../../../components/asset-register/SharedEnquiryRequest';
import BusinessListingInvite from '../../../components/business-network/BusinessListingInvite';
import ShareDestinationDialog from '../../../components/asset-register/ShareDestinationDialog';
import InsideShareDialog from '../../../components/asset-register/InsideShareDialog';
import AssetExternalShare from '../../../components/asset-register/AssetExternalShare';
import GuestLeadComposer from '../../../components/asset-register/GuestLeadComposer';
import SharedAssetCards from '../../../components/asset-register/SharedAssetCards';
import BusinessAcceptanceForm from '../../../components/business-network/BusinessAcceptanceForm';
import BusinessDirectoryTools from '../../../components/business-network/BusinessDirectoryTools';
import DirectoryAdminAccess from '../../../components/business-network/DirectoryAdminAccess';
export default function Validation(){
 const [hydrated,setHydrated]=useState(false);useEffect(()=>setHydrated(true),[]);
 const [mode,setMode]=useState('accept'),[access,setAccess]=useState<any>('sign-in'),[link,setLink]=useState(''),[selection,setSelection]=useState('one');
 const [reportOpen,setReportOpen]=useState(false);const reportDone=useRef<any>(null);
 const reportAsset={id:'10000000-0000-4000-8000-000000000001',registerId:null,title:'Test bakkie',kind:'vehicle',value:1000,createdAtIso:'2025-09-01',updatedAtIso:'2026-09-01',lastScannedAtIso:null};
 const finishReport=(kind:string,format='pdf',filters:any={})=>{const params=new URLSearchParams({assetId:reportAsset.id,report:kind,format,year:filters.year||'all',month:filters.month||'all'});reportDone.current?.({id:params.toString(),kind:'report',label:kind+' · '+format,fileName:kind+'.'+format,url:'/api/asset-register/scan-report?'+params,contentType:'application/pdf'});setReportOpen(false);};
 const details={allowSubmissions:true,recipientName:'George Workshop',recipientEmail:'business@example.com',request:'Please quote for servicing.',replyName:'Asset Owner',replyEmail:'owner@example.com',replyPhone:'',allowReply:true};
 return <main data-hydrated={hydrated} style={{maxWidth:900,margin:'auto',padding:16}}><nav>{['accept','compose','recipient','admin','external','find','asset','register','umbrella'].map(x=><button key={x} onClick={()=>setMode(x)}>{x}</button>)}</nav>
 {['asset','register','umbrella'].includes(mode)&&<ShareDestinationDialog kind={mode as any} titleId="fixture-share" subject="Test asset" onClose={()=>setMode('find')} onSendLink={()=>setMode('link')} onInside={()=>setMode('inside')} onOutside={()=>setMode('external')}/>}
 {mode==='link'&&<BusinessListingInvite sendLink assetIds={['10000000-0000-4000-8000-000000000001']} onDismiss={()=>setMode('asset')}/>}
 {mode==='inside'&&<InsideShareDialog titleId="fixture-inside" subject="Test asset" onClose={()=>setMode('find')} options={['finance','insurance','replacement_quote','license_renewal'].map((id,i)=>({id,title:['Finance & accounting','Insurance','Dealer','Licence renewal'][i],description:['Accountant, financier or bank','Insurer or broker','Share with a dealer','Renewal date required'][i],icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 20V8l8-5 8 5v12ZM9 20v-8h6v8"/></svg>,onSelect:()=>setMode('find')}))}/>}
 {mode==='accept'&&<BusinessAcceptanceForm/>}
 {mode==='compose'&&<><button onClick={()=>{setSelection('two');setLink('')}}>Change report selection</button><GuestLeadComposer selectionKey={selection} assetIds={['10000000-0000-4000-8000-000000000001']} includePhotos={true} recipient={{name:'George Workshop',email:'business@example.com',phone:''}} reports={[{label:'Valuation report',file:new File(['%PDF-1.4 fixture'],'valuation.pdf',{type:'application/pdf'})}]} ready onChange={setLink}/><output data-link>{link}</output></>}
 {mode==='recipient'&&<><button onClick={()=>setAccess('approval-required')}>Fixture verified</button><button onClick={()=>setAccess('read-only')}>Fixture read-only</button><button onClick={()=>setAccess('request-access')}>Fixture request access</button><button onClick={()=>setAccess('active')}>Fixture activated</button><button onClick={()=>setAccess('owner')}>Fixture owner</button><SharedAssetCards request={<SharedEnquiryRequest sender="Aim4price.com" request="Please review the shared assets."/>} share={{createdAt:'2026-09-26',assets:[{assetId:reportAsset.id,title:'Test bakkie',serialNumber:'TEST-1',yearModel:2022,usage:'100 km',condition:'Good',valueExVat:200000,replacementPriceExVat:300000,photoUrls:[],publicUrl:null}]}} enquiry={{token:'g'.repeat(43),permissions:{reports:true,serialNumber:true,replacementPrice:true,documents:true},reports:[{id:'10000000-0000-4000-8000-000000000002',label:'Valuation report'}],access}}/></>}

 {mode==='external'&&<AssetExternalShare shareName="Test tractor" assets={[{assetId:'10000000-0000-4000-8000-000000000001',title:'Test tractor',photoUrls:[],serialNumber:'TEST-1',yearModel:2022,usage:'120 hours',condition:'Good',replacementPriceExVat:500000,valueExVat:300000,publicUrl:null}]} recipient={{name:'George Workshop',email:'business@example.com',phone:'27820000000'}} reportFiles={[{id:'pdf',kind:'report',label:'Valuation report',description:'Selected report',fileName:'valuation.pdf',url:'/api/fixture-pdf',contentType:'application/pdf'}]} onAddAim4priceReport={()=>{}} onRemoveAim4priceReport={()=>{}}/>}
 {mode==='find'&&<><BusinessDirectoryTools senderName="X Farms" assetIds={['10000000-0000-4000-8000-000000000001']} includePhotos={false} reportAssets={[reportAsset]} onChooseReport={(_id,done)=>{reportDone.current=done;setReportOpen(true);}}/>
 {reportOpen&&<GroupReports open initialView="reports" reportDeliveryMode="attach" anchorAsset={reportAsset} group={{id:'fixture',userId:'test',registerId:null,name:'Test umbrella',valueMode:'separate',members:[{assetId:reportAsset.id,role:'primary',relationship:'primary',countsTowardTotal:true,sortOrder:0}],createdAtIso:'2025-09-01',updatedAtIso:'2026-09-01'}} assets={[reportAsset]} groups={[]} onClose={()=>{reportDone.current?.(null);setReportOpen(false);}} onSave={()=>{}} onDelete={()=>{}} onDownloadReport={(_group,kind,format,filters)=>finishReport(kind,format,filters)} onDownloadMap={()=>finishReport('map')} canDownloadMap/>}</>}
 {mode==='admin'&&<DirectoryAdminAccess onAdd={b=>setLink(b.email)}/>}
 </main>;
}
`);
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3033'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'validation',PGPASSWORD:'local-only',PGDATABASE:'validation',BETTER_AUTH_SECRET:'local-validation-secret-not-for-production'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timed out')),60000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));});
  browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await require('@sparticuz/chromium').executablePath(),args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true,pipe:true});
  const page=await browser.newPage(),errors=[],requests=[];
  page.setDefaultNavigationTimeout(120000);
  await page.evaluateOnNewDocument(()=>{localStorage.setItem('aim4price.website-canvas.v2',JSON.stringify({mode:'manual',scale:1.06}));});
  await page.evaluateOnNewDocument(()=>{const original=window.fetch;window.fetch=function(url,options){if(String(url)==='/api/asset-share-links/leads'&&options?.body instanceof FormData)window.__selectedLeadDetails=options.body.get('details');return original.apply(this,arguments);};});
  page.on('pageerror',e=>{errors.push(e.message);console.error(page.url(),e.message)});
  page.on('console',msg=>{if(msg.type()==='error')console.error(page.url(),msg.text())});
  let history=[],activated=false,documents=[];
  await page.setRequestInterception(true);
  page.on('request',req=>{
   const p=new URL(req.url()).pathname;
   if(!p.startsWith('/api/'))return req.continue();
   if(p==='/api/business-network/accept/search')return req.respond({status:200,contentType:'application/json',body:JSON.stringify({places:[{id:'fixture-place',displayName:{text:'George Workshop'},formattedAddress:'George, Western Cape',googleMapsUri:'https://maps.google.com/?cid=123'}]})});
   if(p==='/api/asset-register/scan-report'||p==='/api/my-invoices/report'){requests.push({path:p,url:req.url(),method:req.method()});return req.respond({status:200,contentType:'application/pdf',body:reportPdf});}
   if(p.endsWith('/access')){requests.push({path:p,method:req.method(),data:req.postData()});return req.respond({status:200,contentType:'application/json',body:JSON.stringify({assigned:false,recipientEmail:null,allowReply:true,permissions:{reports:true,replacementPrice:true,serialNumber:true,documents:true},requests:[{user_id:'recipient',email:'business@example.com',business_name:'Verified Workshop',status:'pending'}],ok:true})});}
   if(p==='/api/fixture-pdf')return req.respond({status:200,contentType:'application/pdf',body:'%PDF-1.4 fixture'});
   let body={ok:true};requests.push({path:p,method:req.method(),data:req.postData()});
   if(p==='/api/asset-share-links/leads'){
    if(req.method()==='POST'){history=[{token,recipient_name:'George Workshop',recipient_email:'business@example.com',created_at:'2026-09-22T00:00:00Z'}];body={share:{token,sender_name:'Saved Business Ltd'}};}
    else body={leads:history,replyName:'Asset Owner',replyEmail:'owner@example.com'};
   }
   if(p==='/api/asset-share-links'&&req.method()==='POST')body={share:{token,sender_name:'Saved Business Ltd'}};
   if(p==='/api/asset-share-links'&&req.method()==='DELETE')history=history.map(x=>({...x,revoked_at:'2026-09-22T00:00:00Z'}));
   if(p.endsWith('/corrections'))body={correction:{id:'fixture-correction',status:'pending',replacementPriceChanged:true,proposedReplacementPriceExVat:JSON.parse(req.postData()).value}};
   if(p.endsWith('/submissions')){
    if(req.method()==='POST')documents=[{id:'10000000-0000-4000-8000-000000000003',kind:'quote',sender_name:'Sam',sender_contact:'sam@example.com',note:'Service quote',file_name:'quote.pdf',status:'pending',created_at:'2026-09-24T00:00:00Z'}];
    if(req.method()==='PATCH')documents=documents.map(d=>({...d,status:JSON.parse(req.postData()).status}));
    body={ok:true,submissions:documents};
   }
   if(p==='/api/admin/guest-businesses'){
    if(req.method()==='POST')activated=JSON.parse(req.postData()).action==='activate';
    body={acceptances:[{id:'acceptance',business_name:'George Workshop',contact_name:'Sam',email:'business@example.com',accepted_at:'2026-09-22T00:00:00Z'}],guests:[{email:'business@example.com',business_name:'George Workshop',contact_name:'Sam',active:activated,suspended:false,access_until:null}]};
   }
   return req.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  const click=async text=>assert.ok(await page.evaluate(t=>{const b=[...document.querySelectorAll('button')].find(e=>(e.textContent.trim()===t||e.querySelector('strong')?.textContent.trim()===t)&&!e.disabled);b?.click();return !!b},text),`Missing button: ${text}`);
  const closeChild=async()=>{await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelectorAll('[role="dialog"]').length===1);};
  const fill=async(selector,value)=>{await page.$eval(selector,(e,v)=>{const setter=Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));},value);};
  const labelInput=async(label,value)=>{const handle=await page.evaluateHandle(t=>[...document.querySelectorAll('label')].find(e=>e.textContent.trim()===t)?.querySelector('input,textarea'),label);assert.ok(handle.asElement(),`Missing input ${label}`);await handle.asElement().type(value);await handle.dispose();};
  await fs.mkdir(output,{recursive:true});
  await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:3033/business/send-link-validation',{waitUntil:'networkidle2'});
  await page.waitForSelector('[data-hydrated=true]');await click('asset');
  await page.waitForFunction(()=>document.querySelectorAll('[role="dialog"] strong').length===3);
  const cards=await page.$$eval('[role="dialog"] button:has(strong)',nodes=>nodes.map(n=>({text:n.querySelector('strong').textContent,x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,width:n.getBoundingClientRect().width})));
  assert.deepEqual(cards.map(c=>c.text),['Send link','Inside Aim4price','Outside Aim4price']);
  assert.ok(cards.every(c=>Math.abs(c.width-cards[0].width)<1&&Math.abs(c.y-cards[0].y)<1));
  await page.screenshot({path:path.join(output,'send-link-options.png')});
  await click('Send link');await click('Share read-only');
  assert.equal(await page.$eval('dialog button[type="submit"], dialog button:not([type])',b=>b.disabled),true);
  await page.click('dialog input[type="checkbox"]');await click('Create asset link');
  await page.waitForSelector('dialog a[href^="/asset-share/"], dialog a[href*="/asset-share/"]');
  assert.equal(JSON.parse(await page.evaluate(()=>window.__selectedLeadDetails)).accessMode,'signed-in');
  assert.ok(requests.some(r=>r.path==='/api/asset-share-links/leads'&&r.method==='POST'));
  assert.ok(!requests.some(r=>r.path==='/api/asset-share-links'&&r.method==='POST'),'Send link never uses the public snapshot endpoint');
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Clipboard unavailable')}}}));
  await click('Copy link');await page.waitForSelector('input[aria-label="Asset link"]');
  assert.equal(await page.$eval('input[aria-label="Asset link"]',e=>e.value),`http://127.0.0.1:3033/asset-share/${token}`);
  await page.screenshot({path:path.join(output,'send-link-ready.png')});
  await page.click('button[aria-label="Back to share options"]');
  await page.waitForFunction(()=>document.querySelectorAll('[role="dialog"] strong').length===3);
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await page.reload({waitUntil:'networkidle2'});
  await page.waitForSelector('[data-mobile-landscape-entry]',{visible:true});
  await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true,isLandscape:true});
  await page.waitForSelector('[data-mobile-landscape-entry]',{hidden:true});
  await click('asset');
  await page.waitForSelector('[role="dialog"]');
  assert.equal(await page.$eval('[data-website-canvas]',e=>Math.round(parseFloat(getComputedStyle(e).width))),1440);
  const phoneCards=await page.$$eval('[role="dialog"] button:has(strong)',nodes=>nodes.map(n=>({y:n.getBoundingClientRect().y,w:n.getBoundingClientRect().width})));
  assert.equal(phoneCards.length,3);assert.ok(phoneCards.every(c=>Math.abs(c.y-phoneCards[0].y)<1&&Math.abs(c.w-phoneCards[0].w)<1));
  await page.screenshot({path:path.join(output,'send-link-phone-landscape.png')});
  await page.setViewport({width:1440,height:900,isMobile:false,hasTouch:false});
  requests.length=0;history=[];
  for(const width of [1440,430]){
   history=[];
   await page.setViewport({width,height:1000,deviceScaleFactor:1});
   await page.goto('http://127.0.0.1:3033/business-network/accept?from=X%20Farms',{waitUntil:'networkidle2'});
   assert.ok(await page.evaluate(()=>document.body.textContent.includes('Waiting for an invitation')));
   assert.ok(await page.evaluate(()=>!document.querySelector('main').innerText.includes('X Farms')),'A URL parameter cannot supply the sender identity');
   assert.equal(await page.$('a[href^="/asset-share/"]'),null,'A missing share token offers no enquiry');
   await page.waitForSelector('[data-website-zoom-host=ready] [data-site-workspace-zoom-controls]');
   await page.screenshot({path:path.join(output,`listing-page-${width}.png`),fullPage:true});
   const writesBefore=requests.filter(r=>r.method==='POST').length;
   assert.equal(await page.$('a[href^="/business-network/example"]'),null);
   assert.equal(await page.$('form'),null);
   await page.goto('http://127.0.0.1:3033/asset-share/invalid',{waitUntil:'networkidle2'});
   await page.waitForSelector('[data-website-canvas]');
   await page.waitForSelector('[data-website-zoom-host=ready] [data-site-workspace-zoom-controls]');
   assert.ok(await page.evaluate(()=>document.body.textContent.includes('This link is no longer available')));
   await page.goto('http://127.0.0.1:3033/business-network/example?from=X%20Farms',{waitUntil:'networkidle2'});
   await page.waitForFunction(()=>document.body.textContent.includes('Example Toyota Hilux'));
   const openCard='button[aria-label="Open Example Toyota Hilux"]';
   const closeCard='button[aria-label="Close Example Toyota Hilux"]';
   const manageCard='button[aria-label="Manage Example Toyota Hilux"]';
   await page.waitForSelector(openCard);
   assert.equal(await page.$eval(openCard,button=>button.getAttribute('aria-expanded')),'false');
   assert.equal(await page.$(manageCard),null,'Manage is inside the expanded lead card');
   await page.click(openCard);
   await page.waitForSelector(manageCard);
   assert.equal(await page.$eval(closeCard,button=>button.getAttribute('aria-expanded')),'true');
   const panelId=await page.$eval(closeCard,button=>button.getAttribute('aria-controls'));
   const details=await page.evaluate(id=>document.getElementById(id)?.textContent,panelId);
   assert.match(details,/DEMO-001/);
   assert.match(details,/85 000 km/);
   assert.match(details,/Replacement Price/);
   assert.ok(await page.evaluate(id=>{const card=document.getElementById(id)?.closest('article');return card&&card.scrollWidth<=card.clientWidth+1;},panelId),'Expanded details fit the lead card in the website canvas');
   await page.screenshot({path:path.join(output,`enquiry-expanded-${width}.png`),fullPage:true});
   const layout=await page.$eval(manageCard,button=>{
    const card=button.closest('[class*="leadAssetCard"]');
    const value=card.querySelector('[class*="leadValueBlock"]');
    const shell=card.closest('[class*="shell"]');
    const b=button.getBoundingClientRect(),v=value.getBoundingClientRect(),c=shell.getBoundingClientRect();
    const canvas=document.querySelector('[data-website-canvas]').getBoundingClientRect();
    return {rightGap:Math.abs(b.right-v.right),below:b.top>=v.bottom,leftGutter:c.left-canvas.left,rightGutter:canvas.right-c.right};
   });
   assert.ok(layout.rightGap<3&&layout.below,'Manage sits at the far right below the value');
   assert.ok(layout.leftGutter>0&&Math.abs(layout.leftGutter-layout.rightGutter)<3,'Standard shell has equal side gutters');
   await page.click(manageCard);await page.waitForSelector('[role="dialog"] [aria-label="Close lead management"]');
   await click('Reply by email');await page.waitForFunction(()=>document.body.textContent.includes('this opens your email app'));
   await click('Reply on WhatsApp');await page.waitForFunction(()=>document.body.textContent.includes('this opens WhatsApp'));
   await click('Send an invoice or quote');await page.waitForFunction(()=>document.body.textContent.includes('does not upload files'));
   await page.screenshot({path:path.join(output,`enquiry-example-${width}.png`),fullPage:true});
   assert.equal(requests.filter(r=>r.method==='POST').length,writesBefore,'Demo never sends or uploads anything');
   assert.equal(await page.$eval('a[href^="/business-network/accept"]',a=>new URL(a.href).searchParams.get('from')),'X Farms');
   await page.keyboard.press('Escape');await page.waitForSelector('[role="dialog"] [aria-label="Close lead management"]',{hidden:true});
   assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Manage Example Toyota Hilux','Closing Manage restores focus');
   await page.click(closeCard);await page.waitForSelector(openCard);
   assert.equal(await page.$(manageCard),null,'Closing the card hides its management controls');
   await page.goto('http://127.0.0.1:3033/business-network/guest-validation',{waitUntil:'networkidle2'});
   await page.waitForSelector('[data-hydrated=true]');
   await page.screenshot({path:path.join(output,`acceptance-${width}.png`),fullPage:true});
   await page.type('input[placeholder="e.g. S Haddad, George"]','George Workshop');await click('Search Google');
   await page.waitForSelector('[aria-label="Google search results"] button');
   await page.click('[aria-label="Google search results"] button');await click('Yes, this is my business');
   assert.equal(await page.$eval('[name=businessName]',el=>el.value),'George Workshop');
   assert.equal(await page.$eval('[name=googleMapsUrl]',el=>el.value),'https://maps.google.com/?cid=123');
   await page.type('[name=town]','George');await page.type('[name=contactName]','Sam');await page.type('[name=email]','business@example.com');await page.click('[name=accepted]');await click('Submit my free listing');
   await page.waitForFunction(()=>[...document.querySelectorAll('[role="status"] h2')].some(heading => /your acceptance is recorded/i.test(heading.textContent)));
   const acceptance=requests.filter(r=>r.path==='/api/business-network/accept').at(-1);
   assert.equal(JSON.parse(acceptance.data).googlePlaceId,'fixture-place');
   assert.equal(JSON.parse(acceptance.data).googleConfirmed,true);
   await click('find');
   assert.ok(!(await page.evaluate(()=>document.body.textContent)).includes('Invitations & history'));
   const invitationRequests=requests.filter(r=>r.path.startsWith('/api/business-network/')).length;
   await page.click('button[aria-haspopup="dialog"]:has(span)');await page.waitForSelector('[data-asset-link-dialog]');
   await click('Share read-only');
   assert.equal(await page.$eval('dialog [data-share-consent]',e=>e.checked),false,'Each invitation requires acknowledgement');
   assert.equal(await page.$$eval('dialog a',els=>els.length),0,'No send links before consent');
   if(width===1440) assert.ok(await page.$eval('dialog',e=>e.scrollHeight<=e.clientHeight+1),'Invitation fits desktop without scrolling');
   await page.screenshot({path:path.join(output,`invitation-disclosure-${width}.png`),fullPage:true});
   await page.click('dialog [data-share-consent]');await click('Create invitation link');await page.waitForSelector('dialog a[href^="mailto:"]');
   const links=await page.$$eval('dialog a[href^="mailto:"],dialog a[href^="https://wa.me/"]',nodes=>nodes.map(a=>a.href));
   assert.equal(links.length,2);
   for(const href of links){const target=new URL(href);const message=target.searchParams.get(target.protocol==='mailto:'?'body':'text');assert.ok(message.includes('/business-network/accept'));assert.ok(message.includes('Saved Business Ltd'));assert.ok(!message.includes('X Farms'));assert.ok(!message.includes('/asset-share/'));assert.ok(!message.includes('TEST-1'));}
   assert.ok(links.some(href=>href.startsWith('mailto:?')),'Email lets the owner choose a recipient');
   assert.ok(links.some(href=>href.startsWith('https://wa.me/?')),'WhatsApp lets the owner choose a recipient');
   await page.evaluate(()=>{window.__invitationCopied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__invitationCopied=text;}}});});
   await click('Copy link');await page.waitForFunction(()=>document.body.textContent.includes('Invitation link copied.'));
   assert.equal(await page.evaluate(()=>window.__invitationCopied),'http://127.0.0.1:3033/business-network/accept?share='+token);
   assert.ok(await page.$eval('dialog',e=>e.scrollWidth<=e.clientWidth+1),'Invitation fits without horizontal scrolling');
   await page.screenshot({path:path.join(output,`invitation-${width}.png`),fullPage:true});
   await page.evaluate(()=>{window.__escapedToParent=false;document.addEventListener('keydown',event=>{if(event.key==='Escape')window.__escapedToParent=true;},{once:true});});
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog'));
   assert.equal(await page.evaluate(()=>window.__escapedToParent),false,'Escape stays inside the invitation');
   await page.click('button[aria-haspopup="dialog"]:has(span)');await page.waitForSelector('[data-asset-link-dialog]');
   assert.ok(await page.evaluate(()=>document.querySelector('[data-asset-link-dialog]').textContent.includes('Asset link settings')));
   assert.equal(await page.$$eval('[data-asset-link-dialog] input:checked:disabled',inputs=>inputs.length),0,'Report permissions are selectable');
   assert.equal(await page.$$eval('[data-permission-grid] input:checked',inputs=>inputs.length),0,'New link permissions start unchecked');
   await page.click('[data-asset-link-dialog] input[type=checkbox]');
   await page.waitForFunction(()=>document.querySelectorAll('[data-permission-grid] input:checked').length===11);
   if(width===1440) assert.ok(await page.$eval('[data-asset-link-dialog]',e=>[e,...e.querySelectorAll('div')].every(node=>node.scrollHeight<=node.clientHeight+1||!['auto','scroll'].includes(getComputedStyle(node).overflowY))),'Asset link settings and all option containers fit without scrolling');
   await page.screenshot({path:path.join(output,`permission-picker-${width}.png`),fullPage:true});
   await click('Continue');
   assert.equal(await page.$('dialog input[type=email]'),null);
   assert.equal(await page.$('dialog input[type=file]'),null);
   assert.ok(await page.$eval('dialog',e=>e.scrollHeight<=e.clientHeight+1),'Disclaimer fits without scrolling');
   await page.screenshot({path:path.join(output,`selected-disclosure-${width}.png`),fullPage:true});
   await page.click('dialog [data-share-consent]');await click('Create invitation link');await page.waitForSelector('dialog a[href^="mailto:"]');
   const selectedDetails=await page.evaluate(()=>JSON.parse(window.__selectedLeadDetails));
   assert.deepEqual(selectedDetails.permissions,{updateDetails:true,location:true,yearModel:true,usage:true,condition:true,addMaintenance:true,addPhotos:true,addCosts:true,reports:true,replacementPrice:true,serialNumber:true,documents:false,loggedProblems:true,maintenanceReports:true,costOfOwnership:true,maintenanceSchedules:true,directUpdates:true,allReports:true});assert.equal(selectedDetails.recipientEmail,'');assert.equal(selectedDetails.accessMode,'signed-in');
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog'));

   assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-haspopup')),'dialog','Focus returns to the directory trigger');
   await page.click('button[aria-haspopup="dialog"]:has(span)');await page.waitForSelector('[data-asset-link-dialog]');
   await click('Share read-only');
   assert.equal(await page.$eval('dialog [data-share-consent]',e=>e.checked),false,'Each invitation requires acknowledgement');
   assert.equal(await page.$$eval('dialog a',els=>els.length),0,'No send links before consent');
   await page.click('dialog [data-share-consent]');await click('Create invitation link');await page.waitForSelector('dialog a[href^="mailto:"]');
   const readonlyDetails=await page.evaluate(()=>JSON.parse(window.__selectedLeadDetails));
   assert.equal(readonlyDetails.permissions.addPhotos,false);assert.equal(readonlyDetails.permissions.addCosts,false);
   await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Clipboard unavailable')}}}));
   await click('Copy link');await page.waitForSelector('input[aria-label="Business invitation link"]');
   assert.equal(await page.$eval('input[aria-label="Business invitation link"]',e=>e.value),'http://127.0.0.1:3033/business-network/accept?share='+token);
   await page.click('button[aria-label="Close business invitation"]');await page.waitForFunction(()=>!document.querySelector('dialog'));
   await page.click('button[aria-haspopup="dialog"]:has(span)');await page.waitForSelector('[data-asset-link-dialog]');
   await page.mouse.click(3,3);await page.waitForFunction(()=>!document.querySelector('[data-asset-link-dialog]'));
   assert.equal(requests.filter(r=>r.path.startsWith('/api/business-network/')).length,invitationRequests,'Inviting creates no database record and calls no invitation API');
   for(const kind of ['asset','register','umbrella']){
    await click(kind);await page.waitForSelector('[role=dialog]');
    const measure=()=>page.$eval('[role=dialog] button:has(strong)',button=>{const title=button.querySelector('strong'),description=button.querySelector('small'),icon=button.querySelector('svg');const t=title.getBoundingClientRect(),d=description.getBoundingClientRect(),i=icon.getBoundingClientRect();return {title:getComputedStyle(title).fontSize,description:getComputedStyle(description).fontSize,gap:d.top-t.bottom,stacked:i.bottom<t.top,centred:Math.abs((i.left+i.right-t.left-t.right)/2)<3};});
    const before=await measure();assert.ok(before.stacked&&before.centred,'Destination icon sits above its centred title');
    await page.screenshot({path:path.join(output,`share-${kind}-${width}.png`),fullPage:true});
    await click('Inside Aim4price');await page.waitForFunction(()=>document.body.textContent.includes('Choose who to share with.'));
    const after=await measure();assert.equal(before.title,after.title);assert.equal(before.description,after.description);assert.ok(after.gap<=6,'Title and description stay close');assert.ok(after.stacked&&after.centred);
    await page.screenshot({path:path.join(output,`share-inside-${width}.png`),fullPage:true});
    await page.click('[aria-label="Back to share options"]');
   }
   await click('compose');await page.waitForFunction(()=>document.querySelector('input[value="owner@example.com"]'));
   await labelInput('Your request','Please quote for servicing.');
   await page.click('[data-share-consent]');await click('Create lead link');await page.waitForFunction(()=>document.querySelector('[data-link]').textContent.endsWith('g'.repeat(43)));
   assert.ok(await page.$eval('[data-link]',e=>e.textContent.endsWith('g'.repeat(43))));
   await click('Change report selection');assert.equal(await page.$eval('[data-link]',e=>e.textContent),'');
   assert.equal(await page.$eval('textarea',e=>e.value),'Please quote for servicing.','Report changes preserve request draft');
   await page.click('[data-share-consent]');await click('Create lead link');await page.waitForFunction(()=>document.querySelector('[data-link]').textContent.length>0);
   await page.screenshot({path:path.join(output,`owner-${width}.png`),fullPage:true});
   await page.click('details summary');await click('Disable');await page.waitForFunction(()=>document.body.textContent.includes('Lead disabled'));
   await click('recipient');
   await page.screenshot({path:path.join(output,`request-bar-${width}.png`),fullPage:true});
   await page.click('button[aria-label="Open Test bakkie"]');await page.click('button[aria-label="Manage Test bakkie"]');
   const manageLayout=await page.$eval('[role="dialog"]',dialog=>{const button=dialog.querySelector('button:has(strong)'),title=button.querySelector('strong').getBoundingClientRect(),copy=button.querySelector('small').getBoundingClientRect();return{height:dialog.getBoundingClientRect().height,stacked:copy.top>=title.bottom-1,overflow:dialog.scrollWidth>dialog.clientWidth+1};});
   assert.ok(manageLayout.stacked,'Manage action description sits below its title');assert.equal(manageLayout.overflow,false);
   if(width===1440)assert.ok(manageLayout.height<650,'Manage fits its actions without an empty full-height panel');
   await page.screenshot({path:path.join(output,`manage-actions-${width}.png`),fullPage:true});
   await click('Update replacement price');
   await page.waitForSelector('a[href^="/business/join?returnTo="]');
   const guestLink=await page.$eval('a[href^="/business/join?returnTo="]',a=>({text:a.textContent,returnTo:new URL(a.href).searchParams.get('returnTo')}));
   assert.equal(guestLink.text,'Create a free account');assert.equal(guestLink.returnTo,`/asset-share/${token}?open=1`);
   assert.equal(await page.$('[role="dialog"] form'),null,'Visitors cannot submit updates');
   await page.screenshot({path:path.join(output,`signup-gate-${width}.png`),fullPage:true});
   await closeChild();await click('Reports');
   assert.equal(await page.$$eval('a[href*="/reports/"]',els=>els.length),0,'Locked reports expose no download link');
   assert.ok(await page.$('a[href^="/auth?returnTo="]'),'Sign-in keeps the enquiry return path');
   await closeChild();await page.click('[aria-label="Close lead management"]');await click('Fixture read-only');await page.click('button[aria-label="Manage Test bakkie"]');
   await click('Reports');await page.waitForSelector('a[href*="/reports/"]');
   for(const action of ['Update replacement price','Invoices & quotes']){
    await closeChild();await click(action);
    const accountLink=await page.$eval('[role="dialog"] a[href^="/business?details=1&returnTo="]',a=>({text:a.textContent,returnTo:new URL(a.href).searchParams.get('returnTo')}));
    assert.equal(accountLink.text,'Verify business');assert.equal(accountLink.returnTo,`/asset-share/${token}?open=1`);
    assert.equal(await page.$('[role="dialog"] form'),null,'Read-only recipients cannot submit updates or documents');
    assert.equal(await page.$('[role="dialog"] input[type=file]'),null,'Read-only recipients cannot upload documents');
   }
   await closeChild();await page.click('[aria-label="Close lead management"]');await click('Fixture request access');await page.click('button[aria-label="Manage Test bakkie"]');
   await click('Reports');await click('Request access');
   await page.waitForFunction(()=>document.body.textContent.includes('Access requested.'));
   assert.equal(await page.$$eval('a[href*="/reports/"]',els=>els.length),0,'Requesting access does not unlock reports');
   assert.ok(requests.some(r=>r.path.endsWith('/access')&&r.method==='POST'));
   await closeChild();await page.click('[aria-label="Close lead management"]');await click('Fixture activated');await page.click('button[aria-label="Manage Test bakkie"]');
   await click('Reports');await page.waitForSelector('a[href*="/reports/"]');
   await closeChild();await click('Update replacement price');
   await fill('[role="dialog"] input[type=number]','100000');await click('Send to owner');
   await page.waitForFunction(()=>document.body.textContent.includes('update waiting for owner approval'));
   const proposed=requests.filter(r=>r.path.endsWith('/corrections')).at(-1);assert.equal(JSON.parse(proposed.data).value,100000);assert.equal(JSON.parse(proposed.data).assetId,'10000000-0000-4000-8000-000000000001');
   await click('Invoices & quotes');
   assert.equal(await page.$('[name=name]'),null,'Verified identity cannot be edited');
   await page.type('[name=note]','Service quote');
   const filePath=path.join(output,'quote.pdf');await fs.writeFile(filePath,'%PDF-1.4 fixture');
   await (await page.$('input[type=file]')).uploadFile(filePath);await click('Send to owner');
   await page.waitForFunction(()=>document.body.textContent.includes('Document sent to the owner'));
   assert.equal(await page.$$eval('a[href*="submissions?id="]',els=>els.length),0,'Recipient cannot see received documents');
   await page.screenshot({path:path.join(output,`active-${width}.png`),fullPage:true});
   await closeChild();await page.click('[aria-label="Close lead management"]');await click('Fixture owner');await page.click('button[aria-label="Manage Test bakkie"]');await click('Recipient access');
   await page.waitForFunction(()=>document.body.textContent.includes('Verified Workshop'));
   assert.ok(await page.$eval('[aria-label="Recipient access"]',el=>el.textContent.includes('They can view')&&el.textContent.includes('Suggest a replacement price change')));
   await click('Approve access');
   await page.waitForFunction(()=>document.body.textContent.includes('Recipient approved.'));
   assert.equal(JSON.parse(requests.filter(r=>r.path.endsWith('/access')&&r.method==='PATCH').at(-1).data).userId,'recipient');
   await closeChild();await click('Invoices & quotes');
   await page.waitForSelector('a[href*="submissions?id="]');await click('Accept document');
   await page.waitForFunction(()=>document.body.textContent.includes('Review saved. No asset details or costs were changed.'));
   assert.equal(documents[0].status,'accepted');
   await page.screenshot({path:path.join(output,`review-${width}.png`),fullPage:true});
   await closeChild();await page.click('[aria-label="Close lead management"]');
   await click('admin');await page.waitForFunction(()=>document.body.textContent.includes('Business acceptances (1)'));
   await page.$$eval('details',els=>els.forEach(e=>e.open=true));await click('Prepare listing');
   await fill('[name=until]','2099-12-31');await page.type('[name=note]','Manual test payment');await click('Activate paid access');await page.waitForFunction(()=>document.body.textContent.includes('Guest access updated'));
   assert.ok(activated);await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Suspend access'&&!b.disabled));await click('Suspend access');await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Suspend access'&&!b.disabled));assert.equal(activated,false);
  }
  // Standard outside sharing must not create a snapshot or guest lead.
  const linkRequestsBefore=requests.filter(r=>r.path.startsWith('/api/asset-share-links')).length;
  for(const width of [1440,430]){
   await page.setViewport({width,height:1000,deviceScaleFactor:1});
   await click('find');await click('external');
   assert.equal(await page.$('[data-share-consent]'),null,'Disclosure is not inline in the attachment screen');
   await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='WhatsApp'&&!b.disabled));
   const externalText=await page.$eval('[aria-label="Share outside Aim4price"]',e=>e.textContent);
   assert.doesNotMatch(externalText,/Create lead link|Create asset link|Message & attachments|Lead page|View asset details:/);
   await page.evaluate(()=>{
    window.__opened=[];window.__nativeShares=[];
    window.open=url=>{window.__opened.push(url);return null};
    Object.defineProperty(navigator,'canShare',{configurable:true,value:data=>data.files?.length===1});
    Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{
     window.__nativeShares.push({text:data.text,title:data.title,files:await Promise.all(data.files.map(async file=>({name:file.name,type:file.type,body:await file.text()})))});
    }});
   });
   for(const channel of ['WhatsApp','Email']){
    await click(channel);await page.waitForSelector('dialog[open] [data-share-consent]');
    assert.equal(await page.$eval('dialog [data-share-consent]',e=>e.checked),false,'Every channel click needs acknowledgement');
    assert.equal(await page.evaluate(()=>window.__nativeShares.length),channel==='WhatsApp'?0:1,'Opening disclosure never shares');
    assert.equal(await page.$eval('dialog button:not([aria-label])',e=>e.disabled),true,'Continue is disabled until acknowledged');
    await page.keyboard.press('Escape');await page.waitForSelector('dialog[open]',{hidden:true});
    await page.waitForFunction(channel=>document.activeElement?.textContent.trim()===channel,{},channel);
    await click(channel);await page.waitForSelector('dialog[open] [data-share-consent]');
    await page.click('dialog [data-share-consent]');
    await page.screenshot({path:path.join(output,`external-disclosure-${channel}-${width}.png`),fullPage:true});
    if(width===1440) assert.ok(await page.$eval('dialog',e=>e.scrollHeight<=e.clientHeight+1),'Disclosure fits desktop without scrolling');
    await click('Continue to '+channel);
    await page.waitForFunction(()=>document.body.textContent.includes('attachment was handed to your phone'));
   }
   const sent=await page.evaluate(()=>({opened:window.__opened,native:window.__nativeShares}));
   assert.equal(sent.native.length,2,'Both actions hand the selected report to the native share menu');
   assert.equal(sent.opened.length,0,'No message-only URL silently drops the selected report');
   for(const payload of sent.native){
    assert.match(payload.text,/Serial number: TEST-1/);
    assert.match(payload.text,/Attachments: 1 Aim4price report/);
    assert.doesNotMatch(payload.text,/asset-share|View asset details:/);
    assert.deepEqual(payload.files,[{name:'valuation.pdf',type:'application/pdf',body:'%PDF-1.4 fixture'}]);
   }
   await page.evaluate(()=>Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}));
   await click('WhatsApp');await page.waitForSelector('dialog[open] [data-share-consent]');
   await page.click('dialog [data-share-consent]');await click('Continue to WhatsApp');
   await page.waitForFunction(()=>document.body.textContent.includes('Nothing was sent.'));
   assert.equal(await page.evaluate(()=>window.__nativeShares.length),2,'Unsupported payloads are not sent');
   await page.screenshot({path:path.join(output,`standard-external-${width}.png`),fullPage:true});
  }
  assert.equal(requests.filter(r=>r.path.startsWith('/api/asset-share-links')).length,linkRequestsBefore,'Standard sharing never calls snapshot or lead APIs');
  assert.equal(requests.filter(r=>r.path==='/api/business-network/accept'&&r.method==='POST').length,2);
  assert.equal(requests.filter(r=>r.path==='/api/guest-access'&&r.method==='POST').length,0);
  assert.equal(requests.filter(r=>r.path.endsWith('/submissions')&&r.method==='POST').length,2);
  assert.deepEqual(errors,[]);
  console.log('PASS simple directory invitation, acceptance, lead creation/revocation, private document submission/review, opt-in reports and standard external attachment delivery at desktop and mobile widths');
 }finally{
  if(browser)await browser.close();if(server)server.kill();
  await fs.rm(fixture,{recursive:true,force:true});
  await fs.rm(canonicalFixture,{recursive:true,force:true});
  await fs.rm(path.join(root,'.next/types/app/business/send-link-validation'),{recursive:true,force:true});
  await fs.rm(path.join(root,'.next/types/app/business-network/guest-validation'),{recursive:true,force:true});
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
