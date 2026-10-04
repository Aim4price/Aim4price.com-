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
add('components/asset-register/ShareLinkSettings');
add('app/account/page.module.css');
add('components/asset-register/SharedAssetCards');
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
 // Both lead layouts must close from the visible outside layer, never from card content.
 for (const ownerLayout of [false,true]) {
  if (!ownerLayout) await page.addScriptTag({content:runtime+'window.fixtureRoot??=ReactDOM.createRoot(document.getElementById("app"));'});
  await page.evaluate(ownerLayout=>{window.outsideCloseCount=0;window.fixtureRoot.render(React.createElement(require('components/leads/LeadManageDialog').default,{title:'Outside click check',description:'Asset',ownerLayout,onClose:()=>window.outsideCloseCount++},React.createElement('button',null,'Inside card')))},ownerLayout);
  await page.waitForSelector('[role="dialog"]');
  await page.click('[role="dialog"] button');assert.equal(await page.evaluate(()=>window.outsideCloseCount),1,'Close button closes');
  await page.click('[role="dialog"] h3');assert.equal(await page.evaluate(()=>window.outsideCloseCount),1,'Card content stays open');
  await page.$eval('[role="dialog"]',node=>node.parentElement.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  assert.equal(await page.evaluate(()=>window.outsideCloseCount),2,'Overlay closes');
  await page.mouse.click(3,3);assert.equal(await page.evaluate(()=>window.outsideCloseCount),3,'Visible outside area closes once');
 }
 const props={token:'a'.repeat(43),assetId:'10000000-0000-4000-8000-000000000001',assetIndex:0,assetTitle:'John Deere 6155M',serialNumber:'OLD-123',replacementPrice:900000,permissions:{serialNumber:true,replacementPrice:true,documents:true,reports:true},access:'active',reports:[{id:'report-1',label:'Asset valuation'}]};
 await page.addScriptTag({content:'window.renderFixture=(props)=>{window.fixtureRoot??=ReactDOM.createRoot(document.getElementById("app"));window.fixtureRoot.render(React.createElement(require("components/leads/LeadManageDialog").default,{title:props.assetTitle,description:"Year Model: 2022 • Usage: 1 300 hours • Condition: Good",onClose:()=>{}},React.createElement(require("components/asset-register/ExternalLeadActions").default,{...props,key:props.access+JSON.stringify(props.permissions)})));};window.renderFixture('+JSON.stringify(props)+');'});
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
 await page.evaluate(p=>window.renderFixture({...p,permissions:{serialNumber:false,replacementPrice:false,updateDetails:true,addPhotos:true,location:true,addMaintenance:true,maintenanceSchedules:true,loggedProblems:true,addCosts:true,suggestValue:true,reports:true}}),props);
 await page.waitForSelector('[data-manage-action="details"]');
 assert.deepEqual(await page.$$eval('[data-manage-actions] > button',nodes=>nodes.map(n=>n.dataset.manageAction)),['history','details','reports','addPhotos','location','addMaintenance','maintenanceSchedules','loggedProblems','addCosts','suggestValue']);
 assert.notEqual(await page.$eval('[data-manage-action="details"]',n=>getComputedStyle(n).backgroundImage),await page.$eval('[data-manage-action="addCosts"]',n=>getComputedStyle(n).backgroundImage),'Action groups have distinct subtle colours');
 await page.screenshot({path:'/tmp/shared-manage-colours.png'});
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
 assert.equal(await page.$$eval('[data-asset-link-dialog] [data-permission-grid] input:checked',nodes=>nodes.length),12,'Select all enables all settings');
 await page.click('[data-asset-link-dialog] input[type=checkbox]');
 assert(!box.text.includes('Attach reports'));
 await page.screenshot({path:'/tmp/asset-link-settings.png'});
 await click('Share read-only');await page.waitForSelector('dialog[open]');
 assert(await page.evaluate(()=>document.querySelector('dialog').textContent.includes('Before you share')));
 // Existing link settings must round-trip the current-value permission.
 await page.evaluate(()=>{
  window.previousFetch=window.fetch;
  window.fetch=async(url,options)=>{const body=JSON.parse(options.body);window.savedLink=body;return {ok:true,json:async()=>({permissions:body.permissions})};};
  window.renderLinkSettings=(permissions)=>window.fixtureRoot.render(React.createElement(require('components/asset-register/ShareLinkSettings').default,{key:JSON.stringify(permissions),token:'a'.repeat(43),subject:'2022 New Holland TT4.90 4WD Openstation',initialPermissions:permissions,onClose:()=>{},onSaved:permissions=>{window.savedPermissions=permissions;}}));
  window.renderLinkSettings({suggestValue:false});
 });
 await page.waitForFunction(()=>document.querySelector('[data-asset-link-dialog]')?.textContent.includes('Save changes'));
 const toggleValue=()=>page.$$eval('[data-permission-grid] label',nodes=>nodes.find(node=>node.textContent.includes('Suggest current value')).click());
 const valueChecked=()=>page.$$eval('[data-permission-grid] label',nodes=>nodes.find(node=>node.textContent.includes('Suggest current value')).querySelector('input').checked);
 await toggleValue(); assert.equal(await valueChecked(),true,'Value permission responds to a card click');
 await click('Save changes');await page.waitForFunction(()=>window.savedPermissions?.suggestValue===true);
 assert.equal(await page.evaluate(()=>window.savedLink.permissions.suggestValue),true);
 await page.evaluate(()=>window.renderLinkSettings(window.savedPermissions));
 await page.waitForSelector('[data-permission-grid]');assert.equal(await valueChecked(),true,'Saved value permission loads checked');
 const geometry=await page.$$eval('[data-permission-grid] label',nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(),i=node.querySelector('input').getBoundingClientRect();return Math.abs((r.top+r.height/2)-(i.top+i.height/2));}));
 assert(geometry.every(offset=>offset<1),'Checkboxes are vertically centred in each card');
 await page.screenshot({path:'/tmp/asset-link-settings-edit.png'});
 await toggleValue();await click('Save changes');await page.waitForFunction(()=>window.savedPermissions?.suggestValue===false);
 await page.evaluate(()=>{window.fetch=window.previousFetch;});
 // Owner map uses the same editor, with its real owner wrapper classes.
 await page.evaluate(()=>{
  const s=require('app/asset-register/page.module.css'),a=require('app/account/page.module.css');
  window.renderOwnerLocation=(location)=>window.fixtureRoot.render(React.createElement('div',{className:s.modalOverlay},React.createElement('section',{role:'dialog',className:[s.modalCard,s.assetSettingsModal,s.managementAccountModal,s.assetSettingsSubModal,s.assetSettingsLocationModal,s.assetSettingsMapEntryModal,a.modalTheme].join(' ')},React.createElement('header',{className:s.modalHeader+' '+s.assetSettingsHeader},React.createElement('div',{className:s.modalHeaderText},React.createElement('h3',null,'Map asset'),React.createElement('p',null,'2022 Test tractor')),React.createElement('button',{className:a.modalCloseButton+' '+a.passwordModalCloseButton,'aria-label':'Close map asset'},'×')),React.createElement('div',{className:s.modalScrollBody+' '+s.assetSettingsBody},React.createElement(require('components/AssetLocationEditor').default,{key:JSON.stringify(location),location,viewMapHref:'/asset-map?assetId=test',onSave:async value=>{window.ownerLocationSaved=value;}})))));
  window.renderOwnerLocation({latitude:null,longitude:null,locationText:''});
 });
 await page.waitForFunction(()=>document.querySelector('[role="dialog"]')?.textContent.includes('No location saved yet.'));
 const ownerMap=await page.$eval('[role="dialog"]',n=>{const buttons=[...n.querySelectorAll('button')].filter(b=>!b.getAttribute('aria-label')),r=n.getBoundingClientRect();return {width:r.width,scroll:n.scrollHeight>n.clientHeight+1,tops:buttons.map(b=>b.getBoundingClientRect().top)};});
 assert.equal(Math.round(ownerMap.width),1050);assert.equal(ownerMap.scroll,false);assert(ownerMap.tops.every(top=>Math.abs(top-ownerMap.tops[0])<1),'Owner location choices share one row');
 await page.screenshot({path:'/tmp/owner-location-choices.png'});
 await click('Enter coordinates');await page.waitForSelector('input[placeholder="-33.924869"]');
 await page.type('input[placeholder="-33.924869"]','-34');await page.type('input[placeholder="18.424055"]','22');await click('Save location');await page.waitForFunction(()=>window.ownerLocationSaved?.latitude===-34);
 await page.waitForSelector('a[href="/asset-map?assetId=test"]');
 assert.equal(await page.$eval('a[href="/asset-map?assetId=test"]',n=>n.textContent),'View on asset map');
 await page.evaluate(()=>window.fixtureRoot.render(React.createElement(require('components/asset-register/SharedAssetCards').default,{share:{createdAt:'2026-10-04',assets:[{assetId:'10000000-0000-4000-8000-000000000001',title:'Test tractor',yearModel:2022,usage:'1 300 hours',condition:'Good',serialNumber:'SERIAL-1',photoUrls:[],valueExVat:200000,replacementPriceExVat:400000}]}})));
 await page.waitForSelector('[aria-label="Open Test tractor"]');await page.click('[aria-label="Open Test tractor"]');await page.click('[aria-label="Manage Test tractor"]');
 assert.equal(await page.$eval('[aria-label="Close lead management"]',n=>n.closest('[role="dialog"]').querySelector('header p').textContent),'Year Model: 2022 • Usage: 1 300 hours • Condition: Good');
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
 // A closed lead only shows the problem tint. Opening reveals the owner-style notice.
 await page.evaluate(()=>{
  window.problemItems=[{id:'10000000-0000-4000-8000-000000000004',note:'Rear light is not working.',summary:'Issue reported',operatorName:'George',createdAtIso:'2026-10-03T10:00:00Z',notedAtIso:null}];
  const s=require('app/leads/page.module.css');
  function ProblemLeadFixture(){
   const [open,setOpen]=React.useState(false);
   return React.createElement('main',{className:s.leadsPage},React.createElement('article',{className:s.leadThread,'data-test-problem-lead':true},React.createElement('h3',null,'2023 Toyota Hilux'),React.createElement('button',{onClick:()=>setOpen(!open)},open?'Close lead':'Open lead'),React.createElement(require('components/leads/SharedProblems').default,{endpoint:'/api/test/problems',assetTitle:'2023 Toyota Hilux',notesOnly:true,detailsVisible:open})));
  }
  window.fixtureRoot.render(React.createElement(ProblemLeadFixture));
 });
 await page.waitForSelector('[data-open-problems]');
 assert.equal(await page.evaluate(()=>document.body.textContent.includes('Rear light is not working.')),false,'Closed lead hides problem details');
 assert.equal(await page.evaluate(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Resolved')),false);
 const problemTint=await page.$eval('[data-test-problem-lead]',el=>getComputedStyle(el).backgroundImage);
 await click('Open lead');
 await page.waitForFunction(()=>document.body.textContent.includes('Open issue reported'));
 assert(await page.evaluate(()=>document.body.textContent.includes('By George')));
 await page.screenshot({path:'/tmp/lead-problem-open.png'});
 await click('Resolved');await click('Yes, resolved');
 await page.waitForFunction(()=>!document.querySelector('[data-open-problems]'));
 assert.notEqual(await page.$eval('[data-test-problem-lead]',el=>getComputedStyle(el).backgroundImage),problemTint,'Resolving the last problem clears the red tint');
 // Fact shortcuts keep all nine facts visible while enforcing edit permissions.
 await page.evaluate(()=>{
  window.fetch=async(url)=>({ok:true,json:async()=>String(url).endsWith('/paperwork')?{kind:'tractor',draft:{financeStatus:'no',insuranceStatus:'no',licenseStatus:'no'}}:String(url).endsWith('/location')?{location:{latitude:null,longitude:null,locationText:''}}:{asset:{id:'asset',title:'Test tractor',kind:'tractor',yearModel:2022,usageReading:1300,usageMetric:'hours',condition:'good'},permissions:{updateDetails:true,yearModel:true,usage:true,condition:true}}});
  window.renderFacts=(permissions)=>window.fixtureRoot.render(React.createElement(require('components/leads/SharedAssetFacts').default,{assetTitle:'Test tractor',serial:'ABC123',year:2022,usage:'1 300 hours',condition:'Good',replacementPrice:475000,statuses:{finance:'No',insurance:'Yes',license:'Yes',location:'No'},permissions,endpoint:'/api/asset-leads/test',sourceId:'test'}));
  window.renderFacts({});
 });
 await page.waitForFunction(()=>document.body.textContent.includes('Mapped'));
 assert.equal(await page.$$eval('button[aria-label^="Edit "]',els=>els.length),0,'No permission means plain facts, not edit buttons');
 for(const label of ['Serial','Year','Usage','Condition','Replacement Price','Financed','Insured','Licensed','Mapped'])assert(await page.evaluate(label=>document.body.textContent.includes(label),label));
 await page.evaluate(()=>window.renderFacts({serial:true,year:true,usage:true,condition:true,replacement:true,finance:true,insurance:true,license:true,location:true}));
 await page.waitForFunction(()=>document.querySelectorAll('button[aria-label^="Edit "]').length===9);
 await page.screenshot({path:'/tmp/shared-fact-shortcuts.png'});
 for(const [label,field] of [['year','year'],['usage','usage'],['condition','condition']]){
  await page.click(`button[aria-label="Edit ${label} for Test tractor"]`);
  await page.waitForFunction(field=>document.activeElement?.closest(`[data-asset-detail-edit-target="${field}"]`),{},field);
  await page.keyboard.press('Escape');
 }
 for(const [label,heading] of [['serial','Update serial number'],['replacement price','Update replacement price'],['mapped','Asset location']]){
  await page.click(`button[aria-label="Edit ${label} for Test tractor"]`);
  await page.waitForFunction(heading=>document.body.textContent.includes(heading),{},heading);
  await page.keyboard.press('Escape');
 }
 for(const [label,section] of [['financed','finance'],['insured','insurance'],['licensed','license']]){
  await page.click(`button[aria-label="Edit ${label} for Test tractor"]`);
  await page.waitForFunction(()=>document.body.textContent.includes('Back to paperwork'));
  assert(await page.evaluate(()=>Array.from(document.querySelectorAll('[role="tab"]')).some(tab=>tab.textContent==='Paperwork'&&tab.getAttribute('aria-selected')==='true')));
  await page.keyboard.press('Escape');
 }
 for (const [access,permissions,expected] of [['read-only',{},0],['active',{usage:true},1],['owner',{},9]]) {
  await page.evaluate(({access,permissions})=>window.fixtureRoot.render(React.createElement(require('components/asset-register/SharedAssetCards').default,{key:access,share:{createdAt:'2026-10-04',assets:[{assetId:'10000000-0000-4000-8000-000000000001',title:'2022 Test tractor',yearModel:2022,usage:'1 300 hours',condition:'Good',serialNumber:'ABC123',photoUrls:[],valueExVat:327133,replacementPriceExVat:475000,financeStatus:'no',insuranceStatus:'yes',licenseStatus:'unknown',mapped:false}]},enquiry:{token:'a'.repeat(43),access,permissions,reports:[]}})),{access,permissions});
  await click('Open');
  await page.waitForFunction(()=>document.body.textContent.includes('Mapped'));
  assert.equal(await page.$$eval('button[aria-label^="Edit "]',els=>els.length),expected,`${access} card respects field permissions`);
  if(access==='owner'){await page.addStyleTag({content:'*{animation:none!important;transition:none!important}button,input{font-family:inherit}'});await page.screenshot({path:'/tmp/shared-card-shortcuts.png'});}
 }
 console.log('PASS: shared dialogs, correction endpoint/stable asset ID, Escape return, report link, documents, verification gate and hidden permissions');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
