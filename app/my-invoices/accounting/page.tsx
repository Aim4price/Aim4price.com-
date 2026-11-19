import Link from 'next/link';
import AppHeader from '../../../components/AppHeader';
import { accountingOwner } from '../../../lib/accounting-owner';
import { cloudConfig, cloudPath, names, type Provider } from '../../../lib/accounting-cloud';
import { sageConfig, sagePage } from '../../../lib/sage-za-api';
import styles from '../sage-za/sage.module.css';
export const dynamic='force-dynamic';
export default async function AccountingPage(){
  const owner=await accountingOwner();
  const providers: {name:string;href:string;ready:boolean}[]=(Object.keys(names) as Provider[]).map(p=>({name:names[p],href:cloudPath(p),ready:Boolean(cloudConfig(p))}));
  providers.unshift({name:'Sage Accounting South Africa',href:sagePage,ready:Boolean(sageConfig())});
  return <><AppHeader active="none"/><main className={styles.panel}><Link href="/my-invoices">Back to costs</Link>
    <h1>Accounting connections</h1><p>Preview supplier bill lines against your asset serial numbers.</p>
    <ul>{providers.map(p=><li key={p.href}>{p.ready?<Link prefetch={false} href={p.href}>{p.name}</Link>:<>{p.name} · Awaiting provider setup</>}</li>)}</ul>
    <h2>Sage file exports</h2><Link href="/my-invoices/accounting/sage-export">Preview a detailed CSV or TSV export</Link>
  </main></>;
}
