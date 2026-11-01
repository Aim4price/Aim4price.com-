// Render real AI connection components with synthetic props. No production accounts or secrets.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),modules={},sheets=[],stubs={}; let cssIndex=0;
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
add('app/account/ai-connect/connection-view');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';

const evidence=path.join(root,'.next/ai-connection-validation');
(async()=>{
 fs.mkdirSync(evidence,{recursive:true});
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});
 try {
  const page=await browser.newPage();await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base={account:{name:'Example Farm',email:'owner@example.test'},resource:'https://www.aim4price.com/api/ai/mcp',providers:[{name:'ChatGPT',launchUrl:'https://chatgpt.com/'},{name:'Claude',launchUrl:'https://claude.ai/'}],connections:[]};
  async function render(props,dark=false){
   await page.goto('about:blank');
   await page.setContent(`<!doctype html><html data-background="${dark?'dark':'light'}"><head><style>:root{--website-design-vw:1vw;--website-design-vh:1vh;--shell-width:min(calc(100% - 3rem),1180px);--modal-backdrop-color:rgba(8,23,18,.55);--modal-backdrop-filter:blur(6px)}body{margin:0;font-family:Arial;background:${dark?'#111827':'#eef2f4'};color:#17202b}button,input{font:inherit}*{box-sizing:border-box}${sheets.join('\n')}</style></head><body><div id="root"></div><script>${react}</script><script>${reactDOM}</script><script>${runtime};ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(require('app/account/ai-connect/connection-view').default,${JSON.stringify(props)}));</script></body></html>`);
   await page.waitForSelector('h1');
  }
  await page.setViewport({width:1280,height:1000});
  await render(base,true);
  // The launcher must keep the Owner App Users dimensions, without compact overrides.
  const sizing = await page.evaluate(() => {
   const title = document.querySelector('h1');
   const card = document.querySelector('button[aria-haspopup="dialog"]');
   return {
    shell: document.querySelector('main > div').getBoundingClientRect().width,
    title: parseFloat(getComputedStyle(title).fontSize),
    card: parseFloat(getComputedStyle(card).minHeight),
    icon: card.firstElementChild.getBoundingClientRect().width,
   };
  });
  assert.equal(sizing.shell,1180);
  assert.ok(Math.abs(sizing.title-57.6)<.1);
  assert.ok(Math.abs(sizing.card-179.2)<.1);
  assert.ok(Math.abs(sizing.icon-76.8)<.1);
  await page.click('button[aria-haspopup="dialog"]');await page.waitForSelector('[role="dialog"]');
  assert.equal(await page.$$eval('#ai-connect-panel img', icons => icons.length), 3);
  assert.equal(await page.$('a[href="https://chatgpt.com/"]'), null);
  await page.screenshot({path:path.join(evidence,'assistant-chooser.png')});
  async function choose(name) {
    await page.evaluate(name => Array.from(document.querySelectorAll('#ai-connect-panel button')).find(button => button.querySelector('strong')?.textContent === name).click(), name);
    await page.waitForFunction(name => document.querySelector('#ai-connect-title')?.textContent === 'Connect ' + name, {}, name);
  }
  await choose('Gemini');
  assert.ok((await page.$eval('#ai-connect-panel', e=>e.textContent)).includes('not available yet'));
  assert.equal(await page.$('#ai-connect-panel a[target="_blank"]'), null);
  await page.evaluate(()=>Array.from(document.querySelectorAll('#ai-connect-panel button')).find(button=>button.textContent==='Change assistant').click());
  await choose('Claude');
  assert.equal(await page.$('a[href="https://chatgpt.com/"]'), null);
  assert.equal(await page.$eval('a[href="https://claude.ai/"]',e=>e.textContent),'Open Claude');
  assert.equal(await page.$eval('[role="dialog"]',e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
  await page.screenshot({path:path.join(evidence,'owner-provider-modal-dark.png')});
  await page.keyboard.press('Escape');assert.equal(await page.$('[role="dialog"]'),null);
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-haspopup')),'dialog');
  // Empty management can start setup without closing and finding another trigger.
  await page.click('button[aria-haspopup="dialog"]:nth-child(2)');
  await page.waitForSelector('#ai-manage-panel');
  assert.equal(await page.$eval('[data-website-overlay]',e=>e.parentElement===document.body),true);
  await page.setViewport({width:1280,height:650});
  await page.waitForFunction(() => {
    const body = document.querySelector('#ai-manage-panel > div');
    return body.scrollHeight <= body.clientHeight + 2;
  });
  const manageFit = await page.$eval('#ai-manage-panel', panel => {
    const footer = panel.querySelector('footer');
    const buttons = Array.from(footer.querySelectorAll('button'));
    return buttons.length === 2 && buttons.every(button => {
      const rect = button.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    });
  });
  assert.ok(manageFit, 'Both management actions must stay visible on a short desktop');
  await page.screenshot({path:path.join(evidence,'owner-empty-management.png')});
  await page.setViewport({width:1280,height:1000});
  await page.evaluate(()=>Array.from(document.querySelectorAll('#ai-manage-panel button')).find(e=>e.textContent==='Connect assistant').click());
  await page.waitForSelector('#ai-connect-panel');
  assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-dialog-close')),true);
  await choose('ChatGPT');
  await page.click('#ai-connect-panel footer button');
  // React's transition can still show "Checking…" after the click resolves.
  // Wait for the completed UI state instead of racing the next render on CI.
  await page.waitForFunction(() => {
    const panel = document.querySelector('#ai-connect-panel');
    return panel?.querySelector('[role="status"]')?.textContent.includes('No approved connections yet')
      && panel.querySelector('footer button')?.disabled === false;
  });
  await page.keyboard.press('Escape');
  await render({...base,providers:base.providers.slice(0,1)},false);
  await page.screenshot({path:path.join(evidence,'owner-overview.png'),fullPage:true});
  await page.click('button[aria-haspopup="dialog"]');
  await page.waitForSelector('#ai-connect-panel');
  await choose('ChatGPT');
  assert.ok(await page.$eval('#ai-connect-panel > div',e=>e.scrollHeight<=e.clientHeight+2));
  await page.screenshot({path:path.join(evidence,'owner-connect-desktop.png')});
  await render({...base,audience:'admin',resource:'https://www.aim4price.com/api/ai/admin/mcp',providerName:'ChatGPT Admin',proof:'synthetic-proof',authorization:'synthetic-request'},false);
  const form=await page.$eval('form',e=>({action:e.getAttribute('action'),terms:e.querySelector('[name="terms"]').required,text:e.textContent}));
  assert.equal(form.action,'/api/ai/oauth/authorize');assert.equal(form.terms,true);assert.ok(form.text.includes('24 hours'));
  const text=await page.$eval('main',e=>e.textContent);assert.ok(text.includes('cross-account administrator access'));assert.ok(!text.includes('Costs & budgets'));assert.ok(!text.includes('Fuel purchases'));
  await page.screenshot({path:path.join(evidence,'admin-consent.png'),fullPage:true});
  await page.setViewport({width:390,height:844});await render(base,false);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2));
  await page.screenshot({path:path.join(evidence,'owner-overview-mobile.png'),fullPage:true});
  await page.click('button[aria-haspopup="dialog"]');await page.waitForSelector('[role="dialog"]');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2));
  await page.screenshot({path:path.join(evidence,'owner-provider-modal-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('AI provider modal, dark/light cards, mobile layout, focus return and admin consent verified.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
