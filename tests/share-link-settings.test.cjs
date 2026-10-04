const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const {NextRequest}=require('next/server');
function load(file,mocks){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{if(name in mocks)return mocks[name];throw Error(name);},exports);return exports;}
test('owner can edit a live link in place, preserving recipient and non-editable policies',async()=>{
 const pg=new PGlite();
 try {
  await pg.exec('CREATE TABLE asset_share_links(token text,user_id text,revoked_at timestamptz,history_deleted_at timestamptz,lead_details jsonb)');
  const token='a'.repeat(43),revoked='b'.repeat(43),deleted='c'.repeat(43);
  const details={recipientEmail:'recipient@example.test',accessMode:'signed-in',permissions:{addPhotos:true,reports:true,documents:true,directUpdates:false,allReports:false}};
  await pg.query('INSERT INTO asset_share_links VALUES($1,$2,NULL,NULL,$3)',[token,'owner',details]);
  await pg.query('INSERT INTO asset_share_links VALUES($1,$2,now(),NULL,$3),($4,$2,NULL,now(),$3)',[revoked,'owner',details,deleted]);
  let session={user:{id:'owner'}};
  const route=load('app/api/asset-share-links/history/route.ts',{
   'next/server':require('next/server'),
   '../../../../lib/auth-session':{getServerSession:async()=>session},
   '../../../../lib/asset-register-account-access':{getAssetRegisterAccountAccess:async()=>true},
   '../../../../lib/guest-lead-schema':{ensureGuestLeadSchema:async()=>{}},
   '../../../../lib/db':{getDb:()=>pg},
   '../../../../lib/asset-share-snapshot':{parseShareAssetIds:()=>[]},
   '../../../../lib/business-network-api':{businessBody:r=>r.json(),requireBusinessOrigin:r=>{if(r.headers.get('origin')!=='https://aim4price.test')throw Error('origin');}},
   '../../../../lib/external-share-permissions':load('lib/external-share-permissions.ts',{}),
  });
  const call=(input,origin='https://aim4price.test')=>route.PATCH(new NextRequest('https://aim4price.test/api/asset-share-links/history',{method:'PATCH',headers:{origin},body:JSON.stringify(input)}));
  const input={token,permissions:{addPhotos:false,addCosts:true,directUpdates:true,reports:false,documents:false,allReports:true}};
  session=null;assert.equal((await call(input)).status,403);
  session={user:{id:'other'}};assert.equal((await call(input)).status,409);
  session={user:{id:'owner'}};assert.equal((await call(input,'https://evil.test')).status,400);
  assert.equal((await call({...input,token:revoked})).status,409);
  assert.equal((await call({...input,token:deleted})).status,409);
  assert.equal((await call({...input,token:'invalid'})).status,400);
  assert.equal((await call({...input,permissions:[]})).status,400);
  const response=await call(input);assert.equal(response.status,200);
  const saved=(await pg.query('SELECT * FROM asset_share_links WHERE token=$1',[token])).rows[0];
  assert.equal(saved.token,token);assert.equal(saved.lead_details.recipientEmail,details.recipientEmail);
  assert.equal(saved.lead_details.accessMode,'signed-in');
  assert.deepEqual(Object.fromEntries(['addPhotos','addCosts','reports','documents','directUpdates','allReports'].map(k=>[k,saved.lead_details.permissions[k]])),{addPhotos:false,addCosts:true,reports:true,documents:true,directUpdates:false,allReports:false});
  assert.equal((await response.json()).permissions.addCosts,true);
 } finally {await pg.close();}
});
