/* Exercise the real shared calendar without a database or authenticated session. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
(async () => {
  const browser = await puppeteer.launch({executablePath: process.env.CANVAS_BROWSER_PATH || await chromium.executablePath(), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'], headless: true, pipe: true});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const css = fs.readFileSync('components/DateInput.module.css', 'utf8').replaceAll(':global(:where(html:not(:has([data-website-canvas]))))', ':where(html:not(:has([data-website-canvas])))').replaceAll(':global(html)', 'html').replaceAll(':global(body)', 'body');
    await page.setContent(`<style>body{margin:0;background:#dce8e2;font-family:Arial}*{box-sizing:border-box}${css}</style><form id="root"></form>`);
    await page.addScriptTag({path:'node_modules/react/umd/react.development.js'});
    await page.addScriptTag({path:'node_modules/react-dom/umd/react-dom.development.js'});
    const code = ts.transpileModule(fs.readFileSync('components/DateInput.tsx','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
    await page.addScriptTag({content:`const exports={};const require=name=>name==='react'?React:name==='react-dom'?ReactDOM:{default:new Proxy({},{get:(_,key)=>key})};${code}\nwindow.root=ReactDOM.createRoot(document.getElementById('root'));window.renderCalendar=(props={})=>root.render(React.createElement(exports.default,{key:JSON.stringify(props),defaultValue:'2026-10-24',name:'date',...props}));renderCalendar();`});
    const open = async () => {await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.click('[aria-label="Open calendar"]');await page.waitForSelector('dialog[open]');};
    const value = () => page.$eval('input[name="date"]', el=>el.value);
    await page.setViewport({width:1440,height:900});
    await open();
    assert.equal(await page.$$eval('.days > *', els=>els.length),42,'October has a header and five complete weeks');
    await page.click('[data-date="2026-10-20"]');
    assert.equal(await value(),'2026-10-24','Selecting only previews');
    await page.keyboard.press('Escape');
    assert.equal(await value(),'2026-10-24','Escape cancels');
    await open();
    assert.equal(await page.$eval('[data-date="2026-10-24"]',el=>el.getAttribute('aria-pressed')),'true');
    await page.click('[data-date="2026-10-21"]');
    await page.click('.summary > button');
    assert.equal(await value(),'2026-10-21');
    await open();
    await page.click('[aria-label="Month"]');
    await page.click('[role="option"]:nth-child(2)');
    await page.click('[aria-label="Year"]');
    await page.evaluate(()=>[...document.querySelectorAll('[role="option"]')].find(el=>el.textContent==='2024').click());
    assert.ok(await page.$('[data-date="2024-02-29"]'),'Leap day exists');
    await page.focus('[data-date="2024-02-29"]');await page.keyboard.press('ArrowRight');
    await page.waitForFunction(()=>document.activeElement?.getAttribute('data-date')==='2024-03-01');
    await page.keyboard.press('Enter');await page.click('.summary > button');
    assert.equal(await value(),'2024-03-01','Keyboard crosses month and leap-year boundary');
    await page.evaluate(()=>renderCalendar({min:'2026-10-10',max:'2026-10-24'}));
    await open();
    assert.equal(await page.$eval('[data-date="2026-10-09"]',el=>el.disabled),true);
    assert.equal(await page.$eval('[data-date="2026-10-25"]',el=>el.disabled),true);
    await page.click('[aria-label="Close calendar"]');
    for (const [width,height] of [[1440,900],[1366,768],[390,844],[320,640],[844,390]]) {
      await page.setViewport({width,height});await open();
      const layout=await page.$eval('dialog',el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,x:r.x,y:r.y,overflow:el.scrollWidth>el.clientWidth+1};});
      assert.ok(layout.x>=0&&layout.y>=0&&layout.width<=width&&layout.height<=height,JSON.stringify(layout));
      assert.equal(layout.overflow,false,'No horizontal scroll');
      if(width>=1000) {assert.ok(layout.width>900,'Wide desktop calendar');assert.equal(await page.$eval('dialog',el=>el.scrollHeight>el.clientHeight+1),false,'Desktop needs no scrollbar');}
      await page.click('.summary > button');
    }
    // Six-week months must fit without clipping, including the user's enlarged desktop view.
    for (const [width,height,zoom] of [[1440,900,1],[1366,768,1],[1920,870,1.25],[390,844,1],[320,640,1],[844,390,1]]) {
      await page.setViewport({width,height});
      await page.evaluate(({width,height,zoom})=>{
        document.body.style.minHeight='200vh';
        document.documentElement.style.setProperty('--website-visible-height',`${height/zoom}px`);
        document.documentElement.style.setProperty('--website-visible-width',`${width/zoom}px`);
        document.querySelector('dialog').style.zoom=String(zoom);
      },{width,height,zoom});
      await open();await page.click('[aria-label="Month"]');
      await page.evaluate(()=>[...document.querySelectorAll('[role="option"]')].find(el=>el.textContent==='August').click());
      await page.waitForSelector('[data-date="2026-08-31"]');
      assert.equal(await page.$$eval('.days > *', els=>els.length),49);
      assert.equal(await page.$eval('dialog',el=>el.scrollHeight>el.clientHeight+1),false,'Six weeks fit without scrolling');
      assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow),'hidden','Background scrolling locked');
      assert.equal(await page.$eval('.summary > button',el=>{const r=el.getBoundingClientRect();return r.bottom<=innerHeight&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'Confirmation visible and clickable');
      await page.click('[aria-label="Close calendar"]');
      assert.notEqual(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow),'hidden','Background scrolling restored');
    }
    await page.evaluate(()=>{document.documentElement.style.removeProperty('--website-visible-height');document.documentElement.style.removeProperty('--website-visible-width');document.querySelector('dialog').style.zoom='1';});
    // Blank dates require a selection; close does not submit a surrounding form.
    await page.evaluate(()=>renderCalendar({defaultValue:''}));await open();
    assert.equal(await page.$eval('.summary > button',el=>el.disabled),true);
    await page.click('[aria-label="Close calendar"]');
    await page.setViewport({width:1440,height:900});
    await page.evaluate(()=>renderCalendar());await open();
    fs.mkdirSync('.next/calendar-validation',{recursive:true});
    await page.screenshot({path:'.next/calendar-validation/desktop.png'});
    assert.deepEqual(errors,[]);
    console.log('PASS: selection/confirmation/cancel, bounds, leap year, keyboard navigation, month/year menus, desktop and mobile layout');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
