/* Local document fixtures only; exercise draft preservation and chooser focus. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'app/document-type-validation');
async function main() {
 let server, browser;
 try {
  await fs.mkdir(fixture, {recursive:true});
  await fs.writeFile(path.join(fixture,'page.tsx'), "export {default} from '../documents/documents-client';\n");
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3049'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGUSER:'fixture',PGPASSWORD:'fixture',PGDATABASE:'fixture',BETTER_AUTH_SECRET:'document-picker-fixture-only'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),90000);server.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve();}});server.stderr.on('data',d=>process.stderr.write(d));});
  browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await require('@sparticuz/chromium').executablePath(),args:['--no-sandbox','--disable-gpu'],pipe:true,headless:true});
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1440,height:900});
  await page.setRequestInterception(true);
  page.on('request',r=>{
   const u=new URL(r.url());if(!u.pathname.startsWith('/api/'))return r.continue();
   const user={id:'fixture',name:'Test Owner',email:'test@example.invalid',accountType:'owner'};
   const doc={id:'fixture',title:'Saved title',category:'insurance',documentType:'insurance-policy',notes:'Keep these notes',expiryDate:null,fileName:'policy.pdf',contentType:'application/pdf',byteSize:100,assetLinks:[],createdAtIso:'2026-10-01',updatedAtIso:'2026-10-01',deletedAtIso:null};
   const data=u.pathname==='/api/me'?{ok:true,signedIn:true,user}:u.pathname==='/api/documents'?{ok:true,documents:[doc],assets:[]}:{ok:true,items:[],notifications:[],profile:{...user,userId:user.id,displayName:user.name,extraPhotoUrls:[]}};
   r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  async function click(text){await page.$$eval('button',(buttons,text)=>{const b=buttons.find(b=>b.textContent.trim()===text);if(!b)throw Error('Missing '+text);b.click();},text);}
  await page.goto('http://127.0.0.1:3049/document-type-validation',{waitUntil:'networkidle0',timeout:120000});
  await click('Edit');await page.waitForSelector('#document-type-trigger');
  await page.click('#document-type-trigger');await page.waitForSelector('#document-type-title');
  assert.equal(await page.$$eval('[role=dialog]',nodes=>nodes.length),1);
  assert.equal(await page.$eval('[aria-label="Search document types"]',e=>e===document.activeElement),true);
  await page.type('[aria-label="Search document types"]','licence');
  await page.keyboard.press('Escape');await page.waitForSelector('#document-type-trigger');
  assert.match(await page.$eval('#document-type-trigger',e=>e.textContent),/Insurance policy/);
  assert.equal(await page.$eval('#document-type-trigger',e=>e===document.activeElement),true);
  await page.click('#document-type-trigger');await page.waitForSelector('#document-type-title');
  await page.type('[aria-label="Search document types"]','licence');await click('Licence disc');
  await page.waitForSelector('#document-type-trigger');
  assert.match(await page.$eval('#document-type-trigger',e=>e.textContent),/Licence disc/);
  assert.equal(await page.$eval('textarea',e=>e.value),'Keep these notes');
  await page.click('[aria-label="Close dialog"]');
  await click('Upload documents');await page.waitForSelector('input[type=file]');
  await fs.writeFile('/tmp/document-picker-fixture.txt','Local test document');
  await (await page.$('input[type=file]')).uploadFile('/tmp/document-picker-fixture.txt');await click('Continue');await page.waitForSelector('#document-type-trigger');
  await page.click('#document-type-trigger');await page.waitForSelector('#document-type-title');await click('Insurance policy');
  await page.waitForSelector('#document-type-trigger');assert.match(await page.$eval('#document-type-trigger',e=>e.textContent),/Insurance policy/);
  assert.deepEqual(errors,[]);
  console.log('PASS document type search, selection, Escape, focus return, draft preservation and upload/edit flows');
 } finally {if(browser)await browser.close();if(server)server.kill('SIGTERM');await fs.rm(fixture,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
