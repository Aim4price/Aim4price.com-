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
const functions=client.slice(client.indexOf('  function getUsageLifetimeDefault()'),client.indexOf('  function renderSpecQuestionsProgress()'));
const save=client.slice(client.indexOf('  function saveUsageAnswer('),client.indexOf('  function renderYearModal()'));
add('app/valuation/page.module.css');add('components/estimate-modal.module.css');add('lib/valuation/shared');
const fixture=`
import React, {useState,useRef} from 'react';
import styles from 'app/valuation/page.module.css';
import modalStyles from 'components/estimate-modal.module.css';
import {resolveDefaultLifetimeUsage,ADVANCED_LIFETIME_HOURS_MIN,ADVANCED_LIFETIME_HOURS_MAX,ADVANCED_LIFETIME_KM_MIN,ADVANCED_LIFETIME_KM_MAX} from 'lib/valuation/shared';
export default function Fixture({unit='hours',showHoursInput=true}) {
 const [usageAmount,setUsageAmount]=useState(''); const [lifeWorkedPercent,setLifeWorkedPercent]=useState('');
 const [usageModalMode,setUsageModalMode]=useState(showHoursInput?'hours':'percent');
 const [usageLifetimeDraft,setUsageLifetimeDraft]=useState('');const [usageLifetimeOverride,setUsageLifetimeOverride]=useState(null);
 const [activeDetailsModal,setActiveDetailsModal]=useState('usage');const [usageStepComplete,setUsageStepComplete]=useState(false);
 const [message,setMessage]=useState('');const [usageInputFocused,setUsageInputFocused]=useState(false);
 const lifetimeTitleRef=useRef(null); const compactAppMode=false, dealerStyles={},selectedSector='agricultural',selectedUsageSector=null;
 const selectedUsageDisplayUnit=unit,selectedUsageFieldLabel=unit==='km'?'Current kilometres':'Machine hours';
 const selectedFamily={basicCatalogue:{usageProfile:{primaryMetric:unit,expectedLifetime:unit==='km'?300000:12000}},familyKey:'test'};
 const flowMode='generic_specs',selectedModel=null,enrichedSpecsJson={};
 const toNumberOrNull=v=>v.trim()===''?null:Number(v),toPercentOrNull=v=>v.trim()===''?null:Number(v);
 const usageNumber=toNumberOrNull(usageAmount),lifeWorkedPercentNumber=toPercentOrNull(lifeWorkedPercent);
 const requiredProps=()=>({}),requiredHint=()=>null,setRequiredFeedback=()=>{},resetResult=()=>{},scrollToDetailsCard=()=>{};
 const renderDetailIcon=()=>null,getAssetNounLabel=()=> 'equipment',getUnknownUsageButtonLabel=()=> 'Hours unknown',getKnownUsageButtonLabel=()=> 'Enter reading';
 ${save}
 ${functions}
 return activeDetailsModal?renderUsageModal(showHoursInput):<output>{JSON.stringify({usageAmount,lifeWorkedPercent,usageLifetimeOverride,usageStepComplete})}</output>;
}`;
modules.fixture=ts.transpileModule(fixture,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';





(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 try {
 const page=await browser.newPage(),errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:1366,height:768});
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial;color:#17364a}'+sheets.join('\n')+'</style><main id="app"></main>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:runtime+"window.root=ReactDOM.createRoot(document.getElementById('app'));window.mount=(unit='hours',showHoursInput=true)=>root.render(React.createElement(require('fixture').default,{unit,showHoursInput,key:Math.random()}));mount();"});
 const click=async text=>{await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===t),{},text);for (const button of await page.$$('button')) { if (await button.evaluate(b=>b.textContent.trim())===text) {await button.click();break;} }};
 const fill=async(selector,value)=>{await page.click(selector,{clickCount:3});await page.keyboard.press('Backspace');await page.type(selector,value);};
 await page.waitForSelector('input[type=text]');await fill('input[type=text]','3500');await click('Continue');
 await page.waitForSelector('#usage-lifetime-title');assert.equal(await page.$eval('input[type=text]',e=>e.value),'12 000');
 await click('Back');assert.equal(await page.$eval('input[type=text]',e=>e.value),'3 500');await click('Continue');
 await fill('input[type=text]','16000');await page.screenshot({path:'/tmp/lifetime-modal-desktop.png'});
 const overflow=await page.$eval('[role=dialog]>div',e=>({scroll:e.scrollHeight,client:e.clientHeight,width:e.scrollWidth,clientWidth:e.clientWidth}));
 assert(overflow.scroll<=overflow.client+2,JSON.stringify(overflow));assert(overflow.width<=overflow.clientWidth+2,JSON.stringify(overflow));
 await click('Continue');await page.waitForSelector('output');let value=JSON.parse(await page.$eval('output',e=>e.textContent));assert.equal(value.usageLifetimeOverride,16000);assert.equal(value.usageAmount,'3500');assert.equal(value.usageStepComplete,true);
 await page.evaluate(()=>mount('km'));await page.waitForSelector('input[type=text]');await fill('input[type=text]','100000');await click('Continue');await page.waitForSelector('#usage-lifetime-title');assert.equal(await page.$eval('input[type=text]',e=>e.value),'300 000');
 await fill('input[type=text]','0');assert(await page.$$eval('button',bs=>bs.find(b=>b.textContent.trim()==='Continue').disabled));
 await click('Reset to default');await click('+ 10 000 km');assert.equal(await page.$eval('input[type=text]',e=>e.value),'310 000');
 await fill('input[type=text]','2000000');await page.screenshot({path:'/tmp/lifetime-modal-km.png'});
 assert(await page.$eval('[class*=lifetimeReadout]',e=>e.scrollWidth<=e.clientWidth+2));
 await page.setViewport({width:390,height:650});await page.screenshot({path:'/tmp/lifetime-modal-mobile.png'});
 assert(await page.$eval('[role=dialog]>div',e=>e.scrollWidth<=e.clientWidth+2));await click('Continue');
 await page.evaluate(()=>mount());await page.waitForSelector('input[type=text]');await click('Hours unknown');await fill('input[type=text]','40');await click('Continue');await page.waitForSelector('#usage-lifetime-title');await click('Continue');await page.waitForSelector('output');value=JSON.parse(await page.$eval('output',e=>e.textContent));assert.equal(value.usageAmount,'');assert.equal(value.lifeWorkedPercent,'40');assert.equal(value.usageLifetimeOverride,12000);
 await page.evaluate(()=>mount('hours',false));await page.waitForSelector('input[type=text]');await fill('input[type=text]','50');await click('Continue');await page.waitForSelector('output');value=JSON.parse(await page.$eval('output',e=>e.textContent));assert.equal(value.usageLifetimeOverride,null);
 assert.deepEqual(errors,[]);console.log('PASS: usage → lifetime, Back, exact entry, validation, reset, hours/km, unknown reading, percentage-only assets, desktop/mobile sizing');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
