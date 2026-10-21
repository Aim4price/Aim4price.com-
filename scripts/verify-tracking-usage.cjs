// Exercise the real usage panel against isolated API fixtures, never production data.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..');
(async()=>{
 const fixture=path.join(root,'app/owner-app/tracking-usage-validation');let server,browser;
 try{
  await fs.mkdir(fixture);
  await fs.writeFile(path.join(fixture,'page.tsx'),`'use client';\nimport AssetTrackingUsage from '../../../components/asset-register/AssetTrackingUsage';\nexport default function Page(){return <main style={{maxWidth:620,margin:'30px auto',padding:16}}><AssetTrackingUsage assetId="11111111-1111-4111-8111-111111111111"/></main>;}`);
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3041'],{cwd:root,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),90000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));server.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'));});});
  browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:[...chromium.args.filter(a=>!a.startsWith('--use-gl')&&!a.startsWith('--use-angle')&&a!=='--single-process'&&a!=='--in-process-gpu'),'--disable-gpu','--disable-software-rasterizer'],headless:true,pipe:true});
  const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
  let state={enabled:false,metric:'hours',reading:4250,estimated:false,baselineValue:null,baselineAt:null,lastTrackedAt:null};
  await page.setRequestInterception(true);page.on('request',r=>{
   if(r.url().includes('/tracking/usage')){if(r.method()==='POST'){const b=JSON.parse(r.postData());requests.push(b);state={...state,enabled:b.enabled,...b.action!=='pause'?{reading:b.reading,baselineValue:b.reading,baselineAt:new Date().toISOString(),estimated:false}:{}};}return r.respond({status:200,contentType:'application/json',body:JSON.stringify(state)});}
   if(r.url().includes('/api/'))return r.respond({status:200,contentType:'application/json',body:'{}'});return r.continue();
  });
  const click=async text=>assert.ok(await page.evaluate(text=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent===text);if(!button)return false;button.click();return true;},text),text);
  await page.setViewport({width:1000,height:850});await page.goto('http://127.0.0.1:3041/owner-app/tracking-usage-validation',{waitUntil:'networkidle0',timeout:120000});
  await page.waitForSelector('section input,section button');assert.equal(requests.length,0);
  await click('Set up automatic updates');assert.equal(await page.$eval('button[type=submit]',e=>e.disabled),true);
  await page.type('input[type=number]','4250');await click('Enable automatic updates');await page.waitForFunction(()=>document.body.textContent.includes('Pause updates'));assert.equal(requests[0].reading,4250);assert.equal(requests[0].enabled,true);
  await click('Pause updates');await page.waitForFunction(()=>document.body.textContent.includes('Set up automatic updates'));assert.equal(requests[1].action,'pause');
  state={...state,enabled:true,estimated:true,reading:4253.33,lastTrackedAt:new Date().toISOString()};
  await page.reload({waitUntil:'networkidle0'});assert.ok(await page.evaluate(()=>document.body.textContent.includes('Estimated from tracking')));
  const output=path.join(root,'.next/tracking-usage-validation');await fs.mkdir(output,{recursive:true});
  for(const width of [1000,360]){await page.setViewport({width,height:850});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No horizontal overflow');await page.screenshot({path:path.join(output,`usage-${width}.png`),fullPage:true});}
  await click('Confirm meter reading');await page.type('input[type=number]','4252');await page.click('button[type=submit]');await page.waitForFunction(()=>document.body.textContent.replace(/[\s,]/g,'').includes('4252'));assert.equal(requests.at(-1).action,'confirm');assert.equal(requests.at(-1).reading,4252);assert.deepEqual(errors,[]);
  console.log('PASS default-off, explicit baseline, enable, pause, correction, estimated label and mobile layout');
 }finally{if(browser)await browser.close();if(server){const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill();await Promise.race([stopped,new Promise(resolve=>setTimeout(resolve,3000))]);}await fs.rm(fixture,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types/app/owner-app/tracking-usage-validation'),{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
