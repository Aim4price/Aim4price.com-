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


add('components/ReportDownloadFlow');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH || await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});
 try {
  for (const [width,height,fontSize] of [[1280,700,20],[390,844,16],[768,700,18]]) {
   const page=await browser.newPage();await page.setViewport({width,height});
   await page.setContent('<style>html{font-size:'+fontSize+'px}body{font-family:Arial;margin:0;height:2000px}*{box-sizing:border-box}'+sheets.join('\n')+'</style><div id="app"></div>');
   await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
   await page.addScriptTag({content:runtime+`
    const Flow=require('components/ReportDownloadFlow').default;
    const root=ReactDOM.createRoot(document.getElementById('app'));let sequence=0;
    window.render=()=>{window.calls=[];window.closeCount=0;root.render(React.createElement(Flow,{key:++sequence,title:'Fuel slip reports',allLabel:'All fuel slips',assets:[],lockedAssetId:'all',instantDownload:true,compactTimeline:true,fields:[{key:'capture',label:'Source / status',initial:'all',options:[{value:'all',label:'All fuel slips'}]},{key:'storage',label:'Storage tank',initial:'all',options:[{value:'all',label:'All targets'}]}],onDownload:async selection=>{window.calls.push(selection);if(window.fail)throw Error('Please try again');},onClose:()=>window.closeCount++}));};window.render();
   `});
   await page.waitForSelector('[data-download-dialog]');
   const layout=await page.evaluate(()=>{const d=document.querySelector('[data-download-dialog]'),b=d.querySelector('[data-download-body]'),f=d.querySelector('footer');return {right:d.getBoundingClientRect().right,bottom:d.getBoundingClientRect().bottom,footer:f.getBoundingClientRect().bottom,bodyOverflow:b.scrollHeight-b.clientHeight,scrollbar:getComputedStyle(b).scrollbarWidth,root:getComputedStyle(document.documentElement).overflow,columns:getComputedStyle(b.firstElementChild).gridTemplateColumns};});
   assert.ok(layout.right<=width+1&&layout.bottom<=height+1&&layout.footer<=height,'Dialog and actions remain within viewport '+JSON.stringify(layout));
   assert.equal(layout.scrollbar,'none');assert.equal(layout.root,'hidden');
   if(width>=768)assert.ok(layout.bodyOverflow<=1,'Desktop timeline fits without scrolling');
   await page.screenshot({path:'/tmp/fuel-download-'+width+'.png'});
   const click=async text=>page.evaluate(text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text)?.click(),text);
   for(const [label,format] of [['PDF report','pdf'],['XLSX workbook','xlsx']]) {
    await click('Next');await page.waitForSelector('[aria-label="Report format"]');
    assert.equal(await page.evaluate(()=>[...document.querySelectorAll('footer button')].some(b=>b.textContent==='Next')),false);
    await page.evaluate(label=>[...document.querySelectorAll('[data-download-option]')].find(b=>b.textContent.includes(label)).click(),label);
    await page.waitForFunction(()=>window.calls.length===1&&window.closeCount===1);
    assert.equal(await page.evaluate(()=>window.calls[0].format),format);
    await page.evaluate(()=>window.render());await page.waitForFunction(()=>document.querySelector('h2')?.textContent==='Choose report timeline');
   }
   await page.evaluate(()=>window.fail=true);await click('Next');await page.waitForSelector('[aria-label="Report format"]');
   await page.evaluate(()=>document.querySelector('[aria-label="Report format"] button').click());await page.waitForSelector('[role="alert"]');assert.equal(await page.evaluate(()=>window.closeCount),0);
   await page.close();console.log('PASS fuel download '+width+'px: visible actions, no scrollbar, direct PDF/Excel and recoverable errors');
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
