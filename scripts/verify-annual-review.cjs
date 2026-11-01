/* Isolated browser fixture; never loads or modifies a production account. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
async function main() {
  let server, browser;
  const route = path.join(root, 'app/admin/annual-review-validation');
  const output = path.join(root, '.next/annual-review-validation');
  try {
    await fs.mkdir(route);
    await fs.writeFile(path.join(route, 'page.tsx'), `import AnnualReviewClient from '../annual-review/annual-review-client';\nexport const viewport={width:'device-width',initialScale:1};\nexport default function Page(){return <main className="adminWorkspaceRoot" style={{padding:16}}><AnnualReviewClient /></main>}`);
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '3037'], { cwd: root, env: { ...process.env, PGHOST:'127.0.0.1', PGPORT:'5432', PGUSER:'fixture', PGPASSWORD:'fixture-only', PGDATABASE:'fixture', BETTER_AUTH_SECRET:'annual-review-local-fixture-secret' }, stdio:['ignore','pipe','pipe'] });
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Next startup timeout')),90000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));server.once('exit',code=>{clearTimeout(timer);reject(Error('Next exited '+code));});});
    await fs.mkdir(output,{recursive:true});
    browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless:true, pipe:true });
    const page = await browser.newPage(), errors=[], requests=[];
    page.on('pageerror',e=>errors.push(e.message));
    let failOnce=true;
    const assets=[{id:'one',revision:'v1',title:'2023 Toyota Hilux',currentValue:500000,replacementPrice:800000,eligible:true,reason:null,saleability:true,extrasNote:'Asset alone. Saved extras are retained separately, once.'}, {id:'two',revision:'v1',title:'2022 John Deere 6135B',currentValue:900000,replacementPrice:1500000,eligible:true,reason:null,saleability:false,extrasNote:'Asset replacement price only.'}, {id:'manual',revision:'v1',title:'Manual asset',currentValue:50000,replacementPrice:null,eligible:false,reason:'Manual valuation — kept unchanged.',saleability:false,extrasNote:''}];
    await page.setRequestInterception(true);
    page.on('request',async r=>{
      const u=new URL(r.url()); if(!u.pathname.startsWith('/api/'))return r.continue();
      if(u.pathname!='/api/admin/annual-review')return r.respond({status:200,contentType:'application/json',body:JSON.stringify({notifications:[]})});
      let response;
      if(r.method()==='GET'){
        // Force the reload race: the previous welcome remains in a closed dialog
        // while the large-register request is pending.
        if(assets.length>3)await new Promise(resolve=>setTimeout(resolve,250));
        response={previewOnly:true,owner:{email:u.searchParams.get('email'),name:'Test Owner'},year:Number(u.searchParams.get('year')),assets};
      }
      else {
        const body=JSON.parse(r.postData()); requests.push(body); assert.equal(body.action,'preview');
        const asset=assets.find(a=>a.id===body.assetId);
        const failed=body.assetId==='two'&&failOnce; if(failed)failOnce=false;
        response={previewOnly:true,result:{id:asset.id,currentValue:asset.currentValue,proposedValue:failed?null:Math.round((body.replacementPrice??asset.replacementPrice)*.55),replacementPrice:body.replacementPrice??asset.replacementPrice,error:failed?'Temporary fixture failure':null}};
      }
      return r.respond({status:200,contentType:'application/json',body:JSON.stringify(response)});
    });
    await page.evaluateOnNewDocument(()=>{Object.defineProperty(window,'outerWidth',{configurable:true,get:()=>innerWidth});localStorage.setItem('aim4price.website-canvas.v2.intro','seen');});
    async function click(text){
      // Closed native dialogs retain their controls in the DOM. Only interact
      // with visible controls in the active dialog (or the unobstructed page).
      const handle=await page.waitForFunction(t=>{
        const scope=document.querySelector('dialog[open]')||document;
        return [...scope.querySelectorAll('button')].find(b=>
          (b.getAttribute('aria-label')===t||b.textContent.trim()===t||b.querySelector('strong')?.textContent===t)
          &&!b.disabled&&b.getClientRects().length>0&&getComputedStyle(b).visibility==='visible');
      },{},text);
      try { await handle.asElement().click(); } finally { await handle.dispose(); }
    }
    async function fill(selector,value){await page.$eval(selector,(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);}
    async function capture(name){await page.evaluate(()=>document.fonts.ready);const geometry=await page.$eval('dialog',d=>{const r=d.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,dialogWidth:r.width,overflow:d.scrollWidth-d.clientWidth,bodyOverflow:document.documentElement.scrollWidth-innerWidth};});assert.ok(geometry.left>=0&&geometry.right<=geometry.width+1&&geometry.top>=0&&geometry.bottom<=geometry.height+1,JSON.stringify(geometry));assert.ok(geometry.overflow<2,JSON.stringify(geometry));assert.ok(geometry.dialogWidth>=Math.min(900,geometry.width-60),JSON.stringify(geometry));await page.screenshot({path:path.join(output,name+'.png')});}
    for(const [width,height] of [[1440,900],[430,740],[768,700]]){
      requests.length=0;failOnce=true;
      await page.setViewport({width,height});
      await page.goto('http://127.0.0.1:3037/admin/annual-review-validation',{waitUntil:'networkidle0',timeout:120000});
      await click('Open review');await page.waitForSelector('dialog[open]');
      assert.equal(await page.$eval('#review-title',el=>el.textContent),'Happy new year, 2027!');
      assert.equal(await page.$eval('#review-title',el=>el.closest('[class*=yearPanel]')!==null),true,'welcome title belongs inside green panel');
      assert.equal(await page.$$eval('dialog input',els=>els.length),0,'welcome must have no asset picker');
      await capture('welcome-'+width);
      await click('Continue');await capture('choice-'+width);
      await click('No, keep unchanged');
      assert.equal(requests.length,0,'Keep unchanged must not recalculate');
      assert.deepEqual(await page.$$eval('dialog dd',els=>els.map(e=>e.textContent.replace(/\D/g,''))),['2300000','2300000','1400000','1400000']);
      assert.equal(await page.$$eval('dialog p',els=>els.filter(e=>e.textContent==='No change').length),2);
      await capture('unchanged-results-'+width);
      await click('Next');await click('Confirm review');
      assert.ok(await page.$eval('dialog',el=>el.textContent.includes('Your prices remain unchanged.')));
      assert.equal(requests.length,0,'Unchanged confirmation must not call the API');
      assert.equal(await page.$eval('dialog',el=>/preview/i.test(el.textContent)),false,'No preview wording in flow');
      await click('Done');await click('Open review');await page.waitForSelector('dialog[open]');
      await click('Continue');await click('Yes, update prices');
      assert.equal(await page.$eval('#annual-percent',el=>el.value),'3');
      assert.equal(await page.$$eval('dialog input[type=number]',els=>els.length),0,'no individual inputs');
      await capture('percentage-'+width);await click('Review results');
      await page.waitForFunction(()=>document.querySelector('dialog').textContent.includes('1 calculation needs another look'));
      assert.equal(requests.length,2);assert.equal(requests[0].replacementPrice,824000);assert.equal(requests[1].replacementPrice,1545000);
      assert.ok(await page.$$eval('dialog button',els=>els.find(b=>b.textContent==='Next').disabled),'partial totals cannot be confirmed');
      await capture('partial-results-'+width);
      const count=requests.filter(r=>r.assetId==='one').length;
      await click('Retry calculations');await page.waitForFunction(()=>document.querySelector('dialog').textContent.includes('2 of 2 assets calculated'));
      assert.equal(requests.filter(r=>r.assetId==='one').length,count,'successful previews are not repeated');
      assert.deepEqual(await page.$$eval('dialog dd',els=>els.map(e=>e.textContent.replace(/\D/g,''))),['2300000','2369000','1400000','1302950']);
      await capture('results-'+width);
      await page.keyboard.press('Escape');await page.waitForSelector('dialog:not([open])');const before=requests.length;
      await click('Resume review');assert.equal(requests.length,before,'resume must not calculate');
      await click('Next');assert.equal(await page.$eval('#review-title',el=>el.textContent),'Are you sure?');
      await capture('confirmation-'+width);await click('Back');await click('Back');
      await fill('#annual-percent','0');await click('Review results');await page.waitForFunction(()=>document.querySelector('dialog').textContent.includes('2 of 2 assets calculated'));
      assert.equal(requests.at(-2).replacementPrice,800000);assert.equal(requests.at(-1).replacementPrice,1500000);
      await click('Back');await fill('#annual-percent','-5');await click('Review results');await page.waitForFunction(()=>document.querySelector('dialog').textContent.includes('2 of 2 assets calculated'));
      assert.equal(requests.at(-2).replacementPrice,760000);assert.equal(requests.at(-1).replacementPrice,1425000);
      await click('Next');const beforeConfirm=requests.length;
      await click('Confirm review');assert.equal(requests.length,beforeConfirm,'confirmation never calls a write or calculation API');
      assert.equal(await page.$eval('#review-title',el=>el.textContent),'Review complete');await capture('complete-'+width);await click('Done');
      await fill('input[type=number]','2028');await click('Open review');await page.waitForFunction(()=>document.querySelector('#review-title').textContent==='Happy new year, 2028!');
      assert.equal(requests.length,beforeConfirm,'new year does not calculate automatically');await click('Close');
      console.log('PASS annual percentage review at '+width+'px: decline, slider, totals, retry, close/resume, confirmation, next year');
    }
    // A large register gets the same aggregate flow, with every eligible asset included.
    for(let i=0;i<18;i++)assets.push({...assets[0],id:'extra-'+i,title:'Review asset '+i});
    requests.length=0;
    await page.setViewport({width:1440,height:900});await click('Open review');
    await page.waitForSelector('dialog[open]');await click('Continue');
    await page.waitForFunction(()=>document.querySelector('dialog[open]').textContent.includes('all 20 eligible assets'));
    await click('Yes, update prices');
    await click('Review results');await page.waitForFunction(()=>document.querySelector('dialog').textContent.includes('20 of 20 assets calculated'));
    assert.equal(requests.length,20);assert.equal(new Set(requests.map(r=>r.assetId)).size,20);assert.ok(!requests.some(r=>r.assetId==='manual'));
    await capture('results-large-register');await click('Close');
    console.log('PASS delayed large-register reload: visible controls, all 20 eligible assets calculated');
    assert.deepEqual(errors,[]);
  } finally { if(browser)await browser.close(); await fs.rm(route,{recursive:true,force:true}); if(server){const exit=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await exit;} }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
