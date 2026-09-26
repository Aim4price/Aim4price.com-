const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const exports = {};
  new Function('require','exports',code)(name => name in mocks ? mocks[name] : name.endsWith('.css') ? {} : require(name), exports);
  return exports;
}
const token = 'a'.repeat(43);
const share = {createdAt:'2026-09-26T10:00:00Z',assets:['Tractor','Trailer','Bakkie'].map(title=>({title,serialNumber:title+'123',yearModel:2022,usage:'100 hours',condition:'Good',valueExVat:100000,replacementPriceExVat:200000,photoUrls:[],publicUrl:null}))};
test('invitation shows every selected asset, opens the real enquiry and has no signup or Google form',async()=>{
  const Page = load('app/business-network/accept/page.tsx',{
    '../../../components/AppHeader':()=>null,
    '../../../lib/asset-share-links':{readPublicAssetShare:async value=>{assert.equal(value,token);return share;}},
  }).default;
  const html=renderToStaticMarkup(await Page({searchParams:{share:token,from:'Farm & Co'}}));
  for(const asset of share.assets)assert.ok(html.includes(asset.title));
  assert.ok(html.includes(`/asset-share/${token}?from=Farm%20%26%20Co`));
  assert.ok(html.includes('Open enquiry'));
  assert.doesNotMatch(html,/See an example|Search Google|Find your business on Google|<form|[—–]/);
});
test('revoked and missing invitations do not offer a fabricated enquiry',async()=>{
  let reads=0;
  const Page=load('app/business-network/accept/page.tsx',{
    '../../../components/AppHeader':()=>null,
    '../../../lib/asset-share-links':{readPublicAssetShare:async()=>{reads++;return null;}},
  }).default;
  const revoked=renderToStaticMarkup(await Page({searchParams:{share:token}}));
  assert.match(revoked,/no longer available/);
  assert.doesNotMatch(revoked,/Open enquiry|\/asset-share\//);
  const empty=renderToStaticMarkup(await Page({searchParams:{}}));
  assert.equal(reads,1);
  assert.match(empty,/Ask the sender/);
  assert.doesNotMatch(empty,/Open enquiry|Example Toyota/);
});
test('public enquiry renders a Leads card and Manage control for every selected asset',()=>{
  const Cards=load('components/asset-register/SharedAssetCards.tsx',{
    './ShareModalCloseButton':()=>null,
    '../business-network/BusinessAcceptanceForm':()=>React.createElement('div',null,'Business lookup'),
    '../WebsitePortal':{createPortal:()=>{throw new Error('No modal should be mounted before Manage is clicked');}},
  }).default;
  const html=renderToStaticMarkup(React.createElement(Cards,{share,senderName:'Farm',allowBusinessDetails:true}));
  assert.equal((html.match(/<article/g)||[]).length,3);
  for(const asset of share.assets)assert.ok(html.includes(`aria-label="Manage ${asset.title}"`));
  assert.ok(html.includes('Add your business details'));
  assert.doesNotMatch(html,/[—–]/);
});
test('invitation creation sends the complete selected asset list and never falls back after failure',async()=>{
  const previousWindow=global.window,previousFetch=global.fetch;
  const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'];
  try{
    global.window={location:{origin:'https://aim4price.test'}};
    for(const failed of [false,true]){
      const changes=[];let sent;
      global.fetch=async(url,options)=>{assert.equal(url,'/api/asset-share-links');sent=JSON.parse(options.body);return{ok:!failed,json:async()=>failed?{error:'Unable to share selected assets'}:{share:{token}}};};
      const Invite=load('components/business-network/BusinessListingInvite.tsx',{
        react:{...React,useId:()=> 'test',useRef:value=>({current:value}),useState:value=>[value,next=>changes.push(next)]},
        '../asset-register/ShareModalCloseButton':()=>null,
        '../WebsitePortal':{createPortal:()=>null},
        '../../lib/asset-external-share':{buildEmailShareUrl:()=>'',buildWhatsAppShareUrl:()=>''},
      }).default;
      const view=Invite({senderName:'Farm',assetIds:ids,includePhotos:false});
      view.props.children[0].props.onClick();
      await new Promise(resolve=>setImmediate(resolve));
      assert.deepEqual(sent,{assetIds:ids,includePhotos:false});
      const urls=changes.filter(value=>typeof value==='string'&&value.startsWith('https://'));
      if(failed){assert.equal(urls.length,0);assert.ok(changes.includes('Unable to share selected assets'));}
      else{assert.equal(urls.length,1);assert.equal(new URL(urls[0]).searchParams.get('share'),token);}
    }
  }finally{global.window=previousWindow;global.fetch=previousFetch;}
});
