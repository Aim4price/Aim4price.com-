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
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH || await chromium.executablePath(),args:process.env.CANVAS_BROWSER_PATH?['--no-sandbox','--disable-dev-shm-usage']:chromium.args,headless:true,pipe:true});
 try {
 const page=await browser.newPage(); await page.setViewport({width:1440,height:1000});
 page.on('pageerror',error=>{throw error;});
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;background:#dce7e0;font-family:Arial;--modal-backdrop-color:rgba(12,24,35,.42);--modal-backdrop-filter:blur(12px)}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.evaluate(()=>{if(!crypto.randomUUID)crypto.randomUUID=()=> '10000000-0000-4000-8000-000000000002';window.requests=[];window.fetch=async(url,opts)=>{window.requests.push({url,body:opts?.body});if(String(url).endsWith('/details'))return {ok:true,json:async()=>({asset:{id:'10000000-0000-4000-8000-000000000001',title:'John Deere 6155M',serialNumber:'OLD-123',replacementPriceExVat:900000,kind:'tractor'},permissions:{serialNumber:true,replacementPrice:true}})};return {ok:true,json:async()=>({correction:{id:'correction',status:'pending',serialNumberChanged:true,proposedSerialNumber:'NEW-456'}})}}});
 await page.addScriptTag({content:runtime+'window.fixtureRoot=ReactDOM.createRoot(document.getElementById("app"));'});
 const props={token:'a'.repeat(43),assetId:'10000000-0000-4000-8000-000000000001',assetIndex:0,assetTitle:'John Deere 6155M',serialNumber:'OLD-123',replacementPrice:900000,permissions:{serialNumber:true,replacementPrice:true,documents:true,reports:true},access:'active',reports:[{id:'report-1',label:'Asset valuation'}]};
 await page.addScriptTag({content:'window.SharedManageFixture=({props})=>{const [suspended,setSuspended]=React.useState(false);return React.createElement(require("components/leads/LeadManageDialog").default,{suspended,title:props.assetTitle,description:"Year Model: 2022 • Usage: 1 300 hours • Condition: Good",onClose:()=>{}},React.createElement(require("components/asset-register/ExternalLeadActions").default,{...props,onDialogChange:setSuspended,assetSubtitle:"Year Model: 2022 • Usage: 1 300 hours • Condition: Good"}));};window.renderFixture=(props)=>{window.fixtureRoot??=ReactDOM.createRoot(document.getElementById("app"));window.fixtureRoot.render(React.createElement(window.SharedManageFixture,{key:props.access+JSON.stringify(props.permissions),props}));};window.renderFixture('+JSON.stringify(props)+');'});
 async function click(text){await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(node=>(text==='Details'?node.querySelector('strong')?.textContent==='Details':node.textContent.includes(text))),{},text);await page.evaluate(text=>{const button=[...document.querySelectorAll('button')].find(node=>(text==='Details'?node.querySelector('strong')?.textContent==='Details':node.textContent.includes(text)));if(!button)throw Error('Missing button '+text);button.click();},text);}
 // Shared maintenance has one entry, owner typography, and editable choices and saved parts.
 await page.evaluate(p=>{
   window.parityParts=[{id:'part-1',itemKey:'oil_filter',itemLabel:'Oil filter',name:'Oil filter',partNumber:'OF-001',brand:'Brand',notes:'',addedBy:'Owner',createdAt:'2026-10-12',revision:0,canEdit:true}];
   window.parityChoices=[{id:'oil_filter',label:'Oil filter'}];
   window.fetch=async(url,options)=>{if(options?.method==='POST'){const data=JSON.parse(options.body);window.requests.push({url,body:options.body});if(data.action==='edit')window.parityParts=window.parityParts.map(part=>({...part,...data,revision:part.revision+1}));if(data.action==='delete')window.parityParts=[];if(data.action==='renameChoice')window.parityChoices=[{id:'oil_filter',label:data.name}];if(data.action==='deleteChoice')window.parityChoices=[];return{ok:true,json:async()=>({ok:true})};}return{ok:true,json:async()=>({parts:window.parityParts,suggestions:window.parityChoices,canView:true,canAdd:true,canManageChoices:true,maintenance:[]})};};
   window.renderFixture({...p,permissions:{viewParts:true,addParts:true,addMaintenance:true,maintenanceSchedules:true}});
 },props);
 await page.waitForSelector('[data-manage-action=maintenance]');
 assert.deepEqual(await page.$$eval('[data-manage-actions] > button',nodes=>nodes.map(node=>node.dataset.manageAction)),['maintenance']);
 const typography=await page.$eval('[data-manage-action=maintenance]',node=>({title:getComputedStyle(node.querySelector('strong')).fontSize,description:getComputedStyle(node.querySelector('small')).fontSize}));
 assert.equal(typography.title,'16px');assert.equal(typography.description,'14.08px');
 await page.click('[data-manage-action=maintenance]');await page.waitForSelector('[data-manage-action=viewParts]');
 await page.waitForFunction(()=>[...document.querySelectorAll('[role=dialog]')].filter(node=>node.getClientRects().length).length===1);
 assert.deepEqual(await page.$$eval('[data-manage-actions] > button',nodes=>nodes.filter(node=>node.getClientRects().length).map(node=>node.dataset.manageAction)),['addMaintenance','viewParts','maintenanceSchedules']);
 await page.screenshot({path:'/tmp/shared-maintenance-menu.png'});
 await page.click('[data-manage-action=viewParts]');await page.waitForSelector('button[aria-label="Edit Oil filter"]');
 await page.click('button[aria-label="Edit Oil filter"]');await page.waitForSelector('form input');
 await page.$eval('form input',node=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,'Primary filter');node.dispatchEvent(new Event('input',{bubbles:true}));});await click('Save changes');await page.waitForSelector('button[aria-label="Delete Primary filter"]');
 await page.click('button[aria-label="Delete Primary filter"]');await click('Delete');await page.waitForFunction(()=>document.body.textContent.includes('No parts yet.'));
 await click('+ Add part');await page.click('button[aria-label="Edit Oil filter"]');await page.waitForSelector('form input');
 await page.$eval('form input',node=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,'Engine filter');node.dispatchEvent(new Event('input',{bubbles:true}));});await click('Save changes');await page.waitForSelector('button[aria-label="Delete Engine filter"]');
 await page.setViewport({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Shared parts fit mobile');await page.screenshot({path:'/tmp/shared-parts-icons-mobile.png'});
 await page.click('button[aria-label="Delete Engine filter"]');await click('Delete');await page.waitForFunction(()=>!document.body.textContent.includes('Engine filter'));
 await click('Cancel');await page.click('button[aria-label="Back to maintenance"]');await page.waitForSelector('[data-manage-action=viewParts]');
 await page.keyboard.press('Escape');await page.waitForSelector('[data-manage-action=maintenance]');
 assert.equal(await page.$$eval('[role=dialog]',nodes=>nodes.filter(node=>node.getClientRects().length).length),1);
 await page.setViewport({width:1440,height:1000});
 console.log('PASS shared maintenance grouping, owner typography, parts editing/deletion and back navigation');
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
