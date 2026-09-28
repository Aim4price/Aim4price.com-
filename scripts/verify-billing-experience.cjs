/* Customer billing and email visual checks with synthetic data; no real email or account writes. */
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

add('app/account/account-invoices');
add('app/account/account-modal-scroller');
add('app/pending-payment/PendingAccessClient');
add('components/AppPatternBackground');
add('components/AppFooter.module.css');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';

function loadNode(file,deps={}){const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const module={exports:{}};Function('require','module','exports',code)(id=>id in deps?deps[id]:require(id),module,module.exports);return module.exports;}
const shared=loadNode('lib/billing-shared.ts');
const report=loadNode('lib/billing-report.ts',{'./billing-shared':shared,'./report-theme':loadNode('lib/report-theme.ts')});
const template=loadNode('lib/billing-email-template.ts',{'./billing-shared':shared,'./billing-report':report,'./email-brand':loadNode('lib/email-brand.ts')});
const resetEmail=loadNode('lib/email.ts',{'./email-brand':loadNode('lib/email-brand.ts')});
const invoice={id:'10000000-0000-4000-8000-000000000001',userId:'owner',number:'A4P-2026-000001',status:'issued',customer:{name:'Example Customer',businessName:'Example Farming',email:'customer@example.test',address:'George'},lines:[{description:'Monthly account subscription',quantity:1,unitCents:39900,totalCents:39900}],totalCents:39900,paidCents:0,dueDate:'2026-09-27',issuedAt:'2026-09-26T10:00:00Z',note:'',version:2};
const evidence=path.join(root,'.next/billing-experience-validation');fs.mkdirSync(evidence,{recursive:true});
(async()=>{
 const html=await report.buildBillingInvoiceHtml(invoice);
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),headless:true,pipe:true,ignoreDefaultArgs:["--hide-scrollbars"],args:["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu"]});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
  page.on('request',request=>{const url=request.url();if(url.includes('/brand/invoice-drop-hero.webp'))return request.respond({contentType:'image/webp',body:fs.readFileSync(path.join(root,'public/brand/invoice-drop-hero.webp'))});if(url.includes('/brand/aim4price-mark-black.png'))return request.respond({contentType:'image/png',body:fs.readFileSync(path.join(root,'public/brand/aim4price-mark-black.png'))});if(url.includes('/api/billing/invoices/'))return request.respond({contentType:'text/html',body:html});if(url.includes('/api/billing/invoices?'))return request.respond({contentType:'application/json',body:JSON.stringify({invoices:Array.from({length:8},(_,i)=>({...invoice,id:invoice.id.slice(0,-1)+i,number:'A4P-2026-00000'+(i+1)})),total:8,preparing:false})});if(url.startsWith('data:'))return request.continue();if(url==='https://billing.test/')return request.respond({contentType:'text/html',body:'<html></html>'});return request.abort();});
  const font=fs.readFileSync(path.join(root,'public/field-manager/montserrat-latin.woff')).toString('base64');
  for(const width of [390,1440]){
   await page.setViewport({width,height:1000});
   for(const mode of ['account','suspended','suspended-unlinked','suspended-void','pending']){
    await page.goto('https://billing.test/');
    await page.setContent('<style>@font-face{font-family:Montserrat;src:url(data:font/woff;base64,'+font+')}*{box-sizing:border-box}body{margin:0;font:16px Montserrat,Arial,sans-serif;background:#f2f6f3;--website-design-vw:1vw;--website-design-vh:12px;--shell-narrow-width:min(calc(100% - 32px),1100px);--website-visible-height:100dvh;--text-strong:#173c32;--modal-backdrop-color:rgba(12,32,26,.58);--modal-backdrop-filter:blur(7px)}button,input,textarea{font:inherit}'+sheets.join('\n')+'</style><div id="app"></div>');
    await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
    const account='const styles=require("app/account/page.module.css");const child=React.createElement(require("app/account/account-invoices").default);ReactDOM.createRoot(document.getElementById("app")).render(React.createElement("section",{className:[styles.modalCard,styles.accountActionModalCardNarrow,styles.accountScrollableModalCard,styles.passwordModalCard,styles.billingModal].join(" "),style:{width:"min(760px,calc(100% - 32px))",margin:"32px auto",maxHeight:"850px",background:"white",borderRadius:"12px",overflow:"hidden"}},React.createElement(require("app/account/account-modal-scroller").default,{label:"Invoice list"},React.createElement("div",{className:styles.modalHeader},React.createElement("h2",null,"Your invoices"),React.createElement("p",null,"View your invoices and recorded payments.")),child)));';
    const suspended='const footerStyles=require("components/AppFooter.module.css");ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(React.Fragment,null,React.createElement(require("components/AppPatternBackground").default,null,React.createElement(require("app/pending-payment/PendingAccessClient").default,'+JSON.stringify({email:'customer@example.test',statusLabel:'Suspended',isSuspended:mode!=='pending',suspension:mode==='suspended-unlinked'||mode==='pending'?null:{reason:'Payment remains outstanding. Please settle the linked invoice and contact Aim4price so we can review your access.',invoice:mode==='suspended-void'?{...invoice,status:'void'}:invoice}})+')),React.createElement("footer",{className:footerStyles.footer},React.createElement("div",{className:footerStyles.footerDock},"Footer"))));';
    await page.addScriptTag({content:runtime+(mode==='account'?account:suspended)});
    if(mode==='account'||mode==='suspended')await page.waitForFunction(()=>document.body.textContent.includes('A4P-2026-000001'));else await page.waitForSelector('h1');
    if(mode==='suspended-unlinked'||mode==='suspended-void'){assert.equal(await page.$('button[aria-label="Open invoice"]'),null);assert.equal(await page.$('iframe'),null);assert.match(await page.$eval('h1',e=>e.textContent),/temporarily paused/);}
    if(mode==='pending')assert.equal(await page.$eval('h1',e=>e.textContent),'Account pending approval');
    if(mode==='account'){
     assert.equal(await page.$$eval('button[aria-expanded]',els=>els.length),8);
     assert.equal(await page.$$eval('button[aria-expanded]',els=>els.every(e=>e.getAttribute('aria-expanded')==='true')),true);
     await page.click('button[aria-expanded]');assert.equal(await page.$eval('button[aria-expanded]',e=>e.getAttribute('aria-expanded')),'false');
     await page.$$eval('button',els=>els.find(e=>e.textContent==='Expand all').click());assert.equal(await page.$$eval('button[aria-expanded]',els=>els.every(e=>e.getAttribute('aria-expanded')==='true')),true);
     const scroll=await page.$eval('[aria-label="Invoice list"]',e=>({overflow:getComputedStyle(e).overflowY,scrollable:e.scrollHeight>e.clientHeight}));assert.equal(scroll.overflow,'auto');assert.equal(scroll.scrollable,true);
     await page.waitForFunction(()=>{const rail=document.querySelector('[class*="accountModalScrollRailVisible"]');return rail && Number(getComputedStyle(rail).opacity)>0});
     await page.screenshot({path:path.join(evidence,'account-expanded-'+width+'.png'),fullPage:true});
     await page.$$eval('button',els=>els.find(e=>e.textContent==='Collapse all').click());
    }
    if(mode==='suspended'){assert.equal(await page.$('iframe'),null);await page.click('button[aria-label="Open invoice"]');await page.waitForSelector('dialog[open] a[download]');assert.equal(await page.$eval('iframe',e=>e.getAttribute('sandbox')),'');assert.match(await page.$eval('a[download]',e=>e.href),/10000000-0000-4000-8000-000000000001/);await page.$eval('iframe',e=>e.scrollIntoView());const frame=await (await page.$('iframe')).contentFrame();await frame.waitForSelector('.assetReportPage');await frame.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
    if(mode==='suspended'){await page.screenshot({path:path.join(evidence,'suspension-preview-'+width+'.png'),fullPage:true});await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Open invoice');}
    await page.evaluate(()=>document.fonts.ready);
    if(mode.startsWith('suspended')){
     const layout=await page.evaluate(()=>{const footer=document.querySelector('footer');const hero=document.querySelector('[data-suspension-page] > section');return {display:getComputedStyle(footer).display,footerTop:footer.getBoundingClientRect().top+scrollY,heroBottom:hero.getBoundingClientRect().bottom+scrollY,height:innerHeight};});
     assert.notEqual(layout.display,'none');
     assert.ok(Math.abs(layout.footerTop-layout.heroBottom)<1,'Footer must meet the hero without a gap');
     assert.ok(layout.footerTop>=layout.height-1,'Footer must sit below the initial viewport');
     await page.$eval('footer',e=>e.scrollIntoView());
     assert.ok(await page.$eval('footer',e=>e.getBoundingClientRect().top<innerHeight),'Footer remains reachable by scrolling');
     await page.evaluate(()=>scrollTo(0,0));
    }
    if(mode==='pending')assert.notEqual(await page.$eval('footer',e=>getComputedStyle(e).display),'none');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,mode+' fits '+width);
    await page.screenshot({path:path.join(evidence,mode+'-'+width+'.png'),fullPage:true});
    assert.deepEqual(errors,[]);
   }
   const email=template.buildBillingEmail({...invoice,issuer:shared.BILLING_ISSUER},'https://aim4price.test/billing');
   await page.goto('https://billing.test/');await page.setContent(email.html);
   await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'email fits '+width);
   await page.screenshot({path:path.join(evidence,'email-'+width+'.png'),fullPage:true});
   const brandHeader=await page.$eval('.email-brand',e=>e.textContent.trim().replace(/\s+/g,' '));
   const reset=resetEmail.buildAim4priceResetPasswordEmail({to:'customer@example.test',name:'Example Customer',resetUrl:'https://billing.test/reset-password?token=synthetic-test-token-only'});
   await page.goto('https://billing.test/');await page.setContent(reset.html);
   await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
   assert.equal(await page.$eval('.email-brand',e=>e.textContent.trim().replace(/\s+/g,' ')),brandHeader);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'reset email fits '+width);
   assert.equal(await page.$eval('.email-button a',e=>e.href),'https://billing.test/reset-password?token=synthetic-test-token-only');
   await page.screenshot({path:path.join(evidence,'reset-email-'+width+'.png'),fullPage:true});
  }
  console.log('PASS customer invoice cards, suspension reason and on-demand invoice preview, and responsive email design');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
