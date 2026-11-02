/* Browser checks for owner shared-maintenance recipient settings. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
let cssIndex=0;
const stubs={'components/AppHeader':'module.exports=()=>null;'};
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




add('app/asset-register/page.module.css');add('app/account/page.module.css');add('app/asset-register/future-value.module.css');add('components/AssetModalSelect');
const source=fs.readFileSync(path.join(root,'app/asset-register/asset-register-client.tsx'),'utf8');
const modal=source.slice(source.indexOf('      {projectionAsset ? ('),source.indexOf('      {documentUploadAsset ? ('));
const icon=source.slice(source.indexOf('function ProjectionIcon('),source.indexOf('function SaleabilityIcon('));
const fixture=`import React from 'react';import styles from './app/asset-register/page.module.css';import accountStyles from './app/account/page.module.css';import futureStyles from './app/asset-register/future-value.module.css';import ModalSelect from './components/AssetModalSelect';
${icon}
export default function Fixture(){
const [projectionStep,setStep]=React.useState(1),[projectionForm,setForm]=React.useState({targetYear:'2028',inflationRatePct:'5',extraHours:'3000',targetCondition:'used'});
window.setStep=setStep;
const projectionAsset={title:'2017 JCB 3DX',condition:'used',value:350000};
const projectionQuestionRef=React.useRef(null),projectionResultRef=React.useRef(null);
const closeProjectionModal=()=>{},updateProjectionForm=p=>setForm(f=>({...f,...p})),advanceProjectionStep=p=>{updateProjectionForm(p||{});setStep(s=>s===4?'result':s+1)},goBackProjection=()=>setStep(s=>s==='result'?4:s-1);
const projectionYearSelectOptions=Array.from({length:16},(_,i)=>({value:String(2026+i),label:String(2026+i)}));
const PROJECTION_INFLATION_PRESETS=['3','5','8','10'],PROJECTION_CONDITION_OPTIONS=['excellent','good','fair','used','serious'].map(key=>({key,label:key==='serious'?'Serious Wear':key[0].toUpperCase()+key.slice(1)}));
const projectionUsesPercentUsage=false,projectionError=null,isLoadingProjection=false,projectionCurrentWorkedPercent=0,projectionTargetWorkedPercent=0;
const projectionUsageHelpText='Enter only the extra usage from now until that year. Leave blank for no increase.',projectionUsageFieldLabel='Additional hours by 2028',projectionUsagePlaceholder='Type extra hours';
const buildAssetUsageValue=()=> '8 853 hours',conditionLabel=v=>v,getAssetLifeWorkedPercent=()=>0;
const projectionResult={projected:{retailExVat:250000,hours:11853},current:{hours:8853},baseYear:2026,targetYear:2028,inflationRatePct:5};
const pricingMoney=v=>'R '+v.toLocaleString('en-ZA'),pricingVatLabel='Excl. VAT',pricingVatIncluded=false,setPricingVatIncluded=()=>{},PricingVatToggle=()=> <button>Excl. VAT</button>,projectionUsageMetaLabel='Hours',projectionUsageShortUnit='hours',projectionCurrentCondition='used',projectionTargetCondition='used',projectionConditionRetainedPercent=()=>45,formatPercent=v=>v+'%',formatProjectionWorkedPercent=v=>v+'%',requestProjection=()=>{};
return <>${modal}</>;}`;
modules.fixture=ts.transpileModule(fixture,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText.replaceAll('require("./','require("');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';
(async()=>{const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});try{
const page=await browser.newPage();page.on('pageerror',e=>{throw e});
for(const [width,height] of [[1366,768],[1920,900],[768,740],[390,740]]){
await page.setViewport({width,height});await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:'(()=>{'+runtime+'ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(require("fixture").default));})();'});await page.waitForSelector('[role="dialog"]');
for(const step of [1,2,3,4,'result']){
await page.evaluate(s=>window.setStep(s),step);await new Promise(r=>setTimeout(r,80));
if(step===1){await page.click('[aria-haspopup="listbox"]');await page.waitForSelector('[role="listbox"]');const r=await page.evaluate(()=>{const a=document.querySelector('[aria-haspopup="listbox"]').getBoundingClientRect(),b=document.querySelector('[role="listbox"]').getBoundingClientRect();return {left:Math.abs(a.left-b.left),width:Math.abs(a.width-b.width),count:document.querySelectorAll('[role="option"]').length}});assert.ok(r.left<2&&r.width<2,JSON.stringify(r));assert.equal(r.count,16);}
const g=await page.$eval('[role="dialog"]',e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight,wide:e.scrollWidth-e.clientWidth,scroll:[...e.querySelectorAll('*')].filter(x=>['auto','scroll'].includes(getComputedStyle(x).overflowY)&&x.scrollHeight>x.clientHeight+1).map(x=>x.className)}});assert.ok(g.top>=-1&&g.bottom<=g.height+1,JSON.stringify({width,step,g}));assert.equal(g.wide,0);assert.equal(g.scroll.length,0,JSON.stringify({width,step,g}));
await page.screenshot({path:'/tmp/future-'+width+'-'+step+'.png'});
}console.log('PASS future value all steps at '+width+'x'+height);
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
