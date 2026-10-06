/* Render real account components against isolated fixture APIs. Never signs into production. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');
const puppeteer=require('puppeteer-core');
const chromium=require('@sparticuz/chromium');
const data=require('../tests/fixtures/account-dialog-data.json');
const root=path.resolve(__dirname,'..');
async function main(){
  const routes=['app/account-dialog-validation','app/owner-app/account-dialog-validation'];
  const output=path.join(root,'.next/account-dialog-validation');
  let server,browser;
  try {
    const source=await fs.readFile(path.join(root,'tests/fixtures/account-dialog-page.tsx'),'utf8');
    for(const route of routes){await fs.mkdir(path.join(root,route));await fs.writeFile(path.join(root,route,'page.tsx'),route.includes('owner-app')?source.replaceAll("'../../", "'../../../"):source);}
    server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3036'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'fixture',PGPASSWORD:'local-fixture-only',PGDATABASE:'fixture',BETTER_AUTH_SECRET:'local-account-dialog-fixture-secret'},stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Next startup timed out')),90000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(t);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));server.once('exit',code=>{clearTimeout(t);reject(Error('Next exited '+code));});});
    await fs.mkdir(output,{recursive:true});
    browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH || await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});
    const page=await browser.newPage(),errors=[],mutations=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request',r=>{
      const u=new URL(r.url());if(!u.pathname.startsWith('/api/'))return r.continue();
      // The native shell renews its session on mount. Stub that lifecycle call
      // separately; every business-data mutation must still fail this check.
      if(u.pathname==='/api/owner-app/session')return r.respond({status:200,contentType:'application/json',body:JSON.stringify({ok:true})});
      if(r.method()!=='GET')mutations.push({path:u.pathname,method:r.method()});
      const body=u.pathname.startsWith('/api/dealer-cost-proposals/')?{ok:true,action:'store',invoice:data.invoice}:{ok:true,asset:data.asset,assets:[data.asset],items:[],notifications:[],permissions:data.asset.permissions};
      return r.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
    });
    await page.evaluateOnNewDocument(()=>{
      // Match the canonical canvas test: CDP changes innerWidth but not outerWidth.
      Object.defineProperty(window,'outerWidth',{configurable:true,get:()=>innerWidth});
      localStorage.setItem('aim4price.website-canvas.v2.intro','seen');
    });
    async function clickText(text){await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===t||b.querySelector('strong')?.textContent===t),{},text);await page.evaluate(t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t||b.querySelector('strong')?.textContent===t).click(),text);}
    async function capture(name,closeSelector){
      await page.waitForSelector(closeSelector);
      await page.evaluate(()=>document.fonts.ready);
      const geometry=await page.$eval(closeSelector,button=>{
        const r=button.getBoundingClientRect(),s=getComputedStyle(button);
        const dialog=button.closest('[role="dialog"],[role="alertdialog"]');
        const surface=dialog?.matches('[data-website-overlay]')?dialog.firstElementChild:dialog;
        return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,vw:innerWidth,vh:innerHeight,radius:parseFloat(s.borderRadius),size:parseFloat(s.width),overflow:surface?surface.scrollWidth-surface.clientWidth:0};
      });
      await page.screenshot({path:path.join(output,name+'.png'),fullPage:false});
      assert.ok(geometry.x>=-1&&geometry.y>=-1&&geometry.right<=geometry.vw+1&&geometry.bottom<=geometry.vh+1,`${name}: close button reachable ${JSON.stringify(geometry)}`);
      assert.ok(geometry.radius<geometry.size/2,`${name}: owner-style square close button`);
      assert.ok(geometry.overflow<=2,`${name}: horizontal dialog overflow ${geometry.overflow}`);
    }
    await page.setViewport({width:1440,height:1000});
    async function visit(view){await page.goto('http://127.0.0.1:3036/account-dialog-validation?view='+view,{waitUntil:'networkidle0',timeout:120000});}
    await visit('download');
    await clickText('Specific asset');
    await clickText('Test asset');
    await clickText('Next');
    await page.click('[aria-label="Close download"]');
    assert.match(await page.$eval('h2',el=>el.textContent),/timeline/i,'Close returns from format to timeline');
    await clickText('Cancel');
    assert.ok(await page.$('input[aria-label="Search saved assets"]'),'Cancel returns to asset selection');
    await page.type('input[aria-label="Search saved assets"]','Test');
    await clickText('Test asset');
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('input[aria-label="Search saved assets"]',el=>el.value),'Test','Search draft survives Escape');
    await clickText('Cancel');
    await clickText('Cancel');
    assert.match(await page.$eval('body',el=>el.textContent),/Dialog closed/);
    console.log('PASS report Close, Cancel, Escape and retained selection');

    await visit('schedule');await clickText('Service');await clickText('Specific date');
    await page.waitForSelector('textarea');await page.type('textarea','Keep my service instructions');
    await page.click('[aria-label="Close maintenance form"]');
    await page.waitForSelector('[aria-label="Close maintenance trigger selection"]');
    await clickText('Specific date');
    assert.equal(await page.$eval('textarea',el=>el.value),'Keep my service instructions','Schedule draft survives Close');
    await clickText('Cancel');
    await page.waitForSelector('[aria-label="Close maintenance trigger selection"]');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>[...document.querySelectorAll('button strong')].some(el=>el.textContent==='Service'));
    console.log('PASS maintenance Close, Cancel, Escape and retained draft');

    await visit('leads');
    await clickText('Open');
    await clickText('Manage');
    await clickText('Reports');
    await page.waitForSelector('[aria-label="Close PDF reports"]');
    await page.click('[aria-label="Close PDF reports"]');
    await page.waitForSelector('[aria-label="Close lead management"]',{visible:true});
    await page.click('[aria-label="Close lead management"]');
    assert.equal(await page.$('[aria-label="Close lead management"]'),null);
    console.log('PASS Leads Reports returns to Manage, then Manage returns to card');
    assert.deepEqual(errors,[],'Browser runtime errors');
    assert.deepEqual(mutations,[],'Read-only fixture review must not submit mutations');
  } finally {
    if(browser)await browser.close();
    for(const route of routes){await fs.rm(path.join(root,route),{recursive:true,force:true});await fs.rm(path.join(root,'.next/types',route),{recursive:true,force:true});}
    if(server)server.kill();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
