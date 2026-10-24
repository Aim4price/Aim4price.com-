/* Browser checks for expanded asset detail styles and market-price actions. */
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


add('components/asset-register/AssetMarketDetail');
add('components/asset-register/AssetDetailIcon');
add('app/asset-register/page.module.css');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';



(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],headless:true,pipe:true});
 try {
 const page=await browser.newPage();
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:runtime+`const h=React.createElement,s=require('app/asset-register/page.module.css'),c=require('components/asset-register/AssetCardDetails.module.css'),Icon=require('components/asset-register/AssetDetailIcon').default,Market=require('components/asset-register/AssetMarketDetail').default;window.opens=0;const root=ReactDOM.createRoot(document.getElementById('app'));window.render=(canvas,saved)=>{document.documentElement.toggleAttribute('data-test-canvas',canvas);root.render(h('div',canvas?{'data-website-canvas':true,style:{width:1440}}:{},h('div',{className:s.assetDetailsPanel,style:{width:canvas?750:'100%',maxWidth:750,margin:'auto',padding:16}},h('div',{className:s.assetDetailsGrid},h('div',{className:s.assetPrimaryDetails},[['serial','Serial / VIN','SKB 4'],['registration','Registration','CAW 122851'],['year','Year','2023'],['usage','Usage','162 602 km'],['condition','Condition','Requires attention']].map(([kind,label,value])=>h('button',{className:s.assetDetailRow,key:kind},h('span',{className:c.detailLabel},h(Icon,{kind}),label),h('strong',null,value)))),h('div',{className:s.assetStatusDetails},[['Financed','No'],['Insured','Unknown'],['Licensed','Yes'],['Mapped','NotApplicable']].map(([label,status])=>h('button',{className:s.assetStatusRow,key:label},h('span',null,label),h('strong',{className:s.assetStatusMark+' '+s['statusMark'+status]},status==='Yes'?'✓':status==='No'?'×':status==='Unknown'?'?':'N/A'))))),h('div',{className:s.assetReplacementPriceBubble},h('span',{className:c.detailLabel},h(Icon,{kind:'replacement'}),'Replacement price'),h('strong',null,'R 450 000'),h('small',null,'Excl. VAT')),h(Market,{saved:saved?{priceExVat:300000}:undefined,stale:saved,included:false,loading:false,error:false,canCalculate:true,onCalculate:()=>window.opens++}))));};window.render(false,false);`});
 await page.waitForSelector('[aria-label="Realistic Market Value"]');
 for(const width of [1440,900,390,320]){
  await page.setViewport({width,height:1000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'native overflow '+width);
  assert(await page.$$eval('button',els=>els.every(e=>e.scrollWidth<=e.clientWidth+2)),'button overflow '+width);
  const serial=await page.$eval('[data-detail-icon="serial"]',e=>({height:e.parentElement.getBoundingClientRect().height,text:e.parentElement.textContent}));assert.equal(serial.text,'Serial / VIN');
  await page.screenshot({path:'/tmp/asset-polish-'+width+'.png'});
 }
 await page.click('[aria-label="Open Realistic Market Value"]');assert.equal(await page.evaluate(()=>window.opens),1);
 await page.evaluate(()=>window.render(true,true));await page.waitForSelector('[role=status]');
 assert(await page.$eval('[role=status]',e=>e.textContent==='Update needed'));
 await page.setViewport({width:1440,height:1000});await page.screenshot({path:'/tmp/asset-polish-canvas.png'});
 console.log('PASS: native widths 1440/900/390/320, canonical canvas, calculation action and stale value status.');
 } finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
