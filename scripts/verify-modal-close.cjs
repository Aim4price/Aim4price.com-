/* Run from the repository root: node scripts/verify-modal-close.cjs */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
(async () => {
  const browser = await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH || await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});
  try {
    const page = await browser.newPage();
    // Real shared dialog, with its existing CSS loaded AFTER the global standard.
    const css = fs.readFileSync('app/modal-close.css','utf8') + '\n' + fs.readFileSync('components/asset-register/MoveAssetDestinationPicker.module.css','utf8').replaceAll(':global(:where(html:not(:has([data-website-canvas]))))', ':where(html:not(:has([data-website-canvas])))');
    const choiceCss = fs.readFileSync('components/asset-register/InsideShareDialog.module.css','utf8').replace(/\.([a-zA-Z_][\w-]*)/g,'.choice_$1').replaceAll(':global(body:not(:has([data-website-canvas])))','body:not(:has([data-website-canvas]))');
    const js = ts.transpileModule(fs.readFileSync('components/asset-register/MoveAssetDestinationPicker.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
    await page.setContent('<html><head><style>*{box-sizing:border-box}body{font-family:Arial;margin:0}'+css+'\n'+choiceCss+'</style></head><body><div id="root"></div></body></html>');
    await page.addScriptTag({path:process.cwd()+'/node_modules/react/umd/react.development.js'});
    await page.addScriptTag({path:process.cwd()+'/node_modules/react-dom/umd/react-dom.development.js'});
    await page.addScriptTag({content:`const exports={};const require=name=>name==='react'?React:{default:new Proxy({},{get:(_,key)=>name.includes('InsideShareDialog')?'choice_'+key:key})};${js}
      function Demo(){const [busy,setBusy]=React.useState(false);window.setBusy=setBusy;return React.createElement(exports.default,{assetName:'Test asset',assetDetails:'Year model: 2000',sourceName:'Farm register',destination:'register',onDestinationChange:()=>{},options:[],targetId:'',onSelect:()=>{},canUseUmbrellas:true,loading:false,loadError:'',error:'',busy,managementHref:'#',onRetry:()=>{},onClose:()=>window.closedCount=(window.closedCount||0)+1,onMove:()=>{}})}ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Demo));`});
    await page.waitForSelector('[data-modal-close]');
    for (const width of [390,1280]) {
      await page.setViewport({width,height:900});
      const metrics=await page.$eval('[data-modal-close]',el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el),glyph=getComputedStyle(el,'::after');return {width:r.width,height:r.height,radius:s.borderRadius,background:s.backgroundColor,color:s.color,glyph:glyph.content,label:el.getAttribute('aria-label'),fits:r.left>=0&&r.right<=innerWidth};});
      assert.equal(metrics.width,44);assert.equal(metrics.height,44);assert.equal(metrics.radius,'14.4px');assert.equal(metrics.background,'rgb(247, 250, 248)');assert.equal(metrics.color,'rgb(37, 71, 51)');assert.equal(metrics.glyph,'"×"');assert.ok(metrics.label);assert.ok(metrics.fits);
      await page.focus('[data-modal-close]');
      assert.equal(await page.$eval('[data-modal-close]',el=>getComputedStyle(el).outlineStyle),'solid');
      await page.keyboard.press('Enter');
    }
    assert.equal(await page.evaluate(()=>window.closedCount),2);
    await page.evaluate(()=>window.setBusy(true));
    await page.waitForFunction(()=>document.querySelector('[data-modal-close]').disabled);
    await page.click('[data-modal-close]');
    assert.equal(await page.evaluate(()=>window.closedCount),2,'Disabled close must not dismiss a busy operation');
    await page.evaluate(()=>window.setBusy(false));
    await page.waitForFunction(()=>!document.querySelector('[data-modal-close]').disabled);
    await page.hover('[data-modal-close]');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-modal-close]')).backgroundColor==='rgb(238, 245, 240)');
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    assert.equal(await page.$eval('[data-modal-close]',el=>getComputedStyle(el).transitionDuration),'0s');
    await page.evaluate(()=>{document.documentElement.style.setProperty('--app-surface','#15251d');document.documentElement.style.setProperty('--app-text','#eef5f0');});
    await page.mouse.move(0,0);
    assert.equal(await page.$eval('[data-modal-close]',el=>getComputedStyle(el).color),'rgb(238, 245, 240)');
    // Backdrops and footer buttons must retain their own shapes and labels.
    assert.equal(await page.$eval('.actions button',el=>getComputedStyle(el,'::after').content),'none');
    fs.mkdirSync('.next/canvas-validation',{recursive:true});
    await page.evaluate(()=>{document.documentElement.style.removeProperty('--app-surface');document.documentElement.style.removeProperty('--app-text');});
    await page.screenshot({path:'.next/canvas-validation/modal-close.png'});
    console.log('PASS: real modal at mobile/desktop sizes, legacy CSS cascade, theme, keyboard, hover, busy guards and reduced motion');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
