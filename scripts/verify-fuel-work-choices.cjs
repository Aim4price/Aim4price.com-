/* Saved fuel work browser checks with synthetic data; no real writes. */
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


add('components/FuelWorkField');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH || await chromium.executablePath(),args:process.env.CANVAS_BROWSER_PATH?['--no-sandbox','--disable-dev-shm-usage']:chromium.args,headless:true,pipe:true});
 try {
  const page=await browser.newPage();await page.setViewport({width:430,height:900});
  if (process.env.FUEL_TEST_CPU_THROTTLE) await page.emulateCPUThrottling(Number(process.env.FUEL_TEST_CPU_THROTTLE));
  await page.setContent('<style>body{font-family:Arial;padding:20px;margin:0}*{box-sizing:border-box}'+sheets.join('\n')+'</style><div id="app"></div>');
  await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
  await page.addScriptTag({content:runtime+`
    crypto.randomUUID ??= ()=>'11111111-1111-4111-8111-111111111111';
    window.saved={choices:[{id:'planting',name:'Planting'},{id:'spraying',name:'Spraying'}],revision:0};
    window.fetch=async(url,options)=>{if(options?.method==='PUT'){const body=JSON.parse(options.body);window.saved={choices:body.choices,revision:body.revision+1};}return {ok:true,json:async()=>window.saved};};
    const Field=require('components/FuelWorkField').default;
    function Fixture({readonly}){const [value,setValue]=React.useState('Existing historical description');return React.createElement(Field,{asset:window.activityAsset || {kind:'tractor'},value,onChange:setValue,choices:readonly?window.saved.choices:undefined});}
    const root=ReactDOM.createRoot(document.getElementById('app'));window.render=(readonly=false)=>root.render(React.createElement(Fixture,{key:String(readonly),readonly}));window.render();
  `});
  await page.waitForSelector('button[aria-label="Edit Planting"]');await page.click('summary');
  assert.equal(await page.$eval('[aria-label="Edit Planting"]', button=>button.dataset.tooltip), 'Edit');
  assert.equal(await page.$eval('[aria-label="Delete Spraying"]', button=>button.dataset.tooltip), 'Delete');
  assert.ok(await page.$('[data-tooltip="Add activity"]'), 'Add activity uses the shared asset-register hover labels');
  async function fill(selector,value){await page.waitForSelector(selector,{visible:true});await page.waitForFunction(selector=>!document.querySelector(selector)?.disabled,{},selector);await page.$eval(selector,(node,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));},value);}
  async function click(text){
    await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===text && !b.disabled && b.getClientRects().length),{},text);
    const button=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text && !b.disabled && b.getClientRects().length),text);
    try {await button.asElement().click();} finally {await button.dispose();}
  }
  await click('Planting');assert.equal(await page.$eval('input[aria-label="Work activity"]',n=>n.value),'Planting');
  await page.click('[aria-label="Edit Planting"]');await fill('[aria-label="Work choice name"]','Plant maize');await click('Save activity');await page.waitForSelector('[aria-label="Edit Plant maize"]');
  assert.equal(await page.$eval('input[aria-label="Work activity"]',n=>n.value),'Planting','Renaming a saved choice does not rewrite the current entry');
  await page.click('[aria-label="Delete Spraying"]');assert.equal(await page.evaluate(()=>window.saved.choices.length),2);await click('Delete');await page.waitForFunction(()=>window.saved.choices.length===1);
  await click('Add activity');await fill('[aria-label="Work choice name"]','Irrigation');await click('Save activity');await page.waitForSelector('[aria-label="Edit Irrigation"]');
  assert.equal(await page.evaluate(()=>window.saved.revision),3);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No mobile overflow');
  await page.screenshot({path:'/tmp/fuel-work-choices.png'});
  await page.evaluate(()=>window.render(true));await page.waitForFunction(()=>!document.querySelector('[aria-label="Edit Plant maize"]'));await page.click('summary');await click('Plant maize');
  assert.equal(await page.$eval('input[aria-label="Work activity"]',n=>n.value),'Plant maize');
  await fill('[aria-label="Work activity"]','Plant maize in Block 4');assert.equal(await page.$eval('input[aria-label="Work activity"]',n=>n.value),'Plant maize in Block 4');
  await page.evaluate(()=>{window.activityAsset={kind:'vehicle',equipmentFamilyKey:'sedan_fastback'};window.render(true);});
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Delivery'));
  assert.ok(!(await page.evaluate(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Ploughing'))));
  await click('Delivery');assert.equal(await page.$eval('input[aria-label="Work activity"]',n=>n.value),'Delivery');
  console.log('PASS asset-specific suggestions, saved work selection, editing, confirmed deletion, adding, draft preservation and read-only mobile entry');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
