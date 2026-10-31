const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const load=require('./helpers/load-ts.cjs');
const css=new Proxy({},{get:(_,k)=>k});
const source=fs.readFileSync('components/MarketplacePublishReview.tsx','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const m={exports:{}};
const deps={'react/jsx-runtime':require('react/jsx-runtime'),'../lib/asset-saleability':load('lib/asset-saleability.ts'),'../lib/selling-price':load('lib/selling-price.ts'),'./StudioIcon':()=>null,'./MarketplacePublishReview.module.css':{__esModule:true,default:css}};
new Function('require','module','exports',code)(k=>deps[k],m,m.exports);
const draft={title:'Test loader',photos:[],description:'',sellerName:'Seller',sellerCompany:'',sellerPhone:'0820000000',sellerEmail:'',province:'',area:'',showDealRating:true};
const props={draft,price:100000,vatIncluded:false,idealValue:100000,assessment:{priceExVat:100000,needsReview:false},saved:{ease:{score:70,version:'2',provisional:false},answers:{currentDemand:'strong',realisticBuyerPool:'many'}},stale:false,loading:false,loadError:false,busy:false,onRatingChange:()=>{}};
const render=p=>renderToStaticMarkup(React.createElement(m.exports.default,{...props,...p}));
test('rating switch controls buyer preview independently of seller-only saleability',()=>{const shown=render({});assert.match(shown,/Fair value/);assert.match(shown,/aria-checked="true"/);assert.match(shown,/Only you can see this/);assert.match(shown,/Strong demand/);const hidden=render({draft:{...draft,showDealRating:false}});assert.doesNotMatch(hidden,/Fair value/);assert.match(hidden,/Strong demand/);});
test('unavailable assessments never show a current score or rating',()=>{for(const state of [{loading:true},{loadError:true}]){const html=render(state);assert.doesNotMatch(html,/70\/100|Fair value/);assert.match(html,/aria-checked="false"/);}});
test('ideal-only comparison is explicitly labelled and VAT preview changes display amount',()=>{const html=render({assessment:null,vatIncluded:true});assert.match(html,/Fair value/);assert.match(html,/At ideal selling price/);assert.match(html,/115/);assert.match(html,/Incl. VAT/);});
test('Continue validates and enters review before the publish operation',async()=>{const client=fs.readFileSync('app/asset-register/asset-register-client.tsx','utf8');const start=client.indexOf('    event.preventDefault();',client.indexOf('async function handleConfirmMarketplacePublish'));const end=client.indexOf('    setIsPublishingMarketplace(true);',start);const body=client.slice(start,end)+'\nreturn "publish";';const run=new Function('event','marketplaceAsset','marketplaceDraft','marketplacePhotosBusy','isPublishingMarketplace','parseMoneyInput','setNotice','isMarketplaceEligible','PROPERTY_ASSET_LABEL','marketplaceReview','setMarketplaceReview','requestAnimationFrame',body);let review=false,notice;const args=[{preventDefault(){}},{}, {...draft,askingPriceExVat:'100000'},false,false,Number,n=>notice=n,()=>true,'Property'];assert.equal(run(...args,false,v=>review=v,()=>{}),undefined);assert.equal(review,true);assert.equal(run(...args,true,()=>{},()=>{}),'publish');args[2]={...args[2],sellerPhone:''};review=false;assert.equal(run(...args,false,v=>review=v,()=>{}),undefined);assert.equal(review,false);assert.match(notice.message,/contact name and phone/);});
test('review offers a non-submit realistic-price action and returns from assessment without opening pricing menu',()=>{
 assert.match(render({}), /type="button" class="calculate"[^>]*>Calculate realistic price/);
 const client=fs.readFileSync('app/asset-register/asset-register-client.tsx','utf8');
 const start=client.indexOf('    setSaleabilityAsset(null);',client.indexOf('function closeSaleabilityDialog'));
 const end=client.indexOf('\n  }',start);let closed=false,returned=false,focused=false;
 const close=new Function('setSaleabilityAsset','marketplaceAsset','marketplaceReview','requestAnimationFrame','returnToPricingMenu',client.slice(start,end));
 close(v=>closed=v===null,{},true,()=>focused=true,()=>returned=true);
 assert.equal(closed,true);assert.equal(focused,true);assert.equal(returned,false);
 close(()=>{},null,false,()=>{},()=>returned=true);assert.equal(returned,true);
 assert.match(client,/marketplaceAsset && marketplaceDraft && !saleabilityAsset/);
});

test('stale realistic assessment falls back to ideal without showing stale saleability',()=>{
 const html=render({stale:true,assessment:{priceExVat:50000,needsReview:true}});
 assert.match(html,/Fair value/);assert.match(html,/At ideal selling price/);
 assert.match(html,/aria-checked="true"/);assert.doesNotMatch(html,/70\/100/);
});
