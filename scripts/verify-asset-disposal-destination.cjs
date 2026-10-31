/* Render the actual Asset Register disposal JSX with local state; no API mutations. */
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


add('components/MarketplaceOutcomeModal.module.css');
add('components/asset-register/AssetDisposal.module.css');
add('components/DateInput');
add('components/asset-register/DisposalIcon');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';




const client=fs.readFileSync(path.join(root,'app/asset-register/asset-register-client.tsx'),'utf8');
const modalStart=client.indexOf('{disposalCandidateAsset ? (');
assert(modalStart>=0,'Asset disposal modal must exist');
const start=client.indexOf('<section ',modalStart);
const formEnd=client.indexOf('</form>',start);
assert(start>=modalStart && formEnd>start,'Asset disposal section and form must exist');
const end=formEnd+7;
const jsx=client.slice(start,end)+'</section>';
const helpers=client.slice(client.indexOf('const DISPOSAL_WIZARD_STEPS'),client.indexOf('type PartnerDirectoryEntry'));
const next=client.slice(client.indexOf('  function handleDisposalWizardNext()'),client.indexOf('  async function copyAssetTransferDetails()'));
const source=`
const disposalStyles=require('components/MarketplaceOutcomeModal.module.css'),disposalLayout=require('components/asset-register/AssetDisposal.module.css');
const DateInput=require('components/DateInput').default;
const DisposalIcon=require('components/asset-register/DisposalIcon').default;
${helpers}
function Fixture({reason}){
 const [disposalWizardStep,setDisposalWizardStep]=React.useState(4);
 const [disposalInformationView,setDisposalInformationView]=React.useState('summary');
 const [disposalDraft,setDisposalDraft]=React.useState({reason,disposalDate:'2026-10-26',disposalAmountExVat:'5000',aim4priceOutcomeInfluence:'yes',transferAction:'',note:''});
 const disposalBodyRef=React.useRef(null),disposalCandidateAsset={id:'fixture',title:'1-Cube Dam Scoop #2'},busyDeleteId=null;
 const setNotice=()=>{},setDisposalCandidateAsset=()=>{};
 function handleConfirmDisposal(event){event.preventDefault();window.saved={...disposalDraft};}
 ${next}
 return <div className={disposalStyles.backdrop}>${jsx}</div>;
}
const root=ReactDOM.createRoot(document.getElementById('app'));window.renderFixture=reason=>{window.saved=null;root.render(<Fixture key={Math.random()} reason={reason}/>);};`;
const fixture=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],pipe:true,headless:true});
 try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+fixture});
 assert.deepEqual(errors,[],'Fixture must initialise without browser errors');
 assert.equal(await page.evaluate(()=>typeof window.renderFixture),'function','Fixture renderer must be installed');
 async function click(text){await page.$$eval('button',(buttons,text)=>{const b=buttons.find(b=>b.textContent.trim()===text||b.querySelector('strong')?.textContent===text);if(!b||b.disabled)throw Error('Unavailable '+text);b.click();},text);}
 for(const width of [1440,390]){
 await page.setViewport({width,height:900});
 for(const reason of ['sold','traded_in']){
 await page.evaluate(reason=>window.renderFixture(reason),reason);await page.waitForSelector('#asset-disposal-information-title');
 assert.equal(await page.$('#asset-register-transfer-title'),null);await click('Next');await page.waitForSelector('#asset-register-transfer-title');
 assert.equal(await page.$('#asset-disposal-information-title'),null);assert.equal(await page.$$eval('ol li',n=>n.length),4);assert.equal(await page.evaluate(()=>window.saved),null);
 const save=reason==='sold'?'Save sale':'Save trade-in';assert(await page.$$eval('button',(bs,text)=>bs.find(b=>b.textContent===text).disabled,save));
 const archive=reason==='sold'?'Archive after sale':'Archive after trade-in';await click(archive);
 await click('Back');await page.waitForSelector('#asset-disposal-information-title');await click('Next');await page.waitForSelector('#asset-register-transfer-title');
 assert(await page.$$eval('button',(bs,text)=>bs.find(b=>b.querySelector('strong')?.textContent===text).getAttribute('aria-pressed')==='true',archive));
 await page.screenshot({path:'/tmp/disposal-destination-'+reason+'-'+width+'.png'});
 const gap=await page.evaluate(()=>{const section=document.querySelector('#asset-register-transfer-title').closest('section');return document.querySelector('footer').getBoundingClientRect().top-section.getBoundingClientRect().bottom;});assert(gap>=16,'Bottom gap '+gap);
 await click(save);assert.equal(await page.evaluate(()=>window.saved.transferAction),'archive');
 await click(reason==='sold'?'Send to buyer':'Send to dealer inventory');assert(await page.evaluate(()=>document.body.textContent.includes('Private invoices, finance, insurance and account access stay')));
 await click(save+' & create code');assert.equal(await page.evaluate(()=>window.saved.transferAction),'claim_code');
 }
 for(const reason of ['scrapped','written_off','mistake_duplicate','other']){
 await page.evaluate(reason=>window.renderFixture(reason),reason);await page.waitForSelector('#asset-disposal-information-title');
 assert.equal(await page.$('#asset-register-transfer-title'),null);await click(reason==='mistake_duplicate'?'Delete duplicate':'Save disposal');assert.equal(await page.evaluate(()=>window.saved.reason),reason);
 }
 }
 assert.deepEqual(errors,[]);console.log('PASS separate Information screens, four stages, preserved choices, save gating, non-transfer outcomes and desktop/mobile footer spacing');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
