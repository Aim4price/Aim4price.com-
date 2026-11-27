import type { BillLine } from '../../../lib/accounting-cloud';
import { names, latestBills } from '../../../lib/accounting-cloud';
import { cloudOwner,current,validGrant } from '../../../lib/accounting-connection';
import { sageOwner,accessGrant,connection } from '../../../lib/sage-za-connection';
import { sageRead } from '../../../lib/sage-za-api';
import { listAllOwnerAppAssets } from '../../../lib/owner-app-assets';
import { matchedAccountingAsset,categoryForLine } from '../../../lib/accounting-serial';
import { costCategories } from '../../../lib/cost-categories';
import { importAccountingLine } from '../../../lib/accounting-allocations';

export function sageBillLines(bills:Record<string,unknown>[]):BillLine[] {
  return bills.flatMap(bill => {
    if (!Array.isArray(bill.Lines)) throw new Error('Missing Sage bill detail.');
    return bill.Lines.map(line=>({
      billKey:String(bill.ID ?? ''),lineKey:String(line.ID ?? ''),date:String(bill.Date ?? '').slice(0,10),
      supplier:String(bill.SupplierName ?? ''),invoice:String(bill.DocumentNumber || bill.ID),
      description:String(line.Description ?? ''),amount:typeof line.Exclusive==='number'?line.Exclusive:null,
      vatZar:bill.CurrencyCode==='ZAR' && typeof line.Tax==='number'?line.Tax:undefined,
      currency:String(bill.CurrencyCode ?? ''),grossZar:bill.CurrencyCode==='ZAR' && typeof line.Inclusive==='number'?line.Inclusive:undefined,
    }));
  });
}

export async function importProviderLine(provider:string, company:string, bill:string, lineId:string, form:FormData) {
  'use server';
  let owner:string, label:string, lines:BillLine[];
  if (provider==='sage-za') {
    const ctx=await sageOwner();
    const row=await connection(ctx.owner);
    if (!row?.company_id || String(row.company_id)!==company) throw new Error('Connection changed.');
    const page=await sageRead(ctx.config,await accessGrant(ctx,row.connection_id),'SupplierInvoice/Get',row.company_id);
    owner=ctx.owner; label='Sage Accounting SA'; lines=sageBillLines(page.rows);
  } else {
    if (provider==='intacct') throw new Error('Intacct imports require a stable company reference.');
    const ctx=await cloudOwner(provider);
    const row=await current(ctx);
    if (!row?.company_id || row.company_id!==company) throw new Error('Connection changed.');
    owner=ctx.owner; label=names[ctx.config.provider]; lines=await latestBills(ctx.config,await validGrant(ctx,row.id),company);
  }
  const matches=lines.filter(l=>l.billKey===bill && l.lineKey===lineId);
  if (matches.length!==1) throw new Error('Refresh the bill preview.');
  const line=matches[0];
  if (line.amount != null && line.amount <= 0) throw new Error('Only positive costs can be imported.');
  const {items}=await listAllOwnerAppAssets(owner);
  const asset=matchedAccountingAsset(line.description,items);
  const category=costCategories.find(c=>c.label===categoryForLine(line.description))?.value;
  return importAccountingLine(owner,{provider:label,company,bill,line:lineId},{
    supplier:String(form.get('supplier') ?? ''),invoice:line.invoice,description:line.description,
    vat:form.get('vat') ? Number(form.get('vat')) : null,
    date:String(form.get('date') ?? ''),total:Number(form.get('total')),category:category ?? 'other',
  },asset?.id ?? null,!category);
}
