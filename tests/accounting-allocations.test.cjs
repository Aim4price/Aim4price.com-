const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');

test('matched lines post once and unassigned lines stay outside totals until allocated',async()=>{
  const pg=new PGlite();
  try {
    await pg.exec(`create table "user"(id text primary key); insert into "user" values ('owner'),('other');
      create table asset_register_items(id uuid primary key,user_id text);
      insert into asset_register_items values('10000000-0000-4000-8000-000000000001','owner');
      create table ledger(id uuid primary key,total numeric,asset_id uuid);`);
    const db={query:async(sql,args)=>{const r=await pg.query(sql,args);return {...r,rowCount:r.affectedRows||r.rows.length};}};
    let fail=false;
    const createMyInvoice=async(owner,draft,actor,tx)=>{
      const owned=await db.query('select id from asset_register_items where id=$1 and user_id=$2',[draft.assetId,owner]);
      if (!owned.rowCount) throw Error('asset');
      await pg.exec('begin');
      try {
        await tx.before(db);
        if(fail)throw Error('interrupted');
        await db.query('insert into ledger values($1,$2,$3)',[draft.captureRequestId,draft.totalIncVat,draft.assetId]);
        await tx.after(db,draft.captureRequestId);
        await pg.exec('commit');
      } catch(e) {await pg.exec('rollback');throw e;}
    };
    const mocks={'./db':{getDb:()=>db},'./cost-categories':{costCategory:k=>k==='repair'},'./my-invoices':{createMyInvoice}};
    const service={};
    const code=ts.transpileModule(fs.readFileSync('lib/accounting-allocations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','exports',code)(n=>mocks[n]??require(n),service);
    const asset='10000000-0000-4000-8000-000000000001';
    const source={provider:'Sage',company:'farm',bill:'1',line:'one'};
    const details={supplier:'Workshop',invoice:'A',date:'2026-11-27',description:'Repair',total:120,category:'repair'};
    const add=(line,linked)=>service.importAccountingLine('owner',{...source,line},details,linked);
    const pending=()=>service.listAllocations('owner');
    const amounts=async()=>(await db.query('select total::integer from ledger order by total')).rows.map(r=>r.total);
    fail=true;await assert.rejects(add('matched',asset));fail=false;
    await add('matched',asset);await add('matched',asset);
    assert.deepEqual(await amounts(),[120]);assert.equal((await pending()).length,0);
    await add('unmatched',null);await add('unmatched',null);
    const [row]=await pending();assert.equal((await pending()).length,1);assert.deepEqual(await amounts(),[120]);
    await assert.rejects(service.editAllocation('other',row.id,1,details));
    await service.editAllocation('owner',row.id,1,{...details,total:150});
    await assert.rejects(service.postAllocation('owner',row.id,1,asset));
    fail=true;await assert.rejects(service.postAllocation('owner',row.id,2,asset));fail=false;
    assert.equal((await pending())[0].total,150);
    await service.postAllocation('owner',row.id,2,asset);
    await add('unmatched',asset);assert.deepEqual(await amounts(),[120,150]);
    await add('dismiss',null);const [del]=await pending();await service.dismissAllocation('owner',del.id,1);
    await add('dismiss',asset);assert.equal((await pending()).length,0);assert.deepEqual(await amounts(),[120,150]);
    await service.importAccountingLine('owner',{...source,line:'uncategorised'},{...details,vat:15},asset,true);
    const [uncategorised]=await pending();
    assert.equal(uncategorised.suggestedAsset,asset);
    assert.equal(uncategorised.vat,15);
    await assert.rejects(service.postAllocation('owner',uncategorised.id,1,asset),/category/);
    await service.postAllocation('owner',uncategorised.id,1,asset,'repair');
    assert.equal((await pending()).length,0);
    assert.deepEqual(await amounts(),[120,120,150]);
    await pg.exec(`create table sage_za_connections(owner_id text,connection_id uuid,company_id integer,sync_register text);
      insert into sage_za_connections values('owner','30000000-0000-4000-8000-000000000001',17,'selected')`);
    const connected = '30000000-0000-4000-8000-000000000001';
    const sync = (line,assetId)=>service.importAccountingLine('owner',{...source,company:'17',line},
      details,assetId,false,connected);
    await sync('paid',asset); await sync('paid',asset);
    await sync('unallocated',null);
    assert.equal((await pending()).length,1);
    await pg.exec('delete from sage_za_connections');
    await sync('after-disconnect',asset); await sync('unmatched-after-disconnect',null);
    assert.equal((await pending()).length,1);
    assert.deepEqual(await amounts(),[120,120,120,150]);
  }finally{await pg.close();}
});
