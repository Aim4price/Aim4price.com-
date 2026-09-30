/* Local UI fixtures and intercepted APIs. No real email, signup or production data. */
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const puppeteer=require('puppeteer-core');
const root=path.resolve(__dirname,'..'),fixture=path.join(root,'app/business/phase1-validation');
const enquiry='/asset-share/'+'a'.repeat(43);
async function main(){
 let server,browser;
 try{
  await fs.mkdir(fixture,{recursive:true});
  await fs.writeFile(path.join(fixture,'page.tsx'),`'use client';
import {useState,useEffect} from 'react';
import Signup from '../join/business-signup';
import Gate from '../../../components/SharedEnquiryAccess';
import AuthClient from '../../auth/auth-client';
import Reset from '../../reset-password/reset-password-client';
export default function Fixture(){const [mode,setMode]=useState('signup'),[ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);return <><nav data-ready={ready} style={{position:'relative',zIndex:100}}>{['signup','request-access','wrong-recipient','sign-in','login','reset'].map(x=><button key={x} onClick={()=>setMode(x)}>{x}</button>)}</nav>{mode==='signup'?<Signup returnTo="${enquiry}"/>:mode==='login'?<AuthClient businessSignup returnTo="${enquiry}"/>:mode==='reset'?<Reset token="fixture" error="" returnTo="${enquiry}"/>:<Gate returnTo="${enquiry}" access={mode}/>}</>}
`);
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3034'],{cwd:root,detached:true,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'validation',PGPASSWORD:'local-only',PGDATABASE:'validation',BETTER_AUTH_SECRET:'local-validation-only'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Next startup timeout')),60000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timeout);resolve();}});server.on('exit',code=>reject(Error('Next exited '+code)));});
  browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await require('@sparticuz/chromium').executablePath(),args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],headless:true,pipe:true});
  const page=await browser.newPage(),requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',r=>{
   if(new URL(r.url()).pathname.startsWith('/api/')){
    requests.push({path:new URL(r.url()).pathname,body:r.postData()});
    return r.respond({status:200,contentType:'application/json',body:JSON.stringify({ok:true,signedIn:false,plans:[]})});
   }
   return r.continue();
  });
  const output=path.join(root,'.next/free-business-validation');await fs.mkdir(output,{recursive:true});
  for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   await page.setViewport({width,height,isMobile:label==='mobile',hasTouch:label==='mobile'});
   await page.goto('http://localhost:3034/business/phase1-validation?returnTo='+encodeURIComponent(enquiry),{waitUntil:'networkidle0',timeout:120000});
   await page.waitForSelector('[data-ready="true"]');
   await page.waitForSelector('[data-website-canvas]');
   if(label==='mobile'){
    await page.waitForSelector('[data-mobile-landscape-entry]');
    await page.screenshot({path:path.join(output,'phone-turn-prompt.png'),fullPage:true});
    await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true,isLandscape:true});
    await page.waitForSelector('[data-mobile-landscape-entry]',{hidden:true});
   }
   assert.equal(await page.$eval('[data-website-canvas]',e=>e.style.width),'1440px');
   await page.evaluate(()=>[...document.querySelectorAll('button')].find(e=>e.textContent==='Free sharing account').click());
   await page.waitForSelector('input[name=password]');
   assert.equal(await page.$eval('input[name=password]',e=>e.autocomplete),'new-password');
   assert.equal(await page.$eval('input[name=email]',e=>e.autocomplete),'username');
   await page.screenshot({path:path.join(output,label+'.png'),fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+' has no horizontal overflow');
  }
  for(const [name,value] of Object.entries({name:'Example User',businessName:'Example Workshop',email:'example@test.invalid',password:'local-fixture-password'}))await page.type(`input[name=${name}]`,value);
  await page.click('input[name=terms]');await page.click('button[type=submit]');
  await page.waitForFunction(()=>document.body.innerText.includes('Check your email'));
  const signup=JSON.parse(requests.find(r=>r.path==='/api/auth/sign-up/email').body);
  assert.equal(signup.accountType,'business');assert.equal(signup.accountAccess,'free');assert.equal(signup.callbackURL,enquiry);assert.equal(signup.acceptedTerms,true);
  assert.equal(JSON.parse(requests.find(r=>r.path==='/api/auth/send-verification-email').body).callbackURL,enquiry);
  await page.evaluate(()=>[...document.querySelectorAll('nav button')].find(e=>e.textContent==='request-access').click());
  await page.waitForFunction(()=>document.body.innerText.includes('Request access from the sender'));
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(e=>e.textContent==='Request access').click());
  await page.waitForFunction(()=>document.body.innerText.includes('Access requested.'));
  assert.ok(requests.some(r=>r.path===enquiry.replace('/asset-share/','/api/asset-share-links/')+'/access'));
  await page.evaluate(()=>[...document.querySelectorAll('nav button')].find(e=>e.textContent==='reset').click());
  await page.waitForSelector('input[autocomplete="new-password"]');
  const resetLinks=await page.$$eval('a',els=>els.map(e=>e.getAttribute('href')));
  assert.ok(resetLinks.includes('/auth?returnTo='+encodeURIComponent(enquiry)+'#login'));
  assert.ok(resetLinks.includes('/auth?returnTo='+encodeURIComponent(enquiry)+'#forgot'));
  assert.deepEqual(errors,[]);
  console.log('PASS signup, verified-email handover, access request, reset return links and desktop/mobile layout');
 }finally{if(server&&server.exitCode===null){await new Promise(resolve=>{server.once('exit',resolve);server.kill('SIGTERM');});}await fs.rm(fixture,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types/app/business/phase1-validation'),{recursive:true,force:true});if(browser)await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
