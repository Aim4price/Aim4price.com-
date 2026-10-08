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
 const page=await browser.newPage();await page.setViewport({width:1440,height:1100});
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:runtime+'window.fixtureRoot=ReactDOM.createRoot(document.getElementById("app"));'});
 await page.evaluate(()=>{
  window.sent=[];window.renderedText=[];
  const fillText=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,...rest){window.renderedText.push(text);return fillText.call(this,text,...rest);};
  window.fetch=async(url)=>{const c=document.createElement('canvas');c.width=400;c.height=300;const x=c.getContext('2d');x.fillStyle=url.includes('red')?'red':'blue';x.fillRect(0,0,400,300);const b=await new Promise(r=>c.toBlob(r));return new Response(b,{headers:{'Content-Type':'image/png'}});};
  Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true});
  Object.defineProperty(navigator,'share',{value:async data=>window.sent.push(data),configurable:true});
  window.assets=[{title:'Landini Super 110',serialNumber:'RED-17',yearModel:2024,usage:'439 hours',condition:'Good',valueExVat:404600,replacementPriceExVat:700000,publicUrl:null,photoUrls:['https://photo.test/red.png']},{title:'New Holland T6',serialNumber:'BLUE-19',yearModel:2022,usage:'850 hours',condition:'Good',valueExVat:500000,replacementPriceExVat:800000,publicUrl:null,photoUrls:['https://photo.test/blue.png']}];
  window.fixtureRoot.render(React.createElement(require('components/asset-register/AssetExternalShare').default,{shareName:'Farm tractors',assets:window.assets,onAddAim4priceReport:()=>{},onRemoveAim4priceReport:()=>{}}));
 });
 const click=async text=>page.evaluate(text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text||b.querySelector('strong')?.textContent===text).click(),text);
 await page.waitForSelector('textarea');await page.$eval('textarea',e=>{e.focus();e.select();});await page.keyboard.type('Please quote for these two tractors.');
 await page.click('input[type="checkbox"]');await page.waitForFunction(()=>!document.body.textContent.includes('Preparing attachments')&&document.body.textContent.includes('2 asset cards'));
 assert.equal(await page.$eval('textarea',e=>e.value),'Please quote for these two tractors.','Attachment selection preserves edits');
 await click('WhatsApp');await page.waitForSelector('dialog[open]');await page.click('dialog[open] input[type="checkbox"]');await click('Continue to WhatsApp');
 await page.waitForFunction(()=>window.sent.length===1);
 const result=await page.evaluate(async()=>{
  const data=window.sent[0];const colors=[];
  for(const f of data.files){const b=await createImageBitmap(f);const c=document.createElement('canvas');c.width=b.width;c.height=b.height;const x=c.getContext('2d');x.drawImage(b,0,0);colors.push([...x.getImageData(320,550,1,1).data]);b.close();}
  return {text:data.text,names:data.files.map(f=>f.name),colors,labels:window.renderedText};
 });
 assert.equal(result.text,'Please quote for these two tractors.');assert.equal(result.names.length,2);
 assert(result.names[0].includes('RED-17')&&result.names[1].includes('BLUE-19'));
 assert(result.colors[0][0]>200&&result.colors[0][2]<30);assert(result.colors[1][2]>200&&result.colors[1][0]<30);
 assert(result.labels.includes('Serial / VIN: RED-17')&&result.labels.includes('Serial / VIN: BLUE-19'));
 const card=await page.evaluate(async()=>Array.from(new Uint8Array(await window.sent[0].files[0].arrayBuffer())));fs.writeFileSync('/tmp/asset-share-card.jpg',Buffer.from(card));
 // A fifth photo repeats the same asset identity on a second card.
 const pages=await page.evaluate(async()=>{
  const photo=await (await fetch('https://photo.test/red.png')).blob();const files=Array.from({length:5},()=>new File([photo],'original.png',{type:'image/png'}));
  return (await require('lib/asset-share-cards').createAssetShareCards(window.assets[0],files,0)).map(f=>f.name);
 });assert.equal(pages.length,2);assert(pages.every(n=>n.includes('RED-17')));
 await click('Reset message');assert((await page.$eval('textarea',e=>e.value)).includes('Landini Super 110'));
 await page.screenshot({path:'/tmp/editable-outside-share.png'});
 console.log('PASS grouped asset identities, photo-to-asset mapping, multipage identity, editable outbound message, reset and preserved edits');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
