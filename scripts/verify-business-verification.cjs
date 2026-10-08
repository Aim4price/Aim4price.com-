/* Shared-link/Leads dialog checks with synthetic data; no real writes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
let cssIndex=0;
const stubs={'components/DateInput':'module.exports=()=>null;'};
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


add('app/admin/business-accounts/verification-client');

const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';



(async()=>{
 const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:['--no-sandbox'],headless:true});
 try {
 const page=await browser.newPage();await page.setViewport({width:1100,height:900});
 await page.setContent('<style>*{box-sizing:border-box}body{font-family:Arial;padding:24px}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:runtime});
 await page.evaluate(()=>{
 window.failLoad=false;window.saves=[];
 window.fetch=async(url,options={})=>{
 if(options.method==='PATCH'){window.saves.push(JSON.parse(options.body));return Response.json({ok:true});}
 if(window.failLoad)return Response.json({error:'Verification queue unavailable'},{status:503});
 return Response.json({accounts:[
 {user_id:'a',business_name:'Pending workshop',email:'pending@example.test',email_verified:false,account_status:'active',review_note:'',verified_at:null},
 {user_id:'b',business_name:'Verified workshop',email:'verified@example.test',email_verified:true,account_status:'active',review_note:'Checked ownership',verified_at:'2026-01-01'},
 {user_id:'c',business_name:'Ready workshop',email:'ready@example.test',email_verified:true,account_status:'active',review_note:'',verified_at:null}
 ]});};
 ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(require('app/admin/business-accounts/verification-client').default));
 });
 await page.waitForFunction(()=>document.body.textContent.includes('Needs review (2)'));
 assert.equal(await page.$$eval('details',nodes=>nodes.length),2);
 await page.click('details summary');
 assert(await page.$eval('input[type=checkbox]',node=>node.disabled),'Unverified email cannot be approved');
 await page.type('textarea','Awaiting email verification');
 await page.click('form button');
 await page.waitForFunction(()=>window.saves.length===1);
 assert.equal(await page.evaluate(()=>window.saves[0].verified),false);
 const click=async text=>page.evaluate(text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text).click(),text);
 await click('Verified');
 await page.waitForFunction(()=>document.querySelector('details')?.textContent.includes('Verified workshop'));
 assert.equal(await page.$$eval('details',nodes=>nodes.length),1);
 await page.evaluate(()=>window.failLoad=true);await click('Refresh');
 await page.waitForSelector('[role=alert]');
 assert.equal(await page.$$eval('details',nodes=>nodes.length),0,'Failed refresh hides stale decisions');
 await page.evaluate(()=>window.failLoad=false);await click('Try again');
 await page.waitForSelector('details');
 await page.screenshot({path:'/tmp/admin-verification-audit.png'});
 console.log('PASS verification filters, email approval blocker, review notes, failed-load safety and retry');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
