import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file,deps={}){const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};Function('require','module','exports',code)(id=>id in deps?deps[id]:require(id),m,m.exports);return m.exports;}
const policy=load('lib/tutorial-video-policy.ts');
const content=load('app/tutorials/tutorial-content.ts');
const catalogue=load('lib/tutorial-catalogue.ts',{'../app/tutorials/tutorial-content':content});
test('video ranges support seeking and suffixes, reject malformed and unsatisfiable ranges',()=>{
 assert.deepEqual(policy.videoByteRange('bytes=20-49',100),{start:20,end:49});
 assert.deepEqual(policy.videoByteRange('bytes=80-',100),{start:80,end:99});
 assert.deepEqual(policy.videoByteRange('bytes=-10',100),{start:90,end:99});
 assert.deepEqual(policy.videoByteRange('bytes=0-200',100),{start:0,end:99});
 for(const value of ['bytes=100-','bytes=80-20','bytes=0-1,4-5','bytes=-0','bytes=','invalid'])assert.equal(policy.videoByteRange(value,100),null);
});
test('upload detection checks file bytes rather than trusting a file extension',()=>{
 assert.equal(policy.tutorialVideoType(Buffer.from('0000ftypisom')),'video/mp4');
 assert.equal(policy.tutorialVideoType(Buffer.from([0x1a,0x45,0xdf,0xa3])),'video/webm');
 assert.equal(policy.tutorialVideoType(Buffer.from('<script>alert(1)</script>')),null);
});
test('all audiences have unique addressable topics and local destinations',()=>{
 for(const group of Object.values(catalogue.tutorialCatalogue)){
  assert.equal(new Set(group.features.map(f=>f.id)).size,group.features.length);
  for(const f of group.features){assert.ok(f.steps.length>=3);assert.ok(f.example);assert.ok(f.guideTitle);assert.ok(f.href.startsWith('/')&&!f.href.startsWith('//'));}
 }
});
function service(){
 let state={draft_id:null,published_id:null,revision:0},saved;let fileCount=0;
 const client={release(){},async query(sql,args=[]){
  if(sql==='BEGIN')saved={...state};
  if(sql==='ROLLBACK')state=saved;
  if(sql.startsWith('SELECT * FROM tutorial_video_slots'))return {rows:[{...state}]};
  if(sql.startsWith('INSERT INTO tutorial_video_files'))fileCount++;
  if(sql.startsWith('UPDATE tutorial_video_slots'))state={draft_id:args[2],published_id:args[3],revision:state.revision+1};
  return {rows:[]};
 }};
 const api=load('lib/tutorial-videos.ts',{'./db':{getDb:()=>({query:async()=>({rows:[]}),connect:async()=>client})},'./tutorial-catalogue':catalogue,'./tutorial-video-policy':policy});
 return {api,state:()=>state,fileCount:()=>fileCount};
}
test('replacement upload preserves published video until explicitly published; unpublish retains a draft',async()=>{
 const s=service(),base={audience:'owners',feature:'welcome',actor:'admin'};
 await s.api.saveTutorialVideo({...base,revision:0,action:'upload',bytes:Buffer.from('0000ftypisom'),name:'intro.mp4'});
 const first=s.state().draft_id;assert.ok(first);assert.equal(s.state().published_id,null);
 await s.api.saveTutorialVideo({...base,revision:1,action:'publish',draftId:first});
 await s.api.saveTutorialVideo({...base,revision:2,action:'upload',bytes:Buffer.from('0000ftypisom')});
 assert.equal(s.state().published_id,first);const replacement=s.state().draft_id;
 await assert.rejects(s.api.saveTutorialVideo({...base,revision:3,action:'publish',draftId:first}),/Preview/);
 assert.equal(s.state().published_id,first);
 await s.api.saveTutorialVideo({...base,revision:3,action:'publish',draftId:replacement});
 assert.equal(s.state().published_id,replacement);
 await s.api.saveTutorialVideo({...base,revision:4,action:'unpublish'});
 assert.equal(s.state().published_id,null);assert.equal(s.state().draft_id,replacement);
});
test('stale updates, unknown slots and invalid uploads cannot replace saved state',async()=>{
 const s=service(),base={audience:'dealers',feature:'welcome',actor:'admin',action:'upload',bytes:Buffer.from('0000ftypisom')};
 await s.api.saveTutorialVideo({...base,revision:0});const before={...s.state()};
 await assert.rejects(s.api.saveTutorialVideo({...base,revision:0}),/another session/);
 await assert.rejects(s.api.saveTutorialVideo({...base,revision:1,feature:'missing'}),/valid video/);
 await assert.rejects(s.api.saveTutorialVideo({...base,revision:1,bytes:Buffer.from('bad')}),/MP4/);
 assert.deepEqual(s.state(),before);assert.equal(s.fileCount(),1);
});
test('admin API rejects unauthenticated and cross-origin requests before reading upload bodies',async()=>{
 let touched=false,allowed=false;
 const route=load('app/api/admin/videos/route.ts',{'../../../../lib/admin-api-access':{requireAdminApiAccess:async()=>allowed?{ok:true,actor:{userId:'admin'}}:{ok:false,response:new Response(null,{status:401})}},'../../../../lib/trusted-request-origin':{isTrustedRequestOrigin:()=>false},'../../../../lib/tutorial-videos':{},'../../../../lib/tutorial-video-policy':policy});
 const request={headers:new Headers({origin:'https://evil.test'}),nextUrl:new URL('https://www.aim4price.com/api/admin/videos'),get body(){touched=true;return null;}};
 assert.equal((await route.POST(request)).status,401);allowed=true;assert.equal((await route.POST(request)).status,403);assert.equal(touched,false);
});
test('media route denies anonymous access before consulting storage',async()=>{
 const route=load('app/api/tutorial-videos/[id]/route.ts',{'../../../../lib/auth-session':{getAnyServerSession:async()=>null},'../../../../lib/account-constants':{isAim4priceAdminEmail:()=>false},'../../../../lib/tutorial-preview-access':{canViewTutorialPreview:()=>false},'../../../../lib/tutorial-videos':{ensureTutorialVideos:()=>{throw Error('storage touched');}},'../../../../lib/db':{},'../../../../lib/tutorial-video-policy':policy});
 assert.equal((await route.GET({}, {params:{id:'x'}})).status,401);
});
