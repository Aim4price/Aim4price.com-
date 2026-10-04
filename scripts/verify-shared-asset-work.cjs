/* Shared asset edits and maintenance reuse owner controls; fixture APIs only. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process'),puppeteer=require('puppeteer-core');
const root=path.resolve(__dirname,'..'),fixture=path.join(root,'app/business/shared-work-validation');
async function main(){let server,browser;try{
 await fs.mkdir(fixture,{recursive:true});await fs.writeFile(path.join(fixture,'page.tsx'),`'use client';
import {useState} from 'react';
import SharedAssetWorkDialog from '../../../components/leads/SharedAssetWorkDialog';
export default function Page(){const [action,setAction]=useState<'details'|'maintenance'|'history'|null>(null);return <><button onClick={()=>setAction('details')}>Details</button><button onClick={()=>setAction('maintenance')}>Maintenance</button>{action&&<SharedAssetWorkDialog endpoint="/api/fixture-work" assetTitle="Toyota Hilux" action={action} onClose={()=>setAction(null)}/>}</>;}`);
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3039'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'fixture',PGPASSWORD:'fixture-only',PGDATABASE:'fixture',BETTER_AUTH_SECRET:'fixture-only-shared-cost'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Next startup timed out')),90000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timeout);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));server.once('exit',code=>{clearTimeout(timeout);reject(Error('Next exited '+code));});});
 browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await require('@sparticuz/chromium').executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});
 const page=await browser.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
 page.on('request',r=>{const u=new URL(r.url());if(!u.pathname.startsWith('/api/'))return r.continue();if(r.method()==='POST')writes.push({path:u.pathname,body:JSON.parse(r.postData()||'{}')});const data=u.pathname.includes('session')?null:u.pathname==='/api/fixture-work/checklist'?{items:[]}:u.pathname.startsWith('/api/fixture-work')&&r.method()==='GET'?{asset:{id:'10000000-0000-4000-8000-000000000001',title:'Toyota Hilux',kind:'vehicle',yearModel:2020,usageReading:100,usageMetric:'hours',condition:'good'},permissions:{yearModel:true,usage:true,condition:true}}:{ok:true};return r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});});
 async function click(text){await page.$$eval('button',(nodes,text)=>{const button=nodes.find(n=>n.textContent.trim()===text||n.querySelector('strong')?.textContent===text);if(!button)throw Error('Missing '+text);button.click();},text);}
 await page.setViewport({width:1440,height:900});await page.goto('http://127.0.0.1:3039/business/shared-work-validation',{waitUntil:'networkidle0',timeout:120000});
 await click('Details');await page.waitForSelector('[data-manage-action=details]');await page.click('[data-manage-action=details]');await page.waitForSelector('[role=dialog] input');
 const input=await page.$('[data-asset-detail-edit-target=year] input');await input.click({clickCount:3});await input.type('2021');
 await page.waitForFunction(()=>[...document.querySelectorAll('[role=status]')].some(n=>n.textContent==='Saving…'||n.textContent==='Unsaved changes'));
 await page.screenshot({path:'/tmp/shared-work-details.png'});
 await page.waitForFunction(()=>document.body.textContent.includes('Saved automatically')&&!document.querySelector('[data-asset-detail-edit-target=year] input').disabled);await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Done'&&!b.disabled));
 assert.deepEqual(writes[0].body.patch,{yearModel:2021});
 await page.$$eval('button',nodes=>nodes.find(n=>n.getAttribute('aria-label')?.includes('Close')).click());
 await click('Exit');await click('Maintenance');await page.waitForFunction(()=>document.body.textContent.includes('Already done or upcoming?'));
 assert.equal(await page.$$eval('[role=dialog] button',nodes=>nodes.find(n=>n.querySelector('strong')?.textContent==='Upcoming').disabled),true,'Scheduling requires its own permission');
 await page.screenshot({path:'/tmp/shared-maintenance-timing.png'});
 await click('Already done');await page.waitForFunction(()=>document.body.textContent.includes('What was done?'));await click('Back');await page.waitForFunction(()=>document.body.textContent.includes('Already done or upcoming?'));await click('Already done');await click('Checkup');
 await page.waitForSelector('input[placeholder="e.g. Checked trailer brake lights"]');await page.type('input[placeholder="e.g. Checked trailer brake lights"]','Checked brake lights');await click('Next');
 await page.waitForSelector('input[type=number]');await page.type('input[type=number]','120');await click('Next');
 await page.waitForSelector('input[placeholder="Name of person who checked the asset"]');await page.type('input[placeholder="Name of person who checked the asset"]','Workshop technician');
 await page.screenshot({path:'/tmp/shared-work-maintenance.png'});
 await page.$$eval('button',nodes=>nodes.find(n=>n.textContent.trim().startsWith('Save to history')).click());
 await page.waitForFunction(()=>document.body.textContent.includes('Saved to the owner'));
 assert.equal(writes.length,2);assert.equal(writes[1].path,'/api/fixture-work/maintenance');assert.equal(writes[1].body.maintenanceType,'checkup');assert.equal(writes[1].body.completedUsage,120);assert.deepEqual(errors,[]);
 console.log('PASS shared details and canonical completed maintenance flow');
 }finally{if(browser)await browser.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}await fs.rm(fixture,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types/app/business/shared-work-validation'),{recursive:true,force:true});}}
main().catch(e=>{console.error(e);process.exitCode=1;});
