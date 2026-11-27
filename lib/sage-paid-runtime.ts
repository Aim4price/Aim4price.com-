import { sageConfig, sageHomeCurrency, sageRead, type SageConfig } from './sage-za-api';
import { accessGrant, sageDatabase } from './sage-za-connection';
import { listAllOwnerAppAssets } from './owner-app-assets';
import { paidBillCosts } from './sage-paid-bills';
import { importAccountingLine } from './accounting-allocations';

type Connection = {owner_id:string; connection_id:string; company_id:number; sync_register:string; since:string; sync_offset:number};

async function syncPage(config:SageConfig, row:Connection) {
  const db = await sageDatabase();
  const access = await accessGrant({owner:row.owner_id,config},row.connection_id);
  const page = await sageRead(config,access,'SupplierInvoice/Get',row.company_id,row.sync_offset,row.since);
  const randIds = new Set<number>();
  for (let offset=0; page.rows.length; ) {
    const currencies = await sageRead(config,access,'Currency/Get',row.company_id,offset);
    for (const c of currencies.rows) if (c.Code==='ZAR' && typeof c.ID==='number') randIds.add(c.ID);
    offset += currencies.rows.length;
    if (offset>=currencies.total || !currencies.rows.length) break;
  }
  const homeCurrency = page.rows.some(b => b.Supplier_CurrencyId == null) ?
    await sageHomeCurrency(config,access,row.company_id) : undefined;
  const {items,registers} = await listAllOwnerAppAssets(row.owner_id);
  if (!registers.some(r=>r.id===row.sync_register)) throw Error('Register unavailable');
  const assets = items.filter(a=>a.registerId===row.sync_register);
  let incomplete = false;
  for (const bill of page.rows) {
    if (!bill.Date || String(bill.Date).slice(0,10)<row.since) continue;
    try {
      for (const cost of paidBillCosts(bill,randIds,assets,homeCurrency)) {
        await importAccountingLine(row.owner_id,{
          provider:'Sage Accounting SA',company:String(row.company_id),bill:String(bill.ID),line:cost.key,
        },cost.details,cost.assetId,false,row.connection_id);
      }
    } catch { incomplete = true; }
  }
  const next = row.sync_offset+page.rows.length;
  await db.query(`update public.sage_za_connections set sync_offset=$2,
    sync_note=case when $3 then 'Some paid bills could not be imported. Check their currency and totals in Sage.'
      when $4 then null else sync_note end where connection_id=$1`,
    [row.connection_id,next>=page.total || !page.rows.length ? 0 : next,incomplete,row.sync_offset===0]);
}

export function startPaidBillImports() {
  const config = sageConfig();
  if (!config || process.env.NODE_ENV!=='production' || process.env.NEXT_PHASE==='phase-production-build') return;
  const state = globalThis as typeof globalThis & {paidBillTimer?: ReturnType<typeof setInterval>};
  if (state.paidBillTimer) return;
  let running = false;
  const run = async () => {
    if (running) return;
    running=true;
    try {
      const db=await sageDatabase();
      const rows=await db.query<Connection>(`select owner_id,connection_id,company_id,sync_register,
        to_char(sync_from,'YYYY-MM-DD') as since,sync_offset from public.sage_za_connections
        where company_id is not null and sync_register is not null`);
      for (const row of rows.rows) {
        try { await syncPage(config,row); }
        catch { await db.query("update public.sage_za_connections set sync_note='Sage sync will retry.' where connection_id=$1",[row.connection_id]); }
      }
    } catch { console.error('Sage paid bill sync will retry'); }
    finally { running=false; }
  };
  state.paidBillTimer=setInterval(run,300000);
  state.paidBillTimer.unref();
  void run();
}
