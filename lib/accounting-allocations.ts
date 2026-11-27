import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { createMyInvoice } from './my-invoices';
import { costCategory } from './cost-categories';

export type AllocationDetails = {
  supplier: string;
  invoice: string;
  date: string;
  description: string;
  category: string;
  total: number;
  vat?: number | null;
};

export type Allocation = AllocationDetails & { id: string; provider: string; version: number; suggestedAsset: string | null; needsCategory: boolean };
export type ImportSource = { provider: string; company: string; bill: string; line: string };

const fields = `id, provider, version, supplier, invoice, to_char(invoice_date,'YYYY-MM-DD') as date,
  description, category, total::float8 as total, vat::float8 as vat, suggested_asset::text as "suggestedAsset", needs_category as "needsCategory"`;
let ready: Promise<void> | undefined;
async function ensureTable() {
  ready ??= getDb().query(`create table if not exists public.accounting_cost_imports (
    id uuid primary key default gen_random_uuid(),
    owner_id text not null references public."user"(id) on delete cascade,
    provider text not null, company text not null, bill_key text not null, line_key text not null,
    supplier text not null, invoice text not null, invoice_date date not null,
    description text not null, category text not null, total numeric(15,2) not null check(total > 0),
    suggested_asset uuid, needs_category boolean not null default false,
    vat numeric(15,2) check(vat >= 0 and vat <= total),
    state text not null default 'pending' check(state in ('pending','posted','deleted')),
    version integer not null default 1,
    unique(owner_id,provider,company,bill_key,line_key)
  )`).then(() => undefined).catch(error => { ready = undefined; throw error; });
  return ready;
}

function values(d: AllocationDetails) {
  if (!Number.isFinite(d.total) || d.total <= 0 || d.total > 9999999999999 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !costCategory(d.category)) throw new Error('Check the date, category and amount.');
  if (d.vat != null && (!Number.isFinite(d.vat) || d.vat < 0 || d.vat > d.total)) throw new Error('Check the VAT amount.');
  if (!d.supplier.trim() || !d.invoice.trim()) throw new Error('Enter the supplier and invoice number.');
  return [d.supplier.trim().slice(0,180), d.invoice.trim().slice(0,120), d.date,
    d.description.trim().slice(0,5000), d.category, d.total, d.vat ?? null];
}

export async function listAllocations(owner: string) {
  await ensureTable();
  return (await getDb().query<Allocation>(`select ${fields} from public.accounting_cost_imports
    where owner_id=$1 and state='pending' order by invoice_date desc,id`,[owner])).rows;
}

export async function editAllocation(owner: string, id: string, version: number, details: AllocationDetails) {
  await ensureTable();
  const r = await getDb().query(`update public.accounting_cost_imports set supplier=$4, invoice=$5,
    invoice_date=$6, description=$7, category=$8, total=$9, vat=$10, needs_category=false, version=version+1
    where owner_id=$1 and id=$2 and version=$3 and state='pending'`,[owner,id,version,...values(details)]);
  if (!r.rowCount) throw new Error('This cost has changed. Reopen the allocation list.');
}

export async function dismissAllocation(owner: string, id: string, version: number) {
  await ensureTable();
  const r = await getDb().query(`update public.accounting_cost_imports set state='deleted',version=version+1
    where owner_id=$1 and id=$2 and version=$3 and state='pending'`,[owner,id,version]);
  if (!r.rowCount) throw new Error('This cost has changed. Reopen the allocation list.');
}

export async function postAllocation(owner: string, id: string, version: number, assetId: string, category?: string) {
  await ensureTable();
  const item = (await getDb().query<Allocation>(`select ${fields} from public.accounting_cost_imports
    where id=$1 and owner_id=$2 and state='pending' and version=$3`,[id,owner,version])).rows[0];
  if (!item) throw new Error('This cost has changed. Reopen the allocation list.');
  if (item.needsCategory && !costCategory(category)) throw new Error('Choose a cost category.');
  await createMyInvoice(owner,{
    captureRequestId:id,assetId,source:'automatic',supplierName:item.supplier,invoiceNumber:item.invoice,
    invoiceDate:item.date,totalIncVat:item.total,vatAmount:item.vat,costCategory:item.needsCategory ? category : item.category,notes:item.description,
  }, {displayName:item.provider}, {
    before: async client => {
      const locked = await client.query(`select id from public.accounting_cost_imports
        where id=$1 and owner_id=$2 and version=$3 and state='pending' for update`,[id,owner,version]);
      if (!locked.rowCount) throw new Error('This cost has changed. Reopen the allocation list.');
      const asset = await client.query(`select id from public.asset_register_items where id=$1 and user_id=$2 for share`,[assetId,owner]);
      if (!asset.rowCount) throw new Error('Choose an asset in your register.');
    },
    after: async client => {
      await client.query("update public.accounting_cost_imports set state='posted',version=version+1 where id=$1 and owner_id=$2",[id,owner]);
    },
  });
}

export async function importAccountingLine(owner: string, source: ImportSource, details: AllocationDetails, assetId: string | null, needsCategory = false) {
  await ensureTable();
  if (![source.company,source.bill,source.line].every(value => value && value.length <= 500)) throw new Error('This line needs a stable invoice and line reference.');
  const params=[owner,source.provider,source.company,source.bill,source.line,...values(details)];
  const id=randomUUID();
  const insert = `insert into public.accounting_cost_imports
    (owner_id,provider,company,bill_key,line_key,supplier,invoice,invoice_date,description,category,total,vat,id,state,suggested_asset,needs_category)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    on conflict(owner_id,provider,company,bill_key,line_key) do nothing returning id`;
  if (!assetId || needsCategory) {
    const r=await getDb().query(insert,[...params,id,'pending',assetId,needsCategory]);
    return r.rowCount ? 'Added to Needs approval for allocation.' : 'This line has already been imported.';
  }
  // Reserve the provider line and write the ledger cost in the same transaction.
  // A second import or failure cannot leave an unallocated copy of a matched line.
  const duplicate = new Error('Already imported');
  try {
    await createMyInvoice(owner,{
      assetId,captureRequestId:id,source:'automatic',supplierName:details.supplier,
      invoiceNumber:details.invoice,invoiceDate:details.date,totalIncVat:details.total,vatAmount:details.vat,
      costCategory:details.category,notes:details.description,
    },{displayName:source.provider},{
      before:async client=>{
        const r=await client.query(insert,[...params,id,'posted',assetId,false]);
        if (!r.rowCount) throw duplicate;
      },
      after:async()=>{},
    });
  } catch(error) {
    if (error===duplicate) return 'This line has already been imported.';
    throw error;
  }
  return 'Saved to the Cost Ledger.';
}
