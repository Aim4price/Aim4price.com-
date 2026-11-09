/* Owner valuation browser regression: real component/CSS, synthetic API fixtures; no live writes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
let cssIndex=0;
const stubs={'components/AppHeader':'module.exports=()=>null;', 'components/ListingAlertSettings':'module.exports=()=>null;', 'components/useWebsiteStyles':'exports.useWebsiteStyles=(native)=>native;', 'components/DateInput':'module.exports=()=>null;', 'app/dealer/dealer-nav':'module.exports=()=>null;', 'lib/use-dealer-app-root':'exports.useDealerAppRoot=()=>\"/dealer\";'};
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



add('app/valuation/valuation-client');add('app/owner-app/owner-app.module.css');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="next/dynamic")return ()=>()=>null;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({}),usePathname:()=>"/owner-app/valuation"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';

(async()=>{const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});try{
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:Number(process.env.VIEWPORT_WIDTH||393),height:852});
await page.setRequestInterception(true);page.on('request',r=>{let data={ok:true};const u=r.url();if(u.includes('/api/me'))data={ok:true,signedIn:true,user:{accountType:'owner'}};if(u.includes('/api/equipment-families'))data={ok:true,families:[{id:1,sectorId:1,sectorKey:'agricultural',sectorLabel:'Agricultural',familyKey:'round_baler',familyLabel:'Round Baler',isPropelled:false,usageMetricType:'percent',valuationMode:'percent_used',catalogMode:'generic_specs',sortOrder:1,isActive:true}]};if(u.includes('/api/generic-valuations')){const input=JSON.parse(r.postData()||'{}');const calc={replacementPriceBasis:'user',replacementPriceExVat:485000,aim4priceValueExVat:293250,valuationMidExVat:293250,marketabilityFactor:1,lifeWorkedPercent:50,lifeRemainingPercent:50};data={ok:true,result:{...input,sector:{id:1,key:'agricultural',label:'Agricultural'},family:{id:1,key:'round_baler',label:'Round Baler',usageMetricType:'percent',valuationMode:'percent_used',isPropelled:false,catalogMode:'generic_specs'},brand:{id:1,slug:'krone',name:'Krone'},replacementPriceBasis:'user',userReplacementCalculation:calc,selectedCalculation:calc,aim4priceValueExVat:293250,marketSources:[],notes:[],confidenceLabel:'Medium',confidenceScore:60}};}if(u.includes('/api/saleability/quote'))data={quote:{priceExVat:260000,resultLabel:'Realistic Market Value',modelVersion:'2'}};r.respond({contentType:'application/json',body:JSON.stringify(data)});});
await page.goto('https://preview.test');await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial;background:#eef5f0}'+fs.readFileSync(path.join(root,'app/modal-close.css'),'utf8')+sheets.join('\n')+'</style><div id="app"></div>');await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+'const C=require("app/valuation/valuation-client").default;ReactDOM.createRoot(document.getElementById("app")).render(React.createElement("div",{className:require("app/owner-app/owner-app.module.css").module+" "+require("app/owner-app/owner-app.module.css").appShell},React.createElement(C,{ownerAppMode:true})));'});

const shot=async name=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' must not overflow horizontally');if(name.startsWith('tour-') && Number(process.env.VIEWPORT_WIDTH||393)<=640) {
  await page.waitForFunction(()=>!document.querySelector('dialog[open]').getAnimations({subtree:true}).some(a=>a.playState==='running'));
  assert(await page.evaluate(step=>{
    const target=document.querySelector('[data-value-tour="'+step.replace('tour-','').replace('market','saleability')+'"]');
    const focus=target.querySelector('[data-value-tour-focus]')||target;
    const spot=document.querySelector('dialog [aria-hidden="true"]');
    const panel=document.querySelector('#value-tour-title').parentElement.getBoundingClientRect();
    if(!spot)return false;
    const r=focus.getBoundingClientRect(),s=spot.getBoundingClientRect();
    return s.top<=r.top+1 && s.bottom>=r.bottom-1 && s.left<=r.left+1 && s.right>=r.right-1 && (panel.top>=s.bottom-1 || panel.bottom<=s.top+1);
  },name),name+' must highlight the whole target without covering it');
}
await page.screenshot({path:'/tmp/value-real-'+(process.env.VIEWPORT_WIDTH||393)+'-'+name+'.png',fullPage:false});console.log('PASS screen',name);};
const click=async label=>{await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>!b.disabled&&b.getClientRects().length&&(b.innerText.trim()===t||b.getAttribute('aria-label')===t)),{},label);await page.evaluate(t=>[...document.querySelectorAll('button')].find(b=>!b.disabled&&b.getClientRects().length&&(b.innerText.trim()===t||b.getAttribute('aria-label')===t)).click(),label);};
await click('Choose Agricultural');await shot('modes');await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.startsWith('Basic')).click());await click('Round Baler');await shot('brand');
await page.type('input[placeholder="Enter the manufacturer"]','Krone');await page.type('input[placeholder="Model name or number"]','Fortima 1250MC');await click('Continue');await page.waitForFunction(()=>document.body.innerText.includes('Specification level'));await shot('level');
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.startsWith('Standard')).click());await click('Continue');await shot('specs');
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Choose year')).click());await shot('year');await click('Continue');
await page.click('#valuation-usage-step');await shot('usage');await click('Continue');
await page.click('#valuation-condition-step');await click('Use Basic condition');await shot('condition');await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.startsWith('Good')).click());await click('Continue');
await page.click('#valuation-popularity-step');await shot('popularity');await click('4 stars');await click('Continue');
await page.click('#valuation-extras-step');await click('Choose fitted extras');await shot('extras');await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Other extra')).click());await shot('extras-fields');
await page.type('input[placeholder="e.g. Weight set"]','Weight set');await page.type('input[placeholder="e.g. 25 000"]','25000');await click('Continue');await shot('details-ready');await click('Continue');await shot('replacement');
await page.type('input[placeholder="Enter price"]','460000');await click('Get my estimate');await shot('confirmation');await click('I understand, get my estimate');await page.waitForSelector('dialog[open]');await shot('tour-value');await click('Next');await shot('tour-replacement');await click('Next');await shot('tour-market');await click('Next');await shot('tour-details');await click('Done');await shot('result');await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.startsWith('Save to My Assets')).click());await shot('save-choice');await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Calculate market value')).click());await shot('market-route');
const choice=async text=>{await page.waitForFunction(t=>[...document.querySelectorAll('[aria-labelledby="saleability-title"] button')].some(b=>b.innerText.includes(t)),{},text);await page.evaluate(t=>[...document.querySelectorAll('[aria-labelledby="saleability-title"] button')].find(b=>b.innerText.includes(t)).click(),text);};await choice('Sell directly');await shot('market-time');await choice('Within 30 days');await shot('market-location');await choice('South Africa');await shot('market-demand');await choice('Normal');await shot('market-supply');await choice('A few');await page.waitForFunction(()=>document.body.innerText.includes('260,000'));await shot('market-result');assert.deepEqual(errors,[]);console.log('PASS complete owner valuation flow');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
