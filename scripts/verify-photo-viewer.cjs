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


add('components/LeadPhotoViewerModal');
add('components/PhotoViewerActions');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';



(async()=>{
 const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+'window.root=ReactDOM.createRoot(document.getElementById("app"));'});
 for(const [width,height] of [[1440,1000],[390,844],[844,390]]) {
  await page.setViewport({width,height});
  await page.evaluate(()=>{const c=document.createElement('canvas');c.width=500;c.height=1200;const ctx=c.getContext('2d');ctx.fillStyle='green';ctx.fillRect(0,0,500,1200);window.photo=c.toDataURL();window.root.render(React.createElement(require('components/LeadPhotoViewerModal').default,{assetKey:'fixture',title:'Test tractor',urls:Array(8).fill(window.photo),initialIndex:0,onClose:()=>{}}));});
  await page.waitForSelector('[role=dialog] img');await page.waitForFunction(()=>[...document.images].every(i=>i.complete));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No horizontal overflow');
  const bounds=await page.$eval('[role=dialog] img',img=>({fit:getComputedStyle(img).objectFit,height:img.getBoundingClientRect().height,parent:img.parentElement.getBoundingClientRect().height}));
  assert.equal(await page.$$eval('[role=dialog] img',nodes=>nodes.length),3,'Only active and neighbouring thumbnails load');
  assert.equal(bounds.fit,'contain');assert(bounds.height<=bounds.parent+1,'Image fits its frame');
  assert.equal(await page.$$eval('[role=dialog] button',nodes=>nodes.some(n=>n.textContent==='Delete photo')),false,'Recipients cannot delete');
  await page.screenshot({path:'/tmp/photo-viewer-'+width+'.png'});
 }
 await page.evaluate(()=>{window.deleted=0;window.edited=0;window.root.render(React.createElement(require('components/PhotoViewerActions').default,{url:window.photo,title:'Tractor',onEdit:()=>window.edited++,onDelete:async()=>window.deleted++}));});
 const click=async text=>{await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>b.textContent===t),{},text);await page.evaluate(t=>[...document.querySelectorAll('button')].find(b=>b.textContent===t).click(),text);};
 await click('Edit photos');assert.equal(await page.evaluate(()=>window.edited),1);
 await click('Delete photo');assert.equal(await page.evaluate(()=>window.deleted),0);await click('Cancel');assert.equal(await page.evaluate(()=>window.deleted),0);
 await click('Delete photo');await click('Confirm delete');await page.waitForFunction(()=>window.deleted===1);
 await page.evaluate(()=>{window.saved=null;HTMLAnchorElement.prototype.click=function(){window.saved={href:this.href,name:this.download};};});
 await click('Download');await page.waitForFunction(()=>window.saved);assert((await page.evaluate(()=>window.saved.name)).endsWith('.png'));
 assert.deepEqual(errors,[]);console.log('PASS full-photo fit at desktop, portrait and landscape widths; recipient permissions; owner edit/delete confirmation; original download');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
