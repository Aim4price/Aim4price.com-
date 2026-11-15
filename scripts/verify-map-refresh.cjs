/* Real map/editor components, fixture APIs and a deterministic Leaflet adapter. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/map-refresh-validation');
async function main() {
 let server, browser;
 try {
  await fs.mkdir(fixture);
  await fs.writeFile(path.join(fixture, 'page.tsx'), "import Map from '../asset-map/asset-map-client'; export default Map;");
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next','dev','-p','3045'], {cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'fixture',PGPASSWORD:'fixture-only',PGDATABASE:'fixture',BETTER_AUTH_SECRET:'fixture-map-validation'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Next startup timed out')),90000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timeout);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));server.once('exit',code=>{clearTimeout(timeout);reject(Error('Next exited '+code));});});
  browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await require('@sparticuz/chromium').executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});
  const page=await browser.newPage(), errors=[];let requests=0, fail=false, held=null, hold=false;
  const asset={id:'map-fixture',registerId:'register-fixture',registerName:'Fixture farm',registerLabel:'Fixture farm',title:'2006 Yamaha Kodiak',kind:'vehicle',assetTypeLabel:'Quadbikes',plateLabel:'',publicAssetCode:'MAP-001',qrStatus:'active',condition:'fair',financeStatus:'unknown',insuranceStatus:'unknown',licenseStatus:'unknown',licenseRegistrationNumber:'',value:10000,selectedMethod:'manual',replacementPriceExVat:null,hours:0,lifeWorkedPercent:null,usageMetric:'km',usageDisplay:'0 km',fuelPercent:null,serialNumber:'',brandName:'Yamaha',modelName:'Kodiak',typedModelName:'',yearModel:2006,lastScannedAtIso:null,lastKnownLat:-34.02,lastKnownLng:22.38,lastKnownLocationText:'Farm',updatedAtIso:'2026-11-15T10:00:00Z',photos:[]};
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  const response=()=>({status:fail?503:200,contentType:'application/json',body:JSON.stringify(fail?{ok:false,error:'Fixture refresh failed'}:{ok:true,assets:[{...asset,lastKnownLat:-34.02-requests/1000}],registerFilters:[]})});
  page.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/api/asset-map'){requests++;if(hold){held=r;return;}return r.respond(response());}if(u.pathname.startsWith('/api/'))return r.respond({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:[],user:null})});if(u.hostname!=='127.0.0.1')return r.abort();return r.continue();});
  await page.evaluateOnNewDocument(()=>{
   Object.defineProperty(window,'outerWidth',{configurable:true,get:()=>innerWidth});localStorage.setItem('aim4price.website-canvas.v2.intro','seen');window.tileRedraws=0;
   const layers=new Set();
   window.L={control:{zoom:()=>({addTo(){}})},divIcon:o=>o,layerGroup:()=>({addTo(){return this;},clearLayers(){}}),
    map:()=>({setView(){return this;},on(){return this;},off(){return this;},fitBounds(){},getZoom:()=>13,getSize:()=>({y:700}),project:p=>({add:()=>p}),unproject:p=>p,panTo(){},hasLayer:l=>layers.has(l),removeLayer:l=>layers.delete(l),invalidateSize(){},remove(){}}),
    tileLayer:()=>({addTo(){layers.add(this);return this;},on(){return this;},off(){return this;},redraw(){window.tileRedraws++;}}),
    marker:p=>({addTo(){return this;},on(){return this;},bindTooltip(){return this;},getLatLng:()=>p})};
  });
  async function click(text){await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===text||b.querySelector('strong')?.textContent===text),{},text);await page.$$eval('button',(buttons,text)=>buttons.find(b=>b.textContent.trim()===text||b.querySelector('strong')?.textContent===text).click(),text);}
  await page.setViewport({width:1440,height:1000});
  await page.goto('http://127.0.0.1:3045/map-refresh-validation?assetId=map-fixture',{waitUntil:'networkidle0',timeout:120000});
  if(errors.length) throw Error(errors.join('; '));
  await page.waitForSelector('[data-tooltip="Reload the latest asset locations and map tiles."]');
  const refresh='[data-tooltip="Reload the latest asset locations and map tiles."]';
  await page.type('input[placeholder="Search name, serial or registration"]','Yamaha');
  hold=true;await page.click(refresh);await page.waitForFunction(()=>document.querySelector('[aria-busy="true"]'));
  const count=requests;await page.click(refresh);assert.equal(requests,count,'Busy control cannot duplicate a request');
  await page.evaluate(()=>window.dispatchEvent(new Event('aim4price:asset-register-updated')));assert.equal(requests,count,'Background update cannot abort manual refresh');
  assert(held,'Manual refresh requested fresh data');hold=false;await held.respond(response());held=null;
  await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent==='Map refreshed.');
  assert.equal(await page.$eval('input[placeholder="Search name, serial or registration"]',e=>e.value),'Yamaha');
  assert.equal(await page.$eval('article[class*=selectedAssetCard] h2', e=>e.textContent),'2006 Yamaha Kodiak','Refresh retains the selected asset');
  assert.equal(await page.evaluate(()=>window.tileRedraws),3,'Refresh redraws the map layers');
  fail=true;await page.click(refresh);await page.waitForFunction(()=>document.body.textContent.includes('Fixture refresh failed'));assert.equal(await page.$eval(refresh,e=>e.disabled),false,'Failure allows retry');
  fail=false;await page.click(refresh);await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent==='Map refreshed.');
  await page.screenshot({path:'/tmp/map-refresh-desktop.png'});
  await click('More');await click('Update location');await page.waitForSelector('[data-location-view="choice"]');
  const metrics=await page.evaluate(()=>{const editor=document.querySelector('[data-location-view]'),dialog=editor.closest('[role="dialog"]');return {width:parseFloat(getComputedStyle(dialog).width),weight:getComputedStyle(editor.querySelector('[data-location-action] strong')).fontWeight,overflow:editor.scrollWidth>editor.clientWidth+1};});
  assert(metrics.width>=820,'Location dialog has the wider 52rem layout');assert.equal(metrics.weight,'650');assert.equal(metrics.overflow,false);
  await page.screenshot({path:'/tmp/map-location-choices.png'});
  await click('Enter coordinates');assert.equal(await page.$eval('[data-location-view] input',e=>getComputedStyle(e).fontWeight),'500');await page.screenshot({path:'/tmp/map-location-coordinates.png'});
  await page.setViewport({width:390,height:844});await page.screenshot({path:'/tmp/map-location-phone.png'});
  assert(await page.$eval('[role="dialog"]',e=>e.scrollWidth<=e.clientWidth+1),'No dialog horizontal overflow on phone');
  assert.deepEqual(errors,[]);console.log('PASS refresh request, duplicate guard, background concurrency, failure/retry, retained search, tile redraw and location typography/layout');
 } finally {
  if(browser)await browser.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}
  await fs.rm(fixture,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types/app/map-refresh-validation'),{recursive:true,force:true});
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
