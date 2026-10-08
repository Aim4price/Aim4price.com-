/* Shared-link/Leads dialog checks with synthetic data; no real writes. */
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


add('components/leads/SharedAssetExport');
add('components/asset-register/SharedAssetCards');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';


(async()=>{
 const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 try {
 const page=await browser.newPage();await page.setViewport({width:1440,height:1000});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:runtime+'window.fixtureRoot=ReactDOM.createRoot(document.getElementById("app"));'});
 await page.evaluate(()=>{
  window.requests=[];
  window.fetch=async(url,options)=>{window.requests.push({url,options});return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}});};
  window.fixtureRoot.render(React.createElement(require('components/leads/SharedAssetExport').default,{title:'2024 Landini Super 110',asset:{serialNumber:'SKB 17',yearModel:2024,usage:'439 hours',condition:'Good',replacementPriceExVat:700000,valueExVat:404600},photos:['https://files.example/photo.png'],attachments:[{name:'Shared valuation.pdf',url:'https://files.example/report.pdf'}]}));
 });
 const click=async text=>{await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(b=>(b.textContent.trim()===text||b.querySelector("strong")?.textContent===text)),{},text);await page.evaluate(text=>[...document.querySelectorAll('button')].find(b=>(b.textContent.trim()===text||b.querySelector("strong")?.textContent===text)).click(),text);};
 await click('Share');await page.waitForSelector('[aria-label="Share outside Aim4price"]');
 assert.equal(await page.$eval('[role="dialog"] h3',n=>n.textContent),'Share outside Aim4price');
 assert.equal(await page.evaluate(()=>window.requests.length),0,'Opening shares no files');
 assert.equal(await page.evaluate(()=>document.body.textContent.includes('Prepare selected files')),false);
 const message=await page.$eval('[aria-label="External asset details message preview"]',n=>n.textContent);
 assert(message.includes('SKB 17')&&message.includes('R 404 600'));
 await page.screenshot({path:'/tmp/shared-outside-modal.png'});
 await page.click('input[type="checkbox"]');await page.waitForFunction(()=>document.body.textContent.includes('1 photo')&&!document.body.textContent.includes('Preparing attachments'));
 await click('Add report');await page.waitForSelector('[data-download-dialog]');
 await page.click('[data-download-grid] button');await page.waitForSelector('[data-download-dialog]',{hidden:true});
 await page.waitForFunction(()=>document.body.textContent.includes('1 photo and 1 Aim4price report'));
 await page.click('[aria-label="Remove Shared valuation.pdf"]');
 await click('Add report');await page.waitForSelector('[data-download-dialog]');await page.keyboard.press('Escape');await page.waitForSelector('[data-download-dialog]',{hidden:true});
 assert(await page.$('[aria-label="Share outside Aim4price"]'),'Report cancel returns to outside sharing');
 await click('Email');await page.waitForSelector('dialog[open]');
 assert(await page.$eval('dialog[open]',n=>n.textContent.includes('Share via Email')));
 await page.keyboard.press('Escape');await page.waitForSelector('dialog[open]',{hidden:true});
 await page.setViewport({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Mobile has no horizontal overflow');
 await page.screenshot({path:'/tmp/shared-outside-mobile.png'});
 await page.click('[aria-label="Close outside sharing"]');await page.waitForSelector('[role="dialog"]',{hidden:true});
 assert.deepEqual(errors,[]);
 console.log('PASS direct outside-share modal, original asset copy, photo toggle, permitted report selection, return flow, consent and mobile layout');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
