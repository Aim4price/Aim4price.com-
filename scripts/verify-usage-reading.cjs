/* Browser checks for expanded asset detail styles and market-price actions. */
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



const client=fs.readFileSync(path.join(root,'app/asset-register/asset-register-client.tsx'),'utf8');
// Execute the real entry handlers with spies: both must select the reading view.
const quickSource=client.slice(client.indexOf('  function openQuickAssetDetailEditor('),client.indexOf('  function setAssetSettingsManualLocationInputsFromAsset('));
const quickCode=ts.transpileModule(quickSource,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const calls=[];
const quick=new Function('canUseOwnerOnlyAssetActions','canQuickEditAssetDetail','openConfirmedValue','rememberAssetModalReturn','setExpandedAssetId','isSavedAim4priceAsset','openAssetSettingsModalForAsset','openUpdater',quickCode+';return openQuickAssetDetailEditor;')(true,()=>true,()=>calls.push('price'),()=>{},()=>{},()=>true,(_,view)=>calls.push(view),()=>calls.push('details'));
quick({id:'asset'},'usage');assert.deepEqual(calls,['usage']);
quick({id:'asset'},'replacement');assert.deepEqual(calls,['usage','price']);
const detailsSource=client.slice(client.indexOf('  function openAssetSettingsUsageView()'),client.indexOf('  function goBackFromAssetSettingsSubView()'));
const detailsCode=ts.transpileModule(detailsSource,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const details=new Function('isAssetSettingsBusy','isSavedAim4priceAsset','editingAsset','getAssetSettingsUsageMode','setAssetSettingsView','setIsAssetSettingsModalOpen','setAssetSettingsUsageInput','formatAssetSettingsUsageInput','setAssetSettingsError','clearAssetSettingsLocationFeedback',detailsCode+';return openAssetSettingsUsageView;')(false,()=>true,{id:'asset'},()=> 'hours',view=>calls.push(view),open=>calls.push(open),()=>{},()=> '2600',()=>{},()=>{});
details();assert.deepEqual(calls,['usage','price','usage',true]);
assert(client.includes('onClick={openAssetSettingsUsageView} aria-label={`Update ${usageFieldLabel.toLowerCase()}`}'));
const section=client.slice(client.indexOf("              {assetSettingsView === 'usage' && isSavedAim4priceAsset(editingAsset) ? ("),client.indexOf("              {assetSettingsView === 'usage' && <details"));
const request=client.slice(client.indexOf('  function requestAim4priceUsageOverrideSetting()'),client.indexOf('  function cancelAim4priceUsageOverrideConfirmation()'));
const helpers=client.slice(client.indexOf('function assetSettingsUsageHeading('),client.indexOf('function getAssetSettingsUsageForKind('));
add('app/asset-register/page.module.css');add('components/asset-register/AdvancedSettings.module.css');add('components/asset-register/AssetDetailIcon');
const fixture=`import React,{useState} from 'react';
import styles from 'app/asset-register/page.module.css';
import advancedStyles from 'components/asset-register/AdvancedSettings.module.css';
import AssetDetailIcon from 'components/asset-register/AssetDetailIcon';
const formatLifetimePercentPlain=v=>String(v), formatUsageAmountInput=v=>String(v).replace(/[^0-9 ]/g,''), ASSET_SETTINGS_USAGE_COPY='Enter the reading shown on your asset’s meter.';
const normalizeSettingsUsageAmountInput=v=>String(v).trim()!==''&&Number.isFinite(Number(String(v).replace(/ /g,'')))&&Number(String(v).replace(/ /g,''))>=0?Number(String(v).replace(/ /g,'')):null;
const normalizeSettingsLifeWorkedInput=v=>{const n=normalizeSettingsUsageAmountInput(v);return n!==null&&n<=100?n:null};
${helpers}
export default function Fixture({mode='hours'}) {
 const settingsUsageMode=mode,settingsUsageCurrentValue=mode==='percent'?25:2600;
 const [assetSettingsUsageInput,setAssetSettingsUsageInput]=useState(String(settingsUsageCurrentValue));
 const [assetSettingsError,setAssetSettingsError]=useState(''),[pending,setPendingUsageOverride]=useState(null);
 const editingAsset={id:'asset'},assetSettingsView='usage',isAssetSettingsBusy=false,isSavingAssetSettings=false;
 const isSavedAim4priceAsset=()=>true,getAssetSettingsUsageMode=()=>mode,closeAssetSettingsModal=()=>window.cancelled=true;
 ${request}
 return <div role="dialog" className={styles.modalCard+' '+styles.assetSettingsModal+' '+advancedStyles.dialog} style={{margin:'16px auto'}}>
 <div><h3>{assetSettingsUsageHeading(mode)}</h3><p>2022 John Deere 6135B</p></div>
 <div className={styles.assetSettingsBody+' '+advancedStyles.body}>${section}
 <details className={advancedStyles.trackingDetails}><summary>Automatic usage updates</summary><p>Automatic hours settings</p></details>
 {assetSettingsError&&<p role="alert">{assetSettingsError}</p>}{pending&&<output>{JSON.stringify(pending)}</output>}
 </div></div>;
}`;
modules.fixture=ts.transpileModule(fixture,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:runtime+`const root=ReactDOM.createRoot(document.getElementById('app'));window.mount=mode=>root.render(React.createElement(require('fixture').default,{mode,key:mode}));mount('hours');`});
 await page.waitForSelector('input');
 for(const width of [1366,768,390]){
 await page.setViewport({width,height:width===390?740:768});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow '+width);
 if(width===1366)assert(await page.$eval('[role=dialog]',e=>e.scrollHeight<=e.clientHeight+2&&e.getBoundingClientRect().bottom<=innerHeight),'desktop overflow');
 await page.screenshot({path:'/tmp/usage-reading-'+width+'.png'});
 }
 const click=async text=>{await page.evaluate(text=>[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===text).click(),text);};
 const fill=async text=>{await page.$eval('input',e=>{e.select()});await page.keyboard.press('Backspace');if(text)await page.type('input',text);};
 assert(await page.$$eval('button',els=>els.find(e=>e.textContent==='Review change').disabled));
 await fill('');await click('Review change');await page.waitForSelector('[role=alert]');
 await fill('2400');await click('Review change');await page.waitForSelector('output');assert.deepEqual(JSON.parse(await page.$eval('output',e=>e.textContent)),{mode:'hours',value:2400});
 await page.evaluate(()=>mount('km'));await page.waitForFunction(()=>document.querySelector('h3').textContent==='Correct kilometres');await fill('3000');await click('Review change');await page.waitForSelector('output');assert.equal(JSON.parse(await page.$eval('output',e=>e.textContent)).mode,'km');
 await page.evaluate(()=>mount('percent'));await page.waitForFunction(()=>document.querySelector('input').type==='number');await fill('101');await click('Review change');await page.waitForSelector('[role=alert]');assert.equal(await page.$('output'),null);
 await fill('30');await click('Review change');await page.waitForSelector('output');assert.deepEqual(JSON.parse(await page.$eval('output',e=>e.textContent)),{mode:'percent',value:30});
 await click('Cancel');assert(await page.evaluate(()=>window.cancelled));assert.deepEqual(errors,[]);
 console.log('PASS: reading form desktop/tablet/mobile, hours/km/percent, unchanged disabled, invalid input, lower reading review, Cancel.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
