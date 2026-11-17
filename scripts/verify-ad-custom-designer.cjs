// Run locally: node scripts/verify-ad-custom-designer.cjs (requires an unused port 3147).
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ad-designer-qa-'));
const route=path.join(process.cwd(),'app/designer-qa');
if(fs.existsSync(route))throw Error('Remove the existing app/designer-qa fixture before running this check.');
fs.mkdirSync(route);
fs.writeFileSync(path.join(route,'page.tsx'),"import AdStudioClient from '../../components/AdStudioClient'; export default function QA(){return <AdStudioClient />;}");
const {createRequire}=require('module');
const requireApp=createRequire(process.cwd()+'/package.json');
const puppeteer=requireApp('puppeteer-core');
const server=require('child_process').spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port','3147'],{stdio:['ignore',require('fs').openSync(path.join(temp,'server.log'),'w'),'ignore']});
(async()=>{
for(let i=0;i<120;i++){try{const r=await fetch('http://localhost:3147/designer-qa');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
const browser=await puppeteer.launch({executablePath:await requireApp('@sparticuz/chromium').executablePath(),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage();await page.setViewport({width:1500,height:1000});
await page.evaluateOnNewDocument(()=>Object.defineProperty(window,'outerWidth',{get:()=>window.innerWidth,configurable:true}));
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let kits=[];await page.setRequestInterception(true);
page.on('request',req=>{
 if(req.url().includes('/api/me')) return req.respond({status:200,contentType:'application/json',body:JSON.stringify({ok:true,user:null})});
 if(req.url().includes('/api/admin/')) return req.respond({status:200,contentType:'application/json',body:'{}'});
 if(req.url().includes('/api/ad-studio/brand-kits')){
  if(req.method()==='PUT'){const body=JSON.parse(req.postData());kits=[{...body,id:'00000000-0000-4000-8000-000000000001',isDefault:true}];return req.respond({status:200,contentType:'application/json',body:JSON.stringify({ok:true,kit:kits[0]})});}
  return req.respond({status:200,contentType:'application/json',body:JSON.stringify({ok:true,kits,canManage:true,profileDefaults:{businessName:'Skimmelkrans Equipment',contactName:'Kuyler',phone:'082 123 4567',email:'sales@example.com'}})});
 }
 req.continue();
});
async function click(text){console.log('click',text);await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>b.innerText.trim()===t||b.querySelector('strong')?.textContent===t||b.innerText.trim().endsWith(' '+t)),{},text);await page.evaluate(t=>[...document.querySelectorAll('button')].find(b=>b.innerText.trim()===t||b.querySelector('strong')?.textContent===t||b.innerText.trim().endsWith(' '+t)).click(),text);}

await page.goto('http://localhost:3147/designer-qa',{waitUntil:'networkidle2',timeout:120000});
await page.waitForFunction(()=>document.body.innerText.includes('Advert Template'));
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Set your branding')).click());
await page.waitForSelector('[data-preview-locked]');
const locked=await page.evaluate(()=>{
 const panel=document.querySelector('[data-preview-locked]'),content=panel.querySelector('[inert]');
 const buttons=[...panel.querySelectorAll('button')].filter(b=>!b.closest('dialog'));
 buttons[0].focus();
 return !!content && content.getAttribute('aria-hidden')==='true' && buttons.every(b=>b.disabled) && !panel.contains(document.activeElement);
});if(!locked)throw Error('First template preview must block pointer, keyboard and screen-reader access');
await page.screenshot({path:path.join(temp,'first-template-guidance.png')});
await click('Style');if(!await page.$('[data-preview-locked]'))throw Error('Only Layout or Continue should reveal the first preview');
await click('Details');await click('Continue');
if(await page.$('[data-preview-locked]'))throw Error('Continue should reveal the preview');
await click('Details');if(await page.$('[data-preview-locked]'))throw Error('Returning to Details must keep the revealed preview visible');
await page.reload({waitUntil:'networkidle2'});
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Set your branding')).click());
await page.waitForSelector('[data-preview-locked]');
await click('Layout');if(await page.$('[data-preview-locked]'))throw Error('Layout should reveal the preview');
await click('Create your own');await page.waitForSelector('dialog[open]');
// The whole advert must fit at launch and after each format change, including short windows.
async function assertFits(label){
 await page.waitForFunction(()=>{
  const v=document.querySelector('[aria-label="Scrollable advert canvas"]'), c=document.querySelector('dialog[open] canvas');
  if(!v||!c)return false;const a=v.getBoundingClientRect(),b=c.getBoundingClientRect();
  return b.width>50&&b.left>=a.left-1&&b.top>=a.top-1&&b.right<=a.right+1&&b.bottom<=a.bottom+1;
 });
 const overflow=await page.$eval('[aria-label="Scrollable advert canvas"]',v=>({x:v.scrollWidth-v.clientWidth,y:v.scrollHeight-v.clientHeight}));
 if(overflow.x>2||overflow.y>2)throw Error(label+' has canvas scrollbars at Fit: '+JSON.stringify(overflow));
}
async function zoomButton(label){await page.click('[aria-label="'+label+'"]');}
await assertFits('Initial landscape');
await page.screenshot({path:path.join(temp,'blank-workspace.png')});
for(const size of ['Portrait','Square','Landscape']){await click(size);await assertFits(size);}
for(const size of [{width:1920,height:900},{width:1366,height:768},{width:1500,height:1000}]){
 await page.setViewport(size);await assertFits(size.width+'px window');
 if(size.width===1366)await page.screenshot({path:path.join(temp,'short-window.png')});
}
// Zoom is a view preference: it must not affect Undo or the document.
const undoState=await page.$eval('button[title="Undo (Ctrl+Z)"]',b=>b.disabled);
const blankPixels=await page.$eval('dialog[open] canvas',c=>c.toDataURL());
for(let i=0;i<22;i++)await zoomButton('Zoom in');
if(await page.$eval('[aria-label="Zoom level"]',e=>e.textContent)!=='200%')throw Error('Zoom did not stop at 200%');
if(!await page.$eval('[aria-label="Zoom in"]',e=>e.disabled))throw Error('Maximum zoom button is active');
for(let i=0;i<22;i++)await zoomButton('Zoom out');
if(await page.$eval('[aria-label="Zoom level"]',e=>e.textContent)!=='10%')throw Error('Zoom did not stop at 10%');
if(!await page.$eval('[aria-label="Zoom out"]',e=>e.disabled))throw Error('Minimum zoom button is active');
if(await page.$eval('button[title="Undo (Ctrl+Z)"]',b=>b.disabled)!==undoState)throw Error('Zoom entered document history');
if(await page.$eval('dialog[open] canvas',c=>c.toDataURL())!==blankPixels)throw Error('Zoom changed canvas pixels');
await click('Fit');await assertFits('Fit reset');
await click('Starter layout');
// Pan and drag at enlarged scale must leave document coordinates accurate.
for(let i=0;i<7;i++)await zoomButton('Zoom in');
const snapshot=await page.$$eval('[aria-label^="Move "]',els=>els.map(e=>e.getAttribute('style')));
await page.click('[aria-label="Pan canvas"]');
const view=await page.$('[aria-label="Scrollable advert canvas"]'),vr=await view.boundingBox();
const scrollBefore=await view.evaluate(e=>e.scrollLeft);
await page.mouse.move(vr.x+vr.width/2,vr.y+vr.height/2);await page.mouse.down();await page.mouse.move(vr.x+vr.width/2-70,vr.y+vr.height/2-40,{steps:5});await page.mouse.up();
if(await view.evaluate(e=>e.scrollLeft)===scrollBefore)throw Error('Hand tool did not pan');
if(JSON.stringify(await page.$$eval('[aria-label^="Move "]',els=>els.map(e=>e.getAttribute('style'))))!==JSON.stringify(snapshot))throw Error('Panning moved an element');
await page.click('[aria-label="Select elements"]');
await click('Layers');
await page.evaluate(()=>[...document.querySelectorAll('[aria-label="Design tools"] button')].find(b=>b.textContent.trim()==='Asset title').click());
const zoomTitle=await page.$('[aria-label="Move Asset title"]');
const zbefore=await zoomTitle.evaluate(e=>parseFloat(e.style.left));
const zb=await zoomTitle.boundingBox(),screenCanvasWidth=await page.$eval('dialog[open] canvas',c=>c.getBoundingClientRect().width);
await page.mouse.move(zb.x+zb.width/2,zb.y+zb.height/2);await page.mouse.down();await page.mouse.move(zb.x+zb.width/2+24,zb.y+zb.height/2-16,{steps:5});await page.mouse.up();
const zafter=await zoomTitle.evaluate(e=>parseFloat(e.style.left));
if(Math.abs(zafter-zbefore-24/screenCanvasWidth*100)>.05)throw Error('Dragging at zoom changed coordinates incorrectly');
await click('Undo');
await page.evaluate(()=>[...document.querySelectorAll('[aria-label="Design tools"] button')].find(b=>b.textContent.trim()==='Asking price').click());
const zoomPrice=await page.$('[aria-label="Move Asking price"]'),zpWidth=await zoomPrice.evaluate(e=>parseFloat(e.style.width));
const zpHandle=await (await page.$('[aria-label="Move Asking price"] span')).boundingBox();
await page.mouse.move(zpHandle.x+zpHandle.width/2,zpHandle.y+zpHandle.height/2);await page.mouse.down();await page.mouse.move(zpHandle.x+zpHandle.width/2+20,zpHandle.y+zpHandle.height/2+12,{steps:5});await page.mouse.up();
if(Math.abs(await zoomPrice.evaluate(e=>parseFloat(e.style.width))-zpWidth-20/screenCanvasWidth*100)>.05)throw Error('Resizing at zoom changed dimensions incorrectly');
await click('Undo');await click('Fit');await assertFits('Fit after pan');
await click('Add elements');
// Real pointer drag and keyboard nudge on the title layer.
const titleLayer=await page.$('[aria-label="Move Asset title"]');
const before=await titleLayer.evaluate(e=>({left:parseFloat(e.style.left),top:parseFloat(e.style.top)}));
const box=await titleLayer.boundingBox();
await page.mouse.move(box.x+40,box.y+20);await page.mouse.down();await page.mouse.move(box.x+90,box.y-20,{steps:8});await page.mouse.up();
const after=await titleLayer.evaluate(e=>({left:parseFloat(e.style.left),top:parseFloat(e.style.top)}));
if(after.left===before.left || after.top===before.top)throw Error('Pointer drag did not move the title');
await click('Undo');
if(Math.abs(await titleLayer.evaluate(e=>parseFloat(e.style.left))-before.left)>.001)throw Error('Undo did not restore drag');
await titleLayer.focus();await page.keyboard.press('ArrowRight');
if(await titleLayer.evaluate(e=>parseFloat(e.style.left))<=before.left)throw Error('Keyboard nudge did not move title');
await click('Undo');
// Resize through the visible corner handle.
const handle=await page.$('[aria-label="Move Asset title"] span');
if(!handle){await titleLayer.evaluate(e=>e.blur());await titleLayer.focus();await page.waitForSelector('[aria-label="Move Asset title"] span');}
const corner=await (await page.$('[aria-label="Move Asset title"] span')).boundingBox();
const widthBefore=await titleLayer.evaluate(e=>parseFloat(e.style.width));
await page.mouse.move(corner.x+7,corner.y+7);await page.mouse.down();await page.mouse.move(corner.x-20,corner.y+20,{steps:5});await page.mouse.up();
if(await titleLayer.evaluate(e=>parseFloat(e.style.width))===widthBefore)throw Error('Resize handle did not change width');
await click('Undo');
await page.waitForFunction(()=>!document.querySelector('dialog[open]').innerText.includes('Updating preview'));
await page.screenshot({path:path.join(temp,'desktop.png')});
await page.evaluate(()=>{const original=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.type==='image/png')window.__exportedDesign=blob;return original.call(this,blob)};});
await zoomButton('Zoom in');await zoomButton('Zoom in');
await click('Download preview');await page.waitForFunction(()=>!!window.__exportedDesign);
const equal=await page.evaluate(async()=>{
 const image=await createImageBitmap(window.__exportedDesign), exported=document.createElement('canvas');exported.width=image.width;exported.height=image.height;exported.getContext('2d').drawImage(image,0,0);
 return exported.toDataURL()===document.querySelector('dialog[open] canvas').toDataURL();
});if(!equal)throw Error('PNG differs from editor preview');console.log('drag, resize, nudge, undo and exact PNG match passed');
await click('Fit');
const canvas=await page.$('dialog[open] canvas');console.log('canvas',await canvas.evaluate(c=>[c.width,c.height]));
await click('Square');await page.waitForFunction(()=>document.querySelector('dialog[open] canvas').width===1080);
await click('Undo');await page.waitForFunction(()=>document.querySelector('dialog[open] canvas').width===1600);
await click('Redo');await page.waitForFunction(()=>document.querySelector('dialog[open] canvas').width===1080);
// Selecting a layer exposes its controls; multi-digit inputs commit on blur rather than clamping each keystroke.
await click('Layers');await page.evaluate(()=>[...document.querySelectorAll('[aria-label="Design tools"] button')].find(b=>b.textContent.trim()==='Asset title').click());
await page.evaluate(()=>[...document.querySelectorAll('summary')].find(e=>e.textContent.includes('Size & position')).click());
const fontSummary=await page.$('[aria-label="Element settings"] details:not([class*="disclosure"]) summary');
await fontSummary.focus();await page.keyboard.press('Enter');await click('Montserrat');
if(!await fontSummary.evaluate(e=>e.textContent.includes('Montserrat')&&!e.closest('details').open))throw Error('Font picker did not select and close');
await page.keyboard.press('Enter');await click('Arial');
const numeric=await page.$('[aria-label="Element settings"] input[type="number"]');
await numeric.click({clickCount:3});await page.keyboard.type('72');await page.keyboard.press('Tab');
if(await numeric.evaluate(e=>e.value)!=='72')throw Error('Text size could not be typed naturally');
await page.screenshot({path:path.join(temp,'selected-element.png')});
await click('Undo');
await click('Use design');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
console.log('buttons',await page.$$eval('button',els=>els.map(e=>e.innerText).filter(t=>/save|review/i.test(t))));
await click('Review');
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/Save template|Save advert template/.test(b.innerText)).click());
await page.waitForFunction(()=>document.body.innerText.includes('Advert template saved'));
if(!kits[0]?.customDesign)throw Error('Custom design not saved');
console.log('saved',kits[0].customDesign.size,kits[0].customDesign.elements.length);
await page.reload({waitUntil:'networkidle2'});
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Set your branding')).click());
if(await page.$('[data-preview-locked]'))throw Error('Saved templates must open with a visible preview');
await click('Layout');await click('Open design editor');await page.waitForSelector('dialog[open]');
await page.waitForFunction(()=>document.querySelector('dialog[open] canvas').width===1080);
await page.evaluate(()=>sessionStorage.setItem('aim4price.website-landscape-entry.v1','portrait'));
await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
await page.goto('http://localhost:3147/designer-qa',{waitUntil:'networkidle2'});
// Follow the website's existing landscape guidance when emulating a touch phone.
await page.evaluate(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Continue in portrait'));button?.click();});
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Set your branding')).click());
await click('Layout');await click('Open design editor');await page.waitForSelector('dialog[open]');
await page.waitForFunction(()=>!document.querySelector('dialog[open]').innerText.includes('Updating preview'));
await page.screenshot({path:path.join(temp,'phone.png')});
const geometry=await page.evaluate(()=>{const d=document.querySelector('dialog[open]'),r=d.getBoundingClientRect();return {left:r.left,right:r.right,viewport:innerWidth}});
console.log('phone geometry',geometry);
if(geometry.left< -2 || geometry.right>geometry.viewport+2)throw Error('Editor extends beyond the phone viewport');
console.log('errors',errors);await browser.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{server.kill('SIGTERM');fs.rmSync(route,{recursive:true,force:true});fs.rmSync(path.join(process.cwd(),'.next/types/app/designer-qa'),{recursive:true,force:true});console.log('Screenshots and server log:',temp);setTimeout(()=>process.exit(process.exitCode||0),1000)});
