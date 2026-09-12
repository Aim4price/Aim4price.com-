/* Real desktop, Owner App and Admin components with isolated fixture APIs. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
async function main() {
  const fixture = path.join(root,'app/owner-app/maintenance-validation');
  const output = path.join(root,'.next/maintenance-validation');
  const compiled = ts.transpileModule(await fs.readFile(path.join(root,'lib/maintenance-catalogue-seed.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const exports = {}; new Function('exports',compiled)(exports);
  const catalogue = exports.maintenanceCatalogueSeed;
  let server, browser;
  try {
    await fs.mkdir(fixture); await fs.writeFile(path.join(fixture,'page.tsx'), (await fs.readFile(path.join(root,'tests/fixtures/maintenance-catalogue-page.tsx'),'utf8')).replaceAll("'../../components/", "'../../../components/").replaceAll("'../../lib/", "'../../../lib/").replaceAll("'../../app/", "'../../"));
    server = spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3034'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'maintenance_fixture',PGPASSWORD:'local-fixture-only',PGDATABASE:'maintenance_fixture',BETTER_AUTH_SECRET:'local-maintenance-fixture-secret'},stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{ const timer=setTimeout(()=>reject(Error('Next startup timeout')),90000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));server.once('exit',code=>{clearTimeout(timer);reject(Error(`Next exited ${code}`));}); });
    await fs.mkdir(output,{recursive:true});
    browser = await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});
    const origin='http://127.0.0.1:3034';
    await browser.defaultBrowserContext().overridePermissions(origin,['geolocation']);
    const page=await browser.newPage(); await page.setGeolocation({latitude:-25.7,longitude:28.2,accuracy:10});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    let submitted=null;
    const asset={id:'11111111-1111-4111-8111-111111111111',userId:'fixture',publicAssetCode:'A4P-TEST',plateLabel:'Test',qrStatus:'active',title:'Test plough',kind:'tractor',equipmentFamilyKey:'tractors',equipmentFamilyLabel:'Plough',maintenanceIdentity:{source:'basic',familyKey:'plough',release:'basic_ballpark_20260907_v1',sector:'agricultural'},serialNumber:'TEST',yearModel:2020,financeStatus:'unknown',insuranceStatus:'unknown',licenseStatus:'not_applicable',licenseRegistrationNumber:'',hours:null,usageMode:'percent',usageMetric:'hours',lifeWorkedPercent:30,isPropelled:false,canUpdateFuel:false,condition:'good',note:'',photos:[],lastScannedAtIso:null,lastKnownLat:null,lastKnownLng:null,lastKnownLocationText:'',createdAtIso:null,updatedAtIso:null};
    await page.setRequestInterception(true);
    page.on('request',r=>{
      const url=new URL(r.url()); if(!url.pathname.startsWith('/api/'))return r.continue();
      let body={ok:true,items:[],assets:[],notifications:[],partners:[],openMaintenance:[]};
      if(url.pathname.includes('maintenance-catalogue'))body={catalogue};
      if(url.pathname.startsWith('/api/scan/assets/'))body={ok:true,asset,accessMode:'owner_session',ownerAppDisplayName:'Test owner',openMaintenance:[]};
      if(url.pathname.endsWith('/event')){submitted=JSON.parse(r.postData());body={ok:true,asset,scheduledMaintenanceCompletion:{completed:true}};}
      return r.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
    });
    async function clickText(text) { const found=await page.evaluate(t=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t || b.querySelector('strong')?.textContent===t);if(b){b.click();return true;}return false;},text);assert.ok(found,`Button ${text}`); }
    const url=origin+'/owner-app/maintenance-validation';
    for(const source of ['basic','advanced'])for(const width of [430,1280]){
      await page.setViewport({width,height:900});await page.goto(`${url}?source=${source}`,{waitUntil:'networkidle0',timeout:120000});
      await page.waitForFunction(()=>document.body.textContent.includes('Ploughshares'));
      const options=await page.$$eval('button[aria-pressed]',els=>els.map(e=>e.textContent));assert.ok(options.some(t=>t.includes('Ploughshares')));assert.ok(!options.some(t=>t.includes('Engine oil')));
      await clickText('Ploughshares');await page.type('input[placeholder="Name of person who checked the asset"]','Test inspector');await clickText('Save completed check-up');
      await page.waitForFunction(()=>document.querySelector('#result').textContent!=='null');
      const saved=JSON.parse(await page.$eval('#result',e=>e.textContent));assert.equal(saved.maintenanceWork[0].family.source,source);assert.equal(saved.maintenanceWork[0].items[0].id,'ploughshares');assert.match(saved.completedNotes,/Ploughshares/);
      await page.screenshot({path:path.join(output,`desktop-${source}-${width}.png`)});
    }
    console.log('PASS Basic and Advanced desktop selection and completion payloads at 430 and 1280 pixels');
    await page.setViewport({width:430,height:900,isMobile:true,hasTouch:true});await page.goto(url+'?view=app',{waitUntil:'networkidle0',timeout:120000});
    await page.waitForFunction(()=>[...document.querySelectorAll('button strong')].some(e=>e.textContent==='Maintenance'));
    await clickText('Maintenance');await clickText('Checked');await page.waitForFunction(()=>document.body.textContent.includes('Ploughshares'));
    await clickText('Ploughshares');await page.screenshot({path:path.join(output,'owner-app-plough.png')});
    await page.waitForFunction(()=>{const b=document.querySelector('[class*="editorFooter"] button:last-child');return b&&!b.disabled;});
    await page.$eval('[class*="editorFooter"] button:last-child',b=>b.click());
    await page.waitForFunction(()=>!document.querySelector('[class*="editorFooter"]'));
    assert.equal(submitted.maintenanceWork[0].family.source,'basic');assert.equal(submitted.maintenanceWork[0].items[0].id,'ploughshares');
    console.log('PASS Owner App uses Basic identity over legacy tractor metadata and sends structured work');
    await page.goto(url+'?view=admin',{waitUntil:'networkidle0',timeout:120000});await page.type('input[aria-label="Find a family"]','plough');
    await clickText('Plough');await page.waitForFunction(()=>document.body.textContent.includes('Create separate checklist'));
    await clickText('Create separate checklist for this family');await page.waitForFunction(()=>document.body.textContent.includes('Shared by 1 families'));
    await page.screenshot({path:path.join(output,'admin-family-editor.png')});
    await clickText('Save changes');await page.waitForFunction(()=>document.body.textContent.includes('Catalogue saved.'));
    console.log('PASS Admin family search and independent family checklist editing');
    assert.deepEqual(errors,[]);
  } finally {
    if(server){await fs.rm(fixture,{recursive:true,force:true});await fs.rm(path.join(root,'.next/types/app/owner-app/maintenance-validation'),{recursive:true,force:true});server.kill();}
    if(browser)await browser.close();
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
