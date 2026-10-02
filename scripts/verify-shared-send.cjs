/* Shared Send uses the Leads note modal; fixture APIs only. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process'),puppeteer=require('puppeteer-core');
const root=path.resolve(__dirname,'..'),fixture=path.join(root,'app/business/shared-send-validation');
async function main(){let server,browser;try{
 await fs.mkdir(fixture,{recursive:true});await fs.writeFile(path.join(fixture,'page.tsx'),`'use client';
import SharedAssetSend from '../../../components/asset-register/SharedAssetSend';
export default function Page(){return <SharedAssetSend assetId="10000000-0000-4000-8000-000000000001" assetTitle="Toyota Hilux · Asset Owner" enquiry={{token:'a'.repeat(43),access:'active',permissions:{reports:true,documents:false,serialNumber:false,replacementPrice:false},reports:[],reply:{email:'owner@example.test',phone:'',name:'Owner'}}}/>;}`);
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3039'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'fixture',PGPASSWORD:'fixture-only',PGDATABASE:'fixture',BETTER_AUTH_SECRET:'fixture-only-shared-cost'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Next startup timed out')),90000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timeout);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));server.once('exit',code=>{clearTimeout(timeout);reject(Error('Next exited '+code));});});
 browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await require('@sparticuz/chromium').executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});
 const page=await browser.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
 page.on('request',r=>{const u=new URL(r.url());if(!u.pathname.startsWith('/api/'))return r.continue();if(r.method()==='POST')writes.push({path:u.pathname,body:r.postData()||''});return r.respond({status:200,contentType:'application/json',body:u.pathname.includes('session')?'null':'{"ok":true}'});});
 async function click(text){await page.$$eval('button',(nodes,text)=>{const button=nodes.find(n=>n.textContent.trim()===text||n.querySelector('strong')?.textContent===text);if(!button)throw Error('Missing '+text);button.click();},text);}
 await page.setViewport({width:1440,height:900});await page.goto('http://127.0.0.1:3039/business/shared-send-validation',{waitUntil:'networkidle0',timeout:120000});
 await click('Send');await page.waitForSelector('textarea');
 assert(await page.$eval('[role=dialog]',e=>e.textContent.includes('Send note or quote')));
 await page.type('textarea','Please see the attached quote.');
 await page.screenshot({path:'/tmp/shared-send-modal.png'});
 await click('Send note');await page.waitForFunction(()=>document.body.textContent.includes('Note sent'));
 assert.equal(writes.length,1);assert(writes[0].path.endsWith('/assets/10000000-0000-4000-8000-000000000001/notes'));
 assert.deepEqual(errors,[]);console.log('PASS shared Send button opens canonical note modal and submits asset-scoped note');
 }finally{if(browser)await browser.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}await fs.rm(fixture,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types/app/business/shared-send-validation'),{recursive:true,force:true});}}
main().catch(e=>{console.error(e);process.exitCode=1;});
