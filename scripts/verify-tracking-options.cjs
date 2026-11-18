// Exercise the real tracking chooser and phone controls against isolated API fixtures.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/tracking-options-validation');
(async () => {
  let server, browser;
  try {
    await fs.mkdir(fixture);
    await fs.writeFile(path.join(fixture, 'page.tsx'), `'use client';
import {useEffect,useState} from 'react';
import AssetTrackingPanel from '../../components/asset-register/AssetTrackingPanel';
import AssetLocationEditor from '../../components/AssetLocationEditor';
import AssetAccessSettingsDialog from '../../components/asset-register/AssetAccessSettingsDialog';
export default function Page(){const [mounted,setMounted]=useState(false),[fixed,setFixed]=useState(false);useEffect(()=>setMounted(true),[]);if(!mounted)return null;
if(window.location.search==='?editor')return <AssetAccessSettingsDialog locationLayout title="Update location" assetTitle="Solar panels" onClose={()=>{}}><AssetLocationEditor showLocationSummary={false} location={{latitude:-34,longitude:22,locationText:null}} fixedLocation={fixed} modeAssetId="fixture" onModeChange={item=>setFixed(item.fixedLocation)} onTracking={()=>{}} onSave={async()=>{}}/></AssetAccessSettingsDialog>;
return <AssetAccessSettingsDialog locationLayout title="Asset tracking" assetTitle="Trailer & tank / #12 – 50%" onClose={()=>{}}><AssetTrackingPanel assetId="fixture" assetTitle="Trailer & tank / #12 – 50%"/></AssetAccessSettingsDialog>;}`);
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '3048'], {cwd:root, env:{...process.env, PGHOST:'127.0.0.1', PGPORT:'5432', PGUSER:'fixture', PGPASSWORD:'fixture-only', PGDATABASE:'fixture'}, stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject) => {const timer=setTimeout(()=>reject(Error('Startup timeout')),90000); server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));server.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'));});});
    browser = await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH || await require('@sparticuz/chromium').executablePath(), args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'], headless:true});
    const page=await browser.newPage(), errors=[], mutations=[];
    let device=null;
    const title='Trailer & tank / #12 – 50%';
    const message=`Hello Aim4price, my ${title} already has a tracker. Could you check whether it can connect to Aim4price? Please let me know what information you need.`;
    page.on('pageerror',e=>errors.push(e.message));
    await page.evaluateOnNewDocument(()=>{Object.defineProperty(window,'outerWidth',{configurable:true,get:()=>innerWidth});localStorage.setItem('aim4price.website-canvas.v2.intro','seen');});
    await page.setRequestInterception(true);
    page.on('request',r=>{
      const u=new URL(r.url());
      if(u.pathname==='/api/asset-register/fixture/tracking'){
        let body={device,assetTitle:title};
        if(r.method()==='PATCH'){
          const update=JSON.parse(r.postData());
          if(update.fixedLocation && device && device.id!==update.confirmedDeviceId)return r.respond({status:409,contentType:'application/json',body:JSON.stringify({confirmDeviceId:device.id})});
          device=null;body={item:{fixedLocation:update.fixedLocation,lastKnownLat:-34,lastKnownLng:22,lastKnownLocationText:''}};
        }
        if(r.method()==='POST'){mutations.push('POST');body={code:'ABCD-EF01-2345-6789',expiresInMinutes:15};}
        if(r.method()==='DELETE'){mutations.push('DELETE');device=null;body={ok:true};}
        return r.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
      }
      if(u.pathname.endsWith('/tracking/usage'))return r.respond({status:200,contentType:'application/json',body:JSON.stringify({metric:'km',enabled:false,reading:123000})});
      if(u.pathname.startsWith('/api/'))return r.respond({status:200,contentType:'application/json',body:'{}'});
      if(u.hostname!=='127.0.0.1')return r.abort();
      return r.continue();
    });
    async function click(text){await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===text||b.querySelector('strong')?.textContent===text),{},text);await page.$$eval('button',(buttons,text)=>buttons.find(b=>b.textContent.trim()===text||b.querySelector('strong')?.textContent===text).click(),text);}
    async function assertFits(name,viewports=[{width:1891,height:859},{width:1440,height:900},{width:1366,height:768},{width:390,height:844}]){
      for(const viewport of viewports) {
        await page.setViewport(viewport);await new Promise(r=>setTimeout(r,200));
        const overflow=await page.$eval('[role="dialog"]',e=>({horizontal:e.scrollWidth-e.clientWidth,vertical:Math.max(0,...[e,...e.querySelectorAll('div')].filter(n=>['auto','scroll'].includes(getComputedStyle(n).overflowY)).map(n=>n.scrollHeight-n.clientHeight))}));
        assert(overflow.horizontal<=2 && overflow.vertical<=2,name+' fits '+JSON.stringify({viewport,overflow}));
      }
      await page.setViewport({width:1440,height:900});
    }
    async function assertSingleLine(selector) {
      for (const width of [1920, 1366, 390]) {
        await page.setViewport({width, height: 860});
        await page.waitForSelector(selector);
        const wrapped = await page.$$eval(selector, elements => elements.flatMap(element => {
          const range = document.createRange();
          range.selectNodeContents(element.lastChild);
          return range.getClientRects().length === 1 ? [] : [element.textContent];
        }));
        assert.deepEqual(wrapped, [], 'Single-line copy at width ' + width);
      }
      await page.setViewport({width:1440,height:900});
    }
    const output=path.join(root,'.next/tracking-options-validation');await fs.mkdir(output,{recursive:true});
    await page.setViewport({width:1440,height:1000});
    await page.goto('http://127.0.0.1:3048/tracking-options-validation',{waitUntil:'networkidle0',timeout:120000});
    await page.waitForSelector('[data-tracking-options="choice"]');
    assert.equal(mutations.length,0,'Opening the chooser never starts pairing');
    await assertFits('tracking choice');await page.screenshot({path:path.join(output,'choices-desktop.png')});
    await click('Connect an existing tracker');
    await page.waitForSelector('[data-tracking-options="existing"]');
    const hrefs=await page.$$eval('[data-tracking-options] a',links=>links.map(a=>a.href));
    const whatsapp=new URL(hrefs[0]);assert.equal(whatsapp.origin,'https://wa.me');assert.equal(whatsapp.pathname,'/27625721650');assert.equal(whatsapp.searchParams.get('text'),message);
    const email=new URL(hrefs[1]);assert.equal(email.protocol,'mailto:');assert.equal(email.pathname,'aim4price@gmail.com');assert.equal(email.searchParams.get('body'),message);assert.equal(email.searchParams.get('subject'),`Tracker connection enquiry — ${title}`);assert.equal(hrefs[2],'tel:+27625721650');
    assert.equal(mutations.length,0,'Contact choices never mutate tracking');
    assert.equal(await page.$eval('[data-tracking-options] h4',h=>h===document.activeElement),true,'Screen transition moves focus to its heading');
    await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent.includes('WhatsApp')),true,'Contact buttons work with keyboard navigation');
    await assertFits('existing tracker');await page.screenshot({path:path.join(output,'existing-desktop.png')});
    await page.setViewport({width:390,height:844});assert(await page.$eval('[role="dialog"]',e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:path.join(output,'existing-mobile.png')});
    await page.setViewport({width:1440,height:1000});
    await click('Back');await click('Use a tracking phone');
    await page.waitForSelector('[aria-label="Tracking phone requirements"]');
    assert.equal(mutations.length,0,'Choosing a phone waits for an explicit pairing request');
    assert.equal(await page.$('[data-tracker-pairing]'), null);
    await assertFits('phone preparation');
    await page.screenshot({path:path.join(output,'phone-desktop.png')});
    await click('Next');await assertFits('phone installation');await page.screenshot({path:path.join(output,'install-desktop.png')});
    await click('Share app link');await page.waitForSelector('[data-tracker-install]');await page.click('[aria-label="Close Install Tracker"]');
    await click('Next');await assertFits('phone connection');
    await click('Create pairing code');await page.waitForSelector('[data-tracker-pairing]');assert.deepEqual(mutations,['POST']);
    await assertFits('pairing code');await page.screenshot({path:path.join(output,'pair-desktop.png')});await click('Back');await click('Back');await click('Back');await click('Use a tracking phone');await click('Next');await click('Next');assert(await page.$('[data-tracker-pairing]'),'Back navigation retains the pending pairing code');assert.deepEqual(mutations,['POST']);
    device={id:'paired-phone',name:'Equipment phone',status:'Connected',lastSeenAt:'2026-11-17T12:00:00Z',lastCapturedAt:'2026-11-17T11:59:00Z'};
    await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-tracker-connected]');assert.equal(await page.$('[data-tracking-options]'),null,'Connected phones open their controls directly');
    await page.waitForSelector('[data-tracker-connected] form, [data-tracker-connected] section h4');
    await assertFits('connected phone and automatic kilometres',[{width:1920,height:870},{width:1366,height:768}]);
    await page.screenshot({path:path.join(output,'connected-desktop.png')});
    await page.setViewport({width:1366,height:500});
    await click('Set up automatic updates');
    await page.waitForSelector('[data-tracking-usage-editor]');
    const meterEditor = await page.$eval('[data-tracking-usage-editor]', form => {
      let body = form.parentElement;
      while (body && getComputedStyle(body).overflowY !== 'auto') body = body.parentElement;
      if (!body) throw new Error('Missing scrollable dialog body');
      const scrollbar = getComputedStyle(body, '::-webkit-scrollbar');
      body.scrollTop = body.scrollHeight;
      return {
        scrolled: body.scrollTop > 0,
        visible: scrollbar.display !== 'none' && getComputedStyle(body).scrollbarWidth !== 'none',
        hasTrack: parseFloat(scrollbar.width) > 0,
        submitInView: form.querySelector('[type="submit"]').getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom + 1
      };
    });
    assert.deepEqual(meterEditor, {scrolled:true, visible:true, hasTrack:true, submitInView:true});
    await click('Cancel');
    await page.setViewport({width:1440,height:1000});
    await click('Tracking options');await assertSingleLine('[data-tracking-options="choice"] h4, [data-tracking-options="choice"] strong, [data-tracking-options="choice"] small');await click('View connected phone');await page.waitForSelector('[data-tracker-connected]');
    await click('Manage device');await click('Replace phone');await page.waitForSelector('[aria-label="Tracking phone requirements"]');assert.deepEqual(mutations,['POST'],'Replacement is not paired automatically');
    await click('Back');await click('Manage device');await click('Disconnect phone');await page.waitForSelector('[aria-label="Close Disconnect phone?"]');await assertSingleLine('[role="dialog"]:has([aria-label="Close Disconnect phone?"]) p');assert.deepEqual(mutations,['POST'],'Disconnect requires its confirmation');await click('Cancel');assert.deepEqual(mutations,['POST']);
    await click('Disconnect phone');await page.$$eval('button',buttons=>buttons.filter(b=>b.textContent.trim()==='Disconnect phone').at(-1).click());await page.waitForSelector('[data-tracking-options="choice"]');assert.deepEqual(mutations,['POST','DELETE']);
    await page.evaluate(()=>document.documentElement.dataset.appTheme='dark');await page.screenshot({path:path.join(output,'choices-dark.png')});
    device={id:'paired-phone'};
    await page.goto('http://127.0.0.1:3048/tracking-options-validation?editor',{waitUntil:'networkidle0'});
    const mode='button[role="switch"][aria-label="Fixed location"]';
    await page.waitForSelector(mode);
    assert.equal(await page.$('[data-location-view="choice"] a'),null);
    assert.equal((await page.$$('[data-location-action]')).length,4);
    await assertFits('map location editor',[{width:1920,height:870},{width:1366,height:768}]);
    await page.click(mode);await page.waitForSelector('[aria-label="Confirm stopping tracking"]');
    await click('Cancel');assert(await page.$('[data-location-action="tracking"]'));
    await page.click(mode);await click('Stop tracking and use fixed location');
    await page.waitForSelector(mode+'[aria-checked="true"]');
    assert.equal(await page.$('[data-location-action="tracking"]'),null);
    assert.equal((await page.$$('[data-location-action]')).length,3);
    await page.click(mode);await page.waitForSelector(mode+'[aria-checked="false"]');
    assert(await page.$('[data-location-action="tracking"]'));
    assert.deepEqual(errors,[]);console.log('PASS chooser, encoded contact messages, keyboard navigation, mobile overflow, phone requirements, app sharing, explicit pairing, connected controls, replacement and confirmed disconnect');
  } finally {
    if(browser)await browser.close();
    if(server&&server.exitCode===null){const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await stopped;}
    await fs.rm(fixture,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types/app/tracking-options-validation'),{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
