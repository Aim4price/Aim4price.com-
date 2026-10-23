/* Real sharing dialogs with synthetic photos and mocked renderer/native share; no messages sent. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
let cssIndex=0;
const stubs={
 'lib/marketplace-ad-renderer':`exports.marketplaceListingToAdContent=l=>({...l,brand:{vatLabel:'vat-excluded'}});exports.marketplaceAdFilename=()=> 'ad.jpg';exports.createMarketplaceAdJpeg=async()=>({blob:new Blob(['ad'],{type:'image/jpeg'})});exports.downloadMarketplaceAd=()=>{};`,

};
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
 const filename=['.tsx','.ts',''].map(ext=>path.join(root,file+ext)).find(fs.existsSync);
 if(!filename)throw Error('Missing module '+file);
 modules[file]='';
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 modules[file]=code.replace(/require\(["']([^"']+)["']\)/g,(match,name)=>{
  if(!name.startsWith('.'))return match;
  const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),name));add(resolved);
  return 'require('+JSON.stringify(resolved)+')';
 });
}
const entry='components/FacebookAdvertActions';add(entry);
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const appCode='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}'+
 'const components=require('+JSON.stringify(entry)+');const listing={title:"Test tractor",askingPriceExVat:15000,sellerPhone:"082 328 1614",imageSrc:"https://sharing.test/photo.png",year:"2020",usage:"100 hours",condition:"Used",location:"Western Cape"};const root=ReactDOM.createRoot(document.getElementById("app"));window.mount=(whatsapp)=>root.render(React.createElement(whatsapp?components.WhatsAppAdvertActions:components.default,{key:String(whatsapp),listing,shareUrl:"https://www.aim4price.com/marketplace/browse?listing=test"},"Open sharing"));mount(false);';
(async()=>{const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);page.on('request',r=>r.respond({contentType:r.url().endsWith('.png')?'image/png':'text/html',body:r.url().endsWith('.png')?Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1XkAAAAASUVORK5CYII=','base64'):'<html></html>'}));
 const click=async text=>{await page.evaluate(text=>{const b=[...document.querySelectorAll('button')].find(b=>(b.querySelector('strong')?.textContent || b.textContent)===text);if(!b)throw Error('Missing '+text);b.click()},text);};
 for(const width of [1440,390]){
  await page.setViewport({width,height:950});await page.goto('https://sharing.test/');await page.setContent('<style>body{font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');
  await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:appCode});await page.waitForSelector('button');await click('Open sharing');await page.waitForSelector('dialog[open]');
  assert((await page.$eval('textarea',e=>e.value)).includes('**082 328 1614**'));
  assert.equal(await page.$('a[href="https://www.facebook.com/groups/"]'),null);
  await page.type('textarea',' edited');const edited=await page.$eval('textarea',e=>e.value);
  await click('Continue');await page.waitForSelector('a[href="https://www.facebook.com/groups/"]');assert.equal(await page.$('textarea'),null);
  await click('Back');await page.waitForSelector('textarea');assert.equal(await page.$eval('textarea',e=>e.value),edited);
  assert(await page.$eval('dialog',e=>e.getBoundingClientRect().width<=innerWidth));
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog'));
  await page.evaluate(async()=>{mount(true);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))});await click('Open sharing');await page.waitForSelector('dialog[open]');
  assert((await page.$eval('dialog',e=>e.textContent)).includes('Send Marketplace Ad Details'));
  const href=await page.$eval('dialog a',e=>e.href);assert(decodeURIComponent(href).includes('https://www.aim4price.com/marketplace/browse?listing=test'));
  await click('Send Marketplace Ad Details');await page.waitForFunction(()=>document.querySelector('dialog')?.textContent.includes('Open WhatsApp'));
  assert((await page.$eval('textarea',e=>e.value)).includes('**082 328 1614**'));
  await page.evaluate(()=>{window.shared=null;Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.shared={files:data.files.map(f=>f.name),text:data.text};}})});
  await click('Back');await click('Send Marketplace Ad Details');await page.waitForFunction(()=>document.querySelector('dialog')?.textContent.includes('Share files'));await click('Share files');
  assert.deepEqual(await page.evaluate(()=>shared.files),['advert-photo-1.png']);assert((await page.evaluate(()=>shared.text)).includes('**082 328 1614**'));
  await click('Back');await click('Send Ad');await page.waitForSelector('img[alt="Aim4price ad preview"]');await click('Share files');
  assert.deepEqual(await page.evaluate(()=>shared.files),['ad.jpg']);assert.equal(await page.evaluate(()=>shared.text),undefined);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog'));
 }
 assert.deepEqual(errors,[]);console.log('PASS sharing stages, caption persistence, phone markers, WhatsApp choices, link payload, file payloads and Escape at desktop/mobile sizes.');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
