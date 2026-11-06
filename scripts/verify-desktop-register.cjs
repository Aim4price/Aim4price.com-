/* Real normal-register renderer with synthetic delegated access. No live accounts or database. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {spawn}=require('node:child_process'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),fixture=path.join(root,'app/desktop-validation');
(async()=>{let server,browser,created=false;try{
 await fs.mkdir(fixture);created=true;await fs.writeFile(path.join(fixture,'page.tsx'),`'use client';import TeamWorkspaceClient from '../team/team-workspace-client';export default function Page(){return <TeamWorkspaceClient email="staff@farm" managed/>}`);
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3035'],{cwd:root,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Next startup timeout')),90000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve()}});server.stderr.on('data',d=>process.stderr.write(d));server.once('exit',code=>reject(Error('Next exited '+code)))});
 browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 const page=await browser.newPage(),errors=[],ownerRequests=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
 await page.evaluateOnNewDocument(()=>{Object.defineProperty(window,'outerWidth',{configurable:true,get:()=>innerWidth});localStorage.setItem('aim4price.website-canvas.v2',JSON.stringify({mode:'auto'}));});
 let revoked=false,values=false,revision=1;
 const permissions={viewValues:false,editDetails:true,updateUsage:true,viewMaintenance:false,completeMaintenance:false,uploadDocuments:false,viewPhotos:false,uploadPhotos:false,exportAssets:false};
 const asset=(id,registerId,title)=>({id,registerId,registerName:registerId==='reg-a'?'Farm equipment':'Vehicles',title,kind:'tractor',brand:'Landini',model:'Super 110',year:2020,serial:'SERIAL',registration:'',condition:'good',usage:1200,usageMetric:'hours',photoCount:0,...(values?{values:{current:987654,replacement:1234567,insured:999999}}:{})});
 await page.setRequestInterception(true);page.on('request',request=>{const u=new URL(request.url());if(u.pathname.startsWith('/api/')){
 let body={ok:true},status=200;
 if(u.pathname==='/api/team-workspaces')body={workspaces:[{id:'membership-a',name:'Test farm',available:true,status:'active',permissions}]};
 else if(u.pathname==='/api/team-workspaces/membership-a'){
 if(revoked){status=403;body={error:'Your access has been revoked.'}}else body={name:'Test farm',permissions:{...permissions,viewValues:values},version:revision,assets:[asset('tractor-a','reg-a','Landini tractor'),asset('tractor-b','reg-a','Farm trailer'),asset('vehicle-a','reg-b','Farm vehicle')],groups:[{id:'umbrella-a',name:'Farm machinery',userId:'',registerId:null,valueMode:'separate',members:[{assetId:'tractor-a',role:'primary',countsTowardTotal:true,relationship:'primary',sortOrder:0},{assetId:'tractor-b',role:'member',countsTowardTotal:true,relationship:'grouped',sortOrder:1}],createdAtIso:'',updatedAtIso:''}]};
 }else if(u.pathname.includes('asset-register')||u.pathname.includes('asset-groups')){ownerRequests.push(u.pathname);status=403;body={error:'Owner endpoint blocked'}}
 return request.respond({status,contentType:'application/json',body:JSON.stringify(body)});
 }request.continue();});
 for(const width of [1440,430]){
 await page.setViewport({width,height:1000});await page.goto('http://127.0.0.1:3035/desktop-validation',{waitUntil:'networkidle2',timeout:180000});
 await page.waitForSelector('[data-asset-group-id="umbrella-a"]');
 assert.equal(await page.evaluate(()=>document.body.textContent.includes('Open workspace')),false);
 assert.equal(await page.evaluate(()=>document.body.textContent.includes('987654')),false);
 assert(await page.$('[aria-label="Value restricted"]'));
 await page.$eval('[data-asset-group-id="umbrella-a"] [aria-label="Open Umbrella"]',e=>e.click());
 await page.waitForSelector('#asset-card-tractor-a');
 await page.$eval('#asset-card-tractor-a [aria-label="Open Asset"]',e=>e.click());
 await page.waitForFunction(()=>document.querySelector('#asset-panel-tractor-a')?.textContent.includes('SERIAL'));
 assert(await page.$('#asset-panel-tractor-a')); assert.equal(await page.$('header [data-access-restricted="true"]') !== null,true);
 await fs.mkdir('.next/desktop-validation',{recursive:true});await page.screenshot({path:`.next/desktop-validation/overview-${width}.png`});
 await page.$eval('#asset-card-tractor-a [data-tooltip="Manage asset"]',e=>e.click());await page.waitForSelector('[role="dialog"]');
 assert(await page.$eval('[role="dialog"]',el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;}),'Modal fits viewport');
 assert(await page.$('[data-manage-action="details"]')); assert(await page.$('[data-manage-action="history"][data-access-restricted="true"]')); await page.$eval('[data-manage-action="history"]',e=>e.click()); assert(await page.$('[data-manage-action="details"]'));
 await fs.mkdir('.next/desktop-validation',{recursive:true});await page.screenshot({path:`.next/desktop-validation/register-${width}.png`});
 await page.$eval('[data-manage-action="details"]',e=>e.click());
 await page.waitForSelector('[data-asset-update-section="2"]');
 assert(await page.$('[data-asset-update-section="3"][data-access-restricted="true"]'));
 await page.$eval('[data-asset-update-section="2"]',e=>e.click());
 await page.waitForSelector('[data-asset-detail-edit-target="year"] input');
 assert.equal(await page.$eval('[data-asset-detail-edit-target="year"]',e=>e.inert),false);
 assert(await page.$('[role="dialog"] label[inert][data-access-restricted="true"]')); assert(await page.$$eval('[role="dialog"] [data-access-restricted="true"][inert]',els=>els.some(e=>e.textContent.includes('Insured Value'))));
 await page.screenshot({path:`.next/desktop-validation/update-${width}.png`});
 if(width===1440){
   const saved=page.waitForRequest(r=>r.method()==='PATCH'&&r.url().endsWith('/api/team-workspaces/membership-a'),{timeout:15000});
   await page.focus('[data-asset-detail-edit-target="year"] input'); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.type('2021'); await page.keyboard.press('Tab');
   const payload=JSON.parse((await saved).postData()); assert.equal(payload.assetId,'tractor-a'); assert.equal(payload.patch.yearModel,2021);
   assert.deepEqual(Object.keys(payload.patch).sort(),['brand','condition','model','title','usage','yearModel']);
   await page.waitForNetworkIdle();
 }

 await page.$eval('[aria-label="Back to update asset menu"]',e=>e.click());
 await page.waitForSelector('[aria-label="Close update asset menu"]');
 await page.$eval('[aria-label="Close update asset menu"]',e=>e.click());
 if(await page.$('[aria-label="Close asset management"]')) await page.$eval('[aria-label="Close asset management"]',e=>e.click());
 }
 await page.$eval('[aria-label="Switch Asset Register"]',e=>e.click());
 await page.waitForSelector('[aria-label="Available asset registers"]');
 await page.$$eval('[aria-label="Available asset registers"] button',es=>es.find(e=>e.textContent.includes('Vehicles')).click());
 await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='Vehicles');
 assert.equal(await page.$('[data-asset-group-id="umbrella-a"]'),null);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForNetworkIdle();assert.equal(await page.$eval('h1',e=>e.textContent),'Vehicles');
 values=true;revision++;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Value restricted"]'));
 values=false;revision++;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForSelector('[aria-label="Value restricted"]');
 revoked=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.body.textContent.includes('revoked'));
 assert.equal(await page.$('[data-asset-group-id="umbrella-a"]'),null);
 assert.deepEqual(ownerRequests,[]);assert.deepEqual(errors,[]);console.log('PASS normal register, umbrellas, locked actions, hidden values, permission refresh and revocation at desktop/mobile sizes');
 }finally{if(browser)await browser.close();if(created)await fs.rm(fixture,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types/app/desktop-validation'),{recursive:true,force:true});if(server)server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
