// Local fixtures only: no production listings or Google API calls.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const puppeteer = require('puppeteer-core');
const root=path.resolve(__dirname,'..');
const fixture=path.join(root,'app/business-network/admin-entry-validation');
async function main(){
 let browser,server;
 try{
  await fs.mkdir(fixture,{recursive:true});
  await fs.writeFile(path.join(fixture,'page.tsx'),`'use client';
import {useState} from 'react';
import BusinessJoin from '../join/join-client';
export default function Fixture(){const [saved,setSaved]=useState('');return <><BusinessJoin adminMode onAdminSaved={published=>setSaved(published?'Published without invitation':'Draft saved')}/><output data-saved>{saved}</output></>}
`);
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3035'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'fixture',PGPASSWORD:'fixture-only',PGDATABASE:'fixture',BETTER_AUTH_SECRET:'local-fixture-secret-not-for-production'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Next startup timed out')),60000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(t);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));});
  browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await require('@sparticuz/chromium').executablePath(),args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true,pipe:true});
  const page=await browser.newPage(),errors=[],saves=[];let searches=0,details=0,failSearch=false;
  page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
  page.on('request',req=>{
   const u=new URL(req.url());
   if(u.hostname==='unpkg.com')return req.abort();
   if(u.pathname==='/api/business-network/google'){
    const body=JSON.parse(req.postData());
    if(body.placeId){
     details++;assert.equal(body.placeId,'place-haddad');
     return req.respond({status:200,contentType:'application/json',body:JSON.stringify({place:{id:'place-haddad',displayName:{text:'S Haddad'},formattedAddress:'17 Saffier Crescent, George',addressComponents:[{longText:'George',types:['locality']}],location:{latitude:-33.96,longitude:22.46},nationalPhoneNumber:'044 123 4567',websiteUri:'https://example.com',googleMapsUri:'https://www.google.com/maps?query_place_id=place-haddad'}})});
    }
    searches++;assert.equal(body.query,'S Haddad George');
    return req.respond({status:failSearch?503:200,contentType:'application/json',body:JSON.stringify(failSearch?{error:'Google search is not configured. Enter manually.'}:{places:[{id:'place-haddad',displayName:{text:'S Haddad'},formattedAddress:'George, South Africa',googleMapsUri:'https://www.google.com/maps?query_place_id=place-haddad'}]})});
   }
   if(u.pathname==='/api/admin/business-network'){saves.push(JSON.parse(req.postData()));return req.respond({status:200,contentType:'application/json',body:'{"ok":true,"id":"fixture"}'});}
   if(u.pathname.startsWith('/api/'))return req.respond({status:200,contentType:'application/json',body:'{"ok":true,"signedIn":false}'});
   return req.continue();
  });
  const click=async text=>assert.ok(await page.evaluate(t=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===t&&!e.disabled);b?.click();return Boolean(b);},text),`Missing ${text}`);
  const fill=async(label,value)=>{const h=await page.evaluateHandle(t=>[...document.querySelectorAll('label')].find(e=>e.firstChild?.textContent?.trim()===t)?.querySelector('input'),label);assert.ok(h.asElement(),`Missing ${label}`);await h.asElement().click({clickCount:3});await page.keyboard.press('Backspace');await h.asElement().type(value);await h.dispose();};
  const output=path.join(root,'.next/business-admin-entry-validation');await fs.mkdir(output,{recursive:true});
  for(const width of [1440,430]){
   failSearch=false;await page.setViewport({width,height:1000,deviceScaleFactor:1});
   await page.goto('http://127.0.0.1:3035/business-network/admin-entry-validation',{waitUntil:'networkidle2'});
   await fill('Phone','044 999 9999');
   console.log('Checking viewport',width);
   await fill('Business name and town','S Haddad George');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.body.textContent.includes('George, South Africa')).catch(async e=>{console.error(await page.evaluate(()=>document.body.innerText),errors);throw e;});
   await click('Link this business');await page.waitForFunction(()=>document.body.textContent.includes('Google details loaded'));
   const value=label=>page.evaluate(t=>[...document.querySelectorAll('label')].find(e=>e.firstChild?.textContent?.trim()===t)?.querySelector('input')?.value,label);
   assert.equal(await value('Business name'),'S Haddad');assert.equal(await value('Town / city'),'George');assert.equal(await value('Phone'),'044 999 9999','Manual phone preserved');assert.equal(await value('Latitude'),'-33.96');assert.equal(await value('Website'),'https://example.com');assert.equal(await value('Request email'),'');
   await page.screenshot({path:path.join(output,`google-${width}.png`),fullPage:true});
   failSearch=true;await click('Find on Google');await page.waitForFunction(()=>document.body.textContent.includes('Google search is not configured'));
   await click('Enter manually');assert.equal(await page.$('[aria-label="Google business search"]'),null);
   await fill('Business name','Manual Workshop');await fill('Request email','manual@example.com');await fill('Town / city','George');await fill('Latitude','-33.96');await fill('Longitude','22.46');await click('Mechanic');await click('Brakes');
   await click('Save draft');assert.equal(saves.length,width===1440?0:2,'Unverified Google suggestions cannot be saved');
   await page.evaluate(()=>[...document.querySelectorAll('label')].find(e=>e.textContent.includes('independently checked'))?.querySelector('input').click());
   await click('Save draft');await page.waitForFunction(()=>document.querySelector('[data-saved]').textContent==='Draft saved');assert.equal(saves.at(-1).action,'save');
   await click('Save and publish');await page.waitForFunction(()=>document.querySelector('[data-saved]').textContent==='Published without invitation');assert.equal(saves.at(-1).action,'save_publish');assert.equal(saves.at(-1).googlePlaceId,'place-haddad');assert.equal(saves.at(-1).accepted,false,'Admin approval does not require business consent checkbox');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Form fits viewport');
   await page.screenshot({path:path.join(output,`manual-${width}.png`),fullPage:true});
  }
  assert.equal(searches,4);assert.equal(details,2);assert.equal(saves.length,4);assert.deepEqual(errors,[]);
  console.log('PASS Google results and Enter search, lookup failure recovery, explicit manual entry, draft and direct publication on desktop/mobile');
 }finally{
  if(browser)await browser.close();if(server)server.kill();
  await fs.rm(fixture,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types/app/business-network/admin-entry-validation'),{recursive:true,force:true});
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
