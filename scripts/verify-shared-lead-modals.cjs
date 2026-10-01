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


add('components/asset-register/ExternalLeadActions');
add('components/leads/LeadManageDialog');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';


(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});
 try {
 const page=await browser.newPage(); await page.setViewport({width:1440,height:1000});
 page.on('pageerror',error=>{throw error;});
 await page.setContent('<style>body{margin:0;background:#dce7e0;font-family:Arial;--modal-backdrop-color:rgba(12,24,35,.42);--modal-backdrop-filter:blur(12px)}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.evaluate(()=>{window.requests=[];window.fetch=async(url,opts)=>{window.requests.push({url,body:opts?.body});return {ok:true,json:async()=>({correction:{id:'correction',status:'pending',serialNumberChanged:true,proposedSerialNumber:'NEW-456'}})}}});
 const props={token:'a'.repeat(43),assetId:'10000000-0000-4000-8000-000000000001',assetIndex:0,assetTitle:'John Deere 6155M',serialNumber:'OLD-123',replacementPrice:900000,permissions:{serialNumber:true,replacementPrice:true,documents:true,reports:true},access:'active',reports:[{id:'report-1',label:'Asset valuation'}]};
 await page.addScriptTag({content:runtime+'window.renderFixture=(props)=>{window.fixtureRoot??=ReactDOM.createRoot(document.getElementById("app"));window.fixtureRoot.render(React.createElement(require("components/leads/LeadManageDialog").default,{title:props.assetTitle,description:"Manage enquiry",onClose:()=>{}},React.createElement(require("components/asset-register/ExternalLeadActions").default,{...props,key:props.access+JSON.stringify(props.permissions)})));};window.renderFixture('+JSON.stringify(props)+');'});
 async function click(text){await page.evaluate(text=>{const button=[...document.querySelectorAll('button')].find(node=>node.textContent.includes(text));if(!button)throw Error('Missing button '+text);button.click();},text);}
 await page.waitForFunction(()=>document.body.textContent.includes('Update serial number'));
 await click('Update serial number');await page.waitForSelector('input');
 assert.equal(await page.$$eval('[role="dialog"]',nodes=>nodes.length),2);
 await page.screenshot({path:'/tmp/shared-correction-modal.png'});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelectorAll('[role="dialog"]').length===1);
 await click('Update replacement price');await page.waitForSelector('input[type=number]');await page.keyboard.press('Escape');
 await click('Reports');await page.waitForSelector('[data-download-dialog]');assert.equal(await page.$eval('[data-download-option]',a=>a.getAttribute('href')),'/api/asset-share-links/'+props.token+'/reports/report-1');await page.screenshot({path:'/tmp/shared-reports-modal.png'});await page.keyboard.press('Escape');
 await click('Invoices');await page.waitForSelector('input[type=file]');await page.screenshot({path:'/tmp/shared-documents-modal.png'});await page.keyboard.press('Escape');
 await click('Update serial number');await page.waitForSelector('input');await page.$eval('input',node=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(node,'NEW-456');node.dispatchEvent(new Event('input',{bubbles:true}));});await click('Send to owner');
 await page.waitForFunction(()=>document.body.textContent.includes('update waiting for owner approval'));
 const requests=await page.evaluate(()=>window.requests);assert.equal(requests.length,1);assert.equal(requests[0].url,'/api/asset-share-links/'+props.token+'/corrections');assert.equal(JSON.parse(requests[0].body).assetId,props.assetId);
 await page.evaluate(p=>window.renderFixture({...p,access:'read-only'}),props);await page.waitForFunction(()=>!document.body.textContent.includes('update waiting for owner approval'));await click('Update serial number');await page.waitForFunction(()=>document.body.textContent.includes('Verify business'));assert.equal(await page.$$eval('input',nodes=>nodes.length),0);await page.keyboard.press('Escape');
 await page.evaluate(p=>window.renderFixture({...p,permissions:{reports:true,documents:false,serialNumber:false,replacementPrice:false}}),props);await page.waitForFunction(()=>!document.body.textContent.includes('Update serial number'));assert(!await page.evaluate(()=>document.body.textContent.includes('Invoices & quotes')));
 console.log('PASS: shared dialogs, correction endpoint/stable asset ID, Escape return, report link, documents, verification gate and hidden permissions');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
