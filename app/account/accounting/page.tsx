import Link from 'next/link';
import AppHeader from '../../../components/AppHeader';
import { accountingOwner } from '../../../lib/accounting-owner';
import { cloudConfig, cloudPath, names, type Provider } from '../../../lib/accounting-cloud';
import { current } from '../../../lib/accounting-connection';
import { sageConfig, sagePage } from '../../../lib/sage-za-api';
import { connection } from '../../../lib/sage-za-connection';
import access from '../app-access-management.module.css';
import page from '../dealer-app/page.module.css';
import styles from '../ai-connect/page.module.css';
import AccountingActions, { type Choice } from './accounting-actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Accounting connections | Aim4price' };

export default async function AccountingPage() {
  const owner = await accountingOwner();
  const options: Choice[] = [];
  const sageReady = Boolean(sageConfig());
  const sage = sageReady ? await connection(owner) : null;
  options.push({ brand: 'sage', label: 'Sage Accounting South Africa', href: sagePage, ready: sageReady, connected: !!sage, company: sage?.company_name });
  for (const provider of Object.keys(names) as Provider[]) {
    const config = cloudConfig(provider);
    const row = config ? await current({ owner, config }) : null;
    options.push({ brand: provider === 'intacct' ? 'sage' : provider, label: names[provider], href: cloudPath(provider), ready: !!config, connected: !!row, company: row?.company_name });
  }
  options.push({ brand: 'sage', label: 'Pastel or Evolution file preview', href: '/my-invoices/accounting/sage-export', ready: true, connected: false });

  return <><AppHeader active="account" /><main className={styles.page}>
    <div className={`${page.shell} ${styles.shell}`}>
      <Link href="/account" className={page.backButton}>Back to account</Link>
      <section className={`${access.launcher} ${styles.launcher}`}>
        <div className={access.launcherIntro}><h1>Accounting connections</h1><p>Preview supplier bills and match costs to your assets by serial number or VIN.</p></div>
        <AccountingActions choices={options} />
        <div className={styles.safety}><p><strong>Read-only preview.</strong> Previewing a bill leaves your Cost Ledger and bookkeeping records unchanged.</p></div>
      </section>
    </div>
  </main></>;
}
