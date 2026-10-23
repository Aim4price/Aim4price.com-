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


add('components/asset-register/AddAssetRegisterPicker');
add('components/asset-register/MoveAssetDestinationPicker');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';



(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],headless:true,pipe:true});
 try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:runtime+`;const root=ReactDOM.createRoot(document.getElementById('app'));window.selected='';window.moves=0;window.options=[{value:'a',label:'Skimmelkrans Boerdery Pty Ltd',description:'101 assets',currentValueInclVat:13214210},{value:'b',label:'A very long asset register business name to confirm responsive wrapping',description:'30 assets',currentValueInclVat:46199241},{value:'c',label:'Empty register',description:'0 assets',currentValueInclVat:0}];window.renderPicker=(mode)=>{function App(){const [target,setTarget]=React.useState('');return mode==='add'?React.createElement(require('components/asset-register/AddAssetRegisterPicker').default,{options:window.options,onSelect:id=>window.selected=id,onClose:()=>{},onCreate:async()=>{},busy:false}):React.createElement(require('components/asset-register/MoveAssetDestinationPicker').default,{options:window.options,assetName:'Test asset',assetDetails:'Year model: 2020',sourceName:'Source',destination:'register',onDestinationChange:()=>{},targetId:target,onSelect:setTarget,canUseUmbrellas:false,loading:false,loadError:'',error:'',busy:false,managementHref:'/asset-registers',onRetry:()=>{},onClose:()=>{},onMove:()=>window.moves++});}root.render(React.createElement(App,{key:mode}));};window.renderPicker('add');`});
 await page.waitForSelector('input[type=search]');
 const click=async text=>page.evaluate(text=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===text||b.querySelector('strong')?.textContent===text).click(),text);
 assert(await page.$eval('footer button',b=>b.disabled));
 await click('Skimmelkrans Boerdery Pty Ltd');assert.equal(await page.evaluate(()=>window.selected),'');
 assert.equal(await page.$$eval('button[aria-pressed=true]',els=>els.length),1);
 for(const width of [1280,390,320]){await page.setViewport({width,height:900});assert(await page.$eval('[role=dialog]',e=>e.getBoundingClientRect().right<=innerWidth+1));assert(await page.$eval('[role=dialog]',e=>e.scrollWidth<=e.clientWidth));assert(await page.$$eval('button[aria-pressed]',els=>els.every(e=>e.scrollHeight<=e.clientHeight+2)));await page.screenshot({path:'/tmp/register-choose-'+width+'.png'});}
 await click('Continue');assert.equal(await page.evaluate(()=>window.selected),'a');
 await page.type('input[type=search]','Empty');assert.equal(await page.$$eval('button[aria-pressed]',els=>els.length),1);
 await page.evaluate(()=>window.renderPicker('move'));await page.waitForFunction(()=>document.body.textContent.includes('Asset Register'));await click('Asset Register');await page.waitForSelector('input[type=search]');
 await click('Empty register');assert.equal(await page.evaluate(()=>window.moves),0);await click('Move asset');assert.equal(await page.evaluate(()=>window.moves),1);
 assert(await page.evaluate(()=>document.body.textContent.includes('Current value · incl. VAT')));
 for(const width of [1280,390,320]){await page.setViewport({width,height:900});assert(await page.$eval('[role=dialog]',e=>e.scrollWidth<=e.clientWidth));await page.screenshot({path:'/tmp/register-move-'+width+'.png'});}
 await click('Back');assert.equal(await page.$('input[type=search]'),null);
 assert.deepEqual(errors,[]);console.log('PASS register selection, confirmation, search, zero totals, long names and desktop/mobile layouts');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
