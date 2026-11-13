/* Exercise the real help component, portal, title styles and keyboard interaction. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/page-help-validation');
const output = path.join(root, '.next/page-help-validation');
const topics = ['valuation','register','maintenance','costsEntry','costs','budgets','fuelEntry','fuelSlips','fuelStorage','documents','map','marketplaceEntry','discovery','marketplace','account','registers','desktopUsers','managerUsers','aiConnections','transfers','showroom','invoiceDrop','recentAdverts','partnerLeads','dealerTracking','dealerRegisterChoice','dealerCosts','partsStock','partsList','adStudio','adTemplate','adCreator','dealerUsers','middlemanUsers','sharedEnquiries','dealerAccount','middlemanAccount','sharingAccount'];
(async () => {
  let server, browser;
  try {
    await fs.mkdir(fixture);
    await fs.copyFile(path.join(root,'tests/fixtures/page-help-page.tsx'), path.join(fixture,'page.tsx'));
    server = spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3031'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'help_validation',PGPASSWORD:'local-test-only',PGDATABASE:'help_validation',BETTER_AUTH_SECRET:'local-help-validation-not-for-production'},stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Next startup timed out')),90000);server.stdout.on('data',data=>{if(data.toString().includes('Ready')){clearTimeout(timer);resolve();}});server.stderr.on('data',data=>process.stderr.write(data));server.once('exit',code=>{clearTimeout(timer);reject(Error(`Next exited ${code}`));});});
    browser = await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});
    const page=await browser.newPage(); const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request',request=>request.url().includes('/api/') ? request.respond({status:200,contentType:'application/json',body:JSON.stringify({ok:true,signedIn:false,notifications:[]})}) : request.continue());
    await page.evaluateOnNewDocument(()=>Object.defineProperty(window,'outerWidth',{configurable:true,get:()=>innerWidth}));
    await fs.mkdir(output,{recursive:true});
    for(const width of [1440,1024,430]) {
      await page.setViewport({width,height:900});
      for(const topic of topics) {
        await page.goto(`http://127.0.0.1:3031/page-help-validation?topic=${topic}`,{waitUntil:'networkidle0',timeout:120000});
        const trigger='button[aria-label^="About "]';
        await page.waitForSelector(trigger);
        const bounds=await page.$eval(trigger,el=>{const r=el.getBoundingClientRect();return {x:r.x,right:r.right,width:innerWidth};});
        assert.ok(bounds.x>=0 && bounds.right<=bounds.width+1,`${topic} help is visible at ${width}`);
        const sizes=await page.$eval(trigger,el=>{const button=getComputedStyle(el),icon=getComputedStyle(el.querySelector('svg'));return {buttonWidth:button.width,buttonHeight:button.height,iconWidth:icon.width,iconHeight:icon.height};});
        for (const [key, expected] of Object.entries({buttonWidth:44,buttonHeight:44,iconWidth:20,iconHeight:20})) assert.ok(Math.abs(parseFloat(sizes[key])-expected)<0.1,`${topic}: ${key} is ${sizes[key]}, expected ${expected}px`);
        const overlaps=await page.$eval(trigger,el=>{const r=el.getBoundingClientRect();return [...document.querySelectorAll('button')].filter(b=>b!==el && b.getAttribute('aria-label')?.startsWith('Switch')).some(b=>{const q=b.getBoundingClientRect();return r.left<q.right && r.right>q.left && r.top<q.bottom && r.bottom>q.top;});});
        assert.equal(overlaps,false,`${topic} help does not overlap switches`);
        if(width===1440 && ['register','fuelSlips','map','budgets','registers','desktopUsers','managerUsers','aiConnections','transfers','showroom','invoiceDrop'].includes(topic)) await page.screenshot({path:path.join(output,`${topic}-heading.png`)});
        await page.hover(trigger);
        await page.waitForSelector('[role="tooltip"]',{visible:true});
        const tooltip=await page.$eval('[role="tooltip"]',el=>{const r=el.getBoundingClientRect();return {text:el.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};});
        const label=await page.$eval(trigger,el=>el.getAttribute('aria-label'));
        assert.equal(tooltip.text,label,`${topic}: page-specific hover wording`);
        assert.ok(tooltip.left>=0 && tooltip.right<=width,`${topic}: tooltip stays in viewport`);
        assert.ok(await page.$eval(trigger,(el,tip)=>{const r=el.getBoundingClientRect();return r.top-tip.height-10>=12 ? tip.bottom<=r.top : tip.top>=r.bottom;},tooltip),`${topic}: tooltip sits above the icon or below when space is limited`);
        if(width===1440 && topic==='register') await page.screenshot({path:path.join(output,'register-help-hover.png')});
        await page.focus(trigger);
        await page.keyboard.press('Escape');
        assert.equal(await page.$('[role="tooltip"]'),null,'Escape dismisses tooltip');
        await page.click(trigger);await page.waitForSelector('[role="dialog"]');
        assert.equal(await page.$('[role="dialog"] header svg'),null,'no decorative modal header icon');
        assert.equal(await page.$eval('[role="dialog"]',el=>el.contains(document.activeElement)),true,'dialog receives focus');
        assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden','background scrolling is locked');
        const geometry=await page.$eval('[role="dialog"]',el=>{const r=el.getBoundingClientRect();const body=el.querySelector('[class*="_body"]');return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight,scroll:body.scrollHeight-body.clientHeight,cssWidth:parseFloat(getComputedStyle(el).width)};});
        assert.ok(geometry.x>=-1 && geometry.y>=-1 && geometry.right<=geometry.w+1 && geometry.bottom<=geometry.h+1,JSON.stringify(geometry));
        if(width===1440) {
          assert.ok(geometry.scroll<=1,`${topic}: no desktop scrolling`);
          assert.ok(geometry.cssWidth>=1055,`${topic}: spacious desktop dialog ${JSON.stringify(geometry)}`);
          const wrapped=await page.$$eval('[role="dialog"] li span',elements=>elements.filter(el=>{const range=document.createRange();range.selectNodeContents(el);return range.getClientRects().length>1;}).map(el=>el.textContent));
          assert.deepEqual(wrapped,[],`${topic}: desktop action text stays on one line`);
          await page.screenshot({path:path.join(output,`${topic}-help-desktop.png`)});
        }
        await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
        assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Got it','reverse tab stays in dialog');
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Close page information');
        if(topic==='register') await page.screenshot({path:path.join(output,`register-help-${width}.png`)});
        await page.keyboard.press('Escape');
        assert.equal(await page.$('[role="dialog"]'),null);
        assert.equal(await page.$eval(trigger,el=>el===document.activeElement),true,'focus returns to help');
        assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden','background scrolling is restored');
        await page.click(trigger);await page.click('[role="dialog"] footer button');
        assert.equal(await page.$('[role="dialog"]'),null,'Got it closes dialog');
      }
      console.log(`PASS all ${topics.length} topics at ${width}px: wide layout, hover labels, switches, focus, Escape and Got it`);
    }
    // Short viewports must scroll the body without hiding the close actions.
    await page.setViewport({width:1440,height:480});
    await page.goto('http://127.0.0.1:3031/page-help-validation?topic=register',{waitUntil:'networkidle0'});
    await page.evaluate(()=>document.documentElement.dataset.appTheme='dark');
    await page.click('button[aria-label^="About "]');
    const short=await page.$eval('[role="dialog"]',el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight};});
    assert.ok(short.top>=0 && short.bottom<=short.height+1,'short-screen dialog stays inside viewport');
    await page.screenshot({path:path.join(output,'register-help-dark-short.png')});
    await page.click('[aria-label="Close page information"]');
    assert.equal(await page.$('[role="dialog"]'),null,'close icon works');
    await page.click('button[aria-label^="About "]');
    await page.mouse.click(8,8);
    assert.equal(await page.$('[role="dialog"]'),null,'backdrop closes');
    console.log('PASS dark theme, short viewport, close icon and backdrop');
    assert.deepEqual(errors,[],'no browser runtime errors');
  } finally {
    if(browser) await browser.close();
    await fs.rm(fixture,{recursive:true,force:true});
    await fs.rm(path.join(root,'.next/types/app/page-help-validation'),{recursive:true,force:true});
    server?.kill();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
