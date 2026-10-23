/* Real AppFooter + shared visibility observer; browser hit testing, no production writes. */
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(`<style>${fs.readFileSync('components/AppFooter.module.css','utf8')}
  body{margin:0}#footer-root{position:fixed;bottom:0;left:0;right:0;z-index:2147483647;pointer-events:none}.footer{margin-top:0;pointer-events:auto}
  #page{position:relative;z-index:1;transform:translateZ(0);height:100vh}
  .overlay{position:fixed;inset:0;background:#0006;display:grid;place-items:end center;z-index:10}
  .panel{background:white;padding:20px;width:280px} .panel footer{height:80px;display:grid;place-items:center}.panel button{padding:20px}
  </style><div id="page"></div><div id="footer-root"></div>`);
  await page.addScriptTag({path:process.cwd()+'/node_modules/react/umd/react.development.js'});
  await page.addScriptTag({path:process.cwd()+'/node_modules/react-dom/umd/react-dom.development.js'});
  await page.addScriptTag({content:`window.modalPresence=(()=>{const exports={};${compile('lib/modal-presence.ts')}return exports;})();
   (()=>{const exports={};const require=name=>name==='react'?React:name==='next/navigation'?{usePathname:()=>'/asset-register'}:name==='next/link'?{default:({children,...props})=>React.createElement('a',props,children)}:name.includes('header-session-cache')?{readCachedHeaderSession:()=>null,refreshCachedHeaderSession:async()=>null}:name.includes('modal-presence')?window.modalPresence:{default:new Proxy({},{get:(_,key)=>key})};${compile('components/AppFooter.tsx')}
   ReactDOM.createRoot(document.querySelector('#footer-root')).render(React.createElement(exports.default));})();`});
  await page.waitForSelector('.footerToggle');
  const blocked=()=>page.$eval('.footer',el=>el.hasAttribute('inert')&&getComputedStyle(el).visibility==='hidden'&&getComputedStyle(el).pointerEvents==='none');
  const waitBlocked=async expected=>{await page.waitForFunction(expected=>{const el=document.querySelector('.footer');return (el.hasAttribute('inert')&&getComputedStyle(el).visibility==='hidden')===expected;},{},expected);assert.equal(await blocked(),expected);};
  const open=async(type,host='page')=>page.evaluate(({type,host})=>{
   const wrapper=document.createElement('div');wrapper.id='fixture';wrapper.className='overlay';
   if(type==='overlay')wrapper.setAttribute('data-website-overlay','');
   wrapper.innerHTML=`<section class="panel" ${type==='overlay'?'':`role="${type}" aria-modal="true"`}><h2>Manage asset</h2><footer><button id="modal-action">Save</button></footer></section>`;
   wrapper.querySelector('button').onclick=()=>window.saved=(window.saved||0)+1;
   (host==='body'?document.body:document.getElementById(host)).append(wrapper);
  },{type,host});
  for(const width of [1440,390]){
   await page.setViewport({width,height:900});
   for(const type of ['dialog','alertdialog','overlay']){
    await open(type);await waitBlocked(true);
    assert.equal(await page.$eval('#modal-action',el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'Dialog action receives pointer input over the footer');
    const before=await page.evaluate(()=>window.saved||0);await page.click('#modal-action');assert.equal(await page.evaluate(()=>window.saved),before+1);
    await page.$eval('.footerToggle',el=>el.focus());assert.equal(await page.$eval('.footerToggle',el=>document.activeElement===el),false,'Background footer cannot take keyboard focus');
    await page.evaluate(()=>document.getElementById('fixture').remove());await waitBlocked(false);
   }
  }
  // Portals and nested modals keep the site footer blocked until the final modal closes.
  await open('dialog','body');await page.evaluate(()=>{const nested=document.createElement('div');nested.id='nested';nested.setAttribute('role','alertdialog');nested.textContent='Confirm';document.body.append(nested);});await waitBlocked(true);
  await page.evaluate(()=>document.getElementById('fixture').remove());await waitBlocked(true);
  await page.evaluate(()=>document.getElementById('nested').remove());await waitBlocked(false);
  // Suspended/hidden dialogs must not leave the footer disabled forever.
  await open('dialog');await waitBlocked(true);
  await page.evaluate(()=>document.getElementById('fixture').style.display='none');await waitBlocked(false);
  await page.evaluate(()=>document.getElementById('fixture').style.display='grid');await waitBlocked(true);
  await page.evaluate(()=>document.getElementById('fixture').setAttribute('hidden',''));await waitBlocked(false);
  await page.evaluate(()=>document.getElementById('fixture').remove());
  await page.evaluate(()=>{const d=document.createElement('dialog');d.id='native-dialog';d.textContent='Page size';document.body.append(d);});await waitBlocked(false);
  await page.evaluate(()=>document.getElementById('native-dialog').showModal());await waitBlocked(true);
  await page.evaluate(()=>document.getElementById('native-dialog').close());await waitBlocked(false);
  await page.click('.footerToggle');await page.waitForFunction(()=>document.querySelector('.footerToggle').getAttribute('aria-expanded')==='true');
  await open('dialog');await waitBlocked(true);await page.evaluate(()=>document.getElementById('fixture').remove());await waitBlocked(false);
  assert.equal(await page.$eval('.footerToggle',el=>el.getAttribute('aria-expanded')),'true','Footer state survives modal dismissal');
  assert.deepEqual(errors,[]);console.log('PASS footer layering: real component, desktop/mobile, hit targets, keyboard, portals, nested/hidden/native dialogs and restoration');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
