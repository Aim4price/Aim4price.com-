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
const render=client.slice(client.indexOf('    function renderBasicExtrasModal()'),client.indexOf('\n    return (\n      <div className={basicEstimateActive',client.indexOf('    function renderBasicExtrasModal()')));
const sums=client.slice(client.indexOf('  const basicExtras = useMemo('),client.indexOf('  const basicUsageNotRequired'));
add('app/valuation/page.module.css');add('components/estimate-modal.module.css');
const fixture=`import React,{useState,useMemo} from 'react';
import styles from 'app/valuation/page.module.css';import modalStyles from 'components/estimate-modal.module.css';
export default function Fixture(){
const [basicExtraChoice,setBasicExtraChoice]=useState('');const [basicFamilyExtraReplacementPrice,setBasicFamilyExtraReplacementPrice]=useState('');
const [otherExtraName,setOtherExtraName]=useState('');const [otherExtraReplacementPrice,setOtherExtraReplacementPrice]=useState('');
const [additionalBasicExtras,setAdditionalBasicExtras]=useState([]);const [extrasModalView,setExtrasModalView]=useState('choose');
const [activeDetailsModal,setActiveDetailsModal]=useState('extras');const [message,setMessage]=useState('');
const setOtherExtraEnabled=()=>{},setRequiredFeedback=()=>{},resetResult=()=>{},compactAppMode=false,dealerStyles={};
const basicFamilyExtra={label:'Loader'};const normalizeText=v=>v.trim();const parseMoneyInput=v=>Number(v.replace(/\\s/g,''))||null;
const primaryExtraReplacementPriceExVat=parseMoneyInput(basicExtraChoice==='family'?basicFamilyExtraReplacementPrice:otherExtraReplacementPrice);
const basicBaseReplacementPriceExVat=500000;const moneyExVat=v=>'R '+v+' excl. VAT';const requiredProps=bad=>({'aria-invalid':bad});const requiredHint=bad=>bad?<small>Required</small>:null;const renderDetailIcon=()=> <span className={styles.detailIcon}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M18 14v8M14 18h8"/></svg></span>;
${sums}
${render}
return activeDetailsModal?renderBasicExtrasModal():<><output>{JSON.stringify({basicExtras,basicExtraReplacementPriceExVat,basicTotalReplacementPriceExVat})}</output><button onClick={()=>{setActiveDetailsModal('extras');setExtrasModalView('choose')}}>Edit</button></>;
}`;
modules.fixture=ts.transpileModule(fixture,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';





(async()=>{const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox'],headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1366,height:900});await page.setContent('<style>*{box-sizing:border-box}body{font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+"if(!crypto.randomUUID)crypto.randomUUID=()=>String(Math.random());ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(require('fixture').default));"});
const click=async text=>{for(const b of await page.$$('button'))if(await b.evaluate(e=>e.textContent.trim())===text){await b.click();return;}throw Error('Missing '+text)};
await page.waitForSelector('[aria-label="Choose fitted extras"]');await page.click('[aria-label="Choose fitted extras"]');await click('Other extraEnter a name and price');await page.type('input[maxlength="100"]','Weights');await page.type('input[inputmode="decimal"]','10000');await click('+ Add another extra');
assert(await page.$$eval('button',bs=>bs.find(b=>b.textContent.trim()==='Continue').disabled));await page.type('[aria-label="Extra 2 name"]','GPS');await page.type('[aria-label="Extra 2 replacement price"]','25000');await click('+ Add another extra');await page.type('[aria-label="Extra 3 name"]','Loader');await page.type('[aria-label="Extra 3 replacement price"]','100000');await page.click('[aria-label="Remove extra 2"]');await click('Continue');await page.waitForSelector('output');let result=JSON.parse(await page.$eval('output',e=>e.textContent));assert.equal(result.basicExtraReplacementPriceExVat,110000);assert.equal(result.basicExtras.length,2);
await click('Edit');await page.click('[aria-label="Choose fitted extras"]');await page.screenshot({path:'/tmp/multiple-extras.png'});
for (const viewport of [{width:1366,height:768},{width:390,height:650}]) {
 await page.setViewport(viewport);
 assert(await page.$eval('[class*=extrasEditorBody]',el=>!['auto','scroll'].includes(getComputedStyle(el).overflowY)),'No inner scrollbar');
 assert(await page.$eval('[class*=extrasEditorModal]',el=>getComputedStyle(el).maxHeight==='none'),'Modal grows with extras');
 assert(await page.$eval('[class*=extrasEditorOverlay]',el=>getComputedStyle(el).overflowY==='auto'),'Outer overlay owns scrolling');
 assert(!await page.$('[class*=extrasTotal]'),'No extras total strip');
 assert(await page.$$eval('[class*=removeExtra]',buttons=>buttons.every(b=>{
 const row=b.parentElement, inputs=row.querySelectorAll('input'), input=inputs[inputs.length-1];
 const a=input.getBoundingClientRect(),r=b.getBoundingClientRect();
 return Math.abs((a.top+a.bottom-r.top-r.bottom)/2)<2 && r.left-a.right>=10;
 })),'Delete buttons align with price inputs with a clear gap');
 await page.$$eval('button',buttons=>buttons.find(el=>el.textContent.trim()==='Continue').scrollIntoView({block:'end'}));
 assert(await page.$$eval('button',buttons=>{const b=buttons.find(el=>el.textContent.trim()==='Continue');const r=b.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'Continue remains visible');
}
await page.setViewport({width:1366,height:900});await page.click('[aria-label="Remove first extra"]');await click('Continue');await page.waitForSelector('output');result=JSON.parse(await page.$eval('output',e=>e.textContent));assert.equal(result.basicExtras[0].name,'Loader');assert.equal(result.basicTotalReplacementPriceExVat,600000);await click('Edit');await page.click('[aria-label="No fitted extras"]');await page.waitForSelector('output');result=JSON.parse(await page.$eval('output',e=>e.textContent));assert.equal(result.basicTotalReplacementPriceExVat,500000);assert.deepEqual(errors,[]);console.log('PASS add, validate, remove, reopen, promote and clear extras');}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
