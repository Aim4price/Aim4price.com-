/* Real value-dialog layout and pagination with synthetic data; no real writes. */
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
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';


(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true,ignoreDefaultArgs:['--hide-scrollbars']});
 try{
 const page=await browser.newPage();await page.setViewport({width:1440,height:1000});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);page.on('request',request=>request.respond({status:200,contentType:'text/html',body:'<html></html>'}));await page.goto('https://aim4price.example/asset-register');
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;background:#dce7e0;font-family:Arial;--modal-backdrop-color:rgba(12,24,35,.42)}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+'window.root=ReactDOM.createRoot(document.getElementById("app"));window.renderValue=(suggest=false)=>window.root.render(React.createElement(require("components/asset-register/AssetValueDialog").default,{key:String(suggest)+String(window.renderCount=(window.renderCount||0)+1),suggest,endpoint:"/api/fixture/value",assetTitle:"2023 Tractor",onClose:()=>{window.valueClosed=(window.valueClosed||0)+1}}));'});
 await page.evaluate(()=>{
 if(!crypto.randomUUID)crypto.randomUUID=()=>String(Math.random());window.writes=[];window.data={asset:{id:'asset',title:'2023 Tractor',value:700000,replacementPrice:1000000,revision:'v1',manual:false},requests:[{id:'proposal',amount:800000,reason:'Inspected equipment',actor_name:'Example Dealer',status:'pending',submitted_value:700000}],history:[]};
 window.fetch=async(url,options)=>{if(!options?.method)return {ok:true,json:async()=>({...window.data,value:window.data.asset.value,manual:window.data.asset.manual,revision:window.data.asset.revision})};const b=JSON.parse(options.body);window.writes.push(b);if(b.action==='previewReset')return {ok:true,json:async()=>({revision:window.data.asset.revision,currentValue:window.data.asset.value,recalculatedValue:700000})};if(b.action==='resetAim4price'){window.data.asset.value=700000;window.data.asset.baseline=null;}if(b.action==='restoreManual')window.data.asset.value=600000;if(b.action==='suggest'&&window.data.asset.manual){window.data.asset.value=b.amount;return {ok:true,json:async()=>({ok:true,direct:true})};}if(b.action==='previewReplacement')return {ok:true,json:async()=>({revision:'v1',currentValue:window.data.asset.value,recalculatedValue:960000})};if(b.action==='replacement'){window.data.asset.replacementPrice=b.replacementPrice;if(b.mode==='recalculate')window.data.asset.value=b.expectedValue;}if(b.action==='approve'){window.data.asset.value=800000;window.data.requests[0].status='approved';}if(b.action==='override')window.data.asset.value=b.amount;return {ok:true,json:async()=>({ok:true})};};window.renderValue();
 });
 // Action cards include descriptive copy; match the exact heading, not that copy.
 async function click(text){
  await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>!b.disabled&&(b.querySelector('strong')?.textContent??b.textContent).trim()===t),{},text);
  await page.$$eval('button',(nodes,t)=>{
   const matches=nodes.filter(b=>!b.disabled&&(b.querySelector('strong')?.textContent??b.textContent).trim()===t);
   if(matches.length!==1)throw new Error(`Expected one enabled button for "${t}", found ${matches.length}`);
   matches[0].click();
  },text);
 }
 async function fill(selector,value){await page.waitForSelector(selector);await page.$eval(selector,(n,v)=>{Object.getOwnPropertyDescriptor(n.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(n,v);n.dispatchEvent(new Event('input',{bubbles:true}));},value);}

 await page.evaluate(()=>{window.data.requests=[];window.renderValue();});
 for(const [width,height] of [[1920,900],[1366,768],[390,667]]){
  await page.setViewport({width,height});await page.evaluate(()=>window.renderValue());
  await page.waitForFunction(()=>document.body.textContent.includes('Change current value'));
  for(const label of ['Manage values','Change current value','Change replacement price','History']){
   if(label!=='Manage values')await click(label);
   await new Promise(r=>setTimeout(r,80));
   const layout=await page.$eval('[role=dialog]',el=>({height:el.getBoundingClientRect().height,bottom:el.getBoundingClientRect().bottom,scrolling:[...el.querySelectorAll('*')].filter(n=>n.scrollHeight>n.clientHeight+2&&['auto','scroll'].includes(getComputedStyle(n).overflowY)).map(n=>n.className)}));
   assert.deepEqual(layout.scrolling,[],`${width} ${label}: internal scrollbar`);assert(layout.bottom<=height,`${width} ${label}: extends below viewport`);
   await page.screenshot({path:`/tmp/value-layout-${width}-${label.replaceAll(' ','-')}.png`});
   if(label!=='Manage values')await click('Back');
  }
 }
 await page.evaluate(()=>{window.data.history=Array.from({length:8},(_,i)=>({id:String(i),action:'Value updated',actor_name:'Owner',created_at:'2026-11-02T12:00:00Z',before_data:{amount:100000+i},after_data:{amount:110000+i,reason:'Updated following an inspection.'}}));window.renderValue();});
 await click('History');await page.waitForFunction(()=>document.body.textContent.includes('1 of 8'));await click('Next');await page.waitForFunction(()=>document.body.textContent.includes('2 of 8'));await click('Previous');await page.waitForFunction(()=>document.body.textContent.includes('1 of 8'));
 assert.deepEqual(errors,[]);console.log('PASS value layout at desktop, laptop and mobile sizes; history pagination');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
