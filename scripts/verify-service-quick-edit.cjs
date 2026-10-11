// Real service modal, isolated APIs: record-only edits, parts, chooser contrast and mobile layout.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
(async () => {
  const fixture = path.join(root, 'app/owner-app/service-edit-validation');
  let server, browser;
  try {
    await fs.mkdir(fixture);
    await fs.writeFile(path.join(fixture, 'page.tsx'), `'use client';
import { useState } from 'react';
import DesktopServiceModal from '../../../components/DesktopServiceModal';
import MaintenanceEntryChoice from '../../../components/MaintenanceEntryChoice';
export default function Page(){const [step,setStep]=useState('timing'),[result,setResult]=useState<unknown>(null),[type,setType]=useState<'service'|'checkup'>('service'); return <><div>Asset workspace</div>{step==='timing'?<MaintenanceEntryChoice step="timing" assetTitle="2023 Toyota Hilux" onClose={()=>{}} onDone={()=>setStep('type')} />:step==='type'?<MaintenanceEntryChoice step="type" timing="done" assetTitle="2023 Toyota Hilux" onClose={()=>{}} onType={value=>{setType(value);setStep('record')}} />:<DesktopServiceModal standalone partsEndpoint="/api/parts-fixture" record={{id:'fixture',assetTitle:'2023 Toyota Hilux',assetKind:'vehicle',maintenanceType:type,title:'Service',currentUsage:null,usageMetric:'km'}} onClose={()=>{}} onSubmit={setResult}/>}<pre id="result">{JSON.stringify(result)}</pre></>}`);
    server = spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3038'],{cwd:root,stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),90000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));server.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'));});});
    browser = await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH || await chromium.executablePath(),args:process.env.CANVAS_BROWSER_PATH?['--no-sandbox','--disable-dev-shm-usage']:chromium.args,headless:true,pipe:true});
    const page=await browser.newPage(), errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request',r=> r.url().includes('/api/')?r.respond({status:200,contentType:'application/json',body:JSON.stringify(r.url().includes('parts-fixture')?{parts:[{id:'saved',name:'Oil filter',partNumber:'OF-42',brand:'Toyota'}]}:{items:[]})}):r.continue());
    const click=async text=>assert.ok(await page.evaluate(text=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===text||e.querySelector('strong')?.textContent===text);if(!b||b.disabled)return false;b.click();return true;},text),text);
    const fill=async (selector,value)=>{await page.$eval(selector,(e,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));},value);};
    for(const [width,type] of [[1280,'Service'],[390,'Checkup']]){
      await page.setViewport({width,height:900}); await page.goto('http://127.0.0.1:3038/owner-app/service-edit-validation',{waitUntil:'networkidle0',timeout:120000});
      for(const choice of ['Already done',type]){
        await page.waitForFunction(() => document.querySelector('[role=dialog] h2')?.textContent.includes('?'));
        const backdrop=await page.$eval('[role=dialog]',e=>({background:getComputedStyle(e).backgroundColor,blur:getComputedStyle(e).backdropFilter}));
        assert.equal(backdrop.background,'rgba(8, 25, 23, 0.64)');assert.equal(backdrop.blur,'blur(9px)');await click(choice);
      }
      await page.waitForSelector('button[data-action=edit]');
      const original=await page.$eval('button[data-action=edit]',e=>e.getAttribute('aria-label').slice(5));
      await page.click('button[data-action=edit]');await fill('input[aria-label="Work item name"]','Renamed work');await click('Save');
      await page.waitForSelector('button[aria-label="Edit Renamed work"]');
      await page.click('button[aria-label="Add parts to Renamed work"]');await page.select('select[aria-label="Choose saved part"]','saved');
      await fill('input[aria-label="Part name"]','Gasket');await fill('input[aria-label="Part number"]','G-123');await fill('input[aria-label="Part brand"]','OEM');await click('Add part');
      await page.click('button[aria-label="Delete Oil filter from this work"]');await page.select('select[aria-label="Choose saved part"]','saved');
      await click('Done');
      await fill('input[maxlength="160"]','Manual job');await click('+ Add item');
      await click('Select all');await click('Deselect all');
      assert.equal(await page.$$eval('button[aria-pressed="true"]',elements=>elements.length),0);
      await click('Renamed work');await click('Manual job');
      await page.click('button[aria-label="Edit Manual job"]');await fill('input[aria-label="Work item name"]','Manual job edited');await click('Save');
      assert.equal(await page.$('button[aria-label="Edit '+original+'"]'),null);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No horizontal overflow');
      const output=path.join(root,'.next/maintenance-validation');await fs.mkdir(output,{recursive:true});await page.screenshot({path:path.join(output,`service-quick-edit-${width}.png`)});
      await click('Next');await click('Back');assert.ok(await page.$('button[aria-label="Edit Renamed work"]'));
      await click('Next');await click('Next');
      if(type==='Service'){await page.click('input[type=checkbox]');await page.type('input[placeholder="Mechanic / technician name"]','Tester').catch(async()=>{await page.$eval('input[type=text]',e=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Tester');e.dispatchEvent(new Event('input',{bubbles:true}));});});}
      else await page.type('input[placeholder="Name of person who checked the asset"]','Tester');
      await click('Save to history');await page.waitForFunction(()=>document.querySelector('#result').textContent!=='null');
      const result=JSON.parse(await page.$eval('#result',e=>e.textContent));const item=result.maintenanceWork.flatMap(w=>w.items).find(i=>i.label==='Renamed work');
      assert.ok(result.maintenanceWork.flatMap(w=>w.items).some(i=>i.label==='Manual job edited'));assert.ok(item);assert.deepEqual(item.parts,[{name:'Gasket',partNumber:'G-123',brand:'OEM'},{name:'Oil filter',partNumber:'OF-42',brand:'Toyota'}]);assert.match(result.completedNotes,/Renamed work/);assert.match(result.completedNotes,/G-123/);assert.match(result.completedNotes,/OF-42/);
    }
    assert.deepEqual(errors,[]);console.log('PASS chooser backdrop, quick edits, saved/manual parts, removal, service/checkup submission and mobile layout');
  }finally{if(browser)await browser.close();if(server){const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill();await stopped;}await fs.rm(fixture,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types/app/owner-app/service-edit-validation'),{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
