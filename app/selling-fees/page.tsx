import type { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import styles from './selling-fees.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Asset Sale Fees',
  description: 'Agreed flat fees for asset sales. Fair value for owners, a fair deal for buyers and realistic asset values that support fair trade.',
};

const fees = [
  ['Up to R50,000', 'R2,500'],
  ['Over R50,000–R100,000', 'R5,000'],
  ['Over R100,000–R300,000', 'R15,000'],
  ['Over R300,000–R500,000', 'R25,000'],
  ['Over R500,000–R1 million', 'R35,000'],
  ['Over R1 million–R2 million', 'R50,000'],
  ['Over R2 million–R5 million', 'R75,000'],
  ['Over R5 million–R10 million', 'R100,000'],
  ['Over R10 million', 'Negotiated upfront'],
];

export default function SellingFeesPage() {
  return (
    <main className={styles.page}>
      <AppHeader active="none" />
      <div className={styles.shell}>
        <section className={styles.panel} aria-labelledby="selling-title">
          <header className={styles.introduction}>
            <div>
              <h1 id="selling-title">Sell with confidence.</h1>
              <p className={styles.subtitle}>A fair price for your asset. A clear flat fee for our help.</p>
            </div>
            <div className={styles.contactAction}>
              <Link href="/contact-us" className={styles.primary}>Discuss your asset sale</Link>
              <span>Agree on the fee before marketing begins.</span>
            </div>
            <p className={styles.purpose}>We help owners work towards the best possible selling price while giving buyers a fair deal. Our agreed flat fees cover valuation, marketing and sale coordination, without percentage commissions. We believe realistic asset values support fair trade and help avoid unnecessary financial strain.</p>
          </header>

          <div id="fee-guide" className={styles.feeLayout}>
            <section aria-labelledby="fees-title">
              <h2 id="fees-title">Find your selling price range</h2>
              <table className={styles.table} aria-labelledby="fees-title">
                <thead><tr><th scope="col">Asset value band</th><th scope="col">Flat success fee</th></tr></thead>
                <tbody>{fees.map(([price, fee]) => <tr key={price}><th scope="row">{price}</th><td>{fee}</td></tr>)}</tbody>
              </table>
              <p className={styles.note}>Guide fees, agreed before marketing. For assets over R10 million, the fee is negotiated upfront. Excludes VAT where applicable; your quote shows the total.</p>
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
                  <div><dt>Less our fee</dt><dd>R25,000</dd></div>
                  <div className={styles.total}><dt>You receive</dt><dd>R475,000</dd></div>
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
