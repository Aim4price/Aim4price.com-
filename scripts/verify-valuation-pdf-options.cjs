/* Result walkthrough browser checks with synthetic assets; no real writes. */
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





add('components/ValuationPdfOptions');
const fixture=`import React,{useState} from 'react';import Options from 'components/ValuationPdfOptions';
export default function Fixture(){const [open,setOpen]=useState(true),[value,setValue]=useState('R 150 000'),[stale,setStale]=useState(false);return <><button id="reopen" onClick={()=>setOpen(true)}>Open</button><button id="missing" onClick={()=>{setValue(null);setStale(false);}}>Missing</button><button id="stale" onClick={()=>{setValue(null);setStale(true);}}>Stale</button>{open?<Options idealValue="R 180 000" replacementValue="R 350 000" marketValue={value} stale={stale} busy={false} error="" onClose={()=>setOpen(false)} onCalculate={()=>{window.calculated=true;setValue('R 160 000');}} onDownload={include=>{window.downloadChoice=include;setOpen(false);}}/>:null}</>}`;
modules.fixture=ts.transpileModule(fixture,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';







(async()=>{const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:['--no-sandbox'],headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1366,height:900});
 await page.setRequestInterception(true);page.on('request',r=>r.respond({status:200,contentType:'text/html',body:'<div id="app"></div>'}));await page.goto('https://fixture.test');
 await page.addStyleTag({content:'*{box-sizing:border-box}body{font-family:Arial}'+sheets.join('\n')});
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+"ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(require('fixture').default));"});
 await page.waitForSelector('dialog[open]');
 assert.equal(await page.$eval('[role=switch]',el=>el.getAttribute('aria-checked')),'true');
 assert(await page.$eval('dialog',el=>el.scrollHeight<=el.clientHeight+2));
 await page.screenshot({path:'/tmp/pdf-options.png'});
 await page.click('[role=switch]');await page.$$eval('footer button',els=>els[1].click());assert.equal(await page.evaluate(()=>window.downloadChoice),false);
 await page.click('#reopen');assert.equal(await page.$eval('[role=switch]',el=>el.getAttribute('aria-checked')),'false');
 await page.keyboard.press('Escape');await page.click('#missing');await page.click('#reopen');assert.equal(await page.$('[role=switch]'),null);
 await page.$$eval('footer button',els=>els[1].click());assert.equal(await page.evaluate(()=>window.downloadChoice),false);
 await page.click('#stale');await page.click('#reopen');
 await page.$$eval('section button',els=>els.find(el=>el.textContent==='Update market value').click());assert.equal(await page.evaluate(()=>window.calculated),true);
 await page.click('[role=switch]');await page.$$eval('footer button',els=>els[1].click());assert.equal(await page.evaluate(()=>window.downloadChoice),true);
 await page.click('#reopen');await page.setViewport({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.$eval('dialog',el=>el.getBoundingClientRect().bottom<=innerHeight));
 assert.deepEqual(errors,[]);console.log('PASS PDF inclusion toggle, preference, missing/stale assessment, download choices, desktop/mobile fit');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
