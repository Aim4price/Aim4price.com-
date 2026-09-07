/* Real-component browser regression checks. No database or authenticated account required.
 * The temporary fixture route exists only while this command runs.
 * CANVAS_BROWSER_PATH may select an installed Chromium; CANVAS_BASELINE_URL adds native comparisons.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
const output = process.env.CANVAS_OUTPUT_DIR || path.join(root, '.next/canvas-validation');
const widths = [1440, 1920, 1600, 1366, 1280, 1024, 768, 430];
const user = { id:'canvas-fixture', name:'Canvas Test Owner', email:'canvas@example.invalid', accountType:'owner', accountSubtype:null };
const profile = { userId:user.id,name:user.name,displayName:user.name,email:user.email,accountType:'owner',accountSubtype:'',logoUrl:'',extraPhotoUrls:[],businessName:'Test farm',phone:'',province:'Gauteng',townCity:'Test town',addressLine1:'',addressLine2:'',websiteUrl:'',vatNumber:'',notes:'',marketplaceSellerName:'',marketplacePhone:'',marketplaceEmail:'',marketplaceLocation:'',partnerServices:'',partnerBrandFocus:'',partnerDescription:'',partnerDirectoryStatus:'inactive',partnerLatitude:null,partnerLongitude:null,partnerServiceRadiusKm:null,discoveryParticipationEnabled:false,partnerDirectoryEnabled:false,createdAtIso:null,updatedAtIso:null };
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function check(browser, url) {
  const page = await browser.newPage();
  const errors=[]; page.on('pageerror', e=>{errors.push(e.message);console.error('Browser error',page.url(),e.stack)});
  await page.setRequestInterception(true);
  let signedIn=false;
  page.on('request', request=>{
    const target=new URL(request.url());
    if(target.pathname.startsWith('/api/')) {
      const body = target.pathname==='/api/me' ? {ok:true,signedIn,user:signedIn?user:null} : target.pathname==='/api/account-profile' ? {ok:true,profile} : {ok:true,register:{id:'canvas-register',name:'Test farm'},items:[],assets:[],groups:[],registers:[{id:'canvas-register',name:'Test farm'}],notifications:[],listings:[],storages:[],recentEvents:[],recentFuelSlips:[],requests:[],budgets:[],scanPin:{enabled:false,hasPin:false,updatedAtIso:null},enabled:false,hasPin:false};
      return request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
    }
    // Marketing videos are irrelevant to layout and intentionally not downloaded for CI.
    if(request.resourceType()==='media') return request.abort();
    return request.continue();
  });
  await page.evaluateOnNewDocument(()=>{
    // CDP's setViewport does not change outerWidth. Supply the browser window
    // width explicitly; browser zoom is tested separately with this held fixed.
    Object.defineProperty(window,'outerWidth',{configurable:true,get:()=>Number(sessionStorage.getItem('canvas-test-unzoomed-width'))||innerWidth});
    localStorage.setItem('aim4price.website-canvas.v2.intro','seen');
  });
  const reports=[];
  async function visit(route,width=1440,height=900) {
    await page.setViewport({width,height,deviceScaleFactor:1,isMobile:false,hasTouch:false});
    await page.goto(url+route,{waitUntil:'networkidle2',timeout:120000});
    await page.evaluate(async()=>{await document.fonts.ready;sessionStorage.removeItem('canvas-test-unzoomed-width')});
    await page.waitForSelector('[data-website-canvas]');
    await page.waitForFunction(()=>Boolean(document.querySelector('[data-site-workspace-zoom-controls]')));
    await page.evaluate(()=>{
      [...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Pause animation')?.click();
      window.scrollTo({left:0,top:0,behavior:'instant'});
    });
    await delay(150);
  }
  async function geometry() {
    return page.evaluate(()=>{
      const canvas=document.querySelector('[data-website-canvas]'), scale=Number(canvas.dataset.websiteScale), origin=canvas.getBoundingClientRect();
      const selectors=['header:has(a[aria-label="Go to Aim4price home"]) > div','header nav','header a[aria-label]' ,'h1','[class*="storyHeroGrid"]','[class*="summaryTrack"]','[class*="summaryCard"]','[class*="toolbar"]','footer'];
      const items=[];
      for(const selector of selectors) for(const element of [...canvas.querySelectorAll(selector)].slice(0,12)) {
        const r=element.getBoundingClientRect(),s=getComputedStyle(element);if(!r.width||!r.height)continue;
        items.push({selector,text:element.tagName,className:element.className, rounding:Math.max(2, [...element.querySelectorAll('*')].filter(child=>parseFloat(getComputedStyle(child).borderLeftWidth)>0).length*2), width:r.width/scale,height:r.height/scale,font:parseFloat(s.fontSize),display:s.display});
      }
      const header=canvas.querySelector('header:has(a[aria-label="Go to Aim4price home"])'),nav=header?.querySelector('nav'),actions=header?.firstElementChild?.lastElementChild,plus=header?.querySelector('[aria-label="Zoom in"]');
      const zoomHost=header?.querySelector('[data-website-zoom-host]'),brand=header?.querySelector('a[aria-label="Go to Aim4price home"]');
      const headerFits=!nav||!actions||!plus||(!!zoomHost&&!!brand&&brand.getBoundingClientRect().right<=zoomHost.getBoundingClientRect().left+1&&zoomHost.getBoundingClientRect().right<=nav.getBoundingClientRect().left+1&&nav.getBoundingClientRect().right<=actions.getBoundingClientRect().left+1&&actions.getBoundingClientRect().right<=origin.right+1);
      return {headerFits,scale,width:origin.width/scale,scroll:document.documentElement.scrollWidth,viewport:innerWidth,items};
    });
  }
  for(const [name,route,auth] of (process.env.CANVAS_INTERACTIONS_ONLY?[]:[['home','/',false],['estimate','/valuation',false],['register','/canvas-validation?page=register',true],['marketplace','/canvas-validation?page=marketplace',true],['fuel','/canvas-validation?page=fuel',true],['account','/canvas-validation?page=account',true]])) {
    signedIn=auth;
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>sessionStorage.clear());
    let reference;
    for(const width of widths) {
      await visit(route,width);
      const actual=await geometry();
      assert.ok(Math.abs(actual.scale-Math.min(1.2,width/1440))<.012,`${name}/${width}: automatic scale`);
      assert.ok(Math.abs(actual.width-1440)<.1,`${name}/${width}: logical canvas width`);
      assert.ok(actual.headerFits,`${name}/${width}: header controls overlap or escape the canvas`);
      assert.ok(actual.scroll<=width+1,`${name}/${width}: unexpected horizontal overflow ${actual.scroll}`);
      if(!reference) reference=actual.items;
      assert.equal(actual.items.length,reference.length,`${name}/${width}: composition changed`);
      actual.items.forEach((item,i)=>{
        assert.equal(item.display,reference[i].display,`${name}/${width}: display changed`);
        assert.ok(Math.abs(item.width-reference[i].width)<Math.max(item.rounding/actual.scale,reference[i].width*.015),`${name}/${width}: ${item.selector} width ${item.width} vs ${reference[i].width}`);
        assert.ok(Math.abs(item.height-reference[i].height)<2/actual.scale,`${name}/${width}: ${item.selector} height ${item.height} vs ${reference[i].height}`);
        assert.ok(Math.abs(item.font-reference[i].font)<.02,`${name}/${width}: typography changed`);
      });
      await page.screenshot({path:path.join(output,`${name}-${width}.png`)});
      reports.push({name,width,scale:actual.scale,elements:actual.items.length});
    }
    console.log(`PASS ${name}: ${widths.length} widths`);
  }
  // Height only controls visible area; it must not select a different composition.
  await visit('/',1366,768);const tall=await geometry();await page.setViewport({width:1366,height:600});await delay(150);const short=await geometry();
  assert.equal(tall.scale,short.scale);assert.deepEqual(tall.items,short.items);
  const initialStory=await page.$eval('section[data-story-step]',e=>e.dataset.storyStep);
  await page.evaluate(()=>{const section=document.querySelector('section[data-story-step]'),sticky=section.querySelector('[class*="heroSticky"]'),scale=Number(document.querySelector('[data-website-canvas]').dataset.websiteScale);window.scrollTo({top:section.getBoundingClientRect().top+scrollY+(section.getBoundingClientRect().height-sticky.getBoundingClientRect().height)*.8-parseFloat(getComputedStyle(sticky).top)*scale,behavior:'instant'})});
  await page.waitForFunction(initial=>document.querySelector('section[data-story-step]').dataset.storyStep!==initial,{timeout:10000},initialStory);
  await page.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
  await page.waitForFunction(initial=>document.querySelector('section[data-story-step]').dataset.storyStep===initial,{timeout:10000},initialStory);
  // Header actions, notifications, Manage and the footer use real components.
  signedIn=true;await page.evaluate(()=>sessionStorage.clear());await visit('/canvas-validation?page=account',768);
  await page.click('[aria-label="Open manage menu"]');await page.waitForSelector('[class*="accountPopover"]');
  await page.screenshot({path:path.join(output,'manage-768.png')});await page.click('[aria-label="Open manage menu"]');
  await page.click('[aria-label^="Notifications"]');await page.waitForSelector('[aria-label="Close notifications"]');
  assert.equal(await page.$eval('[aria-label="Close notifications"]',e=>Boolean(e.closest('#aim4price-website-overlays'))),true);
  await page.screenshot({path:path.join(output,'notifications-768.png')});await page.click('[aria-label="Close notifications"]');
  await page.$eval('[aria-label="Open footer"]',e=>e.click());await delay(500);await page.$eval('footer',e=>e.scrollIntoView({block:'end',behavior:'instant'}));await page.screenshot({path:path.join(output,'footer-open-768.png')});const footerOpen=await page.$eval('footer',e=>e.getBoundingClientRect().height);
  await page.$eval('[aria-label="Collapse footer"]',e=>e.click());await delay(500);assert.ok(footerOpen>await page.$eval('footer',e=>e.getBoundingClientRect().height));
  // Initially open portal, anchor geometry, custom account select, manual sizing.
  await visit('/canvas-validation',768);
  await page.waitForSelector('#canvas-test-dropdown');
  async function dropdownGeometry() {
    await page.waitForFunction(()=>document.querySelector('#canvas-test-dropdown')?.style.visibility==='visible');
    return page.evaluate(()=>{
      const anchor=document.querySelector('[aria-controls="canvas-test-dropdown"]').getBoundingClientRect(),menu=document.querySelector('#canvas-test-dropdown'),rect=menu.getBoundingClientRect();
      return {gap:rect.top-anchor.bottom,left:rect.left-anchor.left,width:rect.width-anchor.width,scale:Number(document.querySelector('[data-website-canvas]').dataset.websiteScale),scrollX:window.scrollX,bodyScrollLeft:document.body.scrollLeft,inRoot:!!menu.closest('#aim4price-website-overlays')};
    });
  }
  for(let i=0;i<3;i++) {const g=await dropdownGeometry();assert.ok(g.inRoot);assert.ok(Math.abs(g.left)<1);assert.ok(Math.abs(g.width)<1);assert.ok(Math.abs(g.gap-8*g.scale)<1);await page.click('[aria-label="Zoom in"]');await page.evaluate(()=>window.scrollTo({left:0,top:0,behavior:'instant'}));await delay(150);}
  const manual=await page.$eval('[data-website-canvas]',e=>Number(e.dataset.websiteScale));
  await page.reload({waitUntil:'networkidle2'});assert.equal(await page.$eval('[data-website-canvas]',e=>Number(e.dataset.websiteScale)),manual);
  await page.click('[aria-controls="canvas-test-dropdown"]');
  await page.click('[aria-haspopup="listbox"]:not([aria-controls="canvas-test-dropdown"])');
  await page.waitForSelector('[role="option"]');await page.$$eval('[role="option"]',els=>els.find(e=>e.textContent.includes('Second option')).click());
  assert.ok(await page.$eval('[aria-haspopup="listbox"]:not([aria-controls="canvas-test-dropdown"])',e=>e.textContent.includes('Second option')));
  await page.click('[data-site-workspace-zoom-controls] button:nth-child(2)');
  assert.equal(await page.$eval('[data-site-workspace-zoom-controls]',e=>e.dataset.zoomPreference),'auto');
  // A real Asset Register dialog stays scaled and reachable at both extremes.
  await visit('/canvas-validation?page=register',430,600);
  async function openAssetChoice() {
    await page.$$eval('button',elements=>elements.find(e=>e.textContent.trim()==='Add Asset')?.click());
    await page.waitForSelector('[aria-labelledby="add-asset-choice-title"]');
  }
  await openAssetChoice();
  assert.equal(await page.$eval('[aria-labelledby="add-asset-choice-title"]',e=>Boolean(e.closest('[data-website-canvas]'))),true);
  const autoModalWidth=await page.$eval('[aria-labelledby="add-asset-choice-title"]',e=>parseFloat(getComputedStyle(e).width));
  await page.screenshot({path:path.join(output,'register-modal-auto-430.png')});
  await page.click('[aria-label="Close add asset options"]');
  for(let i=0;i<150;i++) await page.$eval('[aria-label="Zoom in"]',e=>e.click());
  await page.waitForFunction(()=>Number(document.querySelector('[data-website-canvas]').dataset.websiteScale)===1.5);
  await openAssetChoice();
  const safety=await page.$eval('[aria-labelledby="add-asset-choice-title"]',dialog=>{
    const overlay=dialog.closest('[data-website-overlay]'),r=dialog.getBoundingClientRect();
    overlay.scrollTo({left:overlay.scrollWidth,top:overlay.scrollHeight,behavior:'instant'});
    const backdrop=overlay.querySelector(':scope > [data-website-overlay]:empty').getBoundingClientRect();
    return {backdropLeft:backdrop.left,backdropRight:backdrop.right,viewportWidth:document.documentElement.getBoundingClientRect().width,logicalWidth:parseFloat(getComputedStyle(dialog).width),top:r.top,left:r.left,scrollable:overlay.scrollWidth>=overlay.clientWidth,bodyOwnsScroll:document.body.scrollLeft>0};
  });
  assert.ok(safety.top>=-1 && safety.left>=-1,'enlarged dialog starts in reachable scroll space');
  assert.ok(Math.abs(safety.logicalWidth-autoModalWidth)<.1,'manual sizing preserves the canonical modal width');
  assert.ok(Math.abs(safety.backdropLeft)<1 && safety.backdropRight>=safety.viewportWidth-1,'backdrop covers the viewport while the modal scrolls');
  assert.ok(safety.scrollable);assert.equal(safety.bodyOwnsScroll,false);
  await page.screenshot({path:path.join(output,'register-modal-manual-430.png')});
  await page.$eval('[aria-label="Close add asset options"]',e=>e.click());
  await page.$eval('[data-site-workspace-zoom-controls] button:nth-child(2)',e=>e.click());
  await visit('/canvas-validation',768);
  // Browser zoom changes CSS viewport width while unzoomed outerWidth is stable.
  const before=await page.$eval('[data-website-canvas]',e=>Number(e.dataset.websiteScale));
  await page.evaluate(()=>sessionStorage.setItem('canvas-test-unzoomed-width',String(innerWidth)));
  await page.setViewport({width:512,height:600,deviceScaleFactor:1.5});await delay(150);
  assert.equal(await page.$eval('[data-website-canvas]',e=>Number(e.dataset.websiteScale)),before);
  console.log('PASS height, portals, anchored menus, manual persistence/Auto, footer, Manage, notifications, browser-zoom geometry');
  // Native apps keep their own mobile viewport, DOM host and shared styles.
  for(const route of ['/owner-app/login','/dealer/login','/field-manager/login']) {
    const snapshots=[];
    for(const base of [url,...(process.env.CANVAS_BASELINE_URL?[process.env.CANVAS_BASELINE_URL]:[])]) {
      await page.setViewport({width:430,height:900,isMobile:true,hasTouch:true,deviceScaleFactor:1});
      await page.goto(base+route,{waitUntil:'networkidle2',timeout:120000});await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.$('[data-website-canvas]'),null,`${route} excluded`);
      assert.equal(await page.$('#aim4price-website-overlays'),null,`${route} native portal host`);
      snapshots.push(await page.evaluate(()=>({viewport:document.querySelector('meta[name="viewport"]').content,cssVariable:getComputedStyle(document.body).getPropertyValue('--website-design-width'),items:[...document.querySelectorAll('h1,input,button')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,text:e.textContent,width:r.width,height:r.height,x:r.x,y:r.y,font:s.fontSize}})})));
      await page.screenshot({path:path.join(output,`${route.split('/')[1]}-${base===url?'current':'baseline'}.png`)});
    }
    assert.equal(snapshots[0].cssVariable,'');assert.match(snapshots[0].viewport,/width=device-width/);
    if(snapshots.length===2) assert.deepEqual(snapshots[0],snapshots[1],`${route}: native geometry differs from baseline`);
    console.log(`PASS ${route}: native mobile${snapshots.length===2?' baseline parity':''}`);
  }
  assert.deepEqual(errors,[],'browser runtime errors');
  if(reports.length) await fs.writeFile(path.join(output,'results.json'),JSON.stringify(reports,null,2));
  await page.close();
}
async function main() {
  await fs.mkdir(output,{recursive:true});
  const external=process.env.CANVAS_TEST_URL;let server,browser;const fixture=path.join(root,'app/canvas-validation');
  try {
    if(!external) {
      await fs.mkdir(fixture);await fs.copyFile(path.join(root,'tests/fixtures/website-canvas-page.tsx'),path.join(fixture,'page.tsx'));
      server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3030'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'canvas_validation',PGPASSWORD:'local-validation-only',PGDATABASE:'canvas_validation',BETTER_AUTH_SECRET:'canvas-local-validation-secret-not-for-production'},stdio:['ignore','pipe','pipe']});
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Next startup timed out')),90000);server.stdout.on('data',data=>{if(data.toString().includes('Ready')){clearTimeout(timer);resolve()}});server.stderr.on('data',data=>process.stderr.write(data));server.once('exit',code=>{clearTimeout(timer);reject(Error(`Next exited ${code}`))})});
    }
    await fs.mkdir(output,{recursive:true});
    browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});
    await check(browser,external||'http://127.0.0.1:3030');
  } finally {
    if(browser) await browser.close();
    if(server) {
      // Remove only the files this runner owns, before stopping Next's worker.
      for(const file of [path.join(fixture,'page.tsx'),path.join(root,'.next/types/app/canvas-validation/page.ts')]) {
        await fs.unlink(file).catch(error=>{if(error.code!=='ENOENT')throw error});
      }
      await fs.rmdir(fixture).catch(error=>{if(error.code!=='ENOENT')throw error});
      server.kill();
    }
  }
}
main().catch(error=>{console.error(error);process.exitCode=1});

