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
 'function require(name){if(name==="pdf-lib")return PDFLib;if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';


(async()=>{
 const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 try {
 const page=await browser.newPage();await page.setViewport({width:1440,height:1000});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>*{box-sizing:border-box}body{font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:fs.readFileSync(path.join(root,'node_modules/pdf-lib/dist/pdf-lib.min.js'),'utf8')});
 await page.addScriptTag({content:runtime});
 await page.evaluate(async()=>{
  window.sent=[];window.textDraws=[];const fill=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.textDraws.push(text);return fill.call(this,text,...args);};
  const report=await PDFLib.PDFDocument.create();report.addPage([300,400]);window.report=await report.save();
  window.fetch=async url=>{
   if(url.endsWith('.pdf'))return new Response(window.report,{headers:{'Content-Type':'application/pdf'}});
   const c=document.createElement('canvas');c.width=400;c.height=300;c.getContext('2d').fillRect(0,0,400,300);
   return new Response(await new Promise(resolve=>c.toBlob(resolve)),{headers:{'Content-Type':'image/png'}});
  };
  Object.defineProperty(navigator,'canShare',{configurable:true,value:data=>data.files.length<=10});
  Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{if(data.files.length>10)throw Error('Too many files');window.sent.push(data);}});
  const assets=Array.from({length:20},(_,i)=>({title:'Tractor '+(i+1),serialNumber:'VIN-'+(i+1),yearModel:2024,usage:'100 hours',condition:'Good',valueExVat:100000,replacementPriceExVat:200000,publicUrl:null,photoUrls:['https://photo.test/'+i+'.png']}));
  ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(require('components/asset-register/AssetExternalShare').default,{shareName:'Farm fleet',assets,reportFiles:[{id:'report',kind:'report',label:'Fleet report',description:'Report',fileName:'report.pdf',url:'https://photo.test/report.pdf'}],onAddAim4priceReport:()=>{},onRemoveAim4priceReport:()=>{}}));
 });
 const click=async text=>{await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===text&&!b.disabled),{},text);await page.evaluate(text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text).click(),text);};
 await page.waitForSelector('textarea');await page.click('input[type=checkbox]');
 await page.waitForFunction(()=>document.body.textContent.includes('1 PDF · 20 photos and 1 Aim4price report'));
 await page.$eval('textarea',e=>{e.focus();e.setSelectionRange(e.value.length,e.value.length);});await page.keyboard.type(' EDITED MESSAGE');
 await click('WhatsApp');await page.waitForSelector('dialog[open]');await page.click('[data-share-consent]');await click('Continue to WhatsApp');
 await page.waitForFunction(()=>window.sent.length===1);
 const result=await page.evaluate(async()=>{
  const file=window.sent[0].files[0];window.finalBytes=Array.from(new Uint8Array(await file.arrayBuffer()));
  const pdf=await PDFLib.PDFDocument.load(new Uint8Array(window.finalBytes));
  return {files:window.sent[0].files.length,type:file.type,text:window.sent[0].text,pages:pdf.getPageCount(),lastSize:pdf.getPages().at(-1).getSize(),drawn:window.textDraws.join('\n')};
 });
 assert.equal(result.files,1);assert.equal(result.type,'application/pdf');assert.equal(result.text,undefined,'Message is inside the PDF, avoiding files-plus-text restrictions');assert(result.pages>=22);assert.deepEqual(result.lastSize,{width:300,height:400});assert(result.drawn.includes('EDITED MESSAGE'));
 fs.writeFileSync('/tmp/large-asset-share.pdf',Buffer.from(await page.evaluate(()=>window.finalBytes)));
 await page.waitForFunction(()=>!document.querySelector('dialog'));
 await click('Email');await page.waitForSelector('dialog[open]');assert(await page.$eval('dialog',d=>d.textContent.includes('cannot attach files automatically')));
 await page.click('[data-share-consent]');await click('Continue to Email');await page.waitForFunction(()=>window.sent.length===2);
 assert.equal(await page.evaluate(()=>window.sent[1].files.length),1);
 assert.equal(await page.evaluate(()=>document.body.textContent.includes('Next message')),false);
 await page.waitForFunction(()=>!document.querySelector('dialog'));
 await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Blocked','NotAllowedError');}}));
 await click('WhatsApp');await page.waitForSelector('dialog[open]');await page.click('[data-share-consent]');await click('Continue to WhatsApp');
 await page.waitForSelector('dialog a[download]');assert.equal(await page.$$eval('dialog a[download]',links=>links.length),1);
 assert.equal(await page.$eval('dialog a[download]',a=>a.textContent),'Download PDF');
 assert.equal(await page.$eval('[data-share-consent]',c=>c.checked),true);
 await page.setViewport({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.screenshot({path:'/tmp/large-share-disclosure.png'});
 // Unsupported file types must never disappear silently from a bundle.
 const rejected=await page.evaluate(async()=>{try{await require('lib/asset-share-pdf').createAssetSharePdf('Message',[new File(['bad'],'report.doc',{type:'application/msword'})],'Test');return false;}catch{return true;}});assert(rejected);
 assert.deepEqual(errors,[]);console.log('PASS 20-photo umbrella and report become one PDF, edited text retained, report pages retained, both channels one call, unsupported files rejected');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
