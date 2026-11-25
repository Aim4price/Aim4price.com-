import local from './accounting.module.css';
import { costCategories } from '../../../lib/cost-categories';
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

const categoriesByName = [...costCategories].sort((a, b) => a.label.localeCompare(b.label, 'en-ZA'));

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
        <details className={`${styles.examples} ${local.cheatSheet}`}>
          <summary className={styles.exampleHeading}>
            <span className={local.sheetTitle}>
              <span className={local.bookIcon} aria-hidden="true">
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
                  <path d="M12 6c-3-2-6-2.5-10-2v14c4-.5 7 0 10 2 3-2 6-2.5 10-2V4c-4-.5-7 0-10 2Zm0 0v14" />
                </svg>
              </span>
              <strong className={styles.exampleTitle}>Cost-code cheat sheet</strong>
            </span>
            <span className={styles.exampleChevron} aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </summary>
          <div className={local.sheetBody}>
            <div className={local.invoiceExample}>
              <div>
                <strong>Invoice line example</strong>
                <p>In the line description, join the cost code to the asset’s serial or VIN with a hyphen.</p>
              </div>
              <samp>Oil service <code>MAIN-XYZ1234</code></samp>
            </div>
            <dl className={local.codeList} aria-label="Cost categories and codes">
              {categoriesByName.map(category => (
                <div key={category.code}>
                  <dt>{category.label}</dt>
                  <dd><code>{category.code}</code></dd>
                </div>
              ))}
            </dl>
          </div>
        </details>
        <div className={styles.safety}><p><strong>Read-only preview.</strong> Previewing a bill leaves your Cost Ledger and bookkeeping records unchanged.</p></div>
      </section>
    </div>
  </main></>;
}
