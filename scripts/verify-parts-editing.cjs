// Exercise the real parts modal against isolated fixture responses.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
(async () => {
  const fixture = path.join(root, 'app/owner-app/parts-editing-validation');
  let server, browser;
  try {
    await fs.mkdir(fixture);
    await fs.writeFile(path.join(fixture, 'page.tsx'), `'use client';
import AssetPartsModal from '../../../components/AssetPartsModal';
export default function Page() { return <AssetPartsModal endpoint="/api/parts-fixture" assetTitle="2024 Landini Super 110 + Front Loader" assetSubtitle="Year Model: 2024 · Usage: 20 741 hours · Condition: Good" onClose={() => {}}/>; }`);
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '3036'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => { const timer=setTimeout(()=>reject(Error('Next startup timeout')),90000); server.stdout.on('data',d=>{if(d.toString().includes('Ready')) {clearTimeout(timer);resolve();}}); server.stderr.on('data',d=>process.stderr.write(d)); server.once('exit',()=>{clearTimeout(timer);reject(Error('Next exited'));}); });
    browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width:1280, height:1000 });
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    let parts=[{id:'part-1',itemKey:'oil_filter',itemLabel:'Oil filter',name:'Oil filter',partNumber:'001-ABC',brand:'Landini',notes:'',addedBy:'Owner',createdAt:'2026-10-10T12:00:00Z',maintenanceId:null,revision:0,canEdit:true}];
    let suggestions=[{id:'oil_filter',label:'Oil filter'},{id:'fuel_filter',label:'Fuel filter'}], actions=[], failEdit=true;
    await page.setRequestInterception(true);
    page.on('request',r=>{
      if(!r.url().includes('/api/'))return r.continue();
      let body={},status=200;
      if(r.url().includes('/api/parts-fixture')) {
        if(r.method()==='POST') {
          const d=JSON.parse(r.postData()); actions.push(d);
          if(d.action==='edit'&&failEdit){status=409;body={error:'This part has changed. Reopen it before saving.'};failEdit=false;}
          else if(d.action==='edit') parts=parts.map(p=>p.id===d.partId?{...p,...d,revision:p.revision+1}:p);
          else if(d.action==='delete') parts=parts.filter(p=>p.id!==d.partId);
          else if(d.action==='renameChoice') suggestions=suggestions.map(i=>i.id===d.itemKey?{...i,label:d.name}:i);
          else if(d.action==='deleteChoice') suggestions=suggestions.filter(i=>i.id!==d.itemKey);
        } else body={parts,suggestions,family:'Tractors',canView:true,canAdd:true,canManageChoices:true,maintenance:[]};
      }
      return r.respond({status,contentType:'application/json',body:JSON.stringify(body)});
    });
    const click=async text=>assert.ok(await page.evaluate(t=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t);if(!b||b.disabled)return false;b.click();return true;},text),text);
    const setName=async value=>{await page.waitForSelector('form input');await page.$eval('form input',(e,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));},value);};
    await page.goto('http://127.0.0.1:3036/owner-app/parts-editing-validation',{waitUntil:'networkidle0',timeout:120000});
    await click('Oil filter');await setName('Primary oil filter');await click('Save changes');await page.waitForSelector('[role=alert]');assert.equal(parts[0].name,'Oil filter');
    await click('Cancel');await click('Oil filter');await setName('Primary oil filter');await click('Save changes');await page.waitForFunction(()=>document.body.innerText.includes('Part updated.'));assert.equal(parts[0].name,'Primary oil filter');assert.equal(parts[0].partNumber,'001-ABC');
    await page.click('button[aria-label="Delete Primary oil filter"]');await click('Cancel');assert.equal(parts.length,1);
    await page.click('button[aria-label="Delete Primary oil filter"]');await click('Delete');await page.waitForFunction(()=>document.body.innerText.includes('No parts yet.'));assert.equal(parts.length,0);
    await click('+ Add part');await page.click('button[aria-label="Edit Oil filter"]');await setName('Engine filter');await click('Save changes');await page.waitForSelector('button[aria-label="Edit Engine filter"]');
    await page.setViewport({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile overflow');
    const output=path.join(root,'.next/maintenance-validation');await fs.mkdir(output,{recursive:true});await page.screenshot({path:path.join(output,'parts-edit-choices-mobile.png')});
    await page.click('button[aria-label="Delete Engine filter"]');await click('Delete');await page.waitForFunction(()=>!document.body.innerText.includes('Engine filter'));assert.deepEqual(suggestions.map(i=>i.id),['fuel_filter']);
    await click('Cancel');await click('+ Add part');assert.equal(await page.$('button[aria-label="Edit Engine filter"]'),null);
    assert.deepEqual(errors,[]);console.log('PASS saved-part edits, stale conflict, confirmed deletion, per-asset choices and mobile layout');
  } finally {
    if(browser)await browser.close(); if(server)server.kill();
    await fs.rm(fixture,{recursive:true,force:true});
    await fs.rm(path.join(root,'.next/types/app/owner-app/parts-editing-validation'),{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
