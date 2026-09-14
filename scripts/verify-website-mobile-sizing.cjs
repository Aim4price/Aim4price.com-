/* Isolated browser checks of the real SiteWorkspaceZoom component.
 * No Next server, database, authenticated account, or production traffic.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
const compile = file => ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;
const canvas = compile('lib/website-canvas.ts');
const host = compile('components/SiteWorkspaceZoom.tsx');
const output = path.join(root, '.next/mobile-sizing-validation');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH || await chromium.executablePath(),args:chromium.args,headless:true});
  try {
    const page = await browser.newPage();
    const cdp=await page.createCDPSession();
    const setViewport=async ({width,height,deviceScaleFactor=1,isMobile=false,hasTouch=false})=>{
      // Direct CDP updates do not reload and discard this isolated fixture.
      await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor,mobile:isMobile,screenWidth:width,screenHeight:height});
      await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:hasTouch,maxTouchPoints:1});
    };
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', request => request.respond({status:200,contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}.viewport{width:100%}.canvas{margin-inline:auto}.landscapeGate{position:fixed;inset:0;background:white;z-index:100}header{display:flex;gap:24px}button{padding:12px}</style><div id="app"></div>'}));
    await setViewport({width:1440,height:900,isMobile:false,hasTouch:false});
    await page.goto('https://canvas.test/');
    await page.addScriptTag({content:fs.readFileSync(path.join(path.dirname(require.resolve('react')),'umd/react.development.js'),'utf8')});
    await page.addScriptTag({content:fs.readFileSync(path.join(path.dirname(require.resolve('react-dom')),'umd/react-dom.development.js'),'utf8')});
    await page.evaluate(({canvas,host}) => {
      Object.defineProperty(window,'outerWidth',{configurable:true,get:()=>1440});
      localStorage.clear(); sessionStorage.clear();
      localStorage.setItem('aim4price.website-canvas.v2.intro','seen');
      const React=window.React;
      const modules={};
      const context=React.createContext(false);
      function require(name) {
        if(name==='react')return React;
        if(name==='react-dom')return window.ReactDOM;
        if(name==='next/navigation')return {usePathname:()=> '/'};
        if(name==='next/image')return {default:({priority,...props})=>React.createElement('img',props)};
        if(name==='./WebsitePortal')return {WebsiteCanvasContext:context};
        if(name.endsWith('.module.css'))return {default:new Proxy({},{get:(_,key)=>key})};
        if(name==='../lib/website-canvas')return modules.canvas;
        throw Error('Unexpected module '+name);
      }
      function evaluate(source) {const module={exports:{}};new Function('require','module','exports','React',source)(require,module,module.exports,React);return module.exports;}
      modules.canvas=evaluate(canvas);
      const Host=evaluate(host).default;
      window.mount=()=> {
        window.fixtureRoot=ReactDOM.createRoot(document.getElementById('app'));
        window.fixtureRoot.render(React.createElement(Host,{footer:React.createElement('footer',null,'Footer'),operational:null},
          React.createElement('header',null,React.createElement('a',{'aria-label':'Go to Aim4price home',href:'/'},'Aim4price'),React.createElement('div',{'data-website-zoom-host':''})),
          React.createElement('main',null,React.createElement('h1',null,'Home'))));
      };
      window.mount();
    },{canvas,host});
    const waitScale=async expected=>{try {await page.waitForFunction(value=>Math.abs(Number(document.querySelector('[data-website-canvas]')?.dataset.websiteScale)-value)<.001,{},expected);} catch(error) {console.error('Scale mismatch',expected,await page.evaluate(()=>({scale:document.querySelector('[data-website-canvas]')?.dataset.websiteScale,width:document.documentElement.clientWidth,coarse:matchMedia('(hover: none) and (pointer: coarse)').matches})),errors);throw error;}};
    await waitScale(1);
    await page.waitForSelector('[data-site-workspace-zoom-controls]');
    // CDP changes the mobile viewport while the browser's outer window stays 1440.
    await setViewport({width:390,height:844,isMobile:false,hasTouch:true});
    await waitScale(390/1440);
    await page.waitForSelector('[data-mobile-landscape-entry]');
    assert.equal(await page.$eval('[data-website-canvas]',e=>e.inert),true);
    assert.ok(await page.$eval('[data-website-canvas]',e=>e.getBoundingClientRect().width<=390.5));
    await page.screenshot({path:path.join(output,'phone-entry.png')});
    console.log('PASS desktop-to-touch viewport fits 390px with outerWidth held at 1440');
    await setViewport({width:844,height:390,isMobile:false,hasTouch:true});
    await waitScale(844/1440);
    await page.waitForFunction(()=>!document.querySelector('[data-mobile-landscape-entry]'));
    await page.waitForFunction(()=>!document.querySelector('[data-website-canvas]').inert);
    console.log('PASS rotation dismisses entry and refits landscape');
    await setViewport({width:390,height:844,isMobile:false,hasTouch:true});
    await page.waitForSelector('[data-mobile-landscape-entry]');
    await page.$$eval('button',els=>els.find(e=>e.textContent==='Continue in portrait').click());
    await page.waitForFunction(()=>!document.querySelector('[data-mobile-landscape-entry]'));
    await waitScale(390/1440);
    await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});
    await new Promise(resolve=>setTimeout(resolve,200));
    assert.ok(Math.abs(await page.$eval('[data-website-canvas]',e=>Number(e.dataset.websiteScale))-390/1440)<.001);
    await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
    console.log('PASS pinch magnification preserves canvas scale');
    await page.$eval('[aria-label="Zoom in"]',e=>e.click());
    await waitScale(.28);
    await page.evaluate(()=>{window.fixtureRoot.unmount();window.mount()});
    await waitScale(.28);
    await page.waitForSelector('[data-site-workspace-zoom-controls]');
    assert.equal(await page.$('[data-mobile-landscape-entry]'),null);
    await page.$eval('[data-site-workspace-zoom-controls] button:nth-child(2)',e=>e.click());
    await waitScale(390/1440);
    console.log('PASS manual preference and portrait bypass survive remount; percentage restores Auto');
    // Change pointer type with the same viewport to cover media-query change handling.
    await setViewport({width:390,height:844,isMobile:false,hasTouch:false});
    await waitScale(1);
    await setViewport({width:960,height:600,deviceScaleFactor:1.5,isMobile:false,hasTouch:false});
    await waitScale(1);
    console.log('PASS desktop pointer change and browser magnification retain outer-window sizing');
    // Fresh phone entry with actual mobile viewport semantics and device-width metadata.
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true,screenWidth:390,screenHeight:844});
    await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    await page.evaluate(()=>{sessionStorage.clear();localStorage.removeItem('aim4price.website-canvas.v2');window.fixtureRoot.unmount();window.mount()});
    await waitScale(390/1440);
    await page.waitForSelector('[data-mobile-landscape-entry]');
    assert.equal(await page.evaluate(()=>document.documentElement.clientWidth),390);
    console.log('PASS fresh mobile entry uses phone layout viewport and shows rotation prompt');
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
