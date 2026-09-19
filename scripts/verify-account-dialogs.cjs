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
    browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});
    const page=await browser.newPage(),errors=[],mutations=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request',r=>{
      const u=new URL(r.url());if(!u.pathname.startsWith('/api/'))return r.continue();
      if(r.method()!=='GET')mutations.push({path:u.pathname,method:r.method()});
      const body=u.pathname.startsWith('/api/dealer-cost-proposals/')?{ok:true,action:'store',invoice:data.invoice}:{ok:true,asset:data.asset,assets:[data.asset],items:[],notifications:[],permissions:data.asset.permissions};
      return r.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
    });
    await page.evaluateOnNewDocument(()=>localStorage.setItem('aim4price.website-canvas.v2.intro','seen'));
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
    for(const [route,width,height] of [['/account-dialog-validation',1440,900],['/owner-app/account-dialog-validation',430,740],['/owner-app/account-dialog-validation',768,700]]){
      await page.setViewport({width,height});
      async function visit(view){await page.goto('http://127.0.0.1:3036'+route+'?view='+view,{waitUntil:'networkidle0',timeout:120000});}
      await visit('cost');await page.waitForFunction(()=>document.body.textContent.includes('Example maintenance supplier'));
      await capture(`cost-${width}`,'[role="dialog"] button[aria-label="Close dealer cost decision"]');
      await page.click('[role="dialog"] button[aria-label="Close dealer cost decision"]');await page.waitForFunction(()=>document.body.textContent.includes('Dialog closed'));
      await visit('correction');await clickText('Update serial number');await capture(`correction-${width}`,'[aria-label="Close correction form"]');
      await visit('schedule');await clickText('Service');await capture(`schedule-trigger-${width}`,'[aria-label="Close maintenance trigger selection"]');
      await clickText('Specific date');await capture(`schedule-form-${width}`,'[aria-label="Close maintenance form"]');
      await visit('tracker-app');await page.waitForSelector('button[aria-label^="Manage 2023"]');await page.click('button[aria-label^="Manage 2023"]');
      await capture(`tracker-manage-${width}`,'[aria-label="Close tracking management"]');
      await page.click('[aria-label="Close tracking management"]');
      await page.click('[aria-label="View maintenance history"]');
      await capture(`tracker-history-${width}`,'[aria-label="Close maintenance history"]');
      await visit('showroom');await clickText('Manage advert');
      await capture(`showroom-${width}`,'[aria-label="Close advert manager"]');
      console.log(`PASS real account dialogs at ${width}x${height}`);
    }
    assert.deepEqual(errors,[],'Browser runtime errors');
    assert.deepEqual(mutations,[],'Read-only fixture review must not submit mutations');
  } finally {
    if(browser)await browser.close();
    for(const route of routes){await fs.rm(path.join(root,route),{recursive:true,force:true});await fs.rm(path.join(root,'.next/types',route),{recursive:true,force:true});}
    if(server)server.kill();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
