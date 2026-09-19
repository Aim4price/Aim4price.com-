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
    // Cover the website card as well as native app modals. The three actions,
    // long asset title and recurring schedule reproduce the reported layout pressure.
    for (const [width,native] of [[1920,false],[1440,false],[1024,false],[768,false],[430,false],[768,true],[430,true]]) {
      await page.setViewport({width,height:1080});
      await page.goto('http://127.0.0.1:3036'+(native?'/owner-app':'')+'/account-dialog-validation?view='+(native?'tracker-app':'tracker'),{waitUntil:'networkidle0',timeout:120000});
      await page.waitForSelector('button[aria-label^="Manage 2023"]');
      await page.evaluate(()=>document.fonts.ready);
      const result=await page.evaluate(()=>{
        const card=document.querySelector('[class*="trackerExpandedCard"]');
        const header=card.querySelector('[class*="trackerExpandedHeader"]');
        const bounds=card.getBoundingClientRect();
        const targets=[header,...header.querySelectorAll('button,[class*="trackerStatusValue"]'),...card.querySelectorAll('[class*="assetDetailRow"]')];
        const clipped=targets.filter(el=>{const r=el.getBoundingClientRect();return r.left<bounds.left-2||r.right>bounds.right+2||el.scrollWidth>el.clientWidth+2;}).map(el=>el.textContent.trim());
        const cutValues=[...card.querySelectorAll('[class*="assetDetailRow"] > strong')].filter(el=>el.scrollHeight>el.clientHeight+2).map(el=>el.textContent);
        const actionRects=[...header.querySelectorAll('button')].map(el=>el.getBoundingClientRect());
        const overlaps=actionRects.some((r,i)=>actionRects.slice(i+1).some(s=>r.left<s.right&&r.right>s.left&&r.top<s.bottom&&r.bottom>s.top));
        card.scrollIntoView({block:'start'});
        return {clipped,cutValues,overlaps,actions:actionRects.length,compactActions:actionRects.every(r=>r.height<=96),viewportFits:bounds.left>=-2&&bounds.right<=innerWidth+2};
      });
      await page.screenshot({path:path.join(output,`tracking-card-${native?'app':'website'}-${width}.png`),fullPage:false});
      assert.equal(result.viewportFits,true,`Tracking card must fit viewport at ${width}`);
      assert.deepEqual(result.clipped,[],`Tracking card overflow at ${width}`);
      assert.deepEqual(result.cutValues,[],`Tracking detail values clipped at ${width}`);
      assert.equal(result.overlaps,false,`Tracking actions overlap at ${width}`);
      assert.equal(result.compactActions,true,`Tracking actions must remain compact at ${width}`);
      assert.equal(result.actions,3,'Service, History and Manage must all be tested');
      console.log(`PASS expanded ${native?'app':'website'} tracking card at ${width}px`);
    }
    // Regression for desktop Leads nested inside a narrower outer card.
    for (const width of [1920,1440,1024,768,430]) {
      await page.setViewport({width,height:1080});
      await page.goto('http://127.0.0.1:3036/account-dialog-validation?view=leads',{waitUntil:'networkidle0',timeout:120000});
      await clickText('Open');
      await page.waitForSelector('[class*="expandedLeadHeader"]');
      await page.evaluate(()=>document.fonts.ready);
      const result=await page.evaluate(()=>{
        const card=document.querySelector('[class*="leadAssetCard"]');
        const outer=card.closest('article').getBoundingClientRect();
        const bounds=card.getBoundingClientRect();
        const targets=[card.querySelector('[class*="expandedLeadHeader"]'),...card.querySelectorAll('[class*="leadValueBlock"], [class*="leadAssetHeaderActions"] > button, [class*="assetDetailRow"]')];
        const clipped=targets.filter(el=>{const r=el.getBoundingClientRect();return r.left<bounds.left-2||r.right>bounds.right+2||el.scrollWidth>el.clientWidth+2||el.scrollHeight>el.clientHeight+2;}).map(el=>el.textContent.trim());
        const buttons=[...card.querySelectorAll('[class*="leadAssetHeaderActions"] > button')];
        const rects=buttons.map(el=>el.getBoundingClientRect());
        const overlaps=rects.some((r,i)=>rects.slice(i+1).some(s=>r.left<s.right&&r.right>s.left&&r.top<s.bottom&&r.bottom>s.top));
        card.scrollIntoView({block:'start'});
        return {clipped,overlaps,actions:buttons.length,contained:bounds.left>=outer.left-2&&bounds.right<=outer.right+2};
      });
      await page.screenshot({path:path.join(output,`lead-card-website-${width}.png`),fullPage:false});
      assert.deepEqual(result.clipped,[],`Lead content clipped at ${width}`);
      assert.equal(result.overlaps,false,`Lead actions overlap at ${width}`);
      assert.equal(result.contained,true,`Lead card exceeds its outer card at ${width}`);
      assert.equal(result.actions,2,'Send and Manage must both fit');
      console.log(`PASS expanded desktop lead at ${width}px`);
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
