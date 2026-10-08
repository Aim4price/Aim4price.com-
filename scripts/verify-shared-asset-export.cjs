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
  window.requests=[];window.shares=[];window.downloads=[];window.denied=false;window.supported=true;window.cancel=false;
  window.fetch=async(url,options)=>{window.requests.push({url,options});return window.denied?new Response('Denied',{status:403}):new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}});};
  Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>window.supported});
  Object.defineProperty(navigator,'share',{configurable:true,value:async(data)=>{if(window.cancel)throw new DOMException('Cancelled','AbortError');window.shares.push(data);}});
  URL.createObjectURL=(blob)=>{window.downloads.push(blob);return 'blob:fixture';};
  HTMLAnchorElement.prototype.click=function(){};
  window.fixtureRoot.render(React.createElement(require('components/leads/SharedAssetExport').default,{title:'2024 Landini Super 110',details:'Serial / VIN: SKB 17',photos:['https://files.example/photo.png','https://files.example/photo2.png']}));
 });
 const click=async text=>{await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(b=>b.textContent===text),{},text);await page.evaluate(text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text).click(),text);};
 await click('Share / Download');await page.waitForSelector('[role="dialog"]');
 assert.equal(await page.$eval('button[class*="primary"]',b=>b.disabled),true);
 assert.equal(await page.evaluate(()=>window.requests.length),0,'Opening does not download or forward files');
 await click('Select all');await click('Prepare selected files');await page.waitForFunction(()=>document.body.textContent.includes('Your files are ready.'));
 assert.equal(await page.evaluate(()=>window.shares.length),0);
 await click('Download ZIP');
 const archive=await page.evaluate(async()=>Array.from(new Uint8Array(await window.downloads[0].arrayBuffer())));
 fs.writeFileSync('/tmp/shared-export-test.zip',Buffer.from(archive));
 await click('Share outside Aim4price');assert.equal(await page.evaluate(()=>window.shares[0].files.length),3);
 assert.equal(await page.evaluate(()=>window.shares[0].url),undefined,'No access link is forwarded');
 await page.evaluate(()=>{window.cancel=true;});await click('Share outside Aim4price');
 assert.equal(await page.evaluate(()=>window.shares.length),1,'Cancelled sharing sends nothing');
 await page.screenshot({path:'/tmp/shared-export-desktop.png'});
 await page.setViewport({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Mobile has no horizontal overflow');
 await page.screenshot({path:'/tmp/shared-export-mobile.png'});
 await click('Clear selection');await page.evaluate(()=>{window.denied=true;});await click('Select all');await click('Prepare selected files');
 await page.waitForFunction(()=>document.body.textContent.includes('unavailable. Refresh'));
 assert.equal(await page.$$eval('button',nodes=>nodes.some(n=>n.textContent==='Download ZIP')),false,'Failed access produces no partial archive');
 await page.evaluate(()=>{window.denied=false;window.supported=false;});await click('Prepare selected files');await page.waitForFunction(()=>document.body.textContent.includes('attach them in WhatsApp or email'));
 assert.equal(await page.$$eval('button',nodes=>nodes.find(n=>n.textContent==='Share outside Aim4price').disabled),true);
 await page.keyboard.press('Escape');await page.waitForSelector('[role="dialog"]',{hidden:true});
 await page.setViewport({width:1440,height:1000});
 await page.evaluate(()=>window.fixtureRoot.render(React.createElement(require('components/asset-register/SharedAssetCards').default,{share:{createdAt:'2026-10-08',assets:[{assetId:'test',title:'2024 Landini Super 110',yearModel:2024,usage:'439 hours',condition:'Good',serialNumber:'SKB 17',photoUrls:[],valueExVat:404600,replacementPriceExVat:700000}]},enquiry:{token:'a'.repeat(43),access:'read-only',permissions:{},reports:[]}})));
 await page.waitForSelector('[aria-label="Open 2024 Landini Super 110"]');await page.click('[aria-label="Open 2024 Landini Super 110"]');
 const actions=await page.$eval('[class*="exportHeaderActions"]',n=>({overflow:n.scrollWidth>n.clientWidth+1,tops:[...n.querySelectorAll(':scope > button')].map(b=>b.getBoundingClientRect().top)}));
 assert.equal(actions.overflow,false);assert(actions.tops.every(t=>Math.abs(t-actions.tops[0])<1));
 await page.screenshot({path:'/tmp/shared-export-card.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS selections, ZIP download, native file share, cancellation, unsupported browser, access denial, mobile and card layout');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
