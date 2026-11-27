import ImportLine from '../allocations/ImportLine';
import { sageBillLines, importProviderLine } from '../allocations/provider-import';
import type { BillLine } from '../../../lib/accounting-cloud';
import { categoryForLine } from '../../../lib/accounting-serial';
import Link from 'next/link';
import AppHeader from '../../../components/AppHeader';
import { listAllOwnerAppAssets } from '../../../lib/owner-app-assets';
import { assetForSageLine, sageCompanies, sagePage, sageRead } from '../../../lib/sage-za-api';
import { accessGrant, connection, sageOwner } from '../../../lib/sage-za-connection';
import { chooseSage, removeSage, startSage } from './actions';
import styles from './sage.module.css';

export const dynamic = 'force-dynamic';

export default async function SagePage({searchParams}: {searchParams?: {preview?: string; error?: string}}) {
  const ctx = await sageOwner();
  const current = await connection(ctx.owner);
  let companies: {id: number; name: string}[] = [];
  let preview: (BillLine & {asset:string})[] | undefined;
  let failed = Boolean(searchParams?.error);
  try {
    if (current && !current.company_id) {
      companies = await sageCompanies(ctx.config, await accessGrant(ctx, current.connection_id));
    } else if (current?.company_id && searchParams?.preview === '1') {
      const access = await accessGrant(ctx, current.connection_id);
      const {rows} = await sageRead(ctx.config, access, 'SupplierInvoice/Get', current.company_id);
      const {items} = await listAllOwnerAppAssets(ctx.owner);
      preview = sageBillLines(rows).map(line=>({...line,asset:assetForSageLine(line.description,items)||'Asset unassigned'}));
    }
  } catch {
    failed = true;
  }
  return <><AppHeader active="account"/><main className={styles.panel}>
    <Link href="/account/accounting">Accounting connections</Link>
    <h1><img src="/accounting/sage.svg" alt="" />Sage Accounting South Africa</h1>
    {failed && <p role="alert">Sage could not complete the request. Try again or reconnect your account.</p>}
    {!current ? <form action={startSage}><p>Connect your company to preview supplier costs by asset serial number.</p><button>Connect Sage</button></form>
      : <>
        {current.company_id ? <><h2>{current.company_name}</h2><p>Connected</p>
          <Link href={sagePage + '?preview=1'} prefetch={false}>Preview latest 10 supplier bills</Link></>
          : <><h2>Choose your Sage company</h2>{companies.length ? companies.map(company =>
            <form key={company.id} action={chooseSage}><input type="hidden" name="connection" value={current.connection_id}/>
              <button name="company" value={company.id}>{company.name} (#{company.id})</button></form>)
            : !failed && <p>No companies available to this Sage account.</p>}</>}
        {preview && <section><h2>Supplier bill lines</h2><p>Amounts exclude VAT and use the bill currency.</p>
          {preview.length ? <ul>{preview.map((line,index) => <li key={index}><strong>{line.asset}</strong> · {categoryForLine(line.description) ?? 'Uncategorised'}<br/>
            {line.supplier} · {line.invoice}<br/>{line.description} · {line.amount?.toFixed(2) ?? 'Amount unavailable'} excl. VAT{current.company_id && <ImportLine line={line} submitLine={importProviderLine.bind(null,'sage-za',String(current.company_id),line.billKey || '',line.lineKey || '')}/>}</li>)}</ul> : <p>No supplier bill lines found.</p>}</section>}
        <form action={removeSage}><input type="hidden" name="connection" value={current.connection_id}/><button>Disconnect Sage</button></form>
      </>}
  </main></>;
}
