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
const share = {senderName:'Farm & Co',createdAt:'2026-09-26T10:00:00Z',assets:['Tractor','Trailer','Bakkie'].map(title=>({title,serialNumber:title+'123',yearModel:2022,usage:'100 hours',condition:'Good',valueExVat:100000,replacementPriceExVat:200000,photoUrls:[],publicUrl:null}))};
test('invitation shows every selected asset, opens the real enquiry and has no signup or Google form',async()=>{
  const Page = load('app/business-network/accept/page.tsx',{
    '../../../components/AppHeader':()=>null,
    '../../../lib/guest-leads':{readLeadPage:async value=>{assert.equal(value,token);return {share,details:null};}},
  }).default;
  const html=renderToStaticMarkup(await Page({searchParams:{share:token,from:'Combined Asset Registers'}}));
  for(const asset of share.assets)assert.ok(html.includes(asset.title));
  assert.ok(html.includes(`/asset-share/${token}`));
  assert.ok(html.includes('Farm &amp; Co'));
  assert.doesNotMatch(html, /Combined Asset Registers|\?from=/);
  assert.ok(html.includes('Open enquiry'));
  assert.doesNotMatch(html,/See an example|Search Google|Find your business on Google|<form|[—–]/);
});
test('revoked and missing invitations do not offer a fabricated enquiry',async()=>{
  let reads=0;
  const Page=load('app/business-network/accept/page.tsx',{
    '../../../components/AppHeader':()=>null,
    '../../../lib/guest-leads':{readLeadPage:async()=>{reads++;return null;}},
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
    '../leads/useOutsideCardDismiss':load('components/leads/useOutsideCardDismiss.ts',{
      '../../lib/viewport-scrollbar':load('lib/viewport-scrollbar.ts'),
    }),
    '../leads/LeadCardSummary':load('components/leads/LeadCardSummary.tsx').default,
    '../leads/LeadAssetCard':load('components/leads/LeadAssetCard.tsx').default,
    '../leads/LeadAssetDetails':load('components/leads/LeadAssetDetails.tsx').default,
    // Facts and edit shortcuts must stay unmounted until the card is opened.
    '../leads/SharedAssetFacts':()=>{throw new Error('Closed cards must not mount asset facts');},
    'next/navigation':{useRouter:()=>({refresh:()=>{}})},
    '../leads/LeadManageButton':load('components/leads/LeadManageButton.tsx').default,
    '../LeadPhotoViewerModal':()=>null,
    './ExternalLeadActions':()=>null,
    // Interactive problem logging and resolution are exercised by verify-shared-lead-modals.cjs.
    '../leads/SharedProblems':()=>null,
    // Interactive Send is exercised by verify-shared-send.cjs.
    './SharedAssetSend':()=>null,
    './ShareModalCloseButton':()=>null,
    '../leads/LeadManageDialog':()=>null,
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
      global.fetch=async(url,options)=>{sent=options.body;return{ok:!failed,json:async()=>failed?{error:'Unable to share selected assets'}:{share:{token}}};};
      const Invite=load('components/business-network/BusinessListingInvite.tsx',{
        react:{...React,useEffect:()=>{},useId:()=> 'test',useRef:value=>hook({current:value})[0],useState:hook},
        '../asset-register/AssetAccessSettingsDialog':'dialog',
    '../DealerMaintenanceAccessSettings':{DealerMaintenancePermissionPicker:()=>null},
    '../asset-register/ShareDisclaimer':Disclaimer,
        '../../lib/external-file-share':load('lib/external-file-share.ts'),
        '../asset-register/ShareDisclosureDialog':'dialog',
        '../asset-register/ShareModalCloseButton':()=>null,
        '../WebsitePortal':{createPortal:node=>node},
        '../../lib/external-share-permissions':load('lib/external-share-permissions.ts',{}),
        '../../lib/asset-external-share':{buildEmailShareUrl:()=>'',buildWhatsAppShareUrl:()=>''},
      }).default;
      const render=(assetIds=ids)=>{cursor=0;view=Invite({senderName:'Farm',assetIds,includePhotos:false});};
      const button=text=>walk(view,node=>node.type==='button'&&React.Children.toArray(node.props.children).some(child=>typeof child==='string'&&child.trim()===text));
      render();
      walk(view,node=>node.type==='button').props.onClick();render();
      assert.equal(sent,undefined,'Opening the invite does not publish asset data');
      assert.ok(!button('Create invitation link'),'Permission selection comes first');
      button('Share read-only').props.onClick();render();
      assert.equal(button('Create invitation link').props.disabled,true);
      await walk(view,node=>node.type==='form').props.onSubmit({preventDefault(){}});
      assert.equal(sent,undefined,'Handler also enforces consent');
      walk(view,node=>node.type===Disclaimer).props.onChange(true);
      render(['different-asset']);
      await walk(view,node=>node.type==='form').props.onSubmit({preventDefault(){}});
      await new Promise(resolve=>setImmediate(resolve));render();
      assert.deepEqual(JSON.parse(sent.get('assetIds')),ids,'Original complete selection is preserved');assert.equal(sent.get('includePhotos'),'true');assert.equal(JSON.parse(sent.get('details')).permissions.allReports,true);
      if(failed){assert.ok(walk(view,node=>node.props?.role==='alert'));assert.ok(!button('Copy link'));}
      else assert.ok(button('Copy link'));
      walk(view,node=>node.type==='dialog').props.onClose();render();
      walk(view,node=>node.type==='button').props.onClick();render();
      button('Share read-only').props.onClick();render();
      assert.equal(button('Create invitation link').props.disabled,true,'Reopening requires fresh consent');
    }
  }finally{Object.assign(global,previous);}
});

 test('umbrella invitation shows its saved name and asset count without listing every member',async()=>{
  const Page=load('app/business-network/accept/page.tsx',{
    '../../../components/AppHeader':()=>null,
    '../../../lib/guest-leads':{readLeadPage:async()=>({share:{...share,umbrellaName:'Harvest fleet'},details:null})},
  }).default;
  const html=renderToStaticMarkup(await Page({searchParams:{share:token}}));
  assert.match(html,/Harvest fleet/);
  assert.match(html,/3 assets shared/);
  assert.match(html,/Farm &amp; Co/);
  assert.doesNotMatch(html,/Tractor|Trailer|Bakkie|→/);
  assert.ok(html.includes(`/asset-share/${token}`));
});

