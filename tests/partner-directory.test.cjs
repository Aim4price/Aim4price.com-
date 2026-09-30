const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const client=fs.readFileSync('app/asset-register/asset-register-client.tsx','utf8');
const start=client.indexOf('  async function loadQuotePartners('),end=client.indexOf('  function applyQuoteDirectoryFilters',start);
const code=ts.transpileModule(client.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function fixture({bounds=null,selected=[],initial=[]}={}){
 const state={partners:initial,requests:[],search:'',stage:'',location:'George'},pending=[];
 const context={quoteLocationInput:'',selectedQuoteLeadType:'replacement_quote',quotePartnerSearch:'',quoteOptionForLeadType:()=>({partnerType:'dealer'}),quoteDirectoryBoundsRef:{current:bounds},quotePartnerRequestRef:{current:0},selectedQuotePartnerIds:selected,
 setQuotePartners:v=>state.partners=typeof v==='function'?v(state.partners):v,setSelectedQuotePartnerIds:()=>{},setIsLoadingQuotePartners:()=>{},setNotice:()=>{},extractApiError:()=> 'Failed',setQuoteLocationInput:v=>state.location=v,setQuotePartnerSearch:v=>state.search=v,setDirectoryBusiness:()=>{},setQuoteDirectoryStage:v=>state.stage=v,
 fetch:(url)=>{state.requests.push(url);return new Promise(resolve=>pending.push(partners=>resolve({ok:true,json:async()=>({ok:true,partners})})));}};
 const actions=new Function(...Object.keys(context),code+';return {loadQuotePartners,showAllQuotePartners};')(...Object.values(context));return{...actions,state,pending};
}
test('directory name searches preserve area and include businesses without coordinates',async()=>{
 const x=fixture({bounds:{west:20,east:24,south:-35,north:-32}}),request=x.loadQuotePartners('replacement_quote','Workshop');
 const url=new URL(x.state.requests[0],'https://test');assert.equal(url.searchParams.get('search'),'Workshop');assert.equal(url.searchParams.get('west'),'20');
 x.pending.shift()([{userId:'no-coordinates',businessName:'Workshop'}]);await request;assert.equal(x.state.partners[0].userId,'no-coordinates');
});
test('browse all clears area while retaining selected umbrella recipients',async()=>{
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
 assert.match(client,/partner-directory-area/);assert.doesNotMatch(client,/Choose your location/);assert.match(client,/directoryStyles\.layout/);
});
test('name and area are sent independently and a new share drops previous recipients',async()=>{
 const x=fixture({selected:['previous'],initial:[{userId:'previous'}]});
 const request=x.loadQuotePartners('replacement_quote','Workshop',undefined,'George, Western Cape',false);
 const url=new URL(x.state.requests[0],'https://test');assert.equal(url.searchParams.get('search'),'Workshop');assert.equal(url.searchParams.get('area'),'George, Western Cape');
 x.pending.shift()([{userId:'new'}]);await request;assert.deepEqual(x.state.partners.map(p=>p.userId),['new']);
});
test('account directory combines parameterized area matching with business name search',async()=>{
 const source=fs.readFileSync('lib/partner-access.ts','utf8');const a=source.indexOf('export async function listPartnerDirectory('),b=source.indexOf('\nasync function getPartnerProfile',a);
 const code=ts.transpileModule(source.slice(a,b).replace('export async','async'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 let sql,params,externalInput;
 const mocks={ensurePartnerAccessTables:async()=>{},getDb:()=>({query:async(q,p)=>{sql=q;params=p;return{rows:[]};}}),asText:v=>String(v||''),mapPartnerRow:v=>v,distanceKm:()=>0,listExternalBusinesses:async input=>{externalInput=input;return[];}};
 const list=new Function(...Object.keys(mocks),code+';return listPartnerDirectory;')(...Object.values(mocks));
 await list({currentUserId:'owner',search:'Workshop',area:'George, Western Cape'});
 assert.ok(params.includes('%workshop%'));assert.ok(params.includes('%george%'));assert.ok(params.includes('%western cape%'));
 assert.match(sql,/concat_ws\(' ', town_city, province, address_line_1\)/);assert.equal(externalInput.area,'George, Western Cape');
});
