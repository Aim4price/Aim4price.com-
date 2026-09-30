/* Customer billing and email visual checks with synthetic data; no real email or account writes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
let cssIndex=0;
const stubs={
 'lib/guest-enquiry-credits':'exports.guestCreditLimit=()=>null;',
 'lib/guest-business-access':'exports.getGuestViewer=async()=>null;',
 'components/AppHeader':'module.exports=()=>null;',
 'lib/account-access':'exports.getAccountAccess=async()=>({isActive:false,isAdmin:false});',
 'lib/account-profile':'exports.getAccountProfile=async()=>({accountType:"owner"});',
 'lib/auth-session':'exports.getAnyServerSession=async()=>globalThis.fixtureAnonymous?null:({user:{id:"test",email:"customer@example.test"}});',
 'lib/middleman-account':'exports.isMiddlemanAccountSubtype=()=>false;'
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

add('components/GuestEnquiryAccess');
add('app/pricing/pricing-content');
add('app/business/join/page');
add('app/auth/page');
add('app/account/account-invoices');
add('app/billing/billing-overview');
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
const resetEmail=loadNode('lib/email.ts',{'./email-brand':loadNode('lib/email-brand.ts'),'./external-share-permissions':loadNode('lib/external-share-permissions.ts')});
const invoice={id:'10000000-0000-4000-8000-000000000001',userId:'owner',number:'A4P-2026-000001',status:'issued',customer:{name:'Example Customer',businessName:'Example Farming',email:'customer@example.test',address:'George'},lines:[{description:'Monthly account subscription',quantity:1,unitCents:39900,totalCents:39900}],totalCents:39900,paidCents:0,dueDate:'2026-09-27',issuedAt:'2026-09-26T10:00:00Z',note:'',version:2};
const evidence=path.join(root,'.next/billing-experience-validation');fs.mkdirSync(evidence,{recursive:true});
(async()=>{
 const html=await report.buildBillingInvoiceHtml(invoice);
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),headless:true,pipe:true,ignoreDefaultArgs:["--hide-scrollbars"],args:["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu"]});
 try{
  const page=await browser.newPage();let verificationRequests=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
  page.on('request',request=>{const url=request.url();if(url.endsWith('/api/billing/plans'))return request.respond({status:503,contentType:'application/json',body:'{}'});if(url.endsWith('/api/auth/sign-up/email')){const payload=JSON.parse(request.postData());assert.equal(payload.accountType,'business');assert.equal(payload.accountSubtype,'contributor');assert.equal(payload.acceptedTerms,true);return request.respond({contentType:'application/json',body:'{"ok":true}'});}if(url.endsWith('/api/auth/send-verification-email'))return request.respond({status:++verificationRequests%2?503:200,contentType:'application/json',body:'{}'});if(url.endsWith('/api/guest-access'))return request.respond({contentType:'application/json',body:'{"ok":true}'});if(url.startsWith('https://billing.test/asset-share/'))return request.respond({contentType:'text/html',body:'<h1>Shared enquiry</h1>'});if(url.endsWith('/api/auth/sign-out')){assert.equal(request.method(),'POST');return request.respond({contentType:'application/json',body:'{}'});}if(url.endsWith('/api/auth/get-session'))return request.respond({contentType:'application/json',body:'null'});if(new URL(url).origin==='https://billing.test'&&new URL(url).pathname==='/auth')return request.respond({contentType:'text/html',body:'<h1>Login</h1>'});if(url.includes('/brand/invoice-drop-hero.webp'))return request.respond({contentType:'image/webp',body:fs.readFileSync(path.join(root,'public/brand/invoice-drop-hero.webp'))});if(url.includes('/brand/aim4price-mark-black.png'))return request.respond({contentType:'image/png',body:fs.readFileSync(path.join(root,'public/brand/aim4price-mark-black.png'))});if(url.includes('/api/billing/invoices/'))return request.respond({contentType:'text/html',body:html});if(url.includes('/api/billing/invoices?'))return request.respond({contentType:'application/json',body:JSON.stringify({invoices:Array.from({length:8},(_,i)=>({...invoice,id:invoice.id.slice(0,-1)+i,number:'A4P-2026-00000'+(i+1)})),total:8,preparing:false})});if(url.startsWith('data:'))return request.continue();if(url==='https://billing.test/')return request.respond({contentType:'text/html',body:'<html></html>'});return request.abort();});
  const font=fs.readFileSync(path.join(root,'public/field-manager/montserrat-latin.woff')).toString('base64');
  for(const width of [390,1440]){
   await page.setViewport({width,height:1000});
   for(const mode of ['guest','pricing','business-join','business-register','signup-owner','signup-dealer','signup-middleman','switch','account','billing','suspended','suspended-unlinked','suspended-void','pending']){
    await page.goto('https://billing.test/');
    await page.setContent('<style>@font-face{font-family:Montserrat;src:url(data:font/woff;base64,'+font+')}*{box-sizing:border-box}body{margin:0;font:16px Montserrat,Arial,sans-serif;background:#f2f6f3;--website-design-vw:1vw;--website-design-vh:12px;--shell-narrow-width:min(calc(100% - 32px),1100px);--website-visible-height:100dvh;--text-strong:#173c32;--modal-backdrop-color:rgba(12,32,26,.58);--modal-backdrop-filter:blur(7px)}button,input,textarea{font:inherit}'+sheets.join('\n')+'</style><div id="app"></div>');
    await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
    const account='const styles=require("app/account/page.module.css");const child=React.createElement(require("app/account/account-invoices").default);ReactDOM.createRoot(document.getElementById("app")).render(React.createElement("section",{className:[styles.modalCard,styles.accountActionModalCardNarrow,styles.accountScrollableModalCard,styles.passwordModalCard,styles.billingModal].join(" "),style:{width:"min(760px,calc(100% - 32px))",margin:"32px auto",maxHeight:"850px",background:"white",borderRadius:"12px",overflow:"hidden"}},React.createElement(require("app/account/account-modal-scroller").default,{label:"Invoice list"},React.createElement("div",{className:styles.modalHeader},React.createElement("h2",null,"Your invoices"),React.createElement("p",null,"View your invoices and recorded payments.")),child)));';
    const suspended='const footerStyles=require("components/AppFooter.module.css");ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(React.Fragment,null,React.createElement(require("components/AppPatternBackground").default,null,React.createElement(require("app/pending-payment/PendingAccessClient").default,'+JSON.stringify({email:'customer@example.test',statusLabel:mode==='pending'?'Pending approval':'Suspended',isSuspended:mode!=='pending',suspension:mode==='suspended-unlinked'||mode==='pending'?null:{reason:'Payment remains outstanding. Please settle the linked invoice and contact Aim4price so we can review your access.',invoice:mode==='suspended-void'?{...invoice,status:'void'}:invoice}})+')),React.createElement("footer",{className:footerStyles.footer},React.createElement("div",{className:footerStyles.footerDock},"Footer"))));';
    const billing='ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(require("app/billing/billing-overview").default,'+JSON.stringify({invoices:[invoice,{...invoice,id:invoice.id.slice(0,-1)+'2',number:'A4P-2026-000002',paidCents:39900}],total:2,page:1,preparing:false})+'));';
    const switchPage='require("app/auth/page").default({}).then(view=>ReactDOM.createRoot(document.getElementById("app")).render(view));';
    if(mode.startsWith('signup-'))await page.evaluate(type=>history.replaceState(null,'','/auth?accountType='+type+'#signup'),mode.slice(7));
    await page.evaluate(anonymous=>{globalThis.fixtureAnonymous=anonymous;},mode==='business-join'||mode==='business-register');
    await page.addScriptTag({content:runtime+(mode==='pricing'?'ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(require("app/pricing/pricing-content").default));':mode==='business-join'||mode==='business-register'?'require("app/business/join/page").default('+JSON.stringify({searchParams:{mode:mode==='business-register'?'account':undefined,businessType:width===390?'insurance-services':undefined}})+').then(view=>ReactDOM.createRoot(document.getElementById("app")).render(view));':mode.startsWith('signup-')?'ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(require("app/auth/auth-client").default));':mode==='guest'?'ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(require("components/GuestEnquiryAccess").default,{returnTo:"/asset-share/'+ 't'*43 +'"}));':mode==='switch'?switchPage:mode==='account'?account:mode==='billing'?billing:suspended)});
    if(mode==='account'||mode==='suspended')await page.waitForFunction(()=>document.body.textContent.includes('A4P-2026-000001'));else await page.waitForSelector('h1');
    if(mode==='suspended-unlinked'||mode==='suspended-void'){assert.equal(await page.$('button[aria-label="Open invoice"]'),null);assert.equal(await page.$('iframe'),null);assert.match(await page.$eval('h1',e=>e.textContent),/temporarily paused/);}
    if(mode==='pending'){
     assert.equal(await page.$eval('h1',e=>e.textContent),'Pending approval');
     assert.equal(await page.$eval('a[href="/billing"]',e=>e.textContent.includes('View invoices')),true);
     assert.doesNotMatch(await page.$eval('main',e=>e.textContent),/Back to home|Contact Aim4price/);
    }
    if(mode==='billing'){
     assert.equal(await page.$$eval('article',els=>els.length),2);
     await page.$$eval('button',els=>els.find(e=>e.textContent==='View invoice').click());
     await page.waitForSelector('dialog[open] a[download]');
     await page.keyboard.press('Escape');
    }
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
    if(mode.startsWith('suspended')||mode==='pending'){
     const layout=await page.evaluate(()=>{const footer=document.querySelector('footer');const hero=document.querySelector('[data-account-access-page] > section');return {display:getComputedStyle(footer).display,footerTop:footer.getBoundingClientRect().top+scrollY,heroBottom:hero.getBoundingClientRect().bottom+scrollY,height:innerHeight};});
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
    if(mode==='pricing'){
     assert.equal(await page.$eval('a[href="/business/join"]',e=>e.textContent.includes('R199')),true);
     assert.match(await page.$eval('a[href="/business/join"]',e=>e.textContent),/after x credits/);
     await page.$$eval('button[aria-haspopup="dialog"]',els=>els.find(e=>e.textContent.startsWith('Owner')).click());
     await page.waitForSelector('[role="dialog"]');
     assert.match(await page.$eval('[role="dialog"] h2',e=>e.textContent),/How many assets/);
     const choose = async selector => { await page.$eval(selector, e => e.click()); };
     await choose('[aria-label="Number of active assets"] button');
     await choose('[data-pricing-content] + div button:last-child');
     await page.waitForFunction(()=>document.querySelector('[role="dialog"] h2')?.textContent==='Your Owner package');
     const clickText = async text => { await page.$$eval('[role="dialog"] button', (els, text) => els.find(e => e.textContent.trim() === text).click(), text); };
     assert.match(await page.$eval('[role="dialog"]',e=>e.textContent), /R99/);
     assert.equal(await page.$('[aria-label="Optional services"]'),null,'Self-service has no extra charges');
     await clickText('Yearly');
     assert.match(await page.$eval('[role="dialog"]',e=>e.textContent), /R999/);
     await clickText('Monthly');
     await clickText('Need help uploading?');
     assert.match(await page.$eval('[role="dialog"]',e=>e.textContent), /R100 per asset.*R50 per asset.*R7.50\/km/);
     await clickText('Explore visit options');
     await choose('[aria-label="Visit type"] button');
     await choose('[data-pricing-content] + div button:last-child');
     assert.match(await page.$eval('[aria-label="Optional services"]',e=>e.textContent), /Asset recording visit.*Separate quote/);
     await clickText('Remove');
     await clickText('Need monthly admin help?');
     await page.screenshot({path:path.join(evidence,`owner-admin-options-${width}.png`)});
     await choose('[aria-label="Admin package"] button');
     await choose('[data-pricing-content] + div button:last-child');
     assert.match(await page.$eval('[aria-label="Optional services"]',e=>e.textContent), /R499\/month included.*R598\/month total/);
     assert.equal(await page.$eval('[data-owner-package-price]',e=>e.textContent),'R598/month total');
     await clickText('Yearly');
     assert.equal(await page.$eval('[data-owner-package-price]',e=>e.textContent),'R6 987/year total');
     assert.match(await page.$eval('[role="dialog"]',e=>e.textContent),/billed monthly/);
     await clickText('Remove');
     assert.equal(await page.$eval('[data-owner-package-price]',e=>e.textContent),'R999/year');
     await clickText('Monthly');
     assert.equal(await page.$eval('[data-owner-package-price]',e=>e.textContent),'R99/month');
     // Review the same setup-only, combined-service and detail layouts customers see.
     await clickText('Need help uploading?');
     await clickText('Explore visit options');
     await choose('[aria-label="Visit type"] button:last-child');
     await choose('[data-pricing-content] + div button:last-child');
     await page.screenshot({path:path.join(evidence,`owner-inspection-${width}.png`)});
     await clickText('Need monthly admin help?');
     await choose('[aria-label="Admin package"] button');
     await choose('[data-pricing-content] + div button:last-child');
     await page.screenshot({path:path.join(evidence,`owner-combined-${width}.png`)});
     if (width >= 1000) assert.equal(await page.$eval('[data-pricing-content]',e=>e.scrollHeight>e.clientHeight),false,'Combined package fits without internal scrolling on desktop');
     await clickText('Need help uploading?');
     await page.screenshot({path:path.join(evidence,`owner-setup-details-${width}.png`)});
     await clickText('Back to package');
     await clickText('What else should I know?');
     await page.waitForFunction(()=>document.querySelector('[role="dialog"] h2')?.textContent==='Good to know');
     assert.match(await page.$eval('[role="dialog"]',e=>e.textContent),/Sold and archived assets are excluded/);
     await page.screenshot({path:path.join(evidence,`owner-billing-notes-${width}.png`)});
     await clickText('Back to package');
     assert.match(await page.$eval('[aria-label="Optional services"]',e=>e.textContent),/R598\/month total/);
     await clickText('Change asset range');
     await page.$$eval('[aria-label="Number of active assets"] button',els=>els[3].click());
     await choose('[data-pricing-content] + div button:last-child');
     assert.match(await page.$eval('[role="dialog"]',e=>e.textContent), /Enterprise.*Custom quote/);
     await clickText('Start again');
     await choose('[aria-label="Number of active assets"] button');
     await choose('[data-pricing-content] + div button:last-child');
     for (const height of [600, 450]) {
      await page.setViewport({width,height});
      const bounds = await page.$eval('[role="dialog"]', e => {
       const rect=e.getBoundingClientRect(), content=e.querySelector('[data-pricing-content]');
       const signup=e.querySelector('a[href*="#signup"]').getBoundingClientRect();
       return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,signupBottom:signup.bottom,overflow:content.scrollHeight>content.clientHeight,track:content.offsetWidth-content.clientWidth};
      });
      assert.ok(bounds.top>=0 && bounds.bottom<=height && bounds.left>=0 && bounds.right<=width, 'Pricing dialog fits the visible screen');
      assert.ok(bounds.signupBottom<=height, 'Sign up stays visible');
      if (bounds.overflow) {
      assert.ok(bounds.track>=12, 'Overflowing content retains a usable scrollbar');
      const content=await page.$('[data-pricing-content]');
      const scrollBox = await content.boundingBox();
      await page.mouse.move(scrollBox.x + 24, scrollBox.y + 24);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.mouse.wheel({deltaY:1000});
      await page.waitForFunction(()=>document.querySelector('[data-pricing-content]').scrollTop>0);
      await content.focus();
      await page.keyboard.down('Control');
      await page.keyboard.press('Home');
      await page.keyboard.press('End');
      await page.keyboard.up('Control');
      await page.waitForFunction(()=>{const e=document.querySelector('[data-pricing-content]');return e.scrollTop+e.clientHeight>=e.scrollHeight-2;});
      }
      await page.screenshot({path:path.join(evidence,`owner-scroll-${width}-${height}.png`)});
     }
     await page.setViewport({width,height:1000});

     await page.keyboard.press('Escape');
     await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
     const dealerLink='a[href="/auth?accountType=dealer#signup"]';
     assert.match(await page.$eval(dealerLink,e=>e.textContent),/R199.*month.*Create Dealer account/);
     assert.equal(await page.$$eval('button[aria-haspopup="dialog"]',els=>els.some(e=>e.textContent.startsWith('Dealer'))),false);
     await page.click(dealerLink);
     await page.waitForFunction(()=>location.pathname==='/auth'&&location.search==='?accountType=dealer'&&location.hash==='#signup');
    }
    if(['guest','business-join','business-register'].includes(mode)){
     assert.equal(await page.$$eval('main',els=>els.length),1,'Onboarding has one page landmark');
     assert.ok(await page.$('[aria-label="Authentication mode"]'),'Every onboarding screen shares the signup navigation');
     const frame=await page.$eval('h1',e=>e.closest('section').getBoundingClientRect().width);
     assert.ok(width===390?frame<=390:frame>=800,'Onboarding retains the original signup width');
    }
    if(mode==='business-join'||mode==='business-register'){
     assert.equal(await page.$('a[href="/business/guest"]'),null);
     for(const [name,value] of Object.entries({name:'Test Recipient',businessName:'Test Business',email:'recipient@example.test',password:'Synthetic-password-123'}))await page.type('input[name="'+name+'"]',value);
     await page.click('input[name="terms"]');await page.click('button[type="submit"]');
     await page.waitForFunction(()=>document.body.textContent.includes('verification email could not be sent'));
     assert.equal(await page.$('form'),null,'Verification retry cannot create a second account');
     await page.$$eval('button',els=>els.find(e=>e.textContent==='Resend verification email').click());
     await page.waitForFunction(()=>document.body.textContent.includes('Check your inbox and verify your email'));
    }
    if(mode.startsWith('signup-')){
     const clickText=async text=>{assert.ok(await page.evaluate(t=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===t);e?.click();return !!e;},text),text);};
     const select=async(label,text)=>{const selector='button[aria-label^="'+label+'"]';await page.click(selector);await page.waitForSelector('[role="option"]');assert.ok(await page.evaluate(t=>{const e=[...document.querySelectorAll('[role=option]')].find(e=>e.textContent.trim().startsWith(t));e?.click();return !!e;},text));await page.waitForFunction(selector=>{const button=document.querySelector(selector);return button?.getAttribute('aria-expanded')==='false'&&document.activeElement===button;},{},selector);};
     const settledStep=async id=>page.waitForFunction(id=>document.activeElement===document.querySelector('[aria-labelledby="'+id+'"]'),{},id);
     const typeField=async(name,value)=>{const selector='input[name="'+name+'"]';await page.type(selector,value);assert.equal(await page.$eval(selector,e=>e.value),value,'Signup field '+name+' receives every character');};
     if(mode.startsWith('signup-')){
      await page.waitForFunction(type=>document.querySelector('input[name="accountType"]')?.value===type,{},mode.slice(7));
      if(mode==='signup-owner'){
       await select('What would you like to use Aim4price for?','Middleman');
       assert.equal(await page.$eval('input[name="accountSubtype"]',e=>e.value),'equipment-middleman');
       await select('What would you like to use Aim4price for?','Owner');
      }
      if(mode==='signup-middleman')assert.equal(await page.$eval('input[name="accountSubtype"]',e=>e.value),'equipment-middleman');
      if(mode==='signup-dealer'){
       const trigger='button[aria-haspopup="dialog"]';
       assert.equal(await page.$('[role="dialog"]'),null);
       assert.doesNotMatch(await page.$eval('form',e=>e.textContent),/Clients have no login or access/);
       await page.click(trigger);
       await page.waitForSelector('[role="dialog"]');
       const notice=await page.$eval('[role="dialog"]',e=>e.textContent);
       assert.match(notice,/Manage client asset registers/);
       assert.match(notice,/50% of the standard Owner plan price/);
       assert.match(notice,/number of assets and the corresponding Owner plan/);
       assert.match(notice,/Clients have no login or access/);
       assert.match(notice,/billed separately.*R199\/month/);
       await page.screenshot({path:path.join(evidence,'dealer-register-popup-'+width+'.png'),fullPage:true});
       await page.keyboard.press('Escape');
       await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
       assert.equal(await page.$eval(trigger,e=>document.activeElement===e),true);
       await page.click(trigger);
       await page.click('button[aria-label="Close client register information"]');
       await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
       await select('What would you like to use Aim4price for?','Owner');
       assert.equal(await page.$('button[aria-haspopup="dialog"]'),null);
       await select('What would you like to use Aim4price for?','Dealer');
       assert.ok(await page.$('button[aria-haspopup="dialog"]'));
      }else assert.equal(await page.$('button[aria-haspopup="dialog"]'),null);
     }
     await page.click('button[aria-label^="Which best describes your work?"]');await page.waitForSelector('[role="option"]');
     const options=await page.$$eval('[role="option"]',els=>els.map(e=>e.textContent));
     assert.ok(options.every(t=>!/(Insurance|Finance|Licensing|Other business)/.test(t)),mode+' excludes business services');
     await page.keyboard.press('Escape');
     await clickText('Next');await page.waitForSelector('input[name="name"]');await settledStep('signup-step-details');
     assert.ok(await page.$('#signup-step-details'),'Every account uses the same second step');
     await page.screenshot({path:path.join(evidence,mode+'-step2-'+width+'.png'),fullPage:true});
     continue;
    }
    if(mode==='guest'){
     await page.type('input[type="email"]','guest@example.test');await page.click('form button');
     await page.waitForSelector('input[autocomplete="one-time-code"]');
     await page.screenshot({path:path.join(evidence,'guest-code-'+width+'.png'),fullPage:true});
     await page.type('input[autocomplete="one-time-code"]','123456');await page.click('form button');
     await page.waitForFunction(()=>location.pathname.startsWith('/asset-share/'));
    }
    if(mode==='switch'){
     assert.equal(await page.$eval('h1',e=>e.textContent),'Switch account');
     assert.equal(await page.$eval('button',e=>e.textContent),'Sign out and continue');
     await page.click('button');
     await page.waitForFunction(()=>location.pathname==='/auth'&&location.hash==='#login');
    }
    if(mode==='pending'||mode.startsWith('suspended')){
     assert.equal(await page.$$eval('button',els=>els.some(e=>e.textContent==='Sign in to another account')),false,'Account switching stays in the header/login flow');
    }
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
