/* Result walkthrough browser checks with synthetic assets; no real writes. */
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




const client=fs.readFileSync(path.join(root,'app/valuation/valuation-client.tsx'),'utf8');
const replacement=client.slice(client.indexOf('  function renderBasicReplacementStep('),client.indexOf('  function renderMotorSubtypeSelection'));
const lifetime=client.slice(client.indexOf('  function renderLifetimeModal('),client.indexOf('  function renderUsageModal('));
add('app/valuation/page.module.css');add('components/estimate-modal.module.css');
const replacementDialog=client.slice(client.indexOf('              <dialog ref={replacementPriceDialogRef}'),client.indexOf('              </dialog>',client.indexOf('              <dialog ref={replacementPriceDialogRef}'))+'              </dialog>'.length);
const priceFormatter=client.slice(client.indexOf('function formatReplacementPriceInput('),client.indexOf('function handleReplacementPriceInput('));
const fixture=`import React,{useState,useRef,useEffect} from 'react';
import styles from 'app/valuation/page.module.css';import modalStyles from 'components/estimate-modal.module.css';
export default function Fixture(){
const [mode,setMode]=useState('lifetime'),[unit,setUnit]=useState('hours'),[usageLifetimeDraft,setUsageLifetimeDraft]=useState('16000');
const [finalLifetimeOpen,setFinalLifetimeOpen]=useState(true),[finalReplacementDraft,setFinalReplacementDraft]=useState('100000');
const [replacementModalVat,setReplacementModalVat]=useState('excl');
const [basicReplacementPrice,setBasicReplacementPrice]=useState('100000'),[basicReplacementVatMode,setBasicReplacementVatMode]=useState('excl');
const [applied,setApplied]=useState(null);
const replacementPriceDialogRef=useRef(null),[replacementPanelOpen,setReplacementPanelOpen]=useState(false);
useEffect(()=>{if(mode==='replacement'&&!replacementPriceDialogRef.current?.open)replacementPriceDialogRef.current?.showModal();},[mode]);
const replacementModalError='',setReplacementModalError=()=>{},setVatDisplayMode=()=>{},isGeneric=true;
const calculateGenericWithReplacementPrice=async value=>{setApplied({replacement:value});};
const calculateTractorWithReplacementPrice=async()=>{};

const resultState={kind:'generic'},compactAppMode=false,dealerStyles={},selectedUsageDisplayUnit=unit;
const getResultUsageMetricType=()=>unit,getUsageLifetimeDefault=()=>unit==='km'?350000:16000;
const ADVANCED_LIFETIME_KM_MIN=1,ADVANCED_LIFETIME_HOURS_MIN=1,ADVANCED_LIFETIME_KM_MAX=2000000,ADVANCED_LIFETIME_HOURS_MAX=50000;
const advancedRecalculateLoading=false,replacementRecalculateLoading=false,advancedError='',setMessage=()=>{},setActiveDetailsModal=()=>{},usageNumber=5000,usageAmount='5000',setUsageModalMode=()=>{},setUsageLifetimeOverride=()=>{},saveUsageAnswer=()=>{};
const lifetimeTitleRef=useRef(null),getAppliedAdvancedAssumptionsFromState=()=>({}),breakdownAccess=true;
const activeBreakdown={report:{settings:{conditionPercent:80,popularityPercent:90}}};
const applyPrivateEstimateSettings=async settings=>{setApplied(settings);return true;},updateAdvancedAssumptionsAndRecalculate=async()=>false;
const basicEstimateActive=true,basicExtraReplacementPriceExVat=25000,basicReplacementGuide={minExVat:50000,maxExVat:200000,sliderStep:5000,suggestedExVat:100000},selectedFamily={basicCatalogue:{}};
const VAT_RATE=.15,getVatDisplayValue=(value,mode)=>mode==='incl'?value*1.15:value;
const parseMoneyInput=value=>value===null||value===''?null:Number(String(value).replace(/\s/g,''));
const resetResult=()=>{throw Error('Editing the result must not reset it');},money=value=>'R '+Math.round(value).toLocaleString('en-ZA');
const replacementHelpDialogRef=useRef(null),specificationDialogRef=useRef(null),specificationDraft='standard',setSpecificationDraft=()=>{},basicSpecLevel='standard';
const renderSpecificationChoices=()=>null,applyReplacementSpecification=()=>{},renderDetailIcon=()=>null,requiredProps=bad=>({'aria-invalid':bad}),requiredHint=bad=>bad?<small>Required</small>:null;
${priceFormatter}
const handleReplacementPriceInput=(e,set)=>set(e.target.value);
const renderReplacementBreakdown=(base,extra,total,vat)=><output data-total={total}>{money(getVatDisplayValue(total,vat))}</output>;
${replacement}
${lifetime}
return <><button onClick={()=>{setUnit('km');setUsageLifetimeDraft('350000');setFinalLifetimeOpen(true);}}>Kilometres</button>
<button onClick={()=>setMode('replacement')}>Replacement</button>
{mode==='lifetime'&&finalLifetimeOpen?renderLifetimeModal(true,true):null}
{mode==='replacement'?<>${replacementDialog}</>:null}
{applied?<pre id="applied">{JSON.stringify(applied)}</pre>:null}</>;
}`;
modules.fixture=ts.transpileModule(fixture,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';






(async()=>{const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox'],headless:true});try{
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.setViewport({width:1366,height:900});
await page.setContent('<style>*{box-sizing:border-box}body{font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');
await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+"ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(require('fixture').default));"});
const click=async text=>{await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===t),{},text);await page.$$eval('button',(buttons,t)=>buttons.find(b=>b.textContent.trim()===t).click(),text);};
await page.waitForSelector('#usage-lifetime-title');
await click('+ 500 hours');await click('Recalculate estimate');
await page.waitForSelector('#applied');
let applied=JSON.parse(await page.$eval('#applied',el=>el.textContent));assert.equal(applied.lifetimeUsage,16500);assert.equal(applied.conditionPercent,80);assert.equal(applied.popularityPercent,90);
await click('Kilometres');await click('+ 10 000 km');
await page.screenshot({path:'/tmp/shared-lifetime.png'});
await click('Reset to default');await click('Recalculate estimate');
applied=JSON.parse(await page.$eval('#applied',el=>el.textContent));assert.equal(applied.lifetimeUsage,350000);
await click('Replacement');await page.waitForSelector('[aria-label="Replacement price VAT basis"]');
assert.equal(await page.$eval('output',el=>el.dataset.total),'125000');
await click('Including VAT');assert.equal(await page.$eval('output',el=>el.dataset.total),'125000');
await page.$eval('input[inputmode="decimal"]',el=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'230000');el.dispatchEvent(new Event('input',{bubbles:true}));});
await page.waitForFunction(()=>Math.abs(Number(document.querySelector('output').dataset.total)-225000)<.01);
await click('Excluding VAT');assert.equal(await page.$eval('input[inputmode="decimal"]',el=>Math.round(Number(el.value.replaceAll(' ','')))),200000);
await page.screenshot({path:'/tmp/shared-replacement.png'});
await click('Recalculate estimate');await page.waitForFunction(()=>Math.abs(JSON.parse(document.querySelector('#applied').textContent).replacement-225000)<.01);
await page.setViewport({width:390,height:844});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow on mobile');
assert(await page.$eval('dialog[aria-label="Replacement price"]',el=>el.scrollHeight<=el.clientHeight+2),'Replacement scroll is contained in its body');
assert.deepEqual(errors,[]);console.log('PASS shared lifetime hours/km, reset, settings retention, replacement VAT and extras');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
