/* Facebook advert handoff with synthetic listing data; no external posts. */
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


add('components/FacebookAdvertActions');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';


(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:["--no-sandbox","--disable-setuid-sandbox","--disable-gpu","--disable-dev-shm-usage"],headless:true,pipe:true});
 try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);page.on('request',r=>r.respond({contentType:'text/html',body:'<html></html>'}));
 await page.goto('https://advert.test');
 const listing={id:'sample',title:'2014 Agrico Track Filler',yearModel:2014,usageUnit:'percent',lifeWorkedPercent:30,conditionLabel:'Good',familyLabel:'Disc Harrows',askingPriceExVat:39015,sellerCompany:'Example dealer',sellerName:'Dealer contact',sellerPhone:'0821234567',description:'Ready for inspection.',imageUrls:[]};
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial}#app{padding:16px;max-width:640px}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:runtime+';window.renderer=require("lib/marketplace-ad-renderer");ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(require("components/FacebookAdvertActions").default,{listing:'+JSON.stringify(listing)+'}));'});
 await page.waitForSelector('a');
 for(const width of [640,390,320]){
 await page.setViewport({width,height:800});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.equal(await page.$$eval('a',els=>els.filter(e=>e.target==='_blank'&&e.rel.includes('noopener')).length),2);
 await page.screenshot({path:'/tmp/facebook-advert-'+width+'.png'});
 }
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied=text;}}}));
 await page.click('button');await page.waitForFunction(()=>document.body.textContent.includes('Advert text copied.'));
 assert.match(await page.evaluate(()=>window.copied),/30% worked/);
 assert.match(await page.evaluate(()=>window.copied),/Ready for inspection/);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Denied');}}}));
 await page.click('button');await page.waitForSelector('textarea');
 assert.match(await page.$eval('textarea',e=>e.value),/0821234567/);
 await page.evaluate(async listing=>{
 const canvas=document.createElement('canvas');document.body.replaceChildren(canvas);
 await window.renderer.renderMarketplaceAdCanvas(canvas,window.renderer.marketplaceListingToAdContent(listing),{includeImages:false});
 canvas.style.width='100%';canvas.style.height='auto';
 },listing);
 await page.setViewport({width:1600,height:900});await page.screenshot({path:'/tmp/standard-advert.png'});
 assert.deepEqual(errors,[]);console.log('PASS: responsive Facebook actions, destinations, copy success/fallback and standard canvas rendering.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
