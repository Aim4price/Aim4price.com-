/* Customer billing and email visual checks with synthetic data; no real email or account writes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
let cssIndex=0;
const stubs={
 'lib/sharing-foundation':'exports.sharingPlan=async()=>"desktop";',
 'lib/guest-enquiry-credits':'exports.guestCreditLimit=()=>null;',
 'lib/guest-business-access':'exports.getGuestViewer=async()=>null;',
 'components/AppHeader':'module.exports=()=>null;',
 'lib/account-access':'exports.getAccountAccess=async()=>({isActive:false,isAdmin:false});',
 'lib/account-profile':'exports.getAccountProfile=async()=>({accountType:"owner"});',
 'lib/auth-session':'exports.getAnyServerSession=async()=>globalThis.fixtureAnonymous?null:({user:{id:"test",email:"customer@example.test"}});',
 'lib/middleman-account':'exports.isMiddlemanAccountSubtype=()=>false;'
};
function cssModule(file){
 const prefix='c'+cssIndex+++'_',map={},sheet=postcss.parse(fs.readFileSync(path.join(root,file),'utf8'));
 sheet.walkRules(rule=>{
  const globals=[];let selector=rule.selector;
  while(selector.includes(':global(')){
   const start=selector.indexOf(':global(');let end=start+8,depth=1;
   for(;depth&&end<selector.length;end++){if(selector[end]==='(')depth++;else if(selector[end]===')')depth--;}
   const token='GLOBALTOKEN'+globals.length;
   globals.push(selector.slice(start+8,end-1));selector=selector.slice(0,start)+token+selector.slice(end);
  }
  selector=selector.replace(/\.([a-zA-Z_][\w-]*)/g,(_,name)=>{map[name]=prefix+name;return '.'+prefix+name;});
  globals.forEach((value,index)=>{selector=selector.replace('GLOBALTOKEN'+index,value);});
  rule.selector=selector;
 });
 sheets.push(sheet.toString());modules[file]='module.exports='+JSON.stringify(map);
}
function add(file){
 if(Object.hasOwn(modules,file))return;
 if(file.endsWith('.css')){cssModule(file);return;}
 if(stubs[file]){modules[file]=stubs[file];return;}
 const filename=['.tsx','.ts','.json',''].map(ext=>path.join(root,file+ext)).find(fs.existsSync);
 if(!filename)throw Error('Missing module '+file);
 if(filename.endsWith('.json')){modules[file]='module.exports='+fs.readFileSync(filename,'utf8');return;}
 modules[file]='';
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 modules[file]=code.replace(/require\(["']([^"']+)["']\)/g,(match,name)=>{
  if(!name.startsWith('.'))return match;
  const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),name));add(resolved);
  return 'require('+JSON.stringify(resolved)+')';
 });
}

add('app/tutorials/tutorial-library');
add('app/admin/videos/video-manager');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';

function loadNode(file,deps={}){const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const module={exports:{}};Function('require','module','exports',code)(id=>id in deps?deps[id]:require(id),module,module.exports);return module.exports;}

(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
 const dir=path.join(root,'.next/video-manager-validation');fs.mkdirSync(dir,{recursive:true});
 try{
 for(const audience of ['owners','dealers','businesses','sharing']){
  await page.goto('about:blank');await page.setViewport({width:1440,height:900});await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font:16px Arial;background:#193e30}'+sheets.join('\n')+'</style><div id="app"></div>');await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+'ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(require("app/tutorials/tutorial-library").default,{audience:'+JSON.stringify(audience)+'}));'});
  await page.waitForSelector('#owner-feature-title');assert.ok(await page.$eval('#owner-feature-title',e=>!!e.textContent));
  await page.$$eval('nav button',els=>els[0].click());await page.click('[aria-controls="feature-guide"]');assert.equal(await page.$eval('#feature-guide',e=>e.hidden),false);
  await page.screenshot({path:path.join(dir,audience+'.png')});
 }
 for(const width of [1440,390]){
  await page.goto('about:blank');await page.setViewport({width,height:900});await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font:16px Arial;background:#193e30}'+sheets.join('\n')+'</style><div id="app" style="padding:24px"></div>');await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+'ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(require("app/admin/videos/video-manager").default,{initialSlots:[]}));'});
  await page.waitForSelector('input[type="search"]');await page.type('input[type="search"]','fuel');assert.ok(await page.$$eval('nav button',els=>els.length>0&&els.every(e=>e.textContent.toLowerCase().includes('fuel'))));
  await page.$$eval('nav button',els=>els[0].click());assert.equal(await page.$eval('input[type="file"]',e=>e.accept),'video/mp4,video/webm,.mp4,.webm');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Admin has no horizontal overflow');await page.screenshot({path:path.join(dir,'admin-'+width+'.png'),fullPage:true});
 }

 // Exercise the upload/preview/publish controls with a synthetic recording and API.
 let slot={audience:'owners',feature:'welcome',revision:0,draft_id:null,published_id:null,draft_name:null,published_name:null};
 const video=Buffer.from('GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAQyEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHYTbuMU6uEElTDZ1OsggEfTbuMU6uEHFO7a1OsggQc7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsirXsYMPQkBNgI1MYXZmNjAuMTYuMTAwV0GNTGF2ZjYwLjE2LjEwMESJiECPQAAAAAAAFlSua8KuAQAAAAAAADnXgQFzxYitqw6IgQ6teZyBACK1nIN1bmSIgQCGhVZfVlA5g4EBI+ODhAJiWgDgirCCAUC6gbSagQISVMNnQIBzc6BjwIBnyJpFo4dFTkNPREVSRIeNTGF2ZjYwLjE2LjEwMHNz2mPAi2PFiK2rDoiBDq15Z8ilRaOHRU5DT0RFUkSHmExhdmM2MC4zMS4xMDIgbGlidnB4LXZwOWfIoUWjiERVUkFUSU9ORIeTMDA6MDA6MDEuMDAwMDAwMDAwAB9DtnVCceeBAKOsgQAAgIJJg0IAE/ALNgA4JBwYSgAAUGH2MAAAZwn1ho///shOoqUZuqIwBoCjloEAKACGAECSnABQAAADIAAAWjUXrhCjloEAUACGAECSnABO4AADIAAAWjUXrhCjloEAeACGAECSnABQAAADIAAAWjUXrhCjloEAoACGAECSnABNQAADIAAAWjUXrhCjloEAyACGAECSnABQAAADIAAAWjUXrhCjloEA8ACGAECSnABO4AADIAAAWjUXrhCjloEBGACGAECSnABQAAADIAAAWjUXrhCjloEBQACGAECSnABKIAADIAAAWjUXrhCjloEBaACGAECSnABQAAADIAAAWjUXrhCjloEBkACGAMCSnABKIAADIAAAWjUXrhCjloEBuACGAECSnABQAAADIAAAWjUXrhCjloEB4ACGAECSnABNQAADIAAAWjUXrhCjloECCACGAECSnABQAAADIAAAWjUXrhCjloECMACGAECSnABO4AADIAAAWjUXrhCjloECWACGAECSnABQAAADIAAAWjUXrhCjloECgACGAECSnABKIAADIAAAWjUXrhCjloECqACGAECSnABQAAADIAAAWjUXrhCjloEC0ACGAECSnABO4AADIAAAWjUXrhCjloEC+ACGAECSnABQAAADIAAAWjUXrhCjloEDIACGAMCSnABKIAADIAAAWjUXrhCjloEDSACGAECSnABQAAADIAAAWjUXrhCjloEDcACGAECSnABO4AADIAAAWjUXrhCjloEDmACGAECSnABQAAADIAAAWjUXrhCjloEDwACGAECSnABKIAADIAAAWjUXrhAcU7trkbuPs4EAt4r3gQHxggGl8IED','base64');
 const samplePath=path.join(dir,'sample.webm');fs.writeFileSync(samplePath,video);
 await page.setRequestInterception(true);page.on('request',async req=>{
  const url=new URL(req.url());
  if(url.pathname.startsWith('/api/tutorial-videos/'))return req.respond({status:200,contentType:'video/webm',body:video});
  if(url.pathname==='/api/admin/videos'){
   const action=url.searchParams.get('action');
   if(action==='upload')slot={...slot,revision:slot.revision+1,draft_id:'11111111-1111-4111-8111-111111111111',draft_name:'tutorial-test.webm'};
   if(action==='publish')slot={...slot,revision:slot.revision+1,published_id:slot.draft_id,published_name:slot.draft_name,draft_id:null,draft_name:null};
   if(action==='unpublish')slot={...slot,revision:slot.revision+1,draft_id:slot.published_id,draft_name:slot.published_name,published_id:null};
   return req.respond({status:200,contentType:'application/json',body:JSON.stringify({slots:[slot]})});
  }
  return req.respond({status:200,contentType:'text/html',body:'<html><body></body></html>'});
 });
 await page.goto('https://video.test/');await page.setViewport({width:1440,height:1000});await page.setContent('<style>*{box-sizing:border-box}body{font:16px Arial;background:#193e30}'+sheets.join('\n')+'</style><div id="app"></div>');await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+'ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(require("app/admin/videos/video-manager").default,{initialSlots:[]}));'});
 await page.waitForSelector('input[type="file"]');await (await page.$('input[type="file"]')).uploadFile(samplePath);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Publish video'&&!b.disabled));
 await page.$$eval('button',els=>els.find(b=>b.textContent==='Publish video').click());assert.equal(slot.published_id,null,'Confirmation precedes publishing');
 await page.$$eval('button',els=>els.find(b=>b.textContent==='Confirm').click());
 await page.waitForFunction(()=>document.body.textContent.includes('Published to the private guide.'));assert.ok(slot.published_id);assert.equal(slot.draft_id,null);
 await page.$$eval('button',els=>els.find(b=>b.textContent==='Unpublish').click());await page.$$eval('button',els=>els.find(b=>b.textContent==='Confirm').click());
 await page.waitForFunction(()=>document.body.textContent.includes('Video unpublished.'));assert.equal(slot.published_id,null);assert.ok(slot.draft_id);
 console.log('PASS upload, native video preview, explicit publish confirmation and reversible unpublish');
 assert.deepEqual(errors,[]);console.log('PASS all audience guides and admin video manager at desktop and mobile sizes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
