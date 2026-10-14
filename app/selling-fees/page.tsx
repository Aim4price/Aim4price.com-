import type { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import styles from './selling-fees.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Selling fees',
  description: 'A clear fee for selling your machinery. View the Aim4price fee guide, see what we handle and know what you receive before accepting an offer.',
};

const fees = [
  ['R50,000', 'R2,500'],
  ['R100,000', 'R5,000'],
  ['R300,000', 'R10,000'],
  ['R500,000', 'R15,000'],
  ['R1 million', 'R20,000'],
  ['R5 million', 'R40,000'],
  ['R10 million', 'R50,000'],
];

export default function SellingFeesPage() {
  return (
    <main className={styles.page}>
      <AppHeader active="none" />
      <div className={styles.shell}>
        <section className={styles.panel} aria-labelledby="selling-title">
          <header className={styles.introduction}>
            <div>
              <h1 id="selling-title">Selling fees</h1>
              <p>One agreed fee. You approve the final deal.</p>
            </div>
            <Link href="/contact-us" className={styles.primary}>Sell with Aim4price <span aria-hidden="true">↗</span></Link>
          </header>

          <div id="fee-guide" className={styles.feeLayout}>
            <section aria-labelledby="fees-title">
              <h2 id="fees-title">Fee guide</h2>
              <table className={styles.table} aria-labelledby="fees-title">
                <thead><tr><th scope="col">Selling price</th><th scope="col">Our fee</th></tr></thead>
                <tbody>{fees.map(([price, fee]) => <tr key={price}><th scope="row">{price}</th><td>{fee}</td></tr>)}</tbody>
              </table>
              <p className={styles.note}>Guide amounts. Your exact fee is agreed before marketing.<br />Excludes VAT where applicable; your quote shows the total.</p>
            </section>

            <section className={styles.summary} aria-labelledby="included-title">
              <h2 id="included-title">Included in our fee</h2>
              <ul className={styles.services}>
                <li><span aria-hidden="true">✓</span> Valuation and asking price</li>
                <li><span aria-hidden="true">✓</span> Marketing and buyer negotiations</li>
                <li><span aria-hidden="true">✓</span> Sale coordination</li>
              </ul>
              <div className={styles.example} aria-labelledby="example-title">
                <h3 id="example-title">A simple example</h3>
                <dl>
                  <div><dt>Selling price</dt><dd>R500,000</dd></div>
                  <div><dt>Less our fee</dt><dd>R15,000</dd></div>
                  <div className={styles.total}><dt>You receive</dt><dd>R485,000</dd></div>
                </dl>
                <p>Before applicable VAT and approved extra costs.</p>
              </div>
            </section>
          </div>

          <details className={styles.details}>
            <summary>Payment &amp; additional costs <span aria-hidden="true">+</span></summary>
            <div className={styles.detailsContent}>
              <p><strong>Payment.</strong> The buyer pays you directly. Our fee is due after cleared payment and the agreed completion conditions are met. No additional buyer agency fee.</p>
              <p><strong>Extra costs.</strong> Travel, inspections, transport and paid advertising need your approval before costs are incurred.</p>
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
