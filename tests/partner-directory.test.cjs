const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const client=fs.readFileSync('app/asset-register/asset-register-client.tsx','utf8');
const start=client.indexOf('  async function loadQuotePartners('),end=client.indexOf('  function showQuoteDirectoryForLocation',start);
const code=ts.transpileModule(client.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function fixture({bounds=null,selected=[],initial=[]}={}){
 const state={partners:initial,requests:[],search:'',stage:'',location:'George'},pending=[];
 const context={selectedQuoteLeadType:'replacement_quote',quotePartnerSearch:'',quoteOptionForLeadType:()=>({partnerType:'dealer'}),quoteDirectoryBoundsRef:{current:bounds},quotePartnerRequestRef:{current:0},selectedQuotePartnerIds:selected,
 setQuotePartners:v=>state.partners=typeof v==='function'?v(state.partners):v,setSelectedQuotePartnerIds:()=>{},setIsLoadingQuotePartners:()=>{},setNotice:()=>{},extractApiError:()=> 'Failed',setQuoteLocationInput:v=>state.location=v,setQuotePartnerSearch:v=>state.search=v,setDirectoryBusiness:()=>{},setQuoteDirectoryStage:v=>state.stage=v,
 fetch:(url)=>{state.requests.push(url);return new Promise(resolve=>pending.push(partners=>resolve({ok:true,json:async()=>({ok:true,partners})})));}};
 const actions=new Function(...Object.keys(context),code+';return {loadQuotePartners,showAllQuotePartners};')(...Object.values(context));return{...actions,state,pending};
}
test('directory name searches preserve area and include businesses without coordinates',async()=>{
 const x=fixture({bounds:{west:20,east:24,south:-35,north:-32}}),request=x.loadQuotePartners('replacement_quote','Workshop');
 const url=new URL(x.state.requests[0],'https://test');assert.equal(url.searchParams.get('search'),'Workshop');assert.equal(url.searchParams.get('west'),'20');
 x.pending.shift()([{userId:'no-coordinates',businessName:'Workshop'}]);await request;assert.equal(x.state.partners[0].userId,'no-coordinates');
});
test('browse all clears area and search, while retaining selected umbrella recipients',async()=>{
 const chosen={userId:'chosen'};const x=fixture({bounds:{west:20,east:24,south:-35,north:-32},selected:['chosen'],initial:[chosen]});
 x.showAllQuotePartners();assert.equal(x.state.stage,'directory');assert.equal(x.state.location,'');
 assert.equal(x.state.requests[0],'/api/partners?type=dealer');
 x.pending.shift()([{userId:'other'}]);await new Promise(setImmediate);assert.deepEqual(x.state.partners.map(p=>p.userId),['chosen','other']);
});
test('a late search response cannot replace newer directory results',async()=>{
 const x=fixture(),a=x.loadQuotePartners('replacement_quote','old'),b=x.loadQuotePartners('replacement_quote','new');
 x.pending[1]([{userId:'new'}]);await b;x.pending[0]([{userId:'old'}]);await a;assert.equal(x.state.partners[0].userId,'new');
});
test('partner picker uses a directory without loading either map provider',()=>{
 assert.doesNotMatch(client,/GoogleDirectoryMap|setupQuoteMap|quoteLeafletMapRef|Business locations map|Expand partner map/);
 assert.match(client,/Browse all businesses/);assert.match(client,/directoryStyles\.layout/);
});
