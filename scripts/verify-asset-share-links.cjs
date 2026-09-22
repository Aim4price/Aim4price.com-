/* Local fixtures only: no production data, emails, or public links are created. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.next/asset-share-validation');
const asset = { assetId:'10000000-0000-4000-8000-000000000001',title:'2022 New Holland TT4.90',serialNumber:'NH-2022-1048',yearModel:2022,usage:'1 276 hours',condition:'Good',replacementPriceExVat:500000,valueExVat:327133,photoUrls:[],publicUrl:null };
async function main() {
  const fixture = path.join(root, 'app/asset-share/validation');
  const profileFixture = path.join(root, 'app/business-network/profile-validation');
  let server, browser;
  try {
    await fs.mkdir(fixture,{recursive:true});
    await fs.writeFile(path.join(fixture, 'page.tsx'), `'use client';
import {useState} from 'react';
import AssetExternalShare from '../../../components/asset-register/AssetExternalShare';
import SharedAssetCards from '../../../components/asset-register/SharedAssetCards';
const asset=${JSON.stringify(asset)};
export default function Validation(){const [preview,setPreview]=useState(false);return preview?<SharedAssetCards share={{assets:[asset],createdAt:'2026-09-22T09:00:00Z'}}/>:<main style={{maxWidth:1000,margin:'auto',padding:24}}><button onClick={()=>setPreview(true)}>Show test snapshot</button><AssetExternalShare shareName="Tractor" assets={[asset]} onAddAim4priceReport={()=>{}} onRemoveAim4priceReport={()=>{}}/></main>}
`);
    await fs.mkdir(profileFixture,{recursive:true});
    await fs.writeFile(path.join(profileFixture,'page.tsx'), `'use client';
import BusinessProfileCard from '../../../components/business-network/BusinessProfileCard';
export default function ProfileValidation(){return <div style={{width:360,height:800}}><BusinessProfileCard business={{userId:'fixture',businessName:'Fixture workshop',displayName:'Fixture workshop',isExternalBusiness:false,googlePlaceId:'fixture-place',logoUrl:'',extraPhotoUrls:[],description:'Confirmed business description',services:'Repairs',addressLine1:'',townCity:'George',province:'Western Cape',email:'',phone:'044 874 2585',websiteUrl:''}} onClose={()=>{}} onMessage={()=>{}}/></div>}
`);
    server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3031'],{cwd:root,env:{...process.env,NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:'local-fixture-key',PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'validation',PGPASSWORD:'local-validation-only',PGDATABASE:'validation',BETTER_AUTH_SECRET:'local-validation-secret-not-for-production'},stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timed out')),60000);server.stdout.on('data',data=>{if(data.toString().includes('Ready')){clearTimeout(timer);resolve()}});server.stderr.on('data',data=>process.stderr.write(data));});
    browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH || '/tmp/chromium',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true,pipe:true});
    const page=await browser.newPage(); const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',msg=>{if(msg.type()==='error')console.error(msg.text())});
    let saved=null, creates=0, deletes=0;
    await page.setRequestInterception(true);
    page.on('request',req=>{
      const target=new URL(req.url()); const pathname=target.pathname;
      if(target.hostname==='maps.googleapis.com') return req.respond({status:200,contentType:'application/javascript',body:`window.google={maps:{importLibrary:async()=>({Place:class{async fetchFields(){Object.assign(this,{displayName:'Google workshop name',formattedAddress:'George, South Africa',rating:4.8,userRatingCount:42,regularOpeningHours:{weekdayDescriptions:['Monday: 08:00–17:00']},attributions:[{provider:'Fixture provider',providerURI:'https://example.com'}]})}}})}};window.${target.searchParams.get('callback')}();`});
      if(pathname==='/api/asset-share-links') {
        if(req.method()==='POST'){creates++;saved={token:'a'.repeat(43),created_at:'2026-09-22T09:00:00Z'};assert.deepEqual(JSON.parse(req.postData()).assetIds,[asset.assetId]);}
        if(req.method()==='DELETE'){deletes++;saved=null;}
        return req.respond({status:200,contentType:'application/json',body:JSON.stringify({share:saved,ok:true})});
      }
      if(pathname.startsWith('/api/'))return req.respond({status:200,contentType:'application/json',body:'{"ok":true,"signedIn":false}'});
      return req.continue();
    });
    const click=async text=>assert.ok(await page.evaluate(t=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===t&&!e.disabled);b?.click();return !!b},text),`Missing ${text}`);
    await fs.mkdir(output,{recursive:true});
    for(const width of [1440,430]) {
      await page.setViewport({width,height:1000,deviceScaleFactor:1});
      await page.goto('http://127.0.0.1:3031/asset-share/validation',{waitUntil:'networkidle2'});
      await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Create asset link'&&!b.disabled));
      await click('Create asset link');
      await page.waitForSelector('[aria-label="Asset page URL"]');
      assert.match(await page.$eval('[aria-label="External asset details message preview"]',e=>e.textContent),/View asset details:/);
      await page.screenshot({path:path.join(output,`link-controls-${width}.png`),fullPage:true});
      await page.reload({waitUntil:'networkidle2'});
      await page.waitForSelector('[aria-label="Asset page URL"]');
      assert.doesNotMatch(await page.$eval('[aria-label="External asset details message preview"]',e=>e.textContent),/View asset details:/);
      await page.click('[aria-label="Asset page link"] input[type=checkbox]');
      assert.match(await page.$eval('[aria-label="External asset details message preview"]',e=>e.textContent),/View asset details:/);
      await click('Disable link');
      await page.waitForFunction(()=>document.body.textContent.includes('Link disabled.'));
      assert.doesNotMatch(await page.$eval('[aria-label="External asset details message preview"]',e=>e.textContent),/View asset details:/);
      await click('Show test snapshot');
      await page.waitForFunction(()=>document.body.textContent.includes('READ-ONLY ASSET SNAPSHOT'));
      assert.equal(await page.$$eval('button, a, input, select, textarea',els=>els.length),0,'public card has no actions or root footer');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'public page fits mobile');
      await page.screenshot({path:path.join(output,`asset-page-${width}.png`),fullPage:true});
    }
    await page.goto('http://127.0.0.1:3031/business-network/profile-validation',{waitUntil:'networkidle2'});
    await page.waitForFunction(()=>document.body.textContent.includes('Google workshop name'));
    const profile=await page.$eval('[aria-label="Selected business"]',e=>e.textContent);
    assert.match(profile,/Aim4price account/);assert.match(profile,/4.8/);assert.match(profile,/42 reviews/);assert.match(profile,/Google Maps/);assert.match(profile,/Fixture provider/);
    await page.click('summary');
    assert.ok(await page.$eval('details',e=>e.open));
    assert.equal(await page.$eval('a[href^="tel:"]',e=>e.getAttribute('href')),'tel:0448742585');
    assert.equal(creates,2);assert.equal(deletes,2);assert.deepEqual(errors,[]);
    console.log('PASS create, reuse, opt-in message, revoke, action-free snapshots at desktop and mobile widths, and attributed Google profile details');
  } finally {
    if(browser) await browser.close();
    if(server) server.kill();
    await fs.rm(fixture,{recursive:true,force:true});
    await fs.rm(profileFixture,{recursive:true,force:true});
    await fs.rm(path.join(root,'.next/types/app/business-network/profile-validation'),{recursive:true,force:true});
    await fs.rm(path.join(root,'.next/types/app/asset-share/validation'),{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1});
