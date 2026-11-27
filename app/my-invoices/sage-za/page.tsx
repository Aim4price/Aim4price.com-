import { categoryForLine } from '../../../lib/accounting-serial';
import Link from 'next/link';
import AppHeader from '../../../components/AppHeader';
import { listAllOwnerAppAssets } from '../../../lib/owner-app-assets';
import { assetForSageLine, sageCompanies, sagePage, sageRead } from '../../../lib/sage-za-api';
import { accessGrant, connection, sageOwner } from '../../../lib/sage-za-connection';
import { enablePaidBills, chooseSage, removeSage, startSage } from './actions';
import styles from './sage.module.css';

export const dynamic = 'force-dynamic';

export default async function SagePage({searchParams}: {searchParams?: {preview?: string; error?: string}}) {
  const ctx = await sageOwner();
  const current = await connection(ctx.owner);
  const registers = current?.company_id && !current.sync_register ? await (await import('../../../lib/asset-registers')).listAssetRegisters(ctx.owner) : [];
  let companies: {id: number; name: string}[] = [];
  let preview: {supplier: string; invoice: string; description: string; amount: string; asset: string}[] | undefined;
  let failed = Boolean(searchParams?.error);
  try {
    if (current && !current.company_id) {
      companies = await sageCompanies(ctx.config, await accessGrant(ctx, current.connection_id));
    } else if (current?.company_id && searchParams?.preview === '1') {
      const access = await accessGrant(ctx, current.connection_id);
      const {rows} = await sageRead(ctx.config, access, 'SupplierInvoice/Get', current.company_id);
      const {items} = await listAllOwnerAppAssets(ctx.owner);
      preview = rows.flatMap(bill => {
        if (!Array.isArray(bill.Lines)) throw new Error('Missing bill detail.');
        return bill.Lines.map(line => ({
          supplier: String(bill.SupplierName || 'Unknown supplier'), invoice: String(bill.DocumentNumber || bill.ID),
          description: String(line.Description || 'No description'),
          amount: typeof line.Exclusive === 'number' ? line.Exclusive.toLocaleString('en-ZA',{minimumFractionDigits:2, maximumFractionDigits:2}) : 'Unavailable',
          asset: assetForSageLine(String(line.Description || ''), items) || 'Asset unassigned',
        }));
      });
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
          {current.sync_register ? <p>{current.sync_note || 'Paid bill imports enabled'}</p> :
            <form action={enablePaidBills}><h2>Import paid bills automatically</h2>
              <input type="hidden" name="connection" value={current.connection_id}/>
              <label>Asset register<select name="register" required defaultValue=""><option value="" disabled>Choose register</option>
                {registers.map(r=><option key={r.id} value={r.id}>{r.businessName}</option>)}</select></label>
              <label>Include bills dated from<input type="date" name="from" required/></label>
              <button>Enable paid bill imports</button></form>}
          <Link href={sagePage + '?preview=1'} prefetch={false}>Preview latest 10 supplier bills</Link></>
          : <><h2>Choose your Sage company</h2>{companies.length ? companies.map(company =>
            <form key={company.id} action={chooseSage}><input type="hidden" name="connection" value={current.connection_id}/>
              <button name="company" value={company.id}>{company.name} (#{company.id})</button></form>)
            : !failed && <p>No companies available to this Sage account.</p>}</>}
        {preview && <section><h2>Supplier bill lines</h2><p>Preview only. Amounts exclude VAT and use the bill currency.</p>
          {preview.length ? <ul>{preview.map((line,index) => <li key={index}><strong>{line.asset}</strong> · {categoryForLine(line.description) ?? 'Uncategorised'}<br/>
            {line.supplier} · {line.invoice}<br/>{line.description} · {line.amount} excl. VAT</li>)}</ul> : <p>No supplier bill lines found.</p>}</section>}
        <form action={removeSage}><input type="hidden" name="connection" value={current.connection_id}/><button>Disconnect Sage</button></form>
      </>}
  </main></>;
}
