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
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});
 try{
 const page=await browser.newPage();await page.setViewport({width:1440,height:1000});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;background:#dce7e0;font-family:Arial;--modal-backdrop-color:rgba(12,24,35,.42)}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+'window.root=ReactDOM.createRoot(document.getElementById("app"));window.renderValue=(suggest=false)=>window.root.render(React.createElement(require("components/asset-register/AssetValueDialog").default,{key:String(suggest),suggest,endpoint:"/api/fixture/value",assetTitle:"2023 Tractor",onClose:()=>{}}));'});
 await page.evaluate(()=>{
 if(!crypto.randomUUID)crypto.randomUUID=()=>String(Math.random());window.writes=[];window.data={asset:{id:'asset',title:'2023 Tractor',value:700000,replacementPrice:1000000,revision:'v1',manual:false},requests:[{id:'proposal',amount:800000,reason:'Inspected equipment',actor_name:'Example Dealer',status:'pending',submitted_value:700000}],history:[]};
 window.fetch=async(url,options)=>{if(!options?.method)return {ok:true,json:async()=>({...window.data,value:window.data.asset.value})};const b=JSON.parse(options.body);window.writes.push(b);if(b.action==='previewReplacement')return {ok:true,json:async()=>({revision:'v1',currentValue:window.data.asset.value,recalculatedValue:960000})};if(b.action==='approve'){window.data.asset.value=800000;window.data.requests[0].status='approved';}if(b.action==='override')window.data.asset.value=b.amount;return {ok:true,json:async()=>({ok:true})};};window.renderValue();
 });
 async function click(text){await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>b.textContent===t),{},text);await page.$$eval('button',(nodes,t)=>nodes.find(b=>b.textContent===t).click(),text);}
 async function fill(selector,value){await page.waitForSelector(selector);await page.$eval(selector,(n,v)=>{Object.getOwnPropertyDescriptor(n.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(n,v);n.dispatchEvent(new Event('input',{bubbles:true}));},value);}
 await click('Review suggestion');await page.waitForSelector('textarea');assert(await page.evaluate(()=>document.body.textContent.includes('Example Dealer')));await fill('textarea','Accept inspected value');await page.screenshot({path:'/tmp/value-approval.png'});await click('Approve value');await page.waitForFunction(()=>document.body.textContent.includes('Saved.'));assert.equal(await page.evaluate(()=>window.writes[0].proposalId),'proposal');
 await click('Override current value');await fill('input[type=number]','750000');await fill('textarea','Owner inspection');await click('Confirm override');await page.waitForFunction(()=>window.data.asset.value===750000);
 await click('Change replacement price');await fill('input[type=number]','1200000');await fill('textarea','Updated replacement quotation');await click('Preview change');await page.waitForFunction(()=>document.body.textContent.includes('960'));await page.screenshot({path:'/tmp/value-replacement.png'});await click('Keep current value');await page.waitForFunction(()=>window.writes.some(w=>w.mode==='keep'));assert.equal(await page.evaluate(()=>window.writes.find(w=>w.mode==='keep').replacementPrice),1200000);
 await page.evaluate(()=>window.renderValue(true));await fill('input[type=number]','850000');await fill('textarea','Professional inspection');await click('Send suggestion');await page.waitForFunction(()=>document.body.textContent.includes('Suggestion sent.'));assert.equal(await page.evaluate(()=>window.writes.at(-1).action),'suggest');assert.equal(await page.evaluate(()=>window.data.asset.value),750000,'Suggestion does not mutate the live asset');
 assert.deepEqual(errors,[]);console.log('PASS owner approval, override, replacement preview/keep choice, and shared suggestion flow');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
