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
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});
 try {
 const page=await browser.newPage(); await page.setViewport({width:1440,height:1000});
 page.on('pageerror',error=>{throw error;});
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;background:#dce7e0;font-family:Arial;--modal-backdrop-color:rgba(12,24,35,.42);--modal-backdrop-filter:blur(12px)}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.evaluate(()=>{if(!crypto.randomUUID)crypto.randomUUID=()=> '10000000-0000-4000-8000-000000000002';window.requests=[];window.fetch=async(url,opts)=>{window.requests.push({url,body:opts?.body});return {ok:true,json:async()=>({correction:{id:'correction',status:'pending',serialNumberChanged:true,proposedSerialNumber:'NEW-456'}})}}});
 const props={token:'a'.repeat(43),assetId:'10000000-0000-4000-8000-000000000001',assetIndex:0,assetTitle:'John Deere 6155M',serialNumber:'OLD-123',replacementPrice:900000,permissions:{serialNumber:true,replacementPrice:true,documents:true,reports:true},access:'active',reports:[{id:'report-1',label:'Asset valuation'}]};
 await page.addScriptTag({content:runtime+'window.renderFixture=(props)=>{window.fixtureRoot??=ReactDOM.createRoot(document.getElementById("app"));window.fixtureRoot.render(React.createElement(require("components/leads/LeadManageDialog").default,{title:props.assetTitle,description:"Manage enquiry",onClose:()=>{}},React.createElement(require("components/asset-register/ExternalLeadActions").default,{...props,key:props.access+JSON.stringify(props.permissions)})));};window.renderFixture('+JSON.stringify(props)+');'});
 async function click(text){await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(node=>node.textContent.includes(text)),{},text);await page.evaluate(text=>{const button=[...document.querySelectorAll('button')].find(node=>node.textContent.includes(text));if(!button)throw Error('Missing button '+text);button.click();},text);}
 await page.waitForFunction(()=>document.body.textContent.includes('Update serial number'));
 await click('Update serial number');await page.waitForSelector('input');
 assert.equal(await page.$$eval('[role="dialog"]',nodes=>nodes.length),2);
 await page.screenshot({path:'/tmp/shared-correction-modal.png'});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelectorAll('[role="dialog"]').length===1);
 await click('Update replacement price');await page.waitForSelector('input[type=number]');await page.keyboard.press('Escape');
 await click('Reports');await page.waitForSelector('[data-download-dialog]');assert.equal(await page.$eval('[data-download-option]',a=>a.getAttribute('href')),'/api/asset-share-links/'+props.token+'/reports/report-1');await page.screenshot({path:'/tmp/shared-reports-modal.png'});await page.keyboard.press('Escape');
 await click('Invoices');await page.waitForSelector('input[type=file]');await page.screenshot({path:'/tmp/shared-documents-modal.png'});await page.keyboard.press('Escape');
 await click('Update serial number');await page.waitForSelector('input');await page.$eval('input',node=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(node,'NEW-456');node.dispatchEvent(new Event('input',{bubbles:true}));});await click('Send to owner');
 await page.waitForFunction(()=>document.body.textContent.includes('update waiting for owner approval'));
 const requests=await page.evaluate(()=>window.requests);assert.equal(requests.length,1);assert.equal(requests[0].url,'/api/asset-share-links/'+props.token+'/corrections');assert.equal(JSON.parse(requests[0].body).assetId,props.assetId);
 await page.evaluate(p=>window.renderFixture({...p,access:'read-only'}),props);await page.waitForFunction(()=>!document.body.textContent.includes('update waiting for owner approval'));await click('Update serial number');await page.waitForFunction(()=>document.body.textContent.includes('Verify business'));assert.equal(await page.$$eval('input',nodes=>nodes.length),0);await page.keyboard.press('Escape');
 await page.evaluate(p=>window.renderFixture({...p,permissions:{reports:true,documents:false,serialNumber:false,replacementPrice:false}}),props);await page.waitForFunction(()=>!document.body.textContent.includes('Update serial number'));assert(!await page.evaluate(()=>document.body.textContent.includes('Invoices & quotes')));
 // New links reuse the live Leads tools and save directly.
 const live={accessId:props.assetId,assetId:props.assetId,assetTitle:props.assetTitle,assetKind:'tractor',currentUsage:100,usageMetric:'hours',maintenanceRecords:[],openMaintenanceRecords:[],completedMaintenanceRecords:[],scheduleProposals:[],loggedProblems:[],permissions:{canCreateMaintenanceSchedules:true,canViewMaintenanceReports:true}};
 await page.evaluate(({p,live})=>{window.fetch=async(url,options)=>{window.requests.push({url,body:options?.body});return{ok:true,json:async()=>options?.method==='POST'?{ok:true,correction:{id:'saved',status:'accepted',serialNumberChanged:true,proposedSerialNumber:'LIVE-SERIAL'}}:{ok:true,asset:live,assets:[live]}}};window.renderFixture({...p,permissions:{...p.permissions,directUpdates:true,documents:false,maintenanceReports:true,costOfOwnership:true,maintenanceSchedules:true,loggedProblems:true}});},{p:props,live});
 await page.waitForFunction(()=>document.body.textContent.includes('Maintenance Reports'));
 await click('Update serial number');await page.waitForSelector('input');
 assert(await page.evaluate(()=>document.body.textContent.includes('Saving changes updates the live asset immediately.')));
 await page.$eval('input',node=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,'LIVE-SERIAL');node.dispatchEvent(new Event('input',{bubbles:true}));});await click('Save changes');
 await page.waitForFunction(()=>document.querySelectorAll('[role="dialog"]').length===1);
 assert(!await page.evaluate(()=>document.body.textContent.includes('waiting for owner approval')));
 await click('Maintenance Reports');await page.waitForFunction(()=>document.body.textContent.includes('PDF') && !document.body.textContent.includes('Checking current maintenance'));
 await page.screenshot({path:'/tmp/shared-live-maintenance-report.png'});await page.keyboard.press('Escape');
 await click('Cost of Ownership');await page.waitForFunction(()=>document.body.textContent.includes('PDF'));await page.keyboard.press('Escape');
 await click('Create Maintenance Schedules');await page.waitForFunction(()=>document.body.textContent.includes('What needs doing?'));assert(await page.$eval('[role=dialog] h2',node=>{const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+5,r.y+5));}),'Schedule must be above Manage');await page.screenshot({path:'/tmp/shared-live-schedule.png'});await page.keyboard.press('Escape');
 await click('Log problems');await click('Logged problems');await page.waitForFunction(()=>document.body.textContent.includes('No logged problems.'));await page.keyboard.press('Escape');
 await page.evaluate(p=>window.renderFixture({...p,permissions:{reports:true,allReports:true,maintenanceReports:true,costOfOwnership:true,serialNumber:false,replacementPrice:false,documents:false}}),props);
 await page.waitForFunction(()=>!document.body.textContent.includes('Update serial number'));await click('Reports');
 await page.waitForFunction(()=>document.body.textContent.includes('Shared reports · latest asset information'));
 for(const label of ['Asset valuation','Maintenance report','Fuel report','Depreciation log','Cost of ownership','Asset map'])assert(await page.evaluate(t=>document.querySelector('[data-download-dialog]').textContent.includes(t),label));
 await click('Asset valuation');await page.waitForFunction(()=>document.body.textContent.includes('Choose export format'));
 assert(!await page.evaluate(()=>document.body.textContent.includes('Choose report timeline')));await page.keyboard.press('Escape');
 await page.setViewport({width:1440,height:900});
 await page.addScriptTag({content:'window.fixtureRoot.render(React.createElement(require("components/business-network/BusinessListingInvite").default,{sendLink:true,assetIds:["10000000-0000-4000-8000-000000000001"],reportAssets:[{id:"10000000-0000-4000-8000-000000000001",title:"2023 Toyota Hilux"}]}));'});
 await page.waitForSelector('[data-asset-link-dialog]');
 const box=await page.$eval('[data-asset-link-dialog]',node=>({width:node.getBoundingClientRect().width,x:node.getBoundingClientRect().x,scrollHeight:node.scrollHeight,height:node.clientHeight,text:node.textContent}));
 assert.equal(Math.round(box.width),1280);assert.equal(Math.round(box.x),80);assert(box.scrollHeight<=box.height+1,'Settings fit without scrolling');
 assert(box.text.includes('Asset link settings'));assert(box.text.includes('2023 Toyota Hilux'));assert(box.text.includes('Asset photos are included.'));
 assert.equal(await page.$$eval('[data-asset-link-dialog] input:checked:disabled',nodes=>nodes.length),0,'Report permissions are selectable');
 assert.equal(await page.$$eval('[data-asset-link-dialog] [data-permission-grid] input:checked',nodes=>nodes.length),0,'Permissions start off');
 await page.click('[data-asset-link-dialog] input[type=checkbox]');
 assert.equal(await page.$$eval('[data-asset-link-dialog] [data-permission-grid] input:checked',nodes=>nodes.length),11,'Select all enables all settings');
 await page.click('[data-asset-link-dialog] input[type=checkbox]');
 assert(!box.text.includes('Attach reports'));
 await page.screenshot({path:'/tmp/asset-link-settings.png'});
 await click('Share read-only');await page.waitForSelector('dialog[open]');
 assert(await page.evaluate(()=>document.querySelector('dialog').textContent.includes('Before you share')));
 await page.evaluate(()=>window.fixtureRoot.render(React.createElement(require('components/SharedEnquiryLanding').default,{returnTo:'/asset-share/'+ 'a'.repeat(43)+'?open=1',access:'verify-email',prompt:true,summary:{senderName:'Example farm',assetCount:1,assetTitles:['Tractor'],umbrellaName:''}})));
 await page.waitForFunction(()=>document.querySelector('dialog[open]')?.textContent.includes('Verify your email'));
 const gate=await page.$eval('dialog[open]',node=>({scroll:node.scrollHeight,height:node.clientHeight,width:node.getBoundingClientRect().width,heading:node.querySelector('h2').getBoundingClientRect().height}));
 assert(gate.scroll<=gate.height+1);assert(gate.width>=700);assert(gate.heading<40,'Heading fits on one line');
 await click('Resend verification email');await page.waitForFunction(()=>document.body.textContent.includes('Verification email sent'));
 assert(await page.evaluate(()=>window.requests.some(request=>request.url==='/api/shared-account/verification')));
 await page.screenshot({path:'/tmp/shared-email-verification.png'});
 await page.evaluate(()=>window.fixtureRoot.render(React.createElement(require('app/business/join/business-signup').default,{returnTo:null})));
 await page.waitForFunction(()=>document.body.textContent.includes('Choose your access'));
 await page.screenshot({path:'/tmp/shared-account-choice.png'});
 await page.evaluate(()=>{
   function Fixture(){const [value,setValue]=React.useState('good');return React.createElement(require('components/leads/LeadActionDialog').default,{title:'Update asset',assetTitle:'2023 Toyota Hilux',onClose:()=>{window.dropdownDialogClosed=true;}},React.createElement(require('components/AssetConditionPicker').default,{value,onChange:setValue}));}
   window.fixtureRoot.render(React.createElement(Fixture));
 });
 await page.waitForSelector('[aria-label="Condition"][aria-haspopup="listbox"]');
 await page.click('[aria-label="Condition"][aria-haspopup="listbox"]');
 await page.waitForSelector('[role="listbox"]');
 assert.equal(await page.$$eval('select',nodes=>nodes.length),0,'Condition uses a styled picker');
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 assert(await page.$eval('[aria-label="Condition"][aria-haspopup="listbox"]',node=>node.textContent.includes('Fair')));
 await page.click('[aria-label="Condition"][aria-haspopup="listbox"]');await page.waitForSelector('[role="listbox"]');await page.keyboard.press('Escape');
 assert(!await page.evaluate(()=>window.dropdownDialogClosed),'Escape closes only the condition list');
 await page.evaluate(()=>{
  window.problemItems=[];window.problemWrites=[];
  window.fetch=async(url,options)=>{
    if(options?.method==='POST'){
      const body=JSON.parse(options.body);window.problemWrites.push(body);
      if(body.action==='log')window.problemItems=[{id:'10000000-0000-4000-8000-000000000003',assetRegisterItemId:'asset',note:body.note,summary:'Hydraulic leak',operatorName:'Dealer',createdAtIso:'2026-10-03T10:00:00Z',notedAtIso:null}];
      else window.problemItems=window.problemItems.map(item=>({...item,notedAtIso:'2026-10-03T11:00:00Z'}));
    }
    return {ok:true,json:async()=>({items:window.problemItems})};
  };
  window.fixtureRoot.render(React.createElement(require('components/leads/SharedProblems').default,{endpoint:'/api/test/problems',assetTitle:'2023 Toyota Hilux',canWrite:true,onClose:()=>{}}));
 });
 await click('Log problem');await page.waitForSelector('textarea');await page.type('textarea','Hydraulic leak');await click('Save problem');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent==='Resolved'));
 await click('Resolved');await page.waitForFunction(()=>document.body.textContent.includes('Are you sure this problem is resolved?'));
 assert.equal(await page.evaluate(()=>window.problemWrites.length),1,'Opening confirmation does not resolve');
 await click('Cancel');await click('Resolved');await click('Yes, resolved');
 await page.waitForFunction(()=>window.problemWrites.length===2);
 assert(await page.evaluate(()=>window.problemWrites[1].confirmed===true));
 await page.screenshot({path:'/tmp/shared-problems-resolved.png'});
 console.log('PASS: shared dialogs, correction endpoint/stable asset ID, Escape return, report link, documents, verification gate and hidden permissions');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
