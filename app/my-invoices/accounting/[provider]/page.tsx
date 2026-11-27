import ImportLine from '../../allocations/ImportLine';
import { importProviderLine } from '../../allocations/provider-import';
import { categoryForLine } from '../../../../lib/accounting-serial';
import Link from 'next/link';
import AppHeader from '../../../../components/AppHeader';
import { cloudOwner,current,validGrant } from '../../../../lib/accounting-connection';
import { names,companies,latestBills,cloudPath,type Company,type BillLine } from '../../../../lib/accounting-cloud';
import { listAllOwnerAppAssets } from '../../../../lib/owner-app-assets';
import { assetForLine } from '../../../../lib/accounting-serial';
import { start,choose,unlink } from './actions';
import styles from '../../sage-za/sage.module.css';

export const dynamic='force-dynamic';
export default async function ProviderPage({params,searchParams}:{params:{provider:string};searchParams?:{preview?:string;error?:string}}) {
  const ctx=await cloudOwner(params.provider);
  const p=ctx.config.provider;
  const row=await current(ctx);
  let options:Company[]=[];
  let lines:(BillLine & {asset:string})[]|undefined;
  let error=Boolean(searchParams?.error);
  try {
    if(row && !row.company_id) options=await companies(ctx.config,await validGrant(ctx,row.id));
    if(row?.company_id && searchParams?.preview==='1') {
      const bills=await latestBills(ctx.config,await validGrant(ctx,row.id),row.company_id);
      const {items}=await listAllOwnerAppAssets(ctx.owner);
      lines=bills.map(line=>({...line,asset:assetForLine(line.description,items)||'Asset unassigned'}));
    }
  } catch {error=true;}
  return <><AppHeader active="account"/><main className={styles.panel}>
    <Link href="/account/accounting">Accounting connections</Link><h1><img src={`/accounting/${p === "intacct" ? "sage" : p}.svg`} alt="" />{names[p]}</h1>
    {error && <p role="alert">The request failed. Retry or disconnect and sign in again.</p>}
    {!row ? <form action={start.bind(null,p)}><button>Connect {names[p]}</button></form> : <>
      {row.company_id ? <><h2>{row.company_name}</h2><Link prefetch={false} href={cloudPath(p)+'?preview=1'}>Preview supplier bills</Link></>
        : <><h2>Choose your company</h2>{!options.length && !error && <p>No companies available.</p>}
          {options.map(o=><form key={o.id} action={choose.bind(null,p,row.id)}><button value={o.id} name="company">{o.name}</button></form>)}</>}
      {lines && <section><h2>Supplier bill preview</h2><p>Source line amounts in the bill currency. VAT treatment follows the original bill.</p>
        {lines.length ? <ul>{lines.map((l,i)=><li key={i}><strong>{l.asset}</strong> · {categoryForLine(l.description) ?? 'Uncategorised'}<br/>{l.supplier} · {l.invoice}<br/>{l.description} · {l.currency} {l.amount?.toFixed(2)??'Amount unavailable'}{p!=='intacct' && row.company_id && <ImportLine line={l} submitLine={importProviderLine.bind(null,p,row.company_id,l.billKey || '',l.lineKey || '')}/>}</li>)}</ul> : <p>No supplier bill lines found.</p>}</section>}
      <form action={unlink.bind(null,p,row.id)}><button>Disconnect</button></form>
    </>}
  </main></>;
}
