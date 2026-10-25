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
const start=client.indexOf("      {finalSaveIntent && !conversionAssetId && !saveMarketChoice");
const markup=client.slice(start,client.indexOf('      /> : null}',start)+'      /> : null}'.length);
add('components/asset-register/AddAssetRegisterPicker');add('components/EstimateSavePhotos');add('app/valuation/EstimatePriceInput');add('app/valuation/page.module.css');add('components/estimate-modal.module.css');
const breakdown=client.slice(client.indexOf('  function renderResultReplacementBreakdown()'),client.indexOf('  function getCurrentResultReplacementPriceExVat()'));
const fixture=`import React,{useState} from 'react';import AddAssetRegisterPicker from 'components/asset-register/AddAssetRegisterPicker';import EstimateSavePhotos from 'components/EstimateSavePhotos'; import EstimatePriceInput from 'app/valuation/EstimatePriceInput';import styles from 'app/valuation/page.module.css';import modalStyles from 'components/estimate-modal.module.css';
export default function Fixture(){
const [finalSaveEditing,setFinalSaveEditing]=useState(false);
const [savePhotoFiles,setSavePhotoFiles]=useState([]),[savePhotoMode,setSavePhotoMode]=useState('skip'),[requestedRegisterId,setRequestedRegisterId]=useState('farm'),[vatDisplayMode,setVatDisplayMode]=useState('excl');
const publishedEstimatePhotos=null,ownerAppMode=false,registersLoading=false;
const [registerLoadError,setRegisterLoadError]=useState(''),[finalSaveRegisterOpen,setFinalSaveRegisterOpen]=useState(false),[finalSaveRegisterBusy,setFinalSaveRegisterBusy]=useState(false);
const [dealerAssetRegisters,setDealerAssetRegisters]=useState([{id:'farm',businessName:'My farm'},{id:'business',businessName:'My business'}]);
const [userReplacementPrice,setUserReplacementPrice]=useState('9330000');
const [finalSaveIntent,setFinalSaveIntent]=useState('asset-register');
const finalSaveTitle=finalSaveIntent==='marketplace'?'Create advert':'Save to Asset Register',finalSaveDescription=finalSaveIntent==='marketplace'?'Check your values before creating the advert.':'Review your values and choose where to save.',finalSaveCta=finalSaveIntent==='marketplace'?'Save and continue':'Save asset';
const conversionAssetId=null,saveMarketChoice=null,isDealerAccount=false,saveLoading=false,replacementRecalculateLoading=false,advancedRecalculateLoading=false,basicEstimateActive=true,finalSaveInputPrice=Number(userReplacementPrice),finalSaveCanConfirm=true,finalSaveHasPendingReplacementPrice=false,finalSaveError='',headlineValue=4625068,finalSaveReplacementPrice=9330000;
const closeFinalSaveModal=()=>{},recalculateFinalReplacementPrice=()=>{},confirmFinalSaveAction=()=>{},getVatDisplayLabel=mode=>mode==='incl'?'VAT included':'VAT excluded',getVatDisplayValue=(v,mode)=>mode==='incl'?v*1.15:v,money=v=>'R '+String(Math.round(v)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ');
const resultState={kind:'generic',result:{specsJson:{basic_extra_replacement_price_ex_vat:0}}},getCurrentResultReplacementPriceExVat=()=>9330000;
${client.slice(client.indexOf('  async function createFinalSaveRegister('),client.indexOf('  function openFinalSaveModal('))}
${breakdown}
return <><button onClick={()=>{setDealerAssetRegisters([]);setRequestedRegisterId('');}}>New user fixture</button><button onClick={()=>setFinalSaveIntent('marketplace')}>Advert fixture</button>${markup}</>;
}`;
modules.fixture=ts.transpileModule(fixture,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';






(async()=>{const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox'],headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1366,height:900});
 await page.setContent('<style>*{box-sizing:border-box}body{font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+"ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(require('fixture').default));"});
 await page.addStyleTag({content:fs.readFileSync(path.join(root,'public/app-theme.css'),'utf8')});
 await page.waitForSelector('#final-save-title');
 assert(await page.$eval('[aria-labelledby="final-save-title"]',el=>el.scrollHeight<=el.clientHeight+2));
 await page.screenshot({path:'/tmp/save-simple.png'});
 await page.evaluate(()=>{document.getElementById('app').style.zoom='1.25';document.getElementById('app').style.setProperty('--website-visible-height',innerHeight/1.25+'px');document.getElementById('app').style.setProperty('--website-visible-width',innerWidth/1.25+'px');});
 assert(await page.$eval('[aria-labelledby="final-save-title"]',el=>el.scrollHeight<=el.clientHeight+2),'Compact review fits at enlarged website zoom');
 await page.screenshot({path:'/tmp/save-polish-zoom.png'});
 await page.evaluate(()=>{document.getElementById('app').style.zoom='1';document.getElementById('app').style.removeProperty('--website-visible-height');document.getElementById('app').style.removeProperty('--website-visible-width');});
 // Use the real shared picker and creation form; mock only the HTTP boundary.
 await page.evaluate(()=>{window.registerRequests=[];window.failRegister=false;window.fetch=async(url,options)=>{window.registerRequests.push(JSON.parse(options.body));return {ok:!window.failRegister,json:async()=>window.failRegister?{ok:false,error:'Please try again.'}:{ok:true,register:{id:'new',businessName:'New farm'},registers:[{id:'new',businessName:'New farm'}]}};};});
 await page.click('[aria-labelledby="final-save-register-label final-save-register-name"]');
 await page.waitForSelector('[aria-label="Search asset registers"]');
 await page.screenshot({path:'/tmp/save-register-picker.png'});
 await page.type('[aria-label="Search asset registers"]','business');
 assert.equal(await page.$$eval('[aria-label="Available asset registers"] button',els=>els.length),1);
 await page.click('[aria-label="Available asset registers"] button');
 await page.$$eval('button',els=>els.find(el=>el.textContent==='Continue').click());
 assert.equal(await page.$eval('#final-save-register-name',el=>el.textContent),'My business');
 await page.$$eval('button',els=>els.find(el=>el.textContent==='New user fixture').click());
 await page.click('[aria-labelledby="final-save-register-label final-save-register-name"]');
 await page.waitForSelector('input[placeholder="Example: Bashan Boerdery Pty Ltd"]');
 await page.screenshot({path:'/tmp/save-register-create.png'});
 assert.equal(await page.$('[aria-label="Search asset registers"]'),null,'New users open the standard create form directly');
 await page.keyboard.press('Escape');
 await page.waitForSelector('#final-save-title');
 await page.click('[aria-labelledby="final-save-register-label final-save-register-name"]');
 await page.type('input[placeholder="Example: Bashan Boerdery Pty Ltd"]','New farm');
 await page.evaluate(()=>window.failRegister=true);
 await page.click('button[type="submit"]');
 await page.waitForSelector('[role="alert"]');
 assert.equal(await page.$eval('input[placeholder="Example: Bashan Boerdery Pty Ltd"]',el=>el.value),'New farm');
 await page.evaluate(()=>window.failRegister=false);
 await page.click('button[type="submit"]');
 await page.waitForSelector('#final-save-register-name');
 assert.equal(await page.$eval('#final-save-register-name',el=>el.textContent),'New farm');
 assert.equal(await page.evaluate(()=>window.registerRequests.length),2);
 assert.equal(await page.evaluate(()=>window.registerRequests[1].businessName),'New farm');
 assert(await page.$eval('[aria-labelledby="final-save-title"]',el=>el.textContent.includes('R 4 625 068')),'Valuation survives register creation');
 await page.$$eval('[aria-label="Save values VAT basis"] button',els=>els[1].click());
 assert(await page.$eval('[aria-labelledby="final-save-title"]',el=>el.textContent.includes('R 10 729 500')));
 await page.$$eval('[aria-label="Save values VAT basis"] button',els=>els[0].click());
 await page.$eval('input[type=file]',el=>{
   const transfer=new DataTransfer();transfer.items.add(new File(['fixture'],'asset.png',{type:'image/png'}));el.files=transfer.files;el.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.waitForSelector('[aria-label="Remove photo 1"]');
 assert(await page.$eval('[aria-labelledby="final-save-title"]',el=>el.scrollHeight<=el.clientHeight+2));
 await page.click('[aria-label="Remove photo 1"]');

 await page.click('[aria-controls="final-save-edit-values"]');
 await page.waitForSelector('[data-estimate-price-entry] input');
 assert.deepEqual(errors,[]);
 assert.equal(await page.$eval('[data-estimate-price-entry]',el=>getComputedStyle(el).backgroundColor),'rgb(237, 245, 240)');
 assert.equal(await page.$eval('[data-estimate-price-entry] input',el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
 await page.click('[data-estimate-price-entry] input',{clickCount:3});await page.keyboard.press('Backspace');await page.type('[data-estimate-price-entry] input','25000');
 assert.equal(await page.$eval('[data-estimate-price-entry] input',el=>el.value),'25 000');
 await page.click('[aria-controls="final-save-edit-values"]');
 await page.screenshot({path:'/tmp/save-review.png'});
 await page.$$eval('button',els=>els.find(e=>e.textContent==='Advert fixture').click());
 await page.waitForFunction(()=>document.querySelector('#final-save-title').textContent==='Create advert');
 assert(await page.$eval('[aria-labelledby="final-save-title"]',el=>el.scrollHeight<=el.clientHeight+2));
 await page.screenshot({path:'/tmp/advert-review.png'});
 await page.setViewport({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('PASS full green currency control, grouped entry, save/ad review fit and mobile containment');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
