/* Owner valuation browser regression: real component/CSS, synthetic API fixtures; no live writes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const appMode=process.env.APP_MODE||'owner',appRoot=appMode==='owner'?'/owner-app':'/'+appMode;
const extended=process.env.DETAILS_EXTENDED==='1';
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
let cssIndex=0;
const stubs={'components/AppHeader':'module.exports=()=>null;', 'components/ListingAlertSettings':'module.exports=()=>null;', 'components/useWebsiteStyles':'exports.useWebsiteStyles=(native)=>native;', 'components/DateInput':'module.exports=()=>null;', 'lib/use-dealer-app-root':'exports.useDealerAppRoot=()=>'+JSON.stringify(appMode==='middleman'?'/middleman':'/dealer')+';'};
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



add('components/app-flow.module.css');add('app/valuation/valuation-client');add('app/owner-app/owner-app.module.css');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="next/dynamic")return ()=>()=>null;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({back(){},push(href){window.__lastNavigation=href;},replace(){}}),usePathname:()=>'+JSON.stringify(appRoot+'/valuation')+'};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';

(async()=>{const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});try{
const page=await browser.newPage();const errors=[];const saves=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:Number(process.env.VIEWPORT_WIDTH||393),height:Number(process.env.VIEWPORT_HEIGHT||852)});
await page.setRequestInterception(true);page.on('request',r=>{let data={ok:true};const u=r.url();if(u.includes('/api/asset-registers'))data={ok:true,registers:Array.from({length:12},(_,i)=>({id:'register-'+i,businessName:'Farm register '+i,isSelected:i===0}))};if(u.includes('/api/valuation-runs')){saves.push(JSON.parse(r.postData()));data=saves.length===1?{ok:false,error:'Save failed. Please try again.'}:{ok:true,assetId:'saved-test-asset'};}if(u.includes('/api/me'))data={ok:true,signedIn:true,user:{accountType:appMode==='owner'?'owner':'dealer'}};if(u.includes('/api/equipment-families'))data={ok:true,families:[{id:1,sectorId:1,sectorKey:'agricultural',sectorLabel:'Agricultural',familyKey:'round_baler',familyLabel:'Round Baler',isPropelled:false,usageMetricType:'percent',valuationMode:'percent_used',catalogMode:'generic_specs',sortOrder:1,isActive:true}]};if(extended&&u.includes('/api/equipment-families'))Object.assign(data.families[0],{familyKey:'small_field_tractor',familyLabel:'Small Field Tractor',isPropelled:true,usageMetricType:'hours',valuationMode:'hours'});if(u.includes('/api/equipment-families')){const base=data.families[0];data.families.push(...Array.from({length:18},(_,i)=>({...base,id:i+2,familyKey:'fixture_'+i,familyLabel:'Feed equipment type '+(i+1)})));}if(u.includes('/api/generic-valuations')){const input=JSON.parse(r.postData()||'{}');const calc={replacementPriceBasis:'user',replacementPriceExVat:485000,aim4priceValueExVat:293250,valuationMidExVat:293250,marketabilityFactor:1,lifeWorkedPercent:50,lifeRemainingPercent:50};data={ok:true,result:{...input,sector:{id:1,key:'agricultural',label:'Agricultural'},family:{id:1,key:'round_baler',label:'Round Baler',usageMetricType:'percent',valuationMode:'percent_used',isPropelled:false,catalogMode:'generic_specs'},brand:{id:1,slug:'krone',name:'Krone'},replacementPriceBasis:'user',userReplacementCalculation:calc,selectedCalculation:calc,aim4priceValueExVat:293250,marketSources:[],notes:[],confidenceLabel:'Medium',confidenceScore:60}};}if(u.includes('/api/saleability/quote'))data={quote:{priceExVat:260000,resultLabel:'Realistic Market Value',modelVersion:'2',ease:{score:74,version:'2',provisional:false}}};r.respond({contentType:'application/json',body:JSON.stringify(data)});});
await page.goto('https://preview.test');await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial;background:#eef5f0}'+fs.readFileSync(path.join(root,'app/modal-close.css'),'utf8')+sheets.join('\n')+'</style><div id="app"></div>');await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+'const C=require("app/valuation/valuation-client").default;const owner='+JSON.stringify(appMode==='owner')+';const css=require(owner?"app/owner-app/owner-app.module.css":"app/dealer/dealer.module.css");ReactDOM.createRoot(document.getElementById("app")).render(React.createElement("div",{className:(owner?css.appShell:css.dealerLayout)+" "+require("components/app-flow.module.css").surface},React.createElement("div",{className:css.module+" "+(owner?"":css.compactWorkspace)},React.createElement(C,'+JSON.stringify(appMode==='owner'?{ownerAppMode:true}:{dealerAppMode:true})+'))));'});

const shot=async name=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' must not overflow horizontally');if(['sector','modes','family'].includes(name)){assert(await page.$eval('[data-valuation-action="back"]',e=>getComputedStyle(e.parentElement).display==='none'),'Entry screens use the permanent Back control');if(name==='sector'&&Number(process.env.VIEWPORT_WIDTH||393)<=640)assert(await page.$$eval('[aria-label^="Choose "]',els=>els.length===4&&els.every(e=>{const h=e.getBoundingClientRect().height;return h>=80&&h<=112;})),'Sector cards keep compact touch-friendly heights');if(Number(process.env.VIEWPORT_WIDTH||393)<=640)assert(await page.$eval('#valuation-wizard-card',e=>e.getBoundingClientRect().bottom<=innerHeight-8),'Entry content should fit the phone viewport');}if(name.startsWith('tour-') && Number(process.env.VIEWPORT_WIDTH||393)<=640) {
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
await page.screenshot({path:'/tmp/value-real-'+appMode+'-'+(process.env.VIEWPORT_WIDTH||393)+'-'+name+'.png',fullPage:false});console.log('PASS screen',name);};
const click=async label=>{await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>!b.disabled&&b.getClientRects().length&&(b.innerText.trim()===t||b.getAttribute('aria-label')===t)),{},label);await page.evaluate(t=>[...document.querySelectorAll('button')].find(b=>!b.disabled&&b.getClientRects().length&&(b.innerText.trim()===t||b.getAttribute('aria-label')===t)).click(),label);};
await shot('sector');await click('Choose Agricultural');await shot('modes');await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.startsWith('Basic')).click());await shot('family');if(process.env.ENTRY_ONLY==='1'){assert.deepEqual(errors,[]);console.log('PASS opening valuation screens');return;}await page.type('input[placeholder="e.g. tractor, baler, spreader"]',extended?'Tractor':'Round');await click(extended?'Small Field Tractor':'Round Baler');await shot('brand');
await page.type('input[placeholder="Enter the manufacturer"]','Krone');await page.type('input[placeholder="Model name or number"]','Fortima 1250MC');await click('Continue');await page.waitForFunction(()=>document.body.innerText.includes('Specification level'));await shot('level');
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.startsWith('Standard')).click());await click('Continue');await shot('specs');
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Choose year')).click());await shot('year');await click('Continue');
await page.click('#valuation-usage-step');await shot('usage');
if(extended)await page.type('input[placeholder="e.g. 3 500"]','4000');
await click('Continue');
if(extended){await page.waitForSelector('#usage-lifetime-title');await shot('lifetime');await click('Continue');}
await page.click('#valuation-condition-step');await click('Use Basic condition');await shot('condition');await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.startsWith('Good')).click());await click('Continue');
if(extended){
 await page.click('#valuation-condition-step');await click('Use Advanced condition');
 for(let i=0;i<5;i++){
  await page.waitForFunction(()=>document.querySelector('[class*="advancedQuestionHeading"]'));
  await shot('advanced-'+i);
  const heading=await page.$eval('[class*="advancedQuestionHeading"]',e=>e.textContent);
  await page.evaluate(()=>document.querySelector('button[class*="dealerAssessmentOption"]').click());
  if(i<4)await page.waitForFunction(old=>document.querySelector('[class*="advancedQuestionHeading"]')?.textContent!==old,{},heading);
 }
 await click('Continue');
}
await page.click('#valuation-popularity-step');await shot('popularity');await click('4 stars');await click('Continue');
await page.click('#valuation-extras-step');await click('Choose fitted extras');await shot('extras');await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Other extra')).click());await shot('extras-fields');
await page.type('input[placeholder="e.g. Weight set"]','Weight set');await page.type('input[placeholder="e.g. 25 000"]','25000');await click('Continue');await shot('details-ready');await click('Continue');await shot('replacement');
await page.type('input[placeholder="Enter price"]','460000');await click('Get my estimate');await shot('confirmation');if(process.env.DETAILS_ONLY==='1'){assert.deepEqual(errors,[]);console.log('PASS all valuation detail screens');return;}await click('I understand, get my estimate');await page.waitForSelector('dialog[open]');await shot('tour-value');await click('Next');await shot('tour-replacement');await click('Next');await shot('tour-market');await click('Next');await shot('tour-details');if(extended){await click('Next');await shot('tour-assumptions');}await click('Done');await shot('result');
await page.click('[data-value-tour="replacement"] > button');await shot('replacement-edit');await click('Cancel');
assert(await page.$$eval('[class*=resultPriceParts] dd',els=>els.length===3&&els.every(e=>e.scrollWidth<=e.clientWidth+1 && e.getBoundingClientRect().height<35)),'Replacement amounts stay on one line');
if(appMode==='middleman') { assert(!(await page.evaluate(()=>document.body.innerText)).includes('Save to Asset Register'),'Middleman has no register action'); assert(await page.$eval('[data-result-action="create-ad"]',e=>!e.disabled),'Middleman can create an advert without a register'); }if(appMode==='owner'){await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.startsWith('Save to My Assets')).click());await shot('save-choice');
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Save with Ideal Value only')).click());await shot('save-review');assert(await page.$eval('[data-final-save-scroll-body]',e=>{
  const overflows=e.scrollHeight>e.clientHeight+1;
  e.scrollTop=e.scrollHeight;
  const body=e.getBoundingClientRect(),destination=e.querySelector('#final-save-register-trigger').getBoundingClientRect();
  return ['auto','scroll'].includes(getComputedStyle(e).overflowY)
    && (!overflows||e.scrollTop>0)
    && destination.top>=body.top-1&&destination.bottom<=body.bottom+1
    && destination.top>=0&&destination.bottom<=innerHeight;
}),'Save destination is visible, with scrolling when content overflows');await shot('save-destination');
await page.click('#final-save-register-trigger');await page.waitForSelector('input[aria-label="Search asset registers"]');await shot('register-picker');
await page.type('input[aria-label="Search asset registers"]','Farm register 11');
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Farm register 11')).click());await click('Continue');
assert.equal(await page.$eval('#final-save-register-name',e=>e.textContent),'Farm register 11');
await click('Save asset');await page.waitForFunction(()=>document.body.innerText.includes('Save failed. Please try again.'));
assert.equal(saves[0].registerId,'register-11');await shot('save-error');
await click('Save asset');await page.waitForFunction(()=>window.__lastNavigation==='/owner-app/assets/saved-test-asset');assert.equal(saves[1].registerId,'register-11');
await click('Close final save step');
await page.click('[data-result-action="download-pdf"]');await shot('pdf-options');await click('Close PDF options');
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.startsWith('Save to My Assets')).click());
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Calculate market value')).click());}else{await click('Calculate Realistic Market Value');}await shot('market-route');
const choice=async text=>{await page.waitForFunction(t=>[...document.querySelectorAll('[aria-labelledby="saleability-title"] button')].some(b=>b.innerText.includes(t)),{},text);await page.evaluate(t=>[...document.querySelectorAll('[aria-labelledby="saleability-title"] button')].find(b=>b.innerText.includes(t)).click(),text);};await choice('Sell directly');await shot('market-time');await choice('Within 30 days');await shot('market-location');await choice('South Africa');await shot('market-demand');await choice('Normal');await shot('market-supply');await choice('A few');await page.waitForFunction(()=>document.body.innerText.includes('260,000'));await shot('market-result');
if(appMode==='owner') {
 await click('Done');await click('Close final save step');await page.click('[data-result-action="create-ad"]');await click('Save and continue');
 await page.waitForSelector('form[class*="marketplacePublishModal"]');await shot('advert-top');
 assert(await page.$eval('form[class*="marketplacePublishModal"]',e=>{e.scrollTop=e.scrollHeight;return e.scrollTop>0&&['auto','scroll'].includes(getComputedStyle(e).overflowY);}),'Advert must scroll to its actions');
 await shot('advert-bottom');
 assert(await page.$eval('form[class*="marketplacePublishModal"] button[type="submit"]',e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'Advert submit stays reachable');
 await click('Close marketplace modal');
}
assert.deepEqual(errors,[]);console.log('PASS complete '+appMode+' valuation flow');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
