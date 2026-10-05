/* Shared-link/Leads dialog checks with synthetic data; no real writes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
let cssIndex=0;
const stubs={'components/DateInput':'module.exports=()=>null;'};
function cssModule(file){
 const prefix='c'+cssIndex+++'_',map={},sheet=postcss.parse(fs.readFileSync(path.join(root,file),'utf8'));
 sheet.walkRules(rule=>{
  const globals=[];let selector=rule.selector;
  while(selector.includes(':global(')){
   const start=selector.indexOf(':global(');let end=start+8,depth=1;
   for(;depth&&end<selector.length;end++){if(selector[end]==='(')depth++;else if(selector[end]===')')depth--;}
   const token='GLOBALTOKEN'+globals.length;
   globals.push(selector.slice(start+8,end-1));selector=selector.slice(0,start)+token+selector.slice(end);
  }
  selector=selector.replace(/\.([a-zA-Z_][\w-]*)/g,(_,name)=>{map[name]=prefix+name;return '.'+prefix+name;});
  globals.forEach((value,index)=>{selector=selector.replace('GLOBALTOKEN'+index,value);});
  rule.selector=selector;
 });
 sheets.push(sheet.toString());modules[file]='module.exports='+JSON.stringify(map);
}
function add(file){
 if(Object.hasOwn(modules,file))return;
 if(file.endsWith('.css')){cssModule(file);return;}
 if(stubs[file]){modules[file]=stubs[file];return;}
 const filename=['.tsx','.ts','.json',''].map(ext=>path.join(root,file+ext)).find(fs.existsSync);
 if(!filename)throw Error('Missing module '+file);
 if(filename.endsWith('.json')){modules[file]='module.exports='+fs.readFileSync(filename,'utf8');return;}
 modules[file]='';
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 modules[file]=code.replace(/require\(["']([^"']+)["']\)/g,(match,name)=>{
  if(!name.startsWith('.'))return match;
  const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),name));add(resolved);
  return 'require('+JSON.stringify(resolved)+')';
 });
}


add('components/asset-register/AssetValueDialog');
add('components/AssetConditionPicker');
add('components/leads/LeadActionDialog');
add('components/asset-register/ExternalLeadActions');
add('components/leads/LeadManageDialog');
add('components/business-network/BusinessListingInvite');
add('components/SharedEnquiryLanding');
add('app/business/join/business-signup');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';


(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true,ignoreDefaultArgs:['--hide-scrollbars']});
 try{
 const page=await browser.newPage();await page.setViewport({width:1440,height:1000});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);page.on('request',request=>request.respond({status:200,contentType:'text/html',body:'<html></html>'}));await page.goto('https://aim4price.example/asset-register');
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;background:#dce7e0;font-family:Arial;--modal-backdrop-color:rgba(12,24,35,.42)}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+'window.root=ReactDOM.createRoot(document.getElementById("app"));window.renderValue=(suggest=false)=>window.root.render(React.createElement(require("components/asset-register/AssetValueDialog").default,{key:String(suggest)+String(window.renderCount=(window.renderCount||0)+1),suggest,endpoint:"/api/fixture/value",assetTitle:"2023 Tractor",onClose:()=>{}}));'});
 await page.evaluate(()=>{
 if(!crypto.randomUUID)crypto.randomUUID=()=>String(Math.random());window.writes=[];window.data={asset:{id:'asset',title:'2023 Tractor',value:700000,replacementPrice:1000000,revision:'v1',manual:false},requests:[{id:'proposal',amount:800000,reason:'Inspected equipment',actor_name:'Example Dealer',status:'pending',submitted_value:700000}],history:[]};
 window.fetch=async(url,options)=>{if(!options?.method)return {ok:true,json:async()=>({...window.data,value:window.data.asset.value,manual:window.data.asset.manual,revision:window.data.asset.revision})};const b=JSON.parse(options.body);window.writes.push(b);if(b.action==='previewReset')return {ok:true,json:async()=>({revision:window.data.asset.revision,currentValue:window.data.asset.value,recalculatedValue:700000})};if(b.action==='resetAim4price'){window.data.asset.value=700000;window.data.asset.baseline=null;}if(b.action==='restoreManual')window.data.asset.value=600000;if(b.action==='suggest'&&window.data.asset.manual){window.data.asset.value=b.amount;return {ok:true,json:async()=>({ok:true,direct:true})};}if(b.action==='previewReplacement')return {ok:true,json:async()=>({revision:'v1',currentValue:window.data.asset.value,recalculatedValue:960000})};if(b.action==='approve'){window.data.asset.value=800000;window.data.requests[0].status='approved';}if(b.action==='override')window.data.asset.value=b.amount;return {ok:true,json:async()=>({ok:true})};};window.renderValue();
 });
 async function click(text){await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>b.textContent===t),{},text);await page.$$eval('button',(nodes,t)=>nodes.find(b=>b.textContent===t).click(),text);}
 async function fill(selector,value){await page.waitForSelector(selector);await page.$eval(selector,(n,v)=>{Object.getOwnPropertyDescriptor(n.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(n,v);n.dispatchEvent(new Event('input',{bubbles:true}));},value);}
 await click('Review suggestion');await page.waitForSelector('textarea');assert(await page.evaluate(()=>document.body.textContent.includes('Example Dealer')));await fill('textarea','Accept inspected value');await page.screenshot({path:'/tmp/value-approval.png'});await click('Approve value');await page.waitForFunction(()=>document.body.textContent.includes('Saved.'));assert.equal(await page.evaluate(()=>window.writes[0].proposalId),'proposal');
 await click('Override current value');await fill('input[type=number]','750000');await fill('textarea','Owner inspection');await click('Confirm override');await page.waitForFunction(()=>window.data.asset.value===750000);
 await click('Change replacement price');await fill('input[type=number]','1200000');await fill('textarea','Updated replacement quotation');await click('Preview change');await page.waitForFunction(()=>document.body.textContent.includes('960'));await page.screenshot({path:'/tmp/value-replacement.png'});await click('Keep current value');await page.waitForFunction(()=>window.writes.some(w=>w.mode==='keep'));assert.equal(await page.evaluate(()=>window.writes.find(w=>w.mode==='keep').replacementPrice),1200000);
 await page.evaluate(()=>window.renderValue(true));await fill('input[type=number]','850000');await fill('textarea','Professional inspection');await page.screenshot({path:'/tmp/value-suggestion-polished.png'});await click('Send suggestion');await page.waitForFunction(()=>document.body.textContent.includes('Suggestion sent.'));assert.equal(await page.evaluate(()=>window.writes.at(-1).action),'suggest');assert.equal(await page.evaluate(()=>window.data.asset.value),750000,'Suggestion does not mutate the live asset');
 await page.evaluate(()=>{
  const previous=window.fetch;window.scopeOwner=false;
  window.fetch=async(url,options)=>String(url).endsWith('/details')?{ok:true,json:async()=>({asset:{id:'asset',replacementPriceExVat:1000000},permissions:{owner:window.scopeOwner,replacementPrice:true,suggestValue:true}})}:String(url).endsWith('/corrections')?{ok:true,json:async()=>{window.writes.push(JSON.parse(options.body));return {correction:{status:'pending'}};}}:previous(url,options);
  window.renderSharedValue=(owner,field)=>{window.scopeOwner=owner;window.root.render(React.createElement(require('components/leads/SharedAssetValueDialog').default,{key:String(owner)+field,endpoint:'/api/asset-share-links/token/assets/asset',assetTitle:'2023 Tractor',field,onClose:()=>{}}));};
  window.renderSharedValue(false,'replacement');
 });
 await page.waitForFunction(()=>document.body.textContent.includes('Suggest replacement price'));
 await fill('input[type=number]','1150000');await fill('textarea','New supplier quotation');
 await click('Send suggestion');await page.waitForFunction(()=>document.body.textContent.includes('Sent to the owner for approval.'));
 assert.equal(await page.evaluate(()=>window.writes.at(-1).reason),'New supplier quotation');
 assert.equal(await page.evaluate(()=>window.data.asset.value),750000,'Replacement suggestion does not mutate current value');
 await page.evaluate(()=>window.renderSharedValue(true,'replacement'));
 await page.waitForFunction(()=>document.body.textContent.includes('Change replacement price'));
 await page.waitForFunction(()=>document.querySelector('input[type=number]')?.value==='1000000');
 assert.equal(await page.$$eval('button',nodes=>nodes.filter(n=>n.textContent==='Send suggestion').length),0,'Owner opens confirmed replacement flow');
 await page.evaluate(()=>window.renderSharedValue(true,'current'));
 await page.waitForFunction(()=>document.body.textContent.includes('Override current value'));
 assert(await page.evaluate(()=>[...document.querySelectorAll('button')].some(n=>n.textContent==='Confirm override')));
 await page.evaluate(()=>{window.data.asset.manual=true;window.renderValue(true);});
 await page.waitForFunction(()=>document.body.textContent.includes('Update manual value'));
 await fill('input[type=number]','620000');await fill('textarea','Manual assessment');await click('Confirm update');
 await page.waitForFunction(()=>document.body.textContent.includes('Manual value updated.'));
 assert.equal(await page.evaluate(()=>window.writes.at(-1).confirmed),true);
 assert.equal(await page.evaluate(()=>window.writes.at(-1).revision),'v1');
 await page.evaluate(()=>{window.data.history=[{id:'previous',action:'Value manual update',actor_name:'Workshop',created_at:'2026-10-04',before_data:{amount:600000,replacementPrice:1000000},after_data:{amount:620000,reason:'Manual assessment'}}];window.renderValue();});
 await click('History');await click('Restore previous manual value');await fill('textarea','Correct mistaken estimate');await click('Confirm restoration');
 await page.waitForFunction(()=>window.writes.at(-1).action==='restoreManual');assert.equal(await page.evaluate(()=>window.writes.at(-1).historyId),'previous');
 await page.evaluate(()=>{window.data.asset.manual=false;window.data.asset.baseline={amount:600000,actorName:'Owner',date:'2026-10-04',reason:'Approved'};window.renderValue();});
 await click('Return to Aim4price value');await fill('textarea','Use current Aim4price calculation');await click('Preview today’s value');await page.waitForFunction(()=>document.body.textContent.includes('Confirm return to Aim4price'));
 await page.screenshot({path:'/tmp/history-reset-preview.png'});await click('Confirm return to Aim4price');await page.waitForFunction(()=>window.writes.at(-1).action==='resetAim4price');assert.equal(await page.evaluate(()=>window.writes.at(-1).expectedValue),700000);
 await page.evaluate(()=>{
 window.historyItem={id:'event',category:'details',action:'Asset updated',actorName:'Example Workshop',source:'Leads',createdAt:'2026-10-04T10:00:00Z',before:{title:'Old tractor',year_model:2022},after:{title:'2023 Tractor',year_model:2023},recordId:'asset',recordTable:'asset_register_items',restorable:true,href:'/asset-register?assetId=asset'};
 window.fetch=async(url,options)=>{if(String(url).includes('format=pdf')){window.historyPdfUrl=String(url);return new Response('%PDF-test',{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="history.pdf"'}});}if(options?.method==='POST'){window.writes.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true})};}return {ok:true,json:async()=>({items:[window.historyItem,...Array.from({length:12},(_,i)=>({...window.historyItem,id:`older-${i}`,action:`Maintenance updated ${i+1}`,actorName:'Owner',category:'maintenance',restorable:false}))].filter(item=>!new URL(url,'https://example.test').searchParams.has('category')||item.category===new URL(url,'https://example.test').searchParams.get('category')),nextBefore:null})};};
 window.root.render(React.createElement(require('components/asset-register/AssetHistoryDialog').default,{endpoint:'/api/asset-register/asset',assetTitle:'2023 Tractor',assetSubtitle:'Year Model: 2023 • Usage: 1 300 hours • Condition: Good',onClose:()=>{}}));
 });
 await page.waitForSelector('details');
 await page.click('[aria-label="History category"] button:nth-child(5)');
 await page.waitForFunction(()=>document.body.textContent.includes('No recorded activity'));
 assert.equal(await page.$eval('[aria-label="History category"] button:nth-child(5)',node=>node.getAttribute('aria-pressed')),'true');
 await page.click('[aria-label="History category"] button:first-child');await page.waitForSelector('details');
 assert.equal(await page.$$eval('details[open]',nodes=>nodes.length),0);
 assert.equal(await page.$eval('[aria-label="History entries"]',node=>node.scrollHeight>node.clientHeight),true);
 await page.screenshot({path:'/tmp/asset-history-list.png'});
 await page.click('details:nth-of-type(1) summary');await page.click('details:nth-of-type(2) summary');
 assert.equal(await page.$$eval('details[open]',nodes=>nodes.length),1);
 assert.equal(await page.$eval('details:nth-of-type(2)',node=>node.open),true);
 await fill('input[type="search"]','Example Workshop');
 assert.equal(await page.$$eval('details',nodes=>nodes.length),1);
 await click('Download PDF report');await page.waitForFunction(()=>window.historyPdfUrl);assert.ok((await page.evaluate(()=>window.historyPdfUrl)).includes('search=example+workshop'));
 await page.click('details summary');assert.equal(await page.$$eval('details[open]',nodes=>nodes.length),1);
 await page.click('details summary');assert.equal(await page.$$eval('details[open]',nodes=>nodes.length),0);
 await fill('input[type="search"]','no such event');assert.equal(await page.$$eval('details',nodes=>nodes.length),0);
 await fill('input[type="search"]','2022');assert.equal(await page.$$eval('details',nodes=>nodes.length),13);
 await fill('input[type="search"]','Example Workshop');await page.click('details summary');
 assert.equal(await page.$$eval('details[open] a',nodes=>nodes.length),0);
 await page.screenshot({path:'/tmp/asset-history-expanded.png'});
 await click('Retract change');await page.screenshot({path:'/tmp/asset-history-review.png'});await click('Confirm retraction');await page.waitForFunction(()=>document.body.textContent.includes('Change retracted.'));
 assert.equal(await page.evaluate(()=>window.writes.at(-1).eventId),'event');
 assert.deepEqual(errors,[]);console.log('PASS value approval, manual edits, reset preview, history restoration, and shared value flows');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
