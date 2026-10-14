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

const steps = [
  ['Agree the price and fee', 'We assess your machinery and agree on a realistic asking price and one exact rand fee before marketing.'],
  ['Find a buyer', 'We coordinate buyer enquiries and handle negotiations. You approve the final offer and know what you will receive.'],
  ['Complete the sale', 'The buyer pays you directly. Our fee is payable once you receive cleared payment and the agreed completion conditions are met.'],
];

export default function SellingFeesPage() {
  return (
    <main className={styles.page}>
      <AppHeader active="none" />
      <div className={styles.shell}>
        <section className={styles.panel} aria-labelledby="selling-title">
          <header className={styles.introduction}>
            <div>
              <p className={styles.label}>Selling fees</p>
              <h1 id="selling-title">A clear fee.<br /><span>A simpler sale.</span></h1>
            </div>
            <div className={styles.introCopy}>
              <p>We help you value, market and sell your machinery. You approve the price and know our fee before we start.</p>
              <Link href="/contact-us" className={styles.primary}>Talk to us about selling <span aria-hidden="true">↗</span></Link>
            </div>
          </header>

          <div id="fee-guide" className={styles.feeLayout}>
            <div>
              <h2 id="fees-title">Our selling fee guide</h2>
              <p className={styles.lead}>One agreed fee, paid by the seller. No additional buyer agency fee.</p>
              <table className={styles.table} aria-labelledby="fees-title">
                <thead><tr><th scope="col">Machinery selling price</th><th scope="col">Selling fee</th></tr></thead>
                <tbody>{fees.map(([price, fee]) => <tr key={price}><th scope="row">{price}</th><td>{fee}</td></tr>)}</tbody>
              </table>
              <p className={styles.feeNote}>These are guide amounts, not fixed price bands. We confirm your exact fee upfront, including for prices between or outside these examples.</p>
              <p className={styles.feeNote}>Amounts exclude VAT where applicable. Your quote shows any VAT and the total payable.</p>
            </div>

            <aside className={styles.summary} aria-labelledby="included-title">
              <div className={styles.included}>
                <h2 id="included-title">What we handle</h2>
                <ul className={styles.services}>
                  <li><span className={styles.check} aria-hidden="true">✓</span><div><h3>Valuation and pricing</h3><p>A realistic asking price based on your machinery and its condition.</p></div></li>
                  <li><span className={styles.check} aria-hidden="true">✓</span><div><h3>Marketing and negotiation</h3><p>Clear machinery information, buyer enquiries and fair-price discussions.</p></div></li>
                  <li><span className={styles.check} aria-hidden="true">✓</span><div><h3>Sale coordination</h3><p>Clear terms and your expected proceeds before you approve the deal.</p></div></li>
                </ul>
              </div>
              <div className={styles.example} aria-labelledby="example-title">
                <h3 id="example-title">What you receive: an example</h3>
                <dl>
                  <div><dt>Selling price</dt><dd>R500,000</dd></div>
                  <div><dt>Less selling fee</dt><dd>R15,000</dd></div>
                  <div className={styles.total}><dt>You receive</dt><dd>R485,000</dd></div>
                </dl>
                <p>Before applicable VAT and any separately approved costs.</p>
              </div>
            </aside>
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="process-title">
          <h2 id="process-title" className={styles.processTitle}>Three steps to a clear sale.</h2>
          <ol className={styles.steps}>{steps.map(([title, detail], index) => <li key={title}><span className={styles.stepNumber} aria-hidden="true">{index + 1}</span><h3>{title}</h3><p>{detail}</p></li>)}</ol>
          <p className={styles.costNote}><strong>Extra costs? Only with your approval.</strong> Travel, inspections, transport and paid advertising are agreed separately before costs are incurred.</p>
          <div className={styles.closing}><p>Ready to sell your machinery?</p><Link href="/contact-us" className={styles.primary}>Get in touch <span aria-hidden="true">↗</span></Link></div>
        </section>
      </div>
    </main>
  );
}
