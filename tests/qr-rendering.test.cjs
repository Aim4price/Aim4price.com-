const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function load(file,mocks={}){
 const filename=path.resolve(file),exports={};
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 const req=name=>Object.hasOwn(mocks,name)?mocks[name]:name.startsWith('.')?load(path.resolve(path.dirname(filename),name+'.ts'),mocks):require(name);
 new Function('require','exports','module',code)(req,exports,{exports});return exports;
}
const {NextRequest}=require('next/server');
const asset={title:'2020 Toyota Hilux',publicAssetCode:'A4P-TEST123',plateLabel:'TEST'};
function routeFixture({signedIn=true,allowed=true,record=asset,profile={logoUrl:''},lead=null,onProfile=()=>{},onLogo=()=>{}}={}){
 return load('app/api/asset-register/qr/route.ts',{
  '../../../../lib/account-profile':{getAccountProfile:async(user)=>{onProfile(user);return profile;}},
  '../../../../lib/report-logo':{
   getFallbackReportLogoUrl:async()=>'/brand/aim4price-mark-black.png',
   resolveReportLogoUrlForHtml:async(url)=>{onLogo(url);return url||'/brand/aim4price-mark-black.png';},
  },
  '../../../../lib/asset-register-account-access':{getAssetRegisterAccountAccess:async()=>allowed},
  '../../../../lib/auth-session':{getServerSession:async()=>signedIn?{user:{id:'owner'}}:null},
  '../../../../lib/asset-register-db':{getAssetRegisterItemById:async()=>record},
  '../../../../lib/partner-access':{getAssetLeadForPartner:async()=>lead},
 });
}
function request(format){return new NextRequest('https://www.aim4price.com/api/asset-register/qr?assetId=asset&format='+format);}
test('asset QR preview, download and print render locally without network calls',async()=>{
 const originalFetch=global.fetch;global.fetch=async()=>{throw Error('QR generation must be local');};
 try{
  const route=routeFixture();
  const svg=await route.GET(request('svg'));
  assert.equal(svg.status,200);assert.match(svg.headers.get('content-type'),/image\/svg\+xml/);
  assert.match(await svg.text(),/<svg[^>]+viewBox=/);
  const png=await route.GET(request('png'));
  assert.equal(png.status,200);
  const buffer=Buffer.from(await png.arrayBuffer());
  assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(buffer.readUInt32BE(16),1200);assert.equal(buffer.readUInt32BE(20),1200);
  const print=await route.GET(request('print'));
  assert.equal(print.status,200);assert.match(await print.text(),/data:image\/png;base64,/);
 }finally{global.fetch=originalFetch;}
});
test('printed asset label uses owner branding and only relevant identifying text',async()=>{
 const route=routeFixture({record:{...asset,serialNumber:' SN-123 '},profile:{logoUrl:'https://example.com/owner.png'}});
 const html=await (await route.GET(request('print'))).text();
 assert.match(html,/src="https:\/\/example.com\/owner.png"/);
 assert.match(html,/Serial number<\/dt><dd>SN-123<\/dd>/);
 assert.doesNotMatch(html,/Plate label|plateBlock|Farm PIN|Scan access|A4P-TEST123/);
 assert.match(html,/Print \/ Save Label/);
 assert.match(html,/width: 186mm/);
 assert.match(html,/@media screen and/);
 assert.match(html,/qr.decode\(\), decodeLogo\(\)/);
});
test('missing logo falls back to Aim4price and blank serial leaves no empty row',async()=>{
 for(const serialNumber of [undefined,'','   ']) {
  const html=await (await routeFixture({record:{...asset,serialNumber}}).GET(request('print'))).text();
  assert.match(html,/id="accountLogo" src="\/brand\/aim4price-mark-black.png"/);
  assert.doesNotMatch(html,/<div class="detailRow serialBlock">/);
 }
});
test('dealer label resolves the asset owner profile, not dealer branding',async()=>{
 const users=[],logos=[];
 const route=routeFixture({profile:{accountType:'dealer',accountStatus:'active',logoUrl:'owner-logo'},
  lead:{assetRegisterItemId:'asset',ownerUserId:'lead-owner'},onProfile:user=>users.push(user.id),onLogo:url=>logos.push(url)});
 const response=await route.GET(new NextRequest(request('print').url+'&leadId=lead'));
 assert.equal(response.status,200);
 assert.deepEqual(users,['owner','lead-owner']);
 assert.deepEqual(logos,['owner-logo']);
 const denied=routeFixture({profile:{accountType:'dealer',accountStatus:'active'},lead:{assetRegisterItemId:'other',ownerUserId:'lead-owner'}});
 assert.equal((await denied.GET(new NextRequest(request('print').url+'&leadId=lead'))).status,404);
});
test('label displays saved model and year, omits missing details and never prints blank writing lines',async()=>{
 for (const [record,expected] of [
  [{...asset,yearModel:2022,modelName:'TT4.90',serialNumber:'SN-123'},['Year model</dt><dd>2022','Model</dt><dd>TT4.90','Serial number</dt><dd>SN-123']],
  [{...asset,yearModel:null,typedModelName:'Basic model'},['Model</dt><dd>Basic model']],
 ]) {
  const html=await (await routeFixture({record}).GET(request('print'))).text();
  for(const text of expected) assert.ok(html.includes(text));
  if(record.yearModel===null) assert.doesNotMatch(html,/<dt>Year model<\/dt>|<dt>Serial number<\/dt>/);
  assert.doesNotMatch(html,/writingLines|handwritten/);
 }
 const empty=await (await routeFixture().GET(request('print'))).text();
 assert.doesNotMatch(empty,/<dl class="labelDetails"/);
});
test('print label escapes title, serial and image attributes',()=>{
 const {buildAssetQrLabelHtml}=load('lib/asset-qr-label-print.ts');
 const html=buildAssetQrLabelHtml({assetTitle:'<img onerror="attack()">',serialNumber:'<script>attack()</script>',qrImageUrl:'qr',logoUrl:'" onerror="attack()',fallbackLogoUrl:'fallback'});
 assert.match(html,/&lt;img onerror=&quot;attack\(\)&quot;&gt;/);
 assert.match(html,/&lt;script&gt;attack\(\)&lt;\/script&gt;/);
 assert.match(html,/src="&quot; onerror=&quot;attack\(\)"/);
 assert.doesNotMatch(html,/<script>attack|<img onerror/);
});
test('QR rendering retains account access and missing-code checks',async()=>{
 for(const [options,status] of [[{signedIn:false},401],[{allowed:false},403],[{record:null},404],[{record:{...asset,publicAssetCode:''}},409]]){
  assert.equal((await routeFixture(options).GET(request('svg'))).status,status);
 }
});
test('fuel QR preview and print use the same local renderer',async()=>{
 const route=load('app/api/fuel/storage/[storageId]/qr/route.ts',{
  '../../../../../../lib/fuel-ledger':{getFuelStorageById:async()=>({name:'Diesel tank',publicFuelStorageCode:'FUEL-123',fuelType:'diesel',capacityLitres:1000})},
  '../../../../../../lib/owner-workspace-access':{resolveOwnerWorkspaceContext:async()=>({ok:true,context:{ownerUserId:'owner'}})},
 });
 for(const format of ['svg','png','print']) {
  const response=await route.GET(new NextRequest('https://www.aim4price.com/api/fuel/storage/tank/qr?format='+format),{params:{storageId:'tank'}});
  assert.equal(response.status,200);
  if(format==='print')assert.match(await response.text(),/data:image\/png;base64,/);
 }
});
test('QR preview renders inline artwork without an image endpoint',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const code=ts.transpileModule(fs.readFileSync('components/QrCodePreview.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const component={exports:{}};
 new Function('require','exports','module',code)(require,component.exports,component);
 const render=value=>renderToStaticMarkup(React.createElement(component.exports.default,{value,label:'Asset QR'}));
 const markup=render('https://www.aim4price.com/scan/A4P-TEST123');
 assert.match(markup,/<svg/);assert.match(markup,/role="img"/);assert.match(markup,/<path d="M/);
 assert.doesNotMatch(markup,/<img|\/api\/|<image/);
 assert.notEqual(markup,render('https://www.aim4price.com/scan/A4P-OTHER'));
 assert.match(render(null),/QR code is not available yet/);
});
test('QR label opens with explicit website/app context and displays authenticated HTML',async()=>{
 const originalWindow=global.window,originalFetch=global.fetch;
 try {
  for(const [pathname,realm] of [['/asset-register','website'],['/owner-app/assets/1','owner'],['/dealer/assets/1','dealer']]) {
   const events=[];let written='';
   const tab={opener:{},closed:false,document:{title:'',body:{textContent:''},open(){},write(html){written=html;},close(){}},close(){this.closed=true;}};
   global.window={location:{pathname},open:()=>{events.push('open');return tab;}};
   global.fetch=async(url,options)=>{
    events.push('fetch');assert.equal(options.headers['x-aim4price-client-realm'],realm);
    assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');
    return new Response('<html>QR label<img src="data:image/png;base64,test"></html>',{headers:{'content-type':'text/html'}});
   };
   await load('lib/asset-qr-label.ts').openAssetQrLabel('/api/asset-register/qr?assetId=1&format=print');
   assert.deepEqual(events,['open','fetch']);assert.equal(tab.opener,null);
   assert.match(written,/QR label/);assert.equal(tab.closed,false);
  }
 }finally{global.window=originalWindow;global.fetch=originalFetch;}
});
test('QR label closes failed previews and reports expired sessions or blocked popups',async()=>{
 const originalWindow=global.window,originalFetch=global.fetch;
 try {
  const tab={closed:false,document:{body:{},write(){throw Error('Must not display errors as a label');}},close(){this.closed=true;}};
  global.window={location:{pathname:'/asset-register'},open:()=>tab};
  global.fetch=async()=>new Response('{"error":"You must be signed in."}',{status:401});
  await assert.rejects(load('lib/asset-qr-label.ts').openAssetQrLabel('/label'),/session has expired/);
  assert.equal(tab.closed,true);
  global.window.open=()=>null;
  global.fetch=async()=>{throw Error('Must not fetch without a tab');};
  await assert.rejects(load('lib/asset-qr-label.ts').openAssetQrLabel('/label'),/allow pop-ups/);
 }finally{global.window=originalWindow;global.fetch=originalFetch;}
});
