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
test('public enquiry renders an expandable Leads card for every selected asset',()=>{
  const Cards=load('components/asset-register/SharedAssetCards.tsx',{
    '../leads/LeadCardSummary':load('components/leads/LeadCardSummary.tsx').default,
    '../leads/LeadAssetCard':load('components/leads/LeadAssetCard.tsx').default,
    '../leads/LeadAssetDetails':load('components/leads/LeadAssetDetails.tsx').default,
    '../leads/LeadAssetFacts':load('components/leads/LeadAssetFacts.tsx').default,
    '../leads/LeadManageButton':load('components/leads/LeadManageButton.tsx').default,
    '../LeadPhotoViewerModal':()=>null,
    './ShareModalCloseButton':()=>null,
    '../business-network/BusinessAcceptanceForm':()=>React.createElement('div',null,'Business lookup'),
    '../WebsitePortal':{createPortal:()=>{throw new Error('No modal should be mounted before Manage is clicked');}},
  }).default;
  const html=renderToStaticMarkup(React.createElement(Cards,{share,senderName:'Farm',allowBusinessDetails:true}));
  assert.equal((html.match(/<article/g)||[]).length,3);
  for(const asset of share.assets)assert.ok(html.includes(`aria-label="Open ${asset.title}"`));
  assert.ok(html.includes('Add your business details'));
  assert.doesNotMatch(html,/[—–]/);
});

test('invitation requires consent, freezes all selected assets and handles failures without an empty link',async()=>{
  const previous={window:global.window,document:global.document,fetch:global.fetch};
  const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'];
  const walk=(node,predicate)=>!node||typeof node!=='object'?null:predicate(node)?node:React.Children.toArray(node.props?.children).map(child=>walk(child,predicate)).find(Boolean);
  try{
    global.window={location:{origin:'https://aim4price.test'}};global.document={body:{}};
    for(const failed of [false,true]){
      let cursor=0,sent,view;
      const slots=[];
      const hook=initial=>{const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],value=>{slots[index]=value}];};
      const Disclaimer=()=>null;
      global.fetch=async(url,options)=>{sent=JSON.parse(options.body);return{ok:!failed,json:async()=>failed?{error:'Unable to share selected assets'}:{share:{token}}};};
      const Invite=load('components/business-network/BusinessListingInvite.tsx',{
        react:{...React,useEffect:()=>{},useId:()=> 'test',useRef:value=>hook({current:value})[0],useState:hook},
        '../asset-register/ShareDisclaimer':Disclaimer,
        '../asset-register/ShareDisclosureDialog':'dialog',
        '../asset-register/ShareModalCloseButton':()=>null,
        '../WebsitePortal':{createPortal:node=>node},
        '../../lib/asset-external-share':{buildEmailShareUrl:()=>'',buildWhatsAppShareUrl:()=>''},
      }).default;
      const render=(assetIds=ids)=>{cursor=0;view=Invite({senderName:'Farm',assetIds,includePhotos:false});};
      const button=text=>walk(view,node=>node.type==='button'&&React.Children.toArray(node.props.children).some(child=>typeof child==='string'&&child.trim()===text));
      render();
      walk(view,node=>node.type==='button').props.onClick();render();
      assert.equal(sent,undefined,'Opening the invite does not publish asset data');
      assert.equal(button('Create invitation link').props.disabled,true);
      await button('Create invitation link').props.onClick();
      assert.equal(sent,undefined,'Handler also enforces consent');
      walk(view,node=>node.type===Disclaimer).props.onChange(true);
      render(['different-asset']);
      await button('Create invitation link').props.onClick();
      await new Promise(resolve=>setImmediate(resolve));render();
      assert.deepEqual(sent,{assetIds:ids,includePhotos:false},'Original complete selection is preserved');
      if(failed){assert.ok(walk(view,node=>node.props?.role==='alert'));assert.ok(!button('Copy link'));}
      else assert.ok(button('Copy link'));
      walk(view,node=>node.type==='dialog').props.onClose();render();
      walk(view,node=>node.type==='button').props.onClick();render();
      assert.equal(button('Create invitation link').props.disabled,true,'Reopening requires fresh consent');
    }
  }finally{Object.assign(global,previous);}
});