test('Send link creates protected read-only enquiries, requires consent and handles failure and clipboard denial', async()=>{
 const previous={fetch:global.fetch,window:global.window};
 const walk=(node,predicate)=>!node||typeof node!=='object'?null:predicate(node)?node:React.Children.toArray(node.props?.children).map(child=>walk(child,predicate)).find(Boolean);
 try {
  global.window={location:{origin:'https://aim4price.test'}};
  for(const failed of [false,true]) {
   let cursor=0,view,sent,closed=false;const slots=[];
   const hook=initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];};
   const Disclaimer=()=>null;
   global.fetch=async(url,options)=>{sent={url,body:options.body};return{ok:!failed,json:async()=>failed?{error:'Could not create link'}:{share:{token}}};};
   const Invite=load('components/business-network/BusinessListingInvite.tsx',{
    react:{...React,useEffect:()=>{},useId:()=> 'test',useRef:v=>hook({current:v})[0],useState:hook},
    '../asset-register/AssetAccessSettingsDialog':'dialog',
    '../DealerMaintenanceAccessSettings':{DealerMaintenancePermissionPicker:()=>null},
    '../asset-register/ShareDisclaimer':Disclaimer,
    '../../lib/external-file-share':load('lib/external-file-share.ts'),
    '../asset-register/ShareDisclosureDialog':'dialog',
    '../../lib/external-share-permissions':load('lib/external-share-permissions.ts'),
    '../../lib/asset-external-share':{buildEmailShareUrl:()=>'',buildWhatsAppShareUrl:()=>''},
   }).default;
   const render=()=>{cursor=0;view=Invite({sendLink:true,assetIds:['asset-a'],umbrellaId:'fleet',onDismiss:()=>{closed=true;}});};
   const button=text=>walk(view,n=>n.type==='button'&&React.Children.toArray(n.props.children).includes(text));
   render();assert.equal(sent,undefined);
   button('Share read-only').props.onClick();render();
   await walk(view,n=>n.type==='form').props.onSubmit({preventDefault(){}});
   assert.equal(sent,undefined);assert.equal(button('Create asset link').props.disabled,true);
   walk(view,n=>n.type===Disclaimer).props.onChange(true);render();
   await walk(view,n=>n.type==='form').props.onSubmit({preventDefault(){}});
   await new Promise(resolve=>setImmediate(resolve));render();
   assert.equal(sent.url,'/api/asset-share-links/leads');
   assert.equal(sent.body.get('umbrellaId'),'fleet');
   assert.deepEqual(JSON.parse(sent.body.get('assetIds')),['asset-a']);
   const details=JSON.parse(sent.body.get('details'));
   assert.equal(details.accessMode,'signed-in');assert.equal(details.permissions.allReports,true);assert.equal(sent.body.get('includePhotos'),'true');for(const key of ['serialNumber','replacementPrice','maintenanceSchedules','documents'])assert.equal(details.permissions[key],false);
   if(failed){assert.ok(walk(view,n=>n.props?.role==='alert'));assert.ok(!button('Copy link'));}
   else {
    assert.ok(walk(view,n=>n.type==='a'&&n.props.href===`https://aim4price.test/asset-share/${token}`));
    // Node has no clipboard; a denied/unavailable clipboard must leave a selectable URL.
    await button('Copy link').props.onClick();await new Promise(resolve=>setImmediate(resolve));render();
    assert.equal(walk(view,n=>n.type==='input'&&n.props['aria-label']==='Asset link').props.value,`https://aim4price.test/asset-share/${token}`);
   }
   walk(view,n=>n.type==='dialog').props.onClose();assert.equal(closed,true);
  }
 } finally {Object.assign(global,previous);}
});
