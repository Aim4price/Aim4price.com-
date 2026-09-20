/* Real Admin components with synthetic APIs. No production authentication or mutations. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
let cssIndex=0;
const stubs={
 'lib/account-access':'exports.requireAdminPageAccess=async()=>{};',
 'lib/admin-dashboard':'exports.getAdminDashboardStats=async()=>window.fixtureDashboard;',
};
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
const entries={
 accounts:'app/admin/admin-client', businesses:'app/admin/businesses/businesses-client', dashboard:'app/admin/dashboard/page',
 valuations:'app/admin/valuations/admin-valuations-client', marketplace:'app/admin/marketplace/admin-marketplace-client',
 'asset-map':'app/admin/asset-map/admin-asset-map-client', discovery:'app/admin/discovery/admin-discovery-client',
 outcomes:'app/admin/sold-assets/admin-marketplace-outcomes-client', 'asset-outcomes':'app/admin/sold-assets/sold-assets-client',
 'work-tracker':'app/admin/work-tracker/work-tracker-client', 'capture-queue':'app/admin/capture-queue/capture-queue-client',
 lifecycle:'app/admin/lifecycle-calculator/lifecycle-calculator-client', maintenance:'app/admin/maintenance-catalogue/maintenance-catalogue-client',
};
Object.values(entries).forEach(add);
add('components/AdminNavigation');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';
const now='2026-09-20T10:00:00Z';
const user={userId:'owner',name:'Example Agricultural Equipment and Orchard Management',email:'accounts@example.test',phone:'0821234567',accountType:'owner',accountSubtype:'farmer',province:'Western Cape',introducedBy:'Direct',introducedByOption:'direct',introducedByName:'',accountStatus:'active',accountStatusLabel:'Active',passwordStatus:'Set',lastActiveAtIso:now,createdAtIso:now,storageBytes:197000000,storageLabel:'197 MB',storageGigabytesLabel:'0.2 GB',storageFileCount:378,postgresStorageBytes:0,postgresStorageLabel:'0 B',bucketStorageBytes:197000000,bucketStorageLabel:'197 MB'};
const asset={id:'one',ownerUserId:'owner',registerId:'register',registerLabel:'Farm equipment',title:'2022 New Holland TT4.90 4WD Openstation Small Field Tractor',kind:'tractor',assetTypeLabel:'Small Field Tractor',sectorKey:'agricultural',sectorLabel:'Agriculture',value:327133,hasSavedValue:true,selectedMethod:'basic',brandName:'New Holland',modelName:'TT4.90',typedModelName:'',yearModel:2022,hours:1250,lifeWorkedPercent:null,usageMetric:'hours',condition:'good',serialNumber:'SERIAL-123',registrationNumber:'',publicAssetCode:'ABC123',plateLabel:'',qrStatus:'active',lifecycleState:'active',lastScannedAtIso:null,lastKnownLat:null,lastKnownLng:null,lastKnownLocationText:'George',createdAtIso:now,updatedAtIso:now,totalViews:8,accountViews:5,unknownViews:3,uniqueViewers:3,lastViewedAtIso:now,repeatViewerViews:4,repeatViewerLabel:'Example Buyer',repeatViewerAccountType:'owner',repeatViewerLastViewedAtIso:now,hasRepeatInterest:true,owner:{...user,label:user.name,businessName:user.name,townCity:'George',addressLine1:'',addressLine2:'',discoveryParticipationEnabled:true}};
const summary={totalAssets:3,mappedAssets:0,missingLocationAssets:3,ownerAccounts:1,totalValueExVat:981399,valuedAssets:3,missingValueAssets:0,discoveryEnabledAssets:3,discoveryDisabledAssets:0,totalViews:24,accountViews:15,unknownViews:9,viewedAssets:3,repeatInterestAssets:3};
const options={owners:[{value:'owner',label:user.name,count:3}],provinces:[{value:'Western Cape',label:'Western Cape',count:3}],sectors:[{value:'agricultural',label:'Agriculture',count:3}],lifecycleStates:[{value:'active',label:'Active',count:3}]};
const filters={search:'',ownerUserId:'',province:'',sector:'',participation:'all',location:'all',interest:'all',lifecycleState:'',sort:'updated',page:1,pageSize:50,focusAssetId:''};
const pagination={page:1,pageSize:50,totalItems:3,totalPages:1,hasPreviousPage:false,hasNextPage:false};
const discovery={generatedAtIso:now,assets:[0,1,2].map(i=>({...asset,id:'asset-'+i})),summary,options,filters,pagination};
const market={assetKey:'asset:one',sourceAssetId:'one',latestListingId:'listing-one',accountUserId:'owner',title:asset.title,description:'Low-hour tractor',status:'live',askingPriceExVat:327133,sellerLabel:user.name,sellerName:'Example',sellerCompany:user.name,sellerEmail:user.email,province:'Western Cape',area:'George, Western Cape',sectorKey:'agricultural',sectorLabel:'Agriculture',familyLabel:'Small Field Tractor',brandName:'New Holland',modelName:'TT4.90',firstAdvertisedAtIso:now,lastAdvertisedAtIso:now,listingEvents:1,totalViews:8,accountViews:5,unknownViews:3,uniqueViewers:3,lastViewedAtIso:now,repeatViewerViews:4,repeatViewerLabel:'Example Buyer',repeatViewerAccountType:'owner',repeatViewerLastViewedAtIso:now,hasRepeatInterest:true};
const valuation={id:'estimate:1',sourceId:'1',recordType:'estimate',valuationMode:'generic',source:'basic',createdAtIso:now,account:{...asset.owner,known:true},asset:{sectorKey:'agricultural',sectorLabel:'Agriculture',familyKey:'small-field-tractor',familyLabel:'Small Field Tractor',brandName:'New Holland',modelName:'TT4.90',yearModel:2022,condition:'good',usageAmount:1250,usageUnit:'hours'},estimate:{selectedValueExVat:327133,lowValueExVat:300000,midValueExVat:327133,highValueExVat:350000,replacementPriceExVat:600000,confidenceLabel:''},input:{},output:{}};
const valuations={generatedAtIso:now,valuations:[valuation],summary:{totalValuations:1,estimateEvents:1,savedValuations:0,knownAccountValuations:1,unknownAccountValuations:0,uniqueAccounts:1,valuedValuations:1},options:{sectors:options.sectors,years:[]},filters:{search:'',recordType:'all',valuationMode:'all',account:'all',sector:'',period:'all',sort:'latest',page:1,pageSize:50},pagination:{...pagination,totalItems:1}};
const outcome={outcomeId:'outcome',listingId:'listing-one',sourceAssetId:'one',accountUserId:'owner',sellerLabel:user.name,sellerEmail:user.email,title:asset.title,sectorKey:'agricultural',sectorLabel:'Agriculture',reason:'created_by_mistake',outcomeNote:'',aim4priceHelped:false,finalSalePriceExVat:null,askingPriceExVat:327133,aim4priceValueExVat:327133,totalViewsAtClose:8,accountViewsAtClose:5,unknownViewsAtClose:3,uniqueViewersAtClose:3,sourceSurface:'marketplace',publishedAtIso:now,closedAtIso:now,actorType:'owner'};
const titles={accounts:'Accounts',businesses:'Business Directory',dashboard:'Dashboard',valuations:'Valuations',marketplace:'Marketplace','asset-map':'Asset Map',discovery:'Discovery',outcomes:'Outcomes','asset-outcomes':'Asset register outcomes','work-tracker':'Work tracker','capture-queue':'Capture Queue',lifecycle:'Lifecycle Model',maintenance:'Maintenance checklists'};
const props={accounts:{initialUsers:[user,{...user,userId:'two',name:'Example Dealer',accountType:'dealer',accountSubtype:'equipment_middleman',accountStatus:'pending_payment',accountStatusLabel:'Pending payment',email:'dealer@example.test'}]},marketplace:{report:{assets:[market,{...market,assetKey:'asset:two',title:'3 Ton Tip Trailer',hasRepeatInterest:false}],generatedAtIso:now}},discovery:{initialReport:discovery},'asset-map':{initialReport:discovery},valuations:{initialReport:valuations},outcomes:{report:{outcomes:[outcome]}},'asset-outcomes':{report:{outcomes:[]},allocationAccounts:[]},'work-tracker':{initialClients:[user]}};
const catalogue={version:1,profiles:[{key:'tractor',label:'Tractor checklist',items:[{id:'oil',label:'Engine oil',checkLabel:'Check oil',serviceLabel:'Change oil',description:'Check with engine stopped.'}]}],families:[{source:'basic',sector:'agricultural',familyKey:'small-field-tractor',label:'Small Field Tractor',profileKey:'tractor'}]};
const capture={id:'request-one',publicReference:'INV-TEST',requestType:'invoice',submissionChannel:'owner_upload',status:'in_progress',senderDisplayName:'Example Sender',ownerDisplayName:user.name,assetDisplayName:asset.title,assetReference:'ABC123',fuelStorageDisplayName:'',assignedAdminDisplayName:'Admin',submittedAtIso:now,dueAtIso:'2026-09-22T10:00:00Z',updatedAtIso:now,version:1,fileCount:0,ownerUserId:'owner',assetId:'one',fuelStorageId:'',senderEmail:'sender@example.test',senderPhone:'',senderBusinessName:'',senderNote:'',adminNote:'',needsInformationReason:'',candidatePayload:{},capturedPayload:{usageMetric:'hours',usageReading:'1250'}};
const evidence=path.join(root,'.next/admin-review-validation');
(async()=>{
 fs.mkdirSync(evidence,{recursive:true});
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu"],headless:true,pipe:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let failBusiness=false,failReport=false,captureMode=false;
  await page.setRequestInterception(true);
  page.on('request',request=>{
   const url=request.url(),respond=(body,status=200)=>request.respond({status,contentType:'application/json',body:JSON.stringify(body)});
   if(url.includes('/api/admin/business-network'))return failBusiness?respond({error:'Directory unavailable'},503):respond({businesses:[]});
   if(url.includes('/api/admin/maintenance-catalogue'))return respond({catalogue});
   if(url.includes('/api/admin/capture-assistance'))return respond({rows:[],total:0,pending:0});
   if(captureMode && url.includes('/api/admin/capture-requests/request-one'))return respond({ok:true,request:capture,files:[],events:[{id:'match',eventType:'matched',metadata:{ownerUserId:'owner',assetId:'one',fuelStorageId:''}}],matchedTarget:{targetType:'asset',ownerUserId:'owner',ownerDisplayName:user.name,targetId:'one',targetDisplayName:asset.title,reference:'ABC123',meta:'Tractor',assetUsageMetric:'hours',assetUsageReading:1250}});
   if(url.includes('/api/admin/capture-requests'))return respond({ok:true,requests:captureMode?[capture]:[],counts:{}});
   if(url.includes('/api/admin/work-tracker'))return respond({ok:true,activeSession:null,history:{startIso:'2026-09-14T00:00:00Z',endIso:'2026-09-21T00:00:00Z',sessions:[]}});
   if(url.includes('/api/admin/discovery'))return failReport?respond({error:'Report unavailable'},503):respond({ok:true,report:discovery});
   if(url.includes('/api/admin/valuations'))return failReport?respond({error:'Report unavailable'},503):respond({ok:true,report:valuations});
   if(url.startsWith('https://admin.test/'))return request.respond({contentType:'text/html',body:'<html><body></body></html>'});
   if(url.startsWith('data:'))return request.continue();
   return request.abort();
  });
  async function open(section,width=1440){
   errors.length=0;
   await page.setViewport({width,height:1000});await page.goto('https://admin.test/');
   const font=fs.readFileSync(path.join(root,'public/field-manager/montserrat-latin.woff')).toString('base64');
   await page.setContent('<style>@font-face{font-family:Montserrat;src:url(data:font/woff;base64,'+font+')}*{box-sizing:border-box}body{margin:0;font:16px Montserrat,Arial,sans-serif;color:#14392e;background:#f5f8f6;--modal-backdrop-color:rgba(10,30,23,.5);--modal-backdrop-filter:blur(6px)}button,input,select{font:inherit}'+sheets.join('\n')+'\n'+fs.readFileSync(path.join(root,'app/admin/admin-foundation.css'),'utf8')+'</style><div id="app" class="adminWorkspaceRoot"></div>');
   await page.evaluate(()=>{window.fixtureDashboard={cards:['free-estimates','paid-estimates','total-assets-saved','total-accounts-created','owner-accounts-created','average-user-time','marketplace-advertised'].map(id=>({id,title:id,values:[{label:'This month',value:'12'},{label:'This year',value:'54'}]})),storage:{sources:[],customerUsage:{accountCountLabel:'4',averageLabel:'20 MB',medianLabel:'12 MB',p90Label:'100 MB',addedLast30DaysLabel:'10 MB',pendingBucketUploadsLabel:'0',failedBucketUploadsLabel:'0'}}};});
   await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
   const ownShell=['accounts','businesses','dashboard','work-tracker','maintenance'].includes(section);
   const cssFile=section==='outcomes'||section==='asset-outcomes'?'sold-assets':section==='lifecycle'?'lifecycle-calculator':section;
   const wrapper=ownShell?'child':`React.createElement("main",{className:styles.page},React.createElement("section",{className:styles.shell},React.createElement("header",{className:styles.topBar},React.createElement("div",{className:styles.titleBlock},React.createElement("h1",null,${JSON.stringify(titles[section])})),React.createElement(require("components/AdminNavigation").default,{active:${JSON.stringify(section)}})),child))`;
   await page.addScriptTag({content:runtime+`; (async()=>{const Component=require(${JSON.stringify(entries[section])}).default;const child=${section==='dashboard'?'await Component()':`React.createElement(Component,${JSON.stringify(props[section]||{})})`};const styles=${ownShell?'{}':`require("app/admin/${cssFile}/page.module.css")`};ReactDOM.createRoot(document.getElementById("app")).render(${wrapper});})().catch(error=>{window.renderError=error.message;});`});
   await page.waitForSelector('h1');
   await page.evaluate(()=>document.fonts.ready);
   assert.deepEqual(errors,[],section+' runtime');
  }
  for(const section of Object.keys(entries)){
   await open(section);
   if(section==='maintenance')await page.waitForFunction(()=>document.body.textContent.includes('Small Field Tractor'));
   if(section==='capture-queue')await page.waitForFunction(()=>document.body.textContent.includes('No documents to capture'));
   if(section==='businesses')await page.waitForFunction(()=>document.body.textContent.includes('No businesses added yet'));
   await page.screenshot({path:path.join(evidence,section+'-1440.png'),fullPage:true});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
   assert.equal(overflow,false,section+' page must contain its horizontal scrolling');
   console.log('PASS render and page width: '+section);
  }
  for(const width of [980,1920])for(const section of ['accounts','marketplace','discovery','valuations','maintenance']){
   await open(section,width);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,section+' '+width);
   await page.screenshot({path:path.join(evidence,section+'-'+width+'.png'),fullPage:true});
  }
  await open('accounts');
  await page.click('button[aria-haspopup="dialog"]');await page.waitForSelector('[role="dialog"]');
  assert.equal(await page.$$eval('[aria-label="Admin navigation"] a',els=>els.length),12);
  await page.keyboard.press('Escape');assert.equal(await page.$('[role="dialog"]'),null);
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-haspopup')),'dialog');
  console.log('PASS 12-section navigation, Escape and focus restoration');
  failBusiness=true;await open('businesses');await page.waitForSelector('[role="alert"]');
  assert.equal(await page.evaluate(()=>document.body.textContent.includes('No businesses added yet')),false);
  failBusiness=false;await page.$$eval('button',els=>els.find(e=>e.textContent==='Try again').click());
  await page.waitForFunction(()=>document.body.textContent.includes('No businesses added yet'));
  console.log('PASS directory failure and retry');
  failReport=true;
  for(const section of ['discovery','valuations']){
   await open(section);
   await page.type('input[type="search"]','No match');
   await page.keyboard.press('Enter');await page.waitForSelector('[role="alert"]');
   assert.equal(await page.$eval('input[type="search"]',e=>e.value),'');
   assert.ok(await page.$('tbody tr'));
  }
  console.log('PASS failed report filters restore the displayed report filters');
  await open('maintenance');await page.waitForFunction(()=>document.body.textContent.includes('Small Field Tractor'));
  await page.$$eval('button',els=>els.find(e=>e.textContent.includes('Small Field Tractor')).click());
  await page.waitForSelector('input[value="Tractor checklist"]');
  await page.type('input[value="Tractor checklist"]',' updated');
  await page.click('button[aria-haspopup="dialog"]');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.click('a[href="/admin"]');
  assert.ok(await page.$('input[value="Tractor checklist updated"]'),'cancelled navigation preserves unsaved edits');
  console.log('PASS checklist discard confirmation preserves edits');
  // Dismiss the existing dirty page before opening the next isolated fixture.
  page.once('dialog',dialog=>dialog.accept());
  captureMode=true;await open('capture-queue');
  await page.waitForFunction(()=>document.body.textContent.includes('INV-TEST'));
  await page.$$eval('button',els=>els.find(e=>e.textContent.includes('INV-TEST')).click());
  await page.waitForSelector('[aria-label="Asset usage update"]');
  const usageInput=await page.evaluateHandle(()=>[...document.querySelectorAll('label')].find(e=>e.querySelector('span')?.textContent==='Usage reading').querySelector('input'));
  const updateDisabled=()=>page.$$eval('button',els=>els.find(e=>e.textContent.trim()==='Update hours').disabled);
  assert.equal(await updateDisabled(),true);
  await usageInput.click({clickCount:3});await usageInput.type('1300');
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='Update hours'&&!e.disabled));
  await usageInput.click({clickCount:3});await usageInput.type('1200');
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='Update hours'&&e.disabled));
  console.log('PASS invoice usage edits immediately enable valid increases and block lower readings');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
