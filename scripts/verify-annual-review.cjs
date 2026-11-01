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
      if(r.method()==='GET')response={previewOnly:true,owner:{email:u.searchParams.get('email'),name:'Test Owner'},year:Number(u.searchParams.get('year')),assets};
      else {
        const body=JSON.parse(r.postData()); requests.push(body); assert.equal(body.action,'preview');
        const asset=assets.find(a=>a.id===body.assetId);
        const failed=body.assetId==='two'&&failOnce; if(failed)failOnce=false;
        response={previewOnly:true,result:{id:asset.id,currentValue:asset.currentValue,proposedValue:failed?null:Math.round((body.replacementPrice??asset.replacementPrice)*.55),replacementPrice:body.replacementPrice??asset.replacementPrice,error:failed?'Temporary fixture failure':null}};
      }
      return r.respond({status:200,contentType:'application/json',body:JSON.stringify(response)});
    });
    await page.evaluateOnNewDocument(()=>{Object.defineProperty(window,'outerWidth',{configurable:true,get:()=>innerWidth});localStorage.setItem('aim4price.website-canvas.v2.intro','seen');});
    async function click(text){await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')===t||b.textContent.trim()===t)&&!b.disabled),{},text);await page.evaluate(t=>[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')===t||b.textContent.trim()===t)&&!b.disabled).click(),text);}
    async function fill(selector,value){await page.$eval(selector,(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);}
    async function capture(name){await page.evaluate(()=>document.fonts.ready);const geometry=await page.$eval('dialog',d=>{const r=d.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,dialogWidth:r.width,overflow:d.scrollWidth-d.clientWidth,bodyOverflow:document.documentElement.scrollWidth-innerWidth};});assert.ok(geometry.left>=0&&geometry.right<=geometry.width+1&&geometry.top>=0&&geometry.bottom<=geometry.height+1,JSON.stringify(geometry));assert.ok(geometry.overflow<2,JSON.stringify(geometry));assert.ok(geometry.dialogWidth>=Math.min(900,geometry.width-60),JSON.stringify(geometry));await page.screenshot({path:path.join(output,name+'.png')});}
    for(const [width,height] of [[1440,900],[430,740],[768,700]]){
      requests.length=0;failOnce=true;
      await page.setViewport({width,height});
      await page.goto('http://127.0.0.1:3037/admin/annual-review-validation',{waitUntil:'networkidle0',timeout:120000});
      await click('Open preview');await page.waitForSelector('dialog[open]');
      assert.equal(await page.$eval('dialog input:disabled',el=>el.checked),false);
      await capture('welcome-'+width);
      await click('Select assets');await page.click('dialog input[type=checkbox]');await click('Next');await click('Calculate preview');await page.waitForFunction(()=>document.querySelector('dialog').textContent.includes('R')&&!document.querySelector('dialog').textContent.includes('Calculating'));
      assert.equal(requests.length,1);assert.equal(requests[0].assetId,'one');
      await click('Back');await click('All eligible assets (2)');await click('Next');await click('Calculate preview');
      await page.waitForFunction(()=>document.querySelector('dialog').textContent.includes('Temporary fixture failure'));
      const count=requests.filter(r=>r.assetId==='one').length;
      await click('Calculate missing / retry failed');await page.waitForFunction(()=>!document.querySelector('dialog').textContent.includes('Temporary fixture failure')&&!document.querySelector('dialog').textContent.includes('Calculating'));
      assert.equal(requests.filter(r=>r.assetId==='one').length,count,'retry must not repeat successful calculations');
      await capture('depreciation-'+width);
      await click('Include in preview');await click('Adjust by percentage');await fill('dialog input[type=number]','5');await click('Preview replacement changes / retry failed');
      await page.waitForFunction(()=>document.querySelector('dialog').textContent.includes('Replacement:')&&!document.querySelector('dialog').textContent.includes('Calculating'));
      assert.equal(requests.at(-2).replacementPrice,840000);assert.equal(requests.at(-1).replacementPrice,1575000);
      await click('Edit specific assets');await click('Incl. VAT (15%)');
      const fields=await page.$$('dialog input[type=number]');
      for(let i=0;i<fields.length;i++){await fields[i].evaluate((el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));},String(i?1725000:920000));}
      await click('Preview replacement changes / retry failed');await page.waitForFunction(()=>document.querySelector('dialog').textContent.includes('Replacement:')&&!document.querySelector('dialog').textContent.includes('Calculating'));
      assert.equal(requests.at(-2).replacementPrice,800000);assert.equal(requests.at(-1).replacementPrice,1500000);
      await capture('replacement-'+width);await page.keyboard.press('Escape');await page.waitForSelector('dialog:not([open])');const before=requests.length;
      await click('Resume preview');await page.waitForSelector('dialog[open]');assert.equal(await page.$eval('#review-title',el=>el.textContent),'Replacement prices');assert.equal(requests.length,before);
      await click('Review summary');await capture('summary-'+width);assert.ok(await page.$eval('dialog',el=>el.textContent.includes('0 assets saved')));await click('Close');
      await fill('input[type=number]','2028');await click('Open preview');await page.waitForFunction(()=>document.querySelector('#review-title').textContent==='Welcome to 2028');assert.equal(requests.length,before,'opening next year must not calculate or save');await click('Close');
      console.log('PASS annual review at '+width+'px: selection, retry, VAT, replacement, close/resume, next year');
    }
    // A real owner can have dozens of assets: paging/search must preserve selection.
    for(let i=0;i<18;i++)assets.push({...assets[0],id:'extra-'+i,title:'Review asset '+String(i).padStart(2,'0')});
    await page.setViewport({width:1440,height:900});
    await click('Open preview');await page.waitForSelector('dialog[open]');
    assert.equal(await page.$$eval('dialog input[type=checkbox]:not(:disabled)',els=>els.length),6);
    await click('Next assets');await page.waitForFunction(()=>document.querySelector('dialog').textContent.includes('Review asset 04'));
    await fill('dialog input[type=search]','Review asset 17');
    assert.equal(await page.$$eval('dialog input[type=checkbox]:not(:disabled)',els=>els.length),1);
    await page.click('dialog input[type=checkbox]:not(:disabled)');
    await fill('dialog input[type=search]','');
    await capture('welcome-large-register');
    await click('Next');await click('Calculate preview');
    await page.waitForFunction(()=>document.querySelector('dialog').textContent.includes('19 of 19 calculated'));
    assert.ok(!requests.some(r=>r.assetId==='extra-17'),'search deselection must persist across pages');
    await capture('depreciation-large-register');await click('Close');
    assert.deepEqual(errors,[]);
  } finally { if(browser)await browser.close(); await fs.rm(route,{recursive:true,force:true}); if(server){const exit=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await exit;} }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
