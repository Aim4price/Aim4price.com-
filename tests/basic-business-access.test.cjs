const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
function load(file, mocks) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports',code)(id => { if (!(id in mocks)) throw Error('Missing mock '+id); return mocks[id]; },exports);
  return exports;
}
test('Business sessions require explicit endpoint opt-in and current verification', async () => {
  let verified = true, activeFullAccount = false, realm = null;
  const user = {id:'business-1',email:'business@example.test',emailVerified:true};
  const session = {user};
  const mod = load('lib/auth-session.ts', {
    './retired-workspaces': load('lib/retired-workspaces.ts', {}),
    './app-realm-server':{currentAppRealm:async()=>realm},
    'next/headers':{cookies:async()=>({get:()=>undefined}),headers:async()=>new Headers()},
    './account-constants':{isAim4priceAdminEmail:()=>false},
    './account-profile':{isAccountActive:async()=>activeFullAccount,markAccountLastActive:async()=>false},
    './admin-usage-events':{}, './auth':{auth:{api:{getSession:async()=>session}}}, './db':{},
    './dealer-app-session':{getDealerAppSession:async()=>null}, './owner-app-session':{},
    './business-accounts':{canBusinessContribute:async u=>u.id===user.id&&verified},
  });
  assert.equal(await mod.getServerSession(),null,'Stock and full-account APIs remain closed');
  assert.equal(await mod.getServerSession({allowBusiness:true}),session);
  verified=false;
  assert.equal(await mod.getServerSession({allowBusiness:true}),null,'Revoked verification blocks access');
  assert.equal(await mod.getServerSession({requireActive:false}),session,'Verification form remains accessible');
  verified=true; realm='dealer';
  assert.equal(await mod.getServerSession({allowBusiness:true}),null,'Website permission cannot bypass an app realm');
  realm=null; activeFullAccount=true;
  assert.equal(await mod.getServerSession(),session,'Existing full accounts remain supported');
  user.email = 'Accounting@aim4price.com';
  assert.equal(await mod.getAnyServerSession(), session, 'Released specialist email can belong to a normal account');
  assert.equal(await mod.getServerSession({ requireActive:false, allowBusiness:true, authSession:session }), session);
  user.email = 'normal@example.com'; user.id = 'aim4price-assistance-finance';
  assert.equal(await mod.getAnyServerSession(), null);
});
test('Business page access preserves approval, suspension and full-account boundaries',async()=>{
  let status='active',verified=true;
  const session={user:{id:'business-1'}};
  const mod=load('lib/account-access.ts',{
    'next/navigation':{redirect:path=>{throw Error(path);}},
    './account-constants':{accountStatusLabel:s=>s,isAim4priceAdminEmail:()=>false},
    './account-profile':{getAccountProfile:async()=>({accountType:'business'}),getAccountStatusForUser:async()=>status},
    './auth-session':{getAnyServerSession:async()=>session},
    './business-accounts':{canBusinessContribute:async()=>verified},
  });
  await assert.rejects(mod.requireActivePageAccess(),/\/business/);
  await assert.rejects(mod.requireActivePageAccess({allowBusiness:true}),/\/business/,'Free Business accounts cannot enter Desktop Leads');
  verified=false;
  await assert.rejects(mod.requireActivePageAccess({allowBusiness:true}),/\/business/);
  status='suspended';
  await assert.rejects(mod.requireActivePageAccess({allowBusiness:true}),/\/pending-payment/);
});
test('Partner setup does not reclassify Business accounts on repeated runs',async()=>{
  const pg=new PGlite();
  try{
    await pg.exec("CREATE TABLE account_profiles(account_type text,account_subtype text); INSERT INTO account_profiles VALUES ('business','contributor'),('business','insurance-broker'),('bank','bank'),('dealer','machinery-dealer');");
    const source=fs.readFileSync('lib/partner-access.ts','utf8');
    const migrations=[...source.matchAll(/await db.query\(`([\s\S]*?)`\)/g)].map(m=>m[1]).filter(sql=>sql.includes('update account_profiles')&&(sql.includes('set account_type = case')||sql.includes("set account_type = 'insurance'")));
    assert.equal(migrations.length,2);
    for(let pass=0;pass<2;pass++)for(const sql of migrations)await pg.exec(sql);
    assert.deepEqual((await pg.query('SELECT account_type FROM account_profiles ORDER BY account_type')).rows.map(r=>r.account_type),['business','business','dealer','finance']);
  }finally{await pg.close();}
});
