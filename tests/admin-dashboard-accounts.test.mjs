import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

test('dashboard counts Business and Middleman separately from Owners and Dealers', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE "user" (id text PRIMARY KEY, email text, "createdAt" timestamptz); CREATE TABLE account_profiles(user_id text, account_type text, account_subtype text)');
    for (const [id,type,subtype] of [['o','owner','farmer'],['b','business','contributor'],['d','dealer','machinery-dealer'],['m','dealer','equipment-middleman'],['a','owner','farmer']]) {
      await db.query('INSERT INTO "user" VALUES ($1,$2,now())',[id,id==='a'?'aim4price@gmail.com':id+'@example.test']);
      await db.query('INSERT INTO account_profiles VALUES ($1,$2,$3)',[id,type,subtype]);
    }
    const code=ts.transpileModule(readFileSync(new URL('../lib/admin-dashboard.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const module={exports:{}};
    Function('require','module','exports',code)(name=>name==='./db'?{getDb:()=>db}:name==='./account-constants'?{AIM4PRICE_ADMIN_EMAIL:'aim4price@gmail.com'}:{},module,module.exports);
    for(const type of ['owner','dealer','middleman','business']) {
      const result=await module.exports.countAccountsByType(type);
      assert.equal(result.month,1,type);
      assert.equal(result.year,1,type);
    }
    assert.equal((await module.exports.countAccountsByType()).year,4,'Admin is excluded');
  } finally { await db.close(); }
});
