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
    await fs.mkdir(fixture); await fs.writeFile(path.join(fixture,'page.tsx'), (await fs.readFile(path.join(root,'tests/fixtures/maintenance-catalogue-page.tsx'),'utf8')).replaceAll("'../../components/", "'../../../components/").replaceAll("'../../lib/", "'../../../lib/").replaceAll("'../../app/", "'../../").replaceAll("'../../tests/", "'../../../tests/"));
    server = spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3034'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'maintenance_fixture',PGPASSWORD:'local-fixture-only',PGDATABASE:'maintenance_fixture',BETTER_AUTH_SECRET:'local-maintenance-fixture-secret'},stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{ const timer=setTimeout(()=>reject(Error('Next startup timeout')),90000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));server.once('exit',code=>{clearTimeout(timer);reject(Error(`Next exited ${code}`));}); });
    await fs.mkdir(output,{recursive:true});
    browser = await puppeteer.launch({executablePath:process.env.CHROMIUM_PATH || await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});
    const origin='http://127.0.0.1:3034';
    await browser.defaultBrowserContext().overridePermissions(origin,['geolocation']);
    const page=await browser.newPage(); await page.setGeolocation({latitude:-25.7,longitude:28.2,accuracy:10});
    const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error at',page.url(),e.message)});page.on('console',m=>{if(m.type()==='error')console.error('Browser console',m.text())});
    let submitted=null, savedPart=null, savedDealerWork=null, customItems=[], eventMode='success';
    const trackerFixture=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/account-dialog-data.json'),'utf8')).asset;
    const asset={id:'11111111-1111-4111-8111-111111111111',userId:'fixture',publicAssetCode:'A4P-TEST',plateLabel:'Test',qrStatus:'active',title:'Test plough',kind:'tractor',equipmentFamilyKey:'tractors',equipmentFamilyLabel:'Plough',maintenanceIdentity:{source:'basic',familyKey:'plough',release:'basic_ballpark_20260907_v1',sector:'agricultural'},serialNumber:'TEST',yearModel:2020,financeStatus:'unknown',insuranceStatus:'unknown',licenseStatus:'not_applicable',licenseRegistrationNumber:'',hours:null,usageMode:'percent',usageMetric:'hours',lifeWorkedPercent:30,isPropelled:false,canUpdateFuel:false,condition:'good',note:'',photos:[],lastScannedAtIso:null,lastKnownLat:null,lastKnownLng:null,lastKnownLocationText:'',createdAtIso:null,updatedAtIso:null};
    await page.setRequestInterception(true);
    page.on('request',r=>{
      const url=new URL(r.url()); if(!url.pathname.startsWith('/api/'))return r.continue();
      let body={ok:true,items:[],assets:[],notifications:[],partners:[],openMaintenance:[]};
      if(url.pathname.startsWith('/api/app-offline/')) body={ok:true,identity:'polish-fixture'};
      if(url.pathname.endsWith('/event') && eventMode==='offline') return r.abort('internetdisconnected');
      if(url.pathname.endsWith('/event') && eventMode==='rejected') return r.respond({status:400,contentType:'application/json',body:JSON.stringify({error:'This reading needs review. Please check and try again.'})});
      if(url.pathname.includes('maintenance-catalogue'))body={catalogue};
      if(url.pathname.startsWith('/api/scan/assets/'))body={ok:true,asset,accessMode:'owner_session',ownerAppDisplayName:'Test owner',openMaintenance:[]};
      if(url.pathname.endsWith('/checklist')) { if(r.method()==='POST') { const item={id:`custom-fixture-${customItems.length}`, ...JSON.parse(r.postData())}; customItems.push(item);body={item}; } else body={asset:{...asset,headerMeta:'Year Model: 2020 · Usage: 30% · Condition: Good'},items:customItems,canEdit:true,canRecord:true,canSchedule:true}; }
      if(url.pathname===`/api/dealer/maintenance/${trackerFixture.accessId}` && r.method()==='POST') {savedDealerWork=JSON.parse(r.postData());body={ok:true,asset:trackerFixture};}
      if(url.pathname.endsWith('/parts')) { if(r.method()==='POST') { savedPart=JSON.parse(r.postData()); body={ok:true}; } else body={parts:[],suggestions:[{id:'oil_filter',label:'Oil filter'}],family:'Plough',canView:true,canAdd:true,maintenance:[]}; }
      if(url.pathname.endsWith('/event')){submitted=JSON.parse(r.postData());body={ok:true,asset,scheduledMaintenanceCompletion:{completed:true}};}
      return r.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
    });
    async function clickText(text) {
      const handle=await page.evaluateHandle(t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t || b.querySelector('strong')?.textContent===t) || null,text);
      const button=handle.asElement();assert.ok(button,`Button ${text}`);
      await button.click();await handle.dispose();
    }
    const url=origin+'/owner-app/maintenance-validation';
    for(const source of ['basic','advanced'])for(const width of [430,1280]){
      await page.setViewport({width,height:900});await page.goto(`${url}?source=${source}`,{waitUntil:'networkidle0',timeout:120000});
      await page.waitForFunction(()=>document.body.textContent.includes('Frame and welds condition'));
      const options=await page.$$eval('button[aria-pressed]',els=>els.map(e=>e.textContent));assert.ok(options.some(t=>t.includes('Frame and welds condition')));assert.ok(!options.some(t=>t.includes('Engine oil')));assert.ok(!options.some(t=>t.includes('Ploughshares')));
      // Later stages must stay hidden until the current stage is complete.
      assert.equal(await page.$('input[aria-label="Completion date"]'), null);
      assert.equal(await page.$('input[placeholder="Name of person who checked the asset"]'), null);
      await clickText('Next');
      await page.waitForSelector('[role="alert"]');
      assert.equal(await page.$('input[aria-label="Completion date"]'), null);
      await clickText('Frame and welds condition');
      await clickText('Next');
      await page.waitForSelector('input[aria-label="Completion date"]');
      assert.equal(await page.$eval('input[aria-label="Completion date"]', e => e.type), 'text');
      const completionDate = await page.$eval('input[aria-label="Completion date"]', e => e.value);
      assert.match(completionDate, /^\d{2}\/\d{2}\/\d{4}$/);
      await page.click('button[aria-label="Open calendar"]');
      await page.waitForSelector('dialog[open]');
      await page.$eval('dialog[open] button[aria-pressed="true"]', e => e.click());
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      assert.equal(await page.$eval('input[aria-label="Completion date"]', e => e.value), completionDate);
      assert.equal(await page.$('input[placeholder="Name of person who checked the asset"]'), null);
      await clickText('Back');
      await page.waitForSelector('button[aria-pressed="true"]');
      assert.match(await page.$eval('button[aria-pressed="true"]', e => e.textContent), /Frame and welds condition/);
      await clickText('Next');
      await page.waitForSelector('input[aria-label="Completion date"]');
      await clickText('Next');
      await page.waitForSelector('input[placeholder="Name of person who checked the asset"]');
      assert.equal(await page.$('input[aria-label="Completion date"]'), null);
      await page.type('input[placeholder="Name of person who checked the asset"]','Test inspector');
      await clickText('Save completed check-up');
      await page.waitForFunction(()=>document.querySelector('#result').textContent!=='null');
      const saved=JSON.parse(await page.$eval('#result',e=>e.textContent));assert.equal(saved.maintenanceWork[0].family.source,source);assert.equal(saved.maintenanceWork[0].items[0].id,'frame_and_welds');assert.match(saved.completedNotes,/Frame and welds condition/);assert.equal(saved.maintenanceWork[0].items[0].action,'checked');
      await page.screenshot({path:path.join(output,`desktop-${source}-${width}.png`)});
    }
    console.log('PASS Basic and Advanced desktop selection and completion payloads at 430 and 1280 pixels');
    await page.setViewport({width:430,height:900,isMobile:true,hasTouch:true});await page.goto(url+'?view=app',{waitUntil:'networkidle0',timeout:120000});
    await page.waitForFunction(()=>[...document.querySelectorAll('button strong')].some(e=>e.textContent==='Add maintenance'));
    await clickText('Add maintenance');await clickText('Checked');await page.waitForFunction(()=>document.body.textContent.includes('Frame and welds condition'));
    await clickText('Frame and welds condition');await page.screenshot({path:path.join(output,'owner-app-plough.png')});
    await page.waitForFunction(()=>{const b=document.querySelector('[class*="editorFooter"] button:last-child');return b&&!b.disabled;});
    await page.$eval('[class*="editorFooter"] button:last-child',b=>b.click());
    await page.waitForFunction(()=>!document.querySelector('[class*="editorFooter"]'));
    assert.equal(submitted.maintenanceWork[0].family.source,'basic');assert.equal(submitted.maintenanceWork[0].items[0].id,'frame_and_welds');
    console.log('PASS Owner App uses Basic identity over legacy tractor metadata and sends structured work');
    for (const view of ['app','field-manager']) {
      await page.goto(url+'?view='+view,{waitUntil:'networkidle0',timeout:120000});
      await page.waitForFunction(()=>[...document.querySelectorAll('button strong')].some(e=>e.textContent==='Parts'));
      await page.screenshot({path:path.join(output,`${view}-maintenance-actions.png`)});
      await clickText('Checklists');
      await page.waitForSelector('[aria-labelledby="maintenance-checklists-title"]');
      await page.waitForFunction(()=>document.body.textContent.includes('Frame and welds condition'));
      assert.equal(await page.$eval('[id="maintenance-checklists-title"]',e=>e.textContent),'Test plough');
      await page.screenshot({path:path.join(output,`${view}-checklists.png`)});
      await clickText('+ Add item');await page.type('#checklist-item-name',`${view} safety task`);await clickText('Save item');
      await page.waitForFunction(t=>document.body.textContent.includes(t),{},`${view} safety task`);
      await page.click('[aria-label="Close maintenance checklists"]');
      await clickText('Add maintenance');await clickText('Checked');
      await clickText('Change work type');await clickText('Checked');
      assert.equal(await page.$eval('[aria-label="Maintenance progress"] [aria-current="step"]', e=>e.textContent), '2Checks completed');
      await page.waitForFunction(t=>document.body.textContent.includes(t),{},`${view} safety task`);
      await page.click('[aria-labelledby="scan-editor-title"] [class*="editorHeader"] button');

      await clickText('Parts');await page.waitForSelector('input[type=search]');
      await clickText('+ Add part');await clickText('Oil filter');await clickText('Next');
      await page.type('input[placeholder="e.g. 001-ABC"]','001-APP');
      await clickText('Next');await clickText('Save part');
      await page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent.includes('Part saved'));
      assert.equal(savedPart.partNumber,'001-APP');assert.equal(savedPart.itemKey,'oil_filter');
      await page.screenshot({path:path.join(output,`${view}-parts.png`)});
      await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[aria-label="Back to maintenance"]'));
    }
    console.log('PASS Owner and Field Manager Parts entry, save and return on mobile');
    for (const view of ['app','field-manager']) {
      await page.setViewport({width:360,height:780,isMobile:true,hasTouch:true});
      await page.goto(url+'?view='+view,{waitUntil:'networkidle0',timeout:120000});
      await clickText('Add maintenance');await clickText('Checked');
      await page.waitForFunction(()=>document.body.textContent.includes('Frame and welds condition'));
      await clickText('Frame and welds condition');
      eventMode='rejected';await clickText('Save maintenance');
      await page.waitForSelector('[aria-labelledby="scan-editor-title"] [role="alert"]');
      await new Promise(resolve=>setTimeout(resolve,4000));
      assert.match(await page.$eval('[aria-labelledby="scan-editor-title"] [role="alert"]', e=>e.textContent), /reading needs review/);
      assert.ok(await page.$('[aria-labelledby="scan-editor-title"]'));
      assert.ok(await page.$eval('[aria-labelledby="scan-editor-title"] [role="alert"]', e=>{const r=e.getBoundingClientRect();return r.top>=0 && r.bottom<=window.innerHeight;}),'Save error is visible without scrolling');
      await page.screenshot({path:path.join(output,`${view}-save-error-360.png`)});
      eventMode='offline';await clickText('Save maintenance');
      await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='Saved on this phone');
      await new Promise(resolve=>setTimeout(resolve,3000));
      assert.equal(await page.$eval('h1',e=>e.textContent),'Saved on this phone');
      assert.match(await page.$eval('[role="status"]',e=>e.textContent), /waiting to sync/);
      assert.doesNotMatch(await page.$eval('[role="status"]',e=>e.textContent), /saved successfully|Saved to asset/);
      assert.match(await page.$eval('[role="status"]',e=>e.textContent), /Test plough/);
      assert.ok(await page.$('a[href*="assets"], a[href*="operations/maintenance"]'));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No horizontal overflow');
      await page.screenshot({path:path.join(output,`${view}-saved-on-phone-360.png`)});
      eventMode='success';
      await page.evaluate(()=>window.dispatchEvent(new Event('online')));
      await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='Saved to asset');
      assert.match(await page.$eval('[role="status"]',e=>e.textContent), /has synced to this asset/);
      // Clear this isolated fixture queue before the next role so auto-sync cannot affect it.
      await page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('aim4price-offline-mutation-queue',1);request.onsuccess=()=>{const db=request.result;const transaction=db.transaction('mutations','readwrite');transaction.objectStore('mutations').clear();transaction.oncomplete=()=>{db.close();resolve();};transaction.onerror=()=>reject(transaction.error);};request.onerror=()=>reject(request.error);}));
      eventMode='success';
    }
    console.log('PASS Owner and Field Manager show persistent in-form errors and honest offline confirmation at 360 pixels');

    await page.goto(url+'?view=dealer',{waitUntil:'networkidle0',timeout:120000});
    await page.waitForFunction(()=>[...document.querySelectorAll('button strong')].some(e=>e.textContent==='Add maintenance'));
    await clickText('Checklists');await page.waitForSelector('[aria-labelledby="maintenance-checklists-title"]');
    await page.click('[aria-label="Close maintenance checklists"]');
    await clickText('Parts');await page.waitForSelector('input[type=search]');await page.keyboard.press('Escape');
    await clickText('Add maintenance');await clickText('Check-up');
    await page.waitForFunction(()=>document.body.textContent.includes('Record completed check-up'));
    assert.equal(await page.$('[aria-labelledby="dealer-work-choice-title"]'),null);
    await page.screenshot({path:path.join(output,'dealer-unscheduled-checkup.png')});
    await clickText('Visible damage and loose parts');await clickText('Next');
    await page.waitForSelector('input[aria-label="Completion date"]');await clickText('Next');
    await page.type('input[placeholder="Name of person who checked the asset"]','Test mechanic');await clickText('Save to history');
    await page.waitForFunction(()=>document.body.textContent.includes('saved successfully'));
    assert.equal(savedDealerWork.maintenanceId,'');assert.equal(savedDealerWork.linkToScheduledMaintenance,false);assert.equal(savedDealerWork.maintenanceType,'checkup');
    assert.ok(savedDealerWork.maintenanceWork[0].items.length);
    console.log('PASS Dealer has Checklists, Parts and saves unscheduled maintenance');
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
