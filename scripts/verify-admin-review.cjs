/* Real Admin components with synthetic APIs. No production authentication or mutations. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
const sharedStyles=fs.readFileSync(path.join(root,'app/globals.css'),'utf8').replace(/@font-face\s*\{[^}]*\}/g,'');
// Exercise the same canvas and shared CSS shipped by the Admin layout.
const canonical=!process.env.ADMIN_NATIVE_QA;
if(canonical)process.env.ADMIN_WORKSPACE_QA='1';
let cssIndex=0;
const stubs={
 'lib/account-access':'exports.requireAdminPageAccess=async()=>({user:{id:"admin"}});',
 'components/AppPatternBackground':'exports.AppViewportBackground=()=>null;',
 'lib/db':'exports.getDb=()=>({query:async(q)=>({rows:q.includes("count(*)")?[{accepted:12,pending:0,review:0}]:[]})});',
 'lib/maintenance-email-delivery':'exports.ensureAssetEmailDelivery=async()=>{};exports.emailRollout=()=>({enabled:true});',
 'lib/sharing-admin':'exports.sharingAdminAccounts=async()=>[];',
 'lib/admin-attention':'exports.getAdminAttention=async()=>[{label:"Pending accounts",count:3,href:"/admin?status=pending_payment",description:"Review access before activating."},{label:"Overdue capture",count:5,href:"/admin/capture-queue?status=overdue",description:"Open requests past their deadline.",urgent:true},{label:"Unclaimed capture",count:2,href:"/admin/capture-queue?status=unassigned",description:"Open requests without an assigned admin."},{label:"Needs matching",count:1,href:"/admin/capture-queue?status=needs_matching",description:"Confirm the customer and destination."},{label:"Needs information",count:0,href:"/admin/capture-queue?status=needs_information",description:"Follow up on missing details."},{label:"Awaiting owner",count:2,href:"/admin/capture-queue?status=awaiting_owner",description:"Documents awaiting owner review."}];',
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
 billing:'app/admin/billing/billing-client', accounts:'app/admin/admin-client', dashboard:'app/admin/dashboard/page',
 valuations:'app/admin/valuations/admin-valuations-client', marketplace:'app/admin/marketplace/admin-marketplace-client',
 'asset-map':'app/admin/asset-map/admin-asset-map-client', discovery:'app/admin/discovery/admin-discovery-client',
 outcomes:'app/admin/sold-assets/admin-marketplace-outcomes-client', 'asset-outcomes':'app/admin/sold-assets/sold-assets-client',
 'work-tracker':'app/admin/work-tracker/work-tracker-client', 'capture-queue':'app/admin/capture-queue/capture-queue-client',
 lifecycle:'app/admin/lifecycle-calculator/lifecycle-calculator-client', maintenance:'app/admin/maintenance-catalogue/maintenance-catalogue-client',
};
if (process.env.ADMIN_WORKSPACE_QA) Object.assign(entries, {videos:'app/admin/videos/video-manager', 'asset-values':'app/admin/asset-values/values-client', 'annual-review':'app/admin/annual-review/annual-review-client'});
if(canonical)Object.assign(entries,{'asset-emails':'app/admin/asset-emails/page',sharing:'app/admin/sharing/page','ai-connect':'app/account/ai-connect/connection-view'});
if(process.env.ADMIN_OWNER_STYLE_QA){
 entries['select-probe']='test/AdminSelectProbe';
 modules['test/AdminSelectProbe']=`const React=require('react'),Select=require('components/AdminSelect').default;exports.default=()=>{const [value,setValue]=React.useState('0');return React.createElement('main',null,React.createElement('h1',null,'Selector validation'),React.createElement('label',null,'Account',React.createElement(Select,{value,onChange:e=>setValue(e.target.value)},Array.from({length:24},(_,i)=>React.createElement('option',{key:i,value:String(i),disabled:i===1},'Account '+i)))),React.createElement('button',{id:'after-select'},'Next action'),React.createElement('output',{'data-selected-value':true},value),React.createElement(Select,{disabled:true,'aria-label':'Unavailable'},React.createElement('option',null,'Unavailable')));};`;
}
Object.values(entries).forEach(add);
add('components/AdminNavigation');
add('components/AdminWorkspace');
if(canonical)add('components/SiteWorkspaceZoom');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="next/image")return ({priority,...props})=>React.createElement("img",props);if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>window.fixturePathname||"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';
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
const titles={billing:'Billing',accounts:'Accounts',dashboard:'Dashboard',valuations:'Valuations',marketplace:'Marketplace','asset-map':'Asset Map',discovery:'Discovery',outcomes:'Outcomes','asset-outcomes':'Asset register outcomes','work-tracker':'Work tracker','capture-queue':'Capture Queue',lifecycle:'Lifecycle Model',maintenance:'Maintenance checklists'};
const props={billing:{clients:[user,{userId:'dealer-test',name:'Example Equipment Dealer',email:'dealer@example.test',accountType:'dealer'},{userId:'farm-test',name:'River Farm',email:'farm@example.test',accountType:'owner'}],initialAccount:'owner',initialWork:'work-one'},accounts:{initialUsers:[user,{...user,userId:'two',name:'Example Dealer',accountType:'dealer',accountSubtype:'equipment_middleman',accountStatus:'pending_payment',accountStatusLabel:'Pending payment',email:'dealer@example.test'}]},marketplace:{report:{assets:[market,{...market,assetKey:'asset:two',title:'3 Ton Tip Trailer',hasRepeatInterest:false}],generatedAtIso:now}},discovery:{initialReport:discovery},'asset-map':{initialReport:discovery},valuations:{initialReport:valuations},outcomes:{report:{outcomes:[outcome]}},'asset-outcomes':{report:{outcomes:[]},allocationAccounts:[]},'work-tracker':{initialClients:[user]}};
props.videos={initialSlots:[]};
Object.assign(titles,{videos:'Video Manager','asset-values':'Asset values','annual-review':'Annual asset review'});
const catalogue={version:1,profiles:[{key:'tractor',label:'Tractor checklist',items:[{id:'oil',label:'Engine oil',checkLabel:'Check oil',serviceLabel:'Change oil',description:'Check with engine stopped.'}]}],families:[{source:'basic',sector:'agricultural',familyKey:'small-field-tractor',label:'Small Field Tractor',profileKey:'tractor'}]};
const capture={id:'request-one',publicReference:'INV-TEST',requestType:'invoice',submissionChannel:'owner_upload',status:'in_progress',senderDisplayName:'Example Sender',ownerDisplayName:user.name,assetDisplayName:asset.title,assetReference:'ABC123',fuelStorageDisplayName:'',assignedAdminDisplayName:'Admin',submittedAtIso:now,dueAtIso:'2026-09-22T10:00:00Z',updatedAtIso:now,version:1,fileCount:0,ownerUserId:'owner',assetId:'one',fuelStorageId:'',senderEmail:'sender@example.test',senderPhone:'',senderBusinessName:'',senderNote:'',adminNote:'',needsInformationReason:'',candidatePayload:{},capturedPayload:{usageMetric:'hours',usageReading:'1250'}};
Object.assign(props,{'ai-connect':{audience:'admin',account:{name:'Admin',email:'admin@example.test'},connections:[],resource:'https://admin.test/mcp'},sharing:{searchParams:{}}});
Object.assign(titles,{'asset-emails':'Asset emails',sharing:'Sharing usage','ai-connect':'Admin AI connections'});
const evidence=path.join(root,'.next/admin-review-validation');
(async()=>{
 fs.mkdirSync(evidence,{recursive:true});
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu"],headless:true,pipe:true,ignoreDefaultArgs:["--hide-scrollbars"]});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let inviteAttempts=0;
  let verificationAccounts=[],verificationFailure=false; const verificationWrites=[];
  let failValues=false,failReport=false,captureMode=false,queuePaging=false,workMode=false;
  const queueRequests=[],workRequests=[],billingRequests=[];let billingIssued=false,previewFailure=false;
  await page.setRequestInterception(true);
  page.on('request',request=>{
   const url=request.url(),respond=(body,status=200)=>request.respond({status,contentType:'application/json',body:JSON.stringify(body)});
   if (process.env.ADMIN_ACCOUNT_EDITOR_QA && url.endsWith('/api/admin/users/manage')) {
     const input = JSON.parse(request.postData());
     if (input.email === user.email) return respond({error:'Email already exists.',existing:user},409);
     return respond({user:{...user,userId:'manual',name:'Manual client',email:'manual@example.test',accountType:input.type==='middleman'?'dealer':input.type,accountSubtype:input.subtype,sharingPlan:input.type==='business'?'free':'desktop'}});
   }
   if (process.env.ADMIN_ACCOUNT_EDITOR_QA && url.endsWith('/api/admin/users') && request.method()==='POST') {
     assert.equal(JSON.parse(request.postData()).action,'send_setup');
     return ++inviteAttempts === 1 ? respond({error:'Email delivery failed'},503) : respond({ok:true});
   }
   if(url.includes('/api/billing/invoices/'))return previewFailure?respond({error:'Preview unavailable'},503):request.respond({contentType:'text/html',body:fs.existsSync(path.join(root,'.next/billing-validation/invoice.html'))?fs.readFileSync(path.join(root,'.next/billing-validation/invoice.html'),'utf8'):'<!doctype html><html><body><h1>Aim4price Invoice</h1><p>ABSA · No VAT applicable</p></body></html>'});
   if(url.endsWith('/brand/aim4price-mark-black.png')) return request.respond({contentType:'image/png',body:fs.readFileSync(path.join(root,'public/brand/aim4price-mark-black.png'))});
   if(url.includes('/api/admin/asset-values') && failValues) return respond({error:'Value search unavailable'},503);
   if(url.includes('/api/admin/asset-values')) return respond({total:1,page:1,items:[{id:'fixture',user_id:'owner',title:'2022 New Holland TT4.90',email:'owner@example.test',value:327133,pending:2}]});
   if(url.includes('/api/admin/users/owner/qr-labels'))return respond({ok:true,assets:[{...asset,hasQr:true,registerName:'Farm equipment'}]});
   if(url.includes('/api/admin/billing')) {
    if(request.method()==='POST'){billingRequests.push(JSON.parse(request.postData()));return respond({ok:true,id:'fixture'});}
    return respond({invoices:billingIssued?[{id:'invoice-test',userId:'owner',accountStatus:'active',contactPhone:'0821234567',contactEmail:user.email,number:'A4P-2026-000001',status:'issued',customer:{name:user.name,email:user.email},lines:[],dueDate:'2026-09-28',totalCents:30000,paidCents:0,version:2}]:[],total:billingIssued?1:0,plans:[],workspace:{customer:{name:user.name,email:user.email,address:'George'},nextBillingDate:null,interval:'once',amountCents:0,work:[{id:'work-one',started_at:now,duration_seconds:5400,note:'Capture work'}]}});
   }
   if(url.includes('/api/admin/business-accounts')) {
    if(request.method()==='PATCH'){
     const body=JSON.parse(request.postData());verificationWrites.push(body);
     verificationAccounts=verificationAccounts.map(a=>a.user_id===body.userId?{...a,verified_at:body.verified?now:null,review_note:body.note}:a);
     return respond({ok:true});
    }
    return verificationFailure?respond({error:'Unable to load business accounts.'},503):respond({accounts:verificationAccounts});
   }
   if(url.includes('/api/admin/maintenance-catalogue'))return respond({catalogue});
   if(url.includes('/api/admin/capture-assistance'))return respond({rows:[],total:0,pending:0});
   if(captureMode && url.includes('/api/admin/capture-requests/request-one'))return respond({ok:true,request:capture,files:[],events:[{id:'match',eventType:'matched',metadata:{ownerUserId:'owner',assetId:'one',fuelStorageId:''}}],matchedTarget:{targetType:'asset',ownerUserId:'owner',ownerDisplayName:user.name,targetId:'one',targetDisplayName:asset.title,reference:'ABC123',meta:'Tractor',assetUsageMetric:'hours',assetUsageReading:1250}});
   if(url.includes('/api/admin/capture-requests')) {
    const params=new URL(url).searchParams;queueRequests.push(params);
    const queuePage=Number(params.get('page')||1);
    return respond({ok:true,requests:queuePaging?[{...capture,publicReference:'PAGE-'+queuePage}]:captureMode?[capture]:[],counts:{},pagination:{page:queuePage,pageSize:50,total:queuePaging?101:captureMode?1:0,hasNextPage:queuePaging&&queuePage<3}});
   }
   if(url.includes('/api/admin/business-network'))return respond({businesses:[]});
   if(url.includes('/api/admin/guest-businesses'))return respond({acceptances:[],guests:[]});
   if(url.includes('/api/admin/work-tracker')) {
    workRequests.push(new URL(url).searchParams);
    return respond({ok:true,activeSession:null,history:{startIso:'2026-09-14T00:00:00Z',endIso:'2026-09-21T00:00:00Z',sessions:workMode?[{id:'work-one',clientUserId:'owner',clientName:user.name,clientEmail:user.email,clientAccountType:'owner',startedAtIso:now,stoppedAtIso:now,durationSeconds:3600,note:'Original note',includeInReport:true,showTimesInReport:true,showNoteInReport:true,pages:[]}]:[]}});
   }
   if(url.includes('/api/admin/discovery'))return failReport?respond({error:'Report unavailable'},503):respond({ok:true,report:discovery});
   if(url.includes('/api/admin/valuations'))return failReport?respond({error:'Report unavailable'},503):respond({ok:true,report:valuations});
   if(url.startsWith('https://admin.test/'))return request.respond({contentType:'text/html',body:'<html><body></body></html>'});
   if(url.startsWith('data:'))return request.continue();
   return request.abort();
  });
  async function open(section,width=1440){
   errors.length=0;
   await page.setViewport({width,height:1000,isMobile:canonical && width<600,hasTouch:canonical && width<600});await page.goto('https://admin.test/');
   const font=fs.readFileSync(path.join(root,'public/fonts/montserrat-latin.woff')).toString('base64');
   await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><style>@font-face{font-family:Montserrat;font-weight:100 900;src:url(data:font/woff;base64,'+font+')}*{box-sizing:border-box}body{margin:0;font:16px Montserrat,Arial,sans-serif;color:#14392e;background:#f5f8f6;--modal-backdrop-color:rgba(10,30,23,.5);--modal-backdrop-filter:blur(6px)}button,input,select{font:inherit}'+sharedStyles+sheets.join('\n')+'\n'+fs.readFileSync(path.join(root,'app/admin/admin-foundation.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'app/modal-close.css'),'utf8')+'</style><div id="app"></div>');
   if(canonical)await page.evaluate(w=>{Object.defineProperty(window,'outerWidth',{configurable:true,value:w});sessionStorage.setItem('aim4price.website-landscape-entry.v1','portrait');},width);
   await page.evaluate(section=>{window.fixturePathname=section==='accounts'?'/admin':'/admin/'+({lifecycle:'lifecycle-calculator',outcomes:'sold-assets',maintenance:'maintenance-catalogue'}[section]||section);},section);
   await page.evaluate(()=>{window.fixtureDashboard={cards:['free-estimates','paid-estimates','total-assets-saved','total-accounts-created','owner-accounts-created','average-user-time','marketplace-advertised'].map(id=>({id,title:id,values:[{label:'This month',value:'12'},{label:'This year',value:'54'}]})),storage:{sources:[],customerUsage:{accountCountLabel:'4',averageLabel:'20 MB',medianLabel:'12 MB',p90Label:'100 MB',addedLast30DaysLabel:'10 MB',pendingBucketUploadsLabel:'0',failedBucketUploadsLabel:'0'}}};});
   await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
   const ownShell=['accounts','dashboard','work-tracker','maintenance','annual-review','asset-emails','sharing','ai-connect','select-probe'].includes(section);
   const cssFile=section==='outcomes'||section==='asset-outcomes'?'sold-assets':section==='lifecycle'?'lifecycle-calculator':section;
   const wrapper=section==='asset-values'||section==='videos'?`React.createElement("main",null,React.createElement("h1",null,${JSON.stringify(titles[section])}),child)`:ownShell?'child':`React.createElement("main",{className:styles.page},React.createElement("section",{className:styles.shell},React.createElement("header",{className:${section==='billing'?'styles.header':'styles.topBar'}},React.createElement("div",{className:styles.titleBlock},React.createElement("h1",null,${JSON.stringify(titles[section])})),React.createElement(require("components/AdminNavigation").default,{active:${JSON.stringify(section)}})),child))`;
   await page.addScriptTag({content:runtime+`; (async()=>{const Component=require(${JSON.stringify(entries[section])}).default;const child=${['dashboard','asset-emails','sharing'].includes(section)?`await Component(${JSON.stringify(props[section]||{})})`:`React.createElement(Component,${JSON.stringify(props[section]||{})})`};const styles=${ownShell||section==='asset-values'||section==='videos'?'{}':`require("app/admin/${cssFile}/page.module.css")`};ReactDOM.createRoot(document.getElementById("app")).render(${canonical ? `React.createElement(require("components/SiteWorkspaceZoom").default,{footer:null,operational:null},React.createElement("div",{className:"adminWorkspaceRoot"},React.createElement(require("components/AdminWorkspace").default,null,${wrapper})))` : process.env.ADMIN_WORKSPACE_QA ? `React.createElement(require("components/AdminWorkspace").default,null,${wrapper})` : wrapper});})().catch(error=>{window.renderError=error.message;});`});
   await page.waitForSelector('h1');
   await page.evaluate(()=>document.fonts.ready);
   assert.deepEqual(errors,[],section+' runtime');
  }
  if (process.env.ADMIN_ACCOUNT_EDITOR_QA) {
    await open('accounts');
    const form='form[aria-label="Add account"]';
    const editor='form[aria-label="Change account type"]';
    async function choose(form, label) {
      await page.click(form+' [role=combobox]');
      await page.waitForSelector('[role=option]',{visible:true});
      await page.$$eval('[role=option]',(nodes,text)=>nodes.find(n=>n.textContent.includes(text)).click(),label);
    }
    await page.click('button::-p-text(Add account)');
    await page.type(form+' input[name=name]','Manual client');
    await page.type(form+' input[name=email]',user.email);
    await page.click(form+' button::-p-text(Create account)');
    await page.waitForSelector('button::-p-text(Open existing account)');
    await page.click('button::-p-text(Open existing account)');
    await page.waitForSelector('[role=dialog]');
    assert.ok((await page.$eval('[role=dialog]',el=>el.innerText)).includes(user.email));
    await page.keyboard.press('Escape');
    await page.click('button::-p-text(Add account)');
    await page.type(form+' input[name=name]','Manual client');
    await page.type(form+' input[name=email]','manual@example.test');
    await choose(form,'Business');
    await page.click(form+' button::-p-text(Create account)');
    await page.waitForSelector('button::-p-text(Send password setup email)');
    await page.click('button::-p-text(Send password setup email)');
    await page.waitForSelector('button::-p-text(Retry email)');
    await page.click('button::-p-text(Retry email)');
    await page.waitForFunction(()=>document.body.innerText.includes('Password setup email sent.'));
    await page.click('button::-p-text(Done)');
    await page.click('[aria-label="Manage Manual client"]');
    await page.click('summary::-p-text(Change account type)');
    await choose(editor,'Middleman');
    assert.equal(await page.$$eval(editor+' [role=combobox]',els=>els.length),1);
    const preview=await page.$eval('[aria-label="Account change preview"]',el=>el.innerText);
    assert.match(preview,/Business/);
    assert.match(preview,/Middleman/);
    assert.match(preview,/Unavailable/);
    await page.click(editor+' button::-p-text(Change to Middleman)');
    await page.waitForFunction(()=>document.querySelector('[role=dialog] header')?.innerText.includes('Middleman'));
    assert.deepEqual(errors,[]);
    console.log('PASS duplicate recovery, invite retry, type preview and Middleman display');
    return;
  }
  if (process.env.ADMIN_OWNER_STYLE_QA) {
   let count=0;
   for (const section of (process.env.ADMIN_QA_SECTIONS?.split(',') ?? Object.keys(entries))) {
    captureMode=section==='capture-queue';
    await open(section,1440);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,section+' contains horizontal scrolling');
    await page.evaluate(()=>document.querySelectorAll('details').forEach(e=>e.open=true));
    assert.equal(await page.$$eval('select',els=>els.filter(e=>e.getClientRects().length).length),0,section+' has no visible native select');
    const total=await page.$$eval('[data-admin-select]',els=>els.length);
    for(let index=0;index<total;index++) {
     const trigger=await page.evaluateHandle(i=>document.querySelectorAll('[data-admin-select]')[i].querySelector('button'),index);
     if(await trigger.evaluate(e=>e.disabled || !e.getClientRects().length))continue;
     await trigger.evaluate(e=>e.scrollIntoView({block:'center'}));
     await trigger.click();await page.waitForSelector('[data-admin-select-menu]');
     const alignment=await trigger.evaluate(e=>{const a=e.getBoundingClientRect(),b=e.querySelector('svg').getBoundingClientRect();return Math.abs(a.top+a.height/2-b.top-b.height/2);});
     assert.ok(alignment<1,section+' centred chevron');
     assert.ok(await page.$eval('[data-admin-select-menu]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}),section+' dropdown fits viewport');
     assert.ok(await page.$eval('[data-admin-select-menu] [role="option"]',e=>parseFloat(getComputedStyle(e).fontSize)>=15),section+' readable options');
     await page.keyboard.press('Escape');
     await page.waitForSelector('[data-admin-select-menu]',{hidden:true});
     assert.equal(await trigger.evaluate(e=>document.activeElement===e),true,section+' restores focus');
     await trigger.click();await page.waitForSelector('[data-admin-select-menu]');
     await page.evaluate(()=>{window.selectChanges=[];document.addEventListener('change',e=>{if(e.target.tagName==='SELECT')window.selectChanges.push(e.target.value);},{once:true});});
     await page.$eval('[data-admin-select-menu] [role="option"]:not([disabled])',e=>e.click());
     assert.equal(await page.evaluate(()=>window.selectChanges.length),1,section+' preserves change events');
     await trigger.click();await page.waitForSelector('[data-admin-select-menu]');
     await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
     assert.equal(await page.$('[data-admin-select-menu]'),null,section+' keyboard selection');
     count++;
    }
    await page.screenshot({path:path.join(evidence,`owner-style-expanded-${section}.png`),fullPage:true});
    assert.deepEqual(errors,[],section+' dropdown runtime');
    console.log('PASS Owner-style controls '+section);
   }
   await open('select-probe',1440);
   await page.click('[data-admin-select] button');await page.waitForSelector('[data-admin-select-menu]');
   await page.type('[data-admin-select-menu] input','Account 23');
   await page.keyboard.press('Enter');
   await page.waitForFunction(()=>document.querySelector('[data-selected-value]').textContent==='23');
   await page.click('[data-admin-select] button');await page.waitForSelector('[data-admin-select-menu]');
   await page.type('[data-admin-select-menu] input','No match');
   await page.waitForSelector('[data-admin-select-menu] [role="status"]');
   await page.keyboard.press('Escape');
   await page.click('[data-admin-select] button');await page.waitForSelector('[data-admin-select-menu]');
   await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'after-select');
   await open('accounts',1440);
   await page.click('[data-admin-select] button');await page.waitForSelector('[data-admin-select-menu]');
   await page.$$eval('[data-admin-select-menu] [role="option"]',els=>els.find(e=>e.textContent.includes('Suspended')).click());
   await page.waitForFunction(()=>document.querySelector('tbody').textContent.includes('No accounts'));
   await page.click('[data-admin-select] button');await page.waitForSelector('[data-admin-select-menu]');
   await page.keyboard.press('Home');await page.keyboard.press('Enter');
   await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===2);
   await page.click('[data-admin-select] button');await page.waitForSelector('[data-admin-select-menu]');
   await page.keyboard.press('Tab');
   assert.equal(await page.$('[data-admin-select-menu]'),null,'Tab closes the menu');
   for(const [action,closeLabel] of [['Manage asset names','Close Asset Name Manager modal'],['Print QR labels','Close QR label modal'],['Send message','Close notification composer']]){
    props.accounts.initialAccountId='owner';await open('accounts',1440);delete props.accounts.initialAccountId;
    await page.waitForSelector('[aria-labelledby="admin-account-action-modal-title"]');
    await page.$$eval('[aria-labelledby="admin-account-action-modal-title"] button',(els,text)=>els.find(e=>e.textContent.trim()===text).click(),action);
    await page.waitForSelector(`[aria-label="${closeLabel}"]`);
    await page.screenshot({path:path.join(evidence,`owner-account-${action.replaceAll(' ','-').toLowerCase()}.png`),fullPage:true});
    await page.$eval(`[aria-label="${closeLabel}"]`,e=>e.click());
    assert.equal(await page.$(`[aria-label="${closeLabel}"]`),null);
   }
   await open('accounts',1440);
   await page.click('[aria-label="Zoom in"]');await page.waitForSelector('dialog[open]');
   await page.$eval('#website-zoom-slider',e=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'125');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
   await page.waitForFunction(()=>Number(document.querySelector('[data-website-canvas]').dataset.websiteScale)===1.25);
   await page.keyboard.press('Escape');await page.click('[data-admin-select] button');await page.waitForSelector('[data-admin-select-menu]');
   assert.ok(await page.$eval('[data-admin-select-menu]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}),'Owner-style dropdown remains in view at 125%');
   await page.screenshot({path:path.join(evidence,'owner-dropdown-125.png'),fullPage:true});
   await page.keyboard.press('Escape');
   console.log('PASS '+count+' custom dropdowns, native events, keyboard, focus, alignment and Account status filtering');
   return;
  }
  if (canonical && process.env.ADMIN_CANONICAL_QA) {
   const baseline={};
   async function setZoom(value){
    await page.click('[aria-label="Zoom in"]');await page.waitForSelector('dialog[open]');
    await page.$eval('#website-zoom-slider',(e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,String(v));e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},value);
    await page.waitForFunction(v=>Math.abs(Number(document.querySelector('[data-website-canvas]').dataset.websiteScale)-v/100)<.001,{},value);
    await page.keyboard.press('Escape');
   }
   for (const width of (process.env.ADMIN_QA_INTERACTIONS_ONLY ? [] : [1440,390,768,1024,1920])) {
    for(const section of (process.env.ADMIN_QA_SECTIONS ? process.env.ADMIN_QA_SECTIONS.split(',') : Object.keys(entries))) {
     await open(section,width);
     await page.waitForSelector('[data-site-workspace-zoom-controls]');
     const metrics=await page.evaluate(()=>{const c=document.querySelector('[data-website-canvas]'),s=Number(c.dataset.websiteScale),main=document.querySelector('#admin-workspace-content'),side=document.querySelector('aside[aria-label="Admin workspace"]');return {scale:s,width:c.offsetWidth,content:Math.round(main.getBoundingClientRect().width/s),sidebar:getComputedStyle(side).display};});
     assert.equal(metrics.width,1440);assert.ok(Math.abs(metrics.scale-Math.min(1.2,width/1440))<.02);assert.notEqual(metrics.sidebar,'none');
     if(width===1440)baseline[section]=metrics.content;else assert.ok(Math.abs(metrics.content-baseline[section])<=1,section+' canonical composition');
     await page.screenshot({path:path.join(evidence,`canonical-${section}-${width}.png`),fullPage:true});
     if(width===1440){for(const zoom of [80,125]){await setZoom(zoom);assert.equal(await page.$eval('[data-website-canvas]',e=>e.offsetWidth),1440);assert.deepEqual(errors,[],section+' zoom runtime');}}
    }
    console.log('PASS canonical pages at '+width);
   }
   await open('accounts',1440);await page.waitForSelector('[data-site-workspace-zoom-controls]');
   await page.click('[aria-label="Zoom in"]');await page.waitForSelector('dialog[open]');
   assert.equal(await page.$eval('#website-zoom-title',e=>e.textContent),'Page size');
   await page.$eval('#website-zoom-slider',e=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,'125');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
   await page.waitForFunction(()=>Number(document.querySelector('[data-website-canvas]').dataset.websiteScale)===1.25);
   await page.$$eval('dialog[open] button',bs=>bs.find(b=>b.textContent==='Fit to screen').click());
   await page.waitForFunction(()=>document.querySelector('[data-site-workspace-zoom-controls]').dataset.zoomPreference==='auto');
   await page.keyboard.press('Escape');assert.equal(await page.$('dialog[open]'),null);
   await open('accounts',1440);await setZoom(125);
   await page.$eval('tbody button',e=>e.click());await page.waitForSelector('[aria-labelledby="admin-account-action-modal-title"]');
   const modal=await page.$eval('[aria-labelledby="admin-account-action-modal-title"]',e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width};});
   await page.screenshot({path:path.join(evidence,'canonical-account-modal-125.png'),fullPage:true});
   assert.ok(modal.left>=0 && modal.right<=1441 && Math.abs(modal.width/1.25-960)<2,'Enlarged account dialog remains reachable '+JSON.stringify(modal));
   delete props.accounts.initialAccountId;
   await open('work-tracker',1440);await setZoom(125);
   await page.click('button[aria-haspopup="listbox"]');await page.waitForSelector('[role="listbox"]');
   const picker=await page.evaluate(()=>{const trigger=document.querySelector('button[aria-haspopup="listbox"][aria-expanded="true"]').getBoundingClientRect(),menu=document.querySelector('[role="combobox"]').closest('[style]').getBoundingClientRect();return {trigger:{left:trigger.left,bottom:trigger.bottom},menu:{left:menu.left,top:menu.top,width:menu.width},viewport:window.visualViewport?.width ?? innerWidth,inCanvas:Boolean(document.querySelector('[data-website-canvas] [role="listbox"]'))};});
   assert.equal(picker.inCanvas,true);assert.ok(Math.abs(picker.menu.left-Math.min(Math.max(picker.trigger.left,15),picker.viewport-picker.menu.width-15))<2,'Picker uses logical left at 125% '+JSON.stringify(picker));assert.ok(Math.abs(picker.menu.top-picker.trigger.bottom-10)<2,'Picker uses logical top at 125% '+JSON.stringify(picker));
   await page.keyboard.press('Escape');
   console.log('PASS shared Page size modal, all-page manual zoom, fit, account dialog and scaled picker');
   return;
  }
  if (process.env.ADMIN_WORKSPACE_QA && !canonical) {
   for (const width of [390, 768, 1024, 1440, 1920]) {
    for (const section of (process.env.ADMIN_QA_SECTIONS ? process.env.ADMIN_QA_SECTIONS.split(',') : Object.keys(entries))) {
     await open(section, width);
     if(section==='maintenance')await page.waitForFunction(()=>document.body.textContent.includes('Small Field Tractor'));
     await page.screenshot({path:path.join(evidence,`workspace-${section}-${width}.png`),fullPage:true});
     const leaks=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+2 && getComputedStyle(e).position!=='fixed' && !e.closest('table')).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width})));
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,section+' workspace overflow at '+width+' '+JSON.stringify(leaks));
     await page.screenshot({path:path.join(evidence,`workspace-${section}-${width}.png`),fullPage:true});
    }
    console.log('PASS workspace pages at '+width);
   }
   await open('accounts',1440);
   await page.click('[aria-label="Collapse sidebar"]');
   assert.equal(await page.$eval('[aria-label="Expand sidebar"]',e=>e.getAttribute('aria-expanded')),'false');
   await page.click('[aria-label="Expand sidebar"]');
   await open('accounts',390);
   await page.click('[aria-label="Open Admin navigation"]');
   await page.waitForSelector('dialog[open]');
   await page.keyboard.press('Escape');
   assert.equal(await page.$('dialog[open]'),null);
   assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Open Admin navigation');
   await page.click('[aria-label="Open Admin navigation"]');
   await page.setViewport({width:1440,height:1000});
   await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
   assert.equal(await page.$eval('[aria-label="Aim4price Admin dashboard"] img',img=>img.complete && img.naturalWidth>0),true,'Actual Aim4price logo loads');
   assert.equal(await page.$eval('#admin-workspace-content h1',e=>getComputedStyle(e).fontWeight),'800');
   await open('asset-values',1440);
   await page.waitForFunction(()=>document.querySelector('tbody').textContent.includes('New Holland'));
   failValues=true;
   await page.type('[data-search-input]','Missing asset');
   await page.$eval('form',e=>e.requestSubmit());
   await page.waitForSelector('[role="alert"]');
   assert.match(await page.$eval('[role="status"]',e=>e.textContent),/last successful results/);
   assert.equal(await page.$eval('tbody button',e=>e.disabled),true,'Failed search cannot act on stale rows');
   failValues=false;
   await page.$$eval('button',buttons=>buttons.find(b=>b.textContent==='Try again').click());
   await page.waitForFunction(()=>!document.querySelector('[role="alert"]') && !document.querySelector('tbody button').disabled);
   assert.match(await page.$eval('[role="status"]',e=>e.textContent),/Missing asset/);
   await page.$$eval('button',buttons=>buttons.find(b=>b.textContent==='Clear search').click());
   await page.waitForFunction(()=>document.querySelector('[data-search-input]').value==='' && document.querySelector('[role="status"]').textContent==='All assets');
   console.log('PASS logo, typography, sidebar, drawer resize/focus, asset value failure/retry and clear search');
   return;
  }
  for(const width of [390,1440]){
   verificationAccounts=[];
   await open('accounts',width);
   await page.$eval('nav[aria-label="Admin navigation"] > button[aria-haspopup="dialog"]',e=>{e.focus();e.click();});await page.waitForSelector('[role="dialog"]');
   await page.$$eval('[role="dialog"] button',els=>els.find(b=>b.textContent.includes('Business verification')).click());
   await page.waitForFunction(()=>document.body.textContent.includes('No Business accounts found.'));
   assert.equal(await page.$eval('[role="dialog"] h2',e=>e.textContent),'Business verification');
   await page.screenshot({path:path.join(evidence,'business-verification-empty-'+width+'.png'),fullPage:true});
   await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Manage');
   verificationAccounts=[{user_id:'business',business_name:'Example Oil and Filter Company',email:'workshop@example.test',email_verified:true,account_status:'active',phone:'0821234567',website:'https://example.test',evidence:'Confirmed premises and contact details.',verified_at:null,review_note:''}];
   await page.$eval('nav[aria-label="Admin navigation"] > button[aria-haspopup="dialog"]',e=>{e.focus();e.click();});await page.waitForSelector('[role="dialog"]');
   await page.$$eval('[role="dialog"] button',els=>els.find(b=>b.textContent.includes('Business verification')).click());
   await page.waitForSelector('[role="dialog"] details');
   await page.click('[role="dialog"] summary');
   await page.click('[role="dialog"] input[type="checkbox"]');
   await page.type('[role="dialog"] textarea','Confirmed business and contact by phone.');
   await page.screenshot({path:path.join(evidence,'business-verification-review-'+width+'.png'),fullPage:true});
   assert.equal(await page.$eval('[role="dialog"]',e=>[e,...e.querySelectorAll('div,details,section,form')].every(n=>n.scrollWidth<=n.clientWidth+2)),true,'verification modal and form fit without horizontal clipping');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'verification page fits');
   await page.$$eval('[role="dialog"] button',els=>els.find(b=>b.textContent==='Save verification').click());
   await page.waitForFunction(()=>document.body.textContent.includes('Verification decision saved.')&&document.body.textContent.includes('Needs review (0)'));
   await page.$$eval('[role="dialog"] button',els=>els.find(b=>b.textContent==='Verified').click());
   await page.waitForSelector('[role="dialog"] summary');
   await page.click('[role="dialog"] summary');
   assert.deepEqual(verificationWrites.at(-1),{userId:'business',verified:true,note:'Confirmed business and contact by phone.'});
   await page.focus('[role="dialog"] textarea');await page.keyboard.press('Tab');await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Close Admin menu','focus remains inside review form');
   await page.$$eval('[role="dialog"] button',els=>els.find(b=>b.textContent==='Back to Manage').click());
   assert.equal(await page.$eval('[role="dialog"] h2',e=>e.textContent),'Manage');
   await page.keyboard.press('Escape');
   verificationFailure=true;props.accounts.initialVerificationOpen=true;
   await open('accounts',width);
   await page.waitForSelector('[role="dialog"] [role="alert"]');
   verificationFailure=false;
   await page.$$eval('[role="dialog"] button',els=>els.find(b=>b.textContent==='Try again').click());
   await page.waitForFunction(()=>document.body.textContent.includes('No accounts match this filter or search.'));
   await page.$$eval('[role="dialog"] button',els=>els.find(b=>b.textContent==='Verified').click());
   await page.waitForSelector('[role="dialog"] summary');
   await page.keyboard.press('Escape');delete props.accounts.initialVerificationOpen;
   assert.deepEqual(errors,[]);
  }
  if(canonical){
   await open('sharing');
   assert.equal(await page.$('a[href="/admin/businesses"]'),null);
   await page.$$eval('summary',items=>items.find(item=>item.textContent.includes('Listing reviews')).click());
   await page.waitForFunction(()=>document.body.textContent.includes('No businesses added yet.'));
   assert.ok(await page.$('a[href="/business-network/join"]'));
   assert.equal(await page.evaluate(()=>document.body.textContent.includes('Add business manually')),false);
  }
  console.log('PASS directory verification: empty state, manual approval, status refresh, keyboard focus, error retry and legacy entry at 390/1440');
  if(process.env.ADMIN_VERIFY_ONLY==='1')return;
  for(const section of Object.keys(entries)){
   await open(section);
   if(section==='maintenance')await page.waitForFunction(()=>document.body.textContent.includes('Small Field Tractor'));
   if(section==='capture-queue')await page.waitForFunction(()=>document.body.textContent.includes('No documents to capture'));
   await page.screenshot({path:path.join(evidence,section+'-1440.png'),fullPage:true});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
   assert.equal(overflow,false,section+' page must contain its horizontal scrolling');
   console.log('PASS render and page width: '+section);
  }
  for(const width of [980,1920])for(const section of ['accounts','dashboard','capture-queue','marketplace','discovery','valuations','maintenance']){
   await open(section,width);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,section+' '+width);
   await page.screenshot({path:path.join(evidence,section+'-'+width+'.png'),fullPage:true});
  }
  for(const width of [390,1440]){
   await open('billing',width);
   await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Create invoice'&&!b.disabled));
   await page.$$eval('button',els=>els.find(e=>e.textContent==='Create invoice').click());
   await page.waitForSelector('[aria-label="Create invoice"]');
   const rate=await page.evaluateHandle(()=>[...document.querySelectorAll('label')].find(e=>e.textContent==='Agreed hourly rate (R)').querySelector('input'));
   await rate.type('200');
   assert.equal(await page.$eval('input[type="checkbox"]',e=>e.checked),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'billing draft '+width);
   await page.screenshot({path:path.join(evidence,'billing-draft-'+width+'.png'),fullPage:true});
   await page.$$eval('button',els=>els.find(e=>e.textContent==='Save & preview').click());
   await page.waitForFunction(()=>document.body.textContent.includes('Draft saved.'));
   assert.equal(billingRequests.at(-1).hourlyRateCents,20000);
   assert.deepEqual(billingRequests.at(-1).workSessionIds,['work-one']);
   await page.waitForSelector('dialog[open] iframe');
   await page.waitForFunction(()=>[...document.querySelectorAll('dialog[open] button')].some(b=>b.textContent==='Issue & email'&&!b.disabled));
   assert.equal(await page.$eval('dialog[open] a[download]',e=>e.textContent),'Download draft PDF');
   await page.screenshot({path:path.join(evidence,'billing-draft-preview-'+width+'.png'),fullPage:true});
   if(width===1440){
    page.once('dialog',dialog=>dialog.accept());
    await page.$$eval('dialog[open] button',els=>els.find(e=>e.textContent==='Issue & email').click());
    await page.waitForFunction(()=>document.querySelector('dialog[open] h2')?.textContent!=='Preview invoice draft');
    await page.waitForSelector('dialog[open] a[download]');
    assert.equal(billingRequests.at(-1).action,'issue');
    assert.equal(billingRequests.at(-1).version,1);
   }
   if(width===390){
    page.once('dialog',dialog=>dialog.accept());
    await page.$$eval('dialog[open] button',els=>els.find(e=>e.textContent==='Issue & download PDF').click());
    await page.waitForFunction(()=>document.body.textContent.includes('Invoice issued. No email sent.'));
    assert.equal(billingRequests.at(-1).action,'issue');assert.equal(billingRequests.at(-1).sendEmail,false);
   }
   await page.waitForFunction(()=>document.querySelector('dialog[open] h2')?.textContent!=='Preview invoice draft'&&document.querySelector('dialog[open] [aria-label="Close invoice preview"]')?.disabled===false);
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));

  }
  console.log('PASS billing work selection, responsive composer and save-to-preview flow');
  for(const width of [390,1440]){
   await open('billing',width);
   await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Automatic billing')));
   await page.click('[aria-label="Billing paths"] button::-p-text(Automatic billing)');
   await page.waitForSelector('[aria-label="Automatic billing settings"]');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'automatic billing '+width);
   assert.equal(await page.$$eval('button',els=>els.find(e=>e.textContent==='Save & enable automatic billing').disabled),true);
   for(const [label,value] of [['Description','Monthly asset register'],['Unit price (R)','350']]){
    const input=await page.evaluateHandle(label=>[...document.querySelectorAll('[aria-label="Automatic billing settings"] label')].find(e=>e.textContent===label).querySelector('input'),label);
    await input.type(value);
   }
   await page.evaluate(async()=>{window.scrollTo(0,0);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
   await page.screenshot({path:path.join(evidence,'billing-automatic-'+width+'.png'),fullPage:true});
   await page.$$eval('button',els=>els.find(e=>e.textContent==='Save with automation paused').click());
   await page.waitForFunction(()=>document.body.textContent.includes('Billing settings saved.'));
   assert.equal(billingRequests.at(-1).action,'save_agreement');
   assert.equal(billingRequests.at(-1).enabled,false);
   assert.equal(billingRequests.at(-1).lines[0].unitCents,35000);
  }
  console.log('PASS automatic billing setup, explicit approval and responsive layout');

  billingIssued=true;await open('billing');
  await page.waitForFunction(()=>document.body.textContent.includes('A4P-2026-000001'));
  assert.equal(await page.$('a[href*="format=pdf"]'),null,'no direct download before preview');
  await page.click('[aria-label="Choose billing account"]');
  await page.type('[aria-label="Search billing accounts"]','no such account');
  await page.waitForFunction(()=>document.body.textContent.includes('No matching accounts.'));
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('[aria-label="Choose billing account"]',e=>e.getAttribute('aria-expanded')),'false');
  previewFailure=true;
  await (await page.evaluateHandle(()=>[...document.querySelectorAll('button')].find(e=>e.textContent==='View invoice'))).click();
  await page.waitForSelector('dialog[open] [role="alert"]');
  assert.equal(await page.$('dialog[open] a[download]'),null,'failed preview cannot download');
  previewFailure=false;await page.$$eval('dialog[open] button',els=>els.find(e=>e.textContent==='Try again').click());
  await page.waitForSelector('dialog[open] a[download]');
  assert.equal(await page.$eval('dialog[open] iframe',e=>e.getAttribute('sandbox')),'');
  await page.screenshot({path:path.join(evidence,'billing-preview-1440.png'),fullPage:true});
  await page.click('[aria-label="Close invoice preview"]');
  assert.equal(await page.evaluate(()=>document.activeElement.textContent),'View invoice');
  for(const width of [390,1440]){
   await open('billing',width);
   await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent==='Share'));
   await page.$$eval('button',els=>els.find(e=>e.textContent==='Share').focus());
   await page.keyboard.press('Enter');
   await page.waitForSelector('dialog[open]');
   assert.match(await page.$eval('dialog[open] a[href^="https://wa.me/"]',e=>e.href),/^https:\/\/wa.me\/27821234567\?text=/);
   assert.match(await page.$eval('dialog[open] a[href^="mailto:"]',e=>e.href),/^mailto:/);
   assert.equal(await page.$eval('dialog[open]',e=>e.getBoundingClientRect().right<=innerWidth),true);
   await page.screenshot({path:path.join(evidence,`billing-share-${width}.png`),fullPage:true});
   await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Share');
  }
  for(const width of [390,1440]){
   await open('billing',width);
   await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent==='Suspend account'));
   await page.$$eval('button',els=>{const button=els.find(e=>e.textContent==='Suspend account');button.focus();button.click();});
   await page.waitForSelector('dialog[open]');
   assert.equal(await page.$$eval('dialog[open] button',els=>els.find(e=>e.textContent==='Confirm suspension').disabled),true);
   await page.type('dialog[open] textarea','Payment is outstanding. Please contact Aim4price to resolve this invoice.');
   await page.click('dialog[open] input[type="checkbox"]');
   assert.equal(await page.$$eval('dialog[open] button',els=>els.find(e=>e.textContent==='Confirm suspension').disabled),false);
   assert.equal(await page.$eval('dialog[open]',e=>e.getBoundingClientRect().right<=innerWidth),true);
   await page.screenshot({path:path.join(evidence,`billing-suspension-${width}.png`),fullPage:true});
   if(width===1440){
    await page.$$eval('dialog[open] button',els=>els.find(e=>e.textContent==='Confirm suspension').click());
    await page.waitForFunction(()=>document.body.textContent.includes('Account suspended. The customer will see'));
    const command=billingRequests.at(-1);assert.equal(command.action,'suspend_account');assert.equal(command.id,'invoice-test');assert.equal(command.version,2);assert.match(command.reason,/Payment is outstanding/);
   }else{
    await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Suspend account');
   }
  }
  for(const width of [390,1440]){
   await open('billing',width);await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent==='Hard delete'));
   await page.$$eval('button',els=>{const button=els.find(e=>e.textContent==='Hard delete');button.focus();button.click();});await page.waitForSelector('dialog[open]');
   assert.equal(await page.$$eval('dialog[open] button',els=>els.find(e=>e.textContent==='Permanently delete').disabled),true);
   await page.type('dialog[open] textarea','Mistaken test invoice');await page.type('dialog[open] input:not([type="checkbox"])','A4P-2026-000001');await page.click('dialog[open] input[type="checkbox"]');
   assert.equal(await page.$$eval('dialog[open] button',els=>els.find(e=>e.textContent==='Permanently delete').disabled),false);
   await page.screenshot({path:path.join(evidence,`billing-delete-${width}.png`),fullPage:true});
   if(width===1440){await page.$$eval('dialog[open] button',els=>els.find(e=>e.textContent==='Permanently delete').click());await page.waitForFunction(()=>document.body.textContent.includes('Invoice permanently deleted.'));assert.equal(billingRequests.at(-1).action,'hard_delete');assert.equal(billingRequests.at(-1).confirmation,'A4P-2026-000001');}else{await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Hard delete');}
  }
  console.log('PASS hard delete requires a reason, exact number and explicit confirmation');
  console.log('PASS suspension confirmation, reason, invoice scope and responsive layout');
  console.log('PASS responsive invoice sharing, saved contacts and focus restoration');
  billingIssued=false;
  console.log('PASS account search, preview retry, sandbox, download gating and focus restoration');
  for(const width of [390,1440]){
   await open('billing',width);
   await page.click('[aria-label="Choose billing account"]');
   await page.waitForSelector('[aria-label="Search billing accounts"]');
   assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Search billing accounts');
   await page.evaluate(async()=>{window.scrollTo(0,0);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
   await page.screenshot({path:path.join(evidence,'billing-account-picker-'+width+'.png'),fullPage:true});
   await page.type('[aria-label="Search billing accounts"]','dealer');
   await page.keyboard.press('ArrowDown');
   assert.equal(await page.evaluate(()=>document.activeElement.textContent.includes('All accounts')),true);
   await page.keyboard.press('ArrowDown');
   assert.equal(await page.evaluate(()=>document.activeElement.textContent.includes('Example Equipment Dealer')),true);
   await page.keyboard.press('Enter');
   await page.waitForFunction(()=>document.querySelector('[aria-label="Choose billing account"]').getAttribute('aria-expanded')==='false');
   assert.match(await page.$eval('[aria-label="Choose billing account"]',e=>e.textContent),/Example Equipment Dealer/);
   await page.click('[aria-label="Choose billing account"]');
   await page.type('[aria-label="Search billing accounts"]','no such account');
   await page.click('[aria-label="Clear account search"]');
   assert.equal(await page.$eval('[aria-label="Search billing accounts"]',e=>e.value),'');
   await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Choose billing account');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'account picker width');
  }
  console.log('PASS billing account picker keyboard selection, clear search and responsive layout');

  await open('accounts');
  await page.$eval('nav[aria-label="Admin navigation"] > button[aria-haspopup="dialog"]',e=>{e.focus();e.click();});await page.waitForSelector('[role="dialog"]');
  assert.equal(await page.$$eval('[role="dialog"] a',els=>els.length),18);
  assert.match(await page.$eval('[role="dialog"] a[href="/admin/asset-options"]', el=>el.textContent.trim()), /^Asset options/);
  assert.equal(await page.$('[role="dialog"] a[href="/admin/businesses"]'),null);
  assert.match(await page.$eval('[role="dialog"] a[href="/admin/asset-emails"]',el=>el.textContent.trim()),/^Asset emails/);
  assert.match(await page.$eval('[role="dialog"] a[href="/admin/videos"]',el=>el.textContent.trim()),/^Video Manager/);
  assert.match(await page.$eval('[role="dialog"] a[href="/admin/ai-connect"]',el=>el.textContent.trim()),/^AI connections/);
  assert.match(await page.$eval('[role="dialog"] a[href="/admin/asset-values"]',el=>el.textContent.trim()),/^Asset values/);
  assert.match(await page.$eval('[role="dialog"] a[href="/admin/annual-review"]',el=>el.textContent.trim()),/^Preview annual review/);
  await page.keyboard.press('Escape');assert.equal(await page.$('[role="dialog"]'),null);
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-haspopup')),'dialog');
  console.log('PASS 18-section navigation, Escape and focus restoration');
  await page.$$eval('[aria-label="Account summary"] button',els=>els.find(e=>e.textContent.includes('Pending')).click());
  await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===1);
  assert.ok(await page.$eval('tbody',e=>e.textContent.includes('Example Dealer')));
  assert.equal(await page.$eval('tbody',e=>e.textContent.includes('Western Cape Agricultural')),false);
  await page.$$eval('[aria-label="Account summary"] button',els=>els.find(e=>e.textContent.includes('All accounts')).click());
  await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===2);
  props.accounts.initialStatus='pending_payment';await open('accounts');
  assert.equal(await page.$$eval('tbody tr',els=>els.length),1);delete props.accounts.initialStatus;
  props.accounts.initialAccountId='owner';await open('accounts');await page.waitForSelector('[aria-label="Account workspaces"]');
  assert.ok(await page.$('a[href="/admin/capture-queue?owner=owner"]'));
  assert.ok(await page.$('a[href="/admin/work-tracker?account=owner"]'));
  assert.ok(await page.$('a[href="/admin/discovery?owner=owner"]'));delete props.accounts.initialAccountId;
  console.log('PASS account status filters, deep links and account workspaces');
  props.accounts.initialAccountId='owner';
  for (const width of [390,1440,1920]) {
   await open('accounts',width);
   await page.waitForSelector('[aria-labelledby="admin-account-action-modal-title"]');
   const box=await page.$eval('[aria-labelledby="admin-account-action-modal-title"]',el=>{const r=el.getBoundingClientRect();return {width:r.width,left:r.left,right:r.right};});
   assert.ok(box.left>=0 && box.right<=width+1,'account modal stays inside the viewport');
   if(width>=1440){const scale=canonical?await page.$eval('[data-website-canvas]',e=>Number(e.dataset.websiteScale)):1;assert.ok(box.width/scale>=760 && box.width/scale<=1000,'account modal stays compact and readable');}
   assert.equal(await page.$$eval('[aria-labelledby="admin-account-action-modal-title"] button',els=>els.some(el=>el.textContent.trim()==='Delete account'&&!el.disabled)),true);
   await page.screenshot({path:path.join(evidence,`account-modal-wide-${width}.png`),fullPage:true});
  }
  const savedUsers=props.accounts.initialUsers;
  props.accounts.initialUsers=[{...user,userId:'protected-admin',name:'Aim4price administrator',email:'Aim4price@Gmail.com'}];
  props.accounts.initialAccountId='protected-admin';await open('accounts');
  await page.waitForSelector('[aria-labelledby="admin-account-action-modal-title"]');
  assert.equal(await page.$$eval('[aria-labelledby="admin-account-action-modal-title"] button',els=>els.some(el=>el.textContent.trim()==='Delete account')),false);
  assert.ok(await page.$eval('[aria-labelledby="admin-account-action-modal-title"]',el=>el.textContent.includes('this account cannot be deleted')));
  await page.screenshot({path:path.join(evidence,'account-modal-protected.png'),fullPage:true});
  props.accounts.initialUsers=savedUsers;delete props.accounts.initialAccountId;
  console.log('PASS wider responsive account modal and protected administrator without a delete action');

  queuePaging=true;await open('capture-queue');await page.waitForFunction(()=>document.body.textContent.includes('PAGE-1'));
  const queueNextPage = '[aria-label="Capture queue pages"] button[aria-label="Next page"]';
  await page.waitForSelector(queueNextPage);
  assert.equal(await page.$eval(queueNextPage, button => button.disabled), false);
  await page.click(queueNextPage);
  await page.waitForFunction(()=>document.body.textContent.includes('PAGE-2'));
  assert.equal(queueRequests.at(-1).get('page'),'2');
  await page.select('select','all');await page.waitForFunction(()=>document.body.textContent.includes('PAGE-1'));
  assert.equal(queueRequests.at(-1).get('status'),'all');assert.equal(queueRequests.at(-1).get('page'),'1');
  props['capture-queue']={initialStatus:'unassigned',initialOwnerId:'owner'};await open('capture-queue');await page.waitForFunction(()=>document.body.textContent.includes('PAGE-1'));
  assert.equal(queueRequests.at(-1).get('owner'),'owner');assert.equal(queueRequests.at(-1).get('status'),'unassigned');
  delete props['capture-queue'];queuePaging=false;
  console.log('PASS queue pagination, explicit All requests, page reset and scoped deep links');
  workMode=true;props['work-tracker'].initialAccountId='owner';await open('work-tracker');await page.waitForSelector('textarea');
  assert.equal(workRequests.at(-1).get('clientUserId'),'owner');
  await page.type('textarea',' updated');const editedNote=await page.$eval('textarea',e=>e.value);await page.$eval('nav[aria-label="Admin navigation"] > button[aria-haspopup="dialog"]',e=>{e.focus();e.click();});await page.waitForSelector('[role="dialog"]');
  page.once('dialog',dialog=>dialog.dismiss());await page.click('[role="dialog"] a[href="/admin"]');
  assert.equal(await page.$eval('textarea',e=>e.value),editedNote);
  console.log('PASS scoped work history and unsaved note navigation protection');
  page.once('dialog',dialog=>dialog.accept());workMode=false;delete props['work-tracker'].initialAccountId;
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
  await page.$eval('nav[aria-label="Admin navigation"] > button[aria-haspopup="dialog"]',e=>{e.focus();e.click();});await page.waitForSelector('[role="dialog"]');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.click('[role="dialog"] a[href="/admin"]');
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
 }catch(error){fs.mkdirSync(evidence,{recursive:true});const pages=await browser.pages();await pages.at(-1)?.screenshot({path:path.join(evidence,'failure.png'),fullPage:true});throw error;}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
