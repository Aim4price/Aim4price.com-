import type { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import styles from './selling-fees.module.css';

export const metadata: Metadata = {
  title: 'Selling fees',
  description: 'Clear machinery selling fees. Aim4price handles valuation, fair-price negotiations and sale coordination. Partners bring the buyer and share the agreed fee equally.',
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
  ['Agree before we start', 'We assess the machinery, discuss a realistic asking price and confirm the exact selling fee with the seller before marketing.'],
  ['Bring the right buyer', 'Aim4price and its partners use the seller-approved price and clear machinery information. Buyer introductions and any partner split are recorded upfront.'],
  ['Approve the deal', 'Aim4price handles negotiations. The seller approves the final offer and sees the selling price, agreed fee and expected net proceeds before accepting.'],
  ['Complete the sale', 'The buyer pays the seller directly. Our success fee becomes payable once the seller receives cleared payment and the agreed completion conditions are met. Partners are paid after Aim4price receives its fee.'],
];

export default function SellingFeesPage() {
  return (
    <main className={styles.page}>
      <AppHeader active="none" />
      <div className={styles.shell}>
        <section className={styles.hero} aria-labelledby="selling-title">
          <p className={styles.label}>Selling fees</p>
          <h1 id="selling-title">A fair price.<br /><span>A clear selling fee.</span></h1>
          <p className={styles.intro}>Selling machinery should be straightforward. We help the seller agree on a realistic price, bring clear information to the buyer and keep everyone informed from the first conversation to the completed sale.</p>
          <div className={styles.actions}>
            <Link href="/contact-us" className={styles.primary}>Talk to us about selling</Link>
            <a href="#fee-guide" className={styles.secondary}>View the fee guide</a>
          </div>
          <div className={styles.promises}>
            <p><strong>One approved price</strong><span>The seller stays in control of the final deal.</span></p>
            <p><strong>One disclosed fee</strong><span>No hidden partner markups or extra buyer agency fee.</span></p>
            <p><strong>Clear partnerships</strong><span>Everyone knows their role and share upfront.</span></p>
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="roles-title">
          <h2 id="roles-title">We manage the sale.<br />Our partners bring the buyer.</h2>
          <p className={styles.lead}>A simple division of responsibility, with fair treatment for both buyer and seller.</p>
          <div className={styles.twoColumns}>
            <article className={styles.card}>
              <h3>Aim4price handles</h3>
              <ul>
                <li>Valuing the machinery and agreeing on a realistic asking price with the seller.</li>
                <li>Preparing clear machinery details, available records and known condition information.</li>
                <li>Negotiating a fair price, subject to the seller’s approval.</li>
                <li>Coordinating the sale and showing the fee and seller’s net proceeds clearly.</li>
              </ul>
            </article>
            <article className={styles.card}>
              <h3>The partner brings</h3>
              <ul>
                <li>A serious buyer, whether the partner is a dealer, middleman or another introducer.</li>
                <li>Marketing at the approved price, without adding another markup.</li>
                <li>Clear communication about the buyer’s interest and requirements.</li>
                <li>Support to keep the buyer engaged through completion.</li>
              </ul>
            </article>
          </div>
          <p className={styles.note}>The seller approves the final deal. The buyer receives clear machinery details, known faults and sale terms before committing.</p>
        </section>

        <section id="fee-guide" className={styles.panel} aria-labelledby="fees-title">
          <h2 id="fees-title">Know the fee before you sell.</h2>
          <p className={styles.lead}>Use these amounts as a guide. We confirm one exact rand fee with the seller before marketing begins.</p>
          <div className={styles.feeLayout}>
            <table className={styles.table}>
              <caption>Machinery selling fee guide</caption>
              <thead><tr><th scope="col">Machinery selling price</th><th scope="col">Total agency fee</th></tr></thead>
              <tbody>{fees.map(([price, fee]) => <tr key={price}><th scope="row">{price}</th><td>{fee}</td></tr>)}</tbody>
            </table>
            <div className={styles.guideNotes}>
              <h3>A rand amount you can plan around.</h3>
              <p>These are reference points, not price bands with sudden fee jumps. For prices between them, we agree on an appropriate fee before starting.</p>
              <p>Small implements can be grouped into one sale. For machinery outside this guide, contact us for an agreed fee.</p>
              <p>The seller pays the agency fee from the sale proceeds. Partner earnings come from this same fee.</p>
              <p className={styles.taxNote}>Guide amounts exclude VAT where applicable. Your quote will show any applicable VAT and the total payable. These selling fees are separate from Aim4price software subscriptions.</p>
            </div>
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="partners-title">
          <h2 id="partners-title">Bring the buyer.<br />Share the fee equally.</h2>
          <p className={styles.lead}>Partner shares apply to the agreed agency fee, excluding any VAT, once the introduced buyer completes the purchase.</p>
          <div className={styles.threeColumns}>
            <article className={styles.card}><h3>We find the buyer</h3><p className={styles.share}>100%</p><p>Aim4price keeps the agency fee when we find the buyer directly.</p></article>
            <article className={`${styles.card} ${styles.featured}`}><h3>One partner brings the buyer</h3><p className={styles.share}>50 / 50</p><p>50% to Aim4price.<br />50% to the introducing partner.</p></article>
            <article className={styles.card}><h3>Two partners bring the buyer</h3><p className={styles.share}>50 / 25 / 25</p><p>50% to Aim4price.<br />25% to each agreed introducing partner.</p></article>
          </div>
          <p className={styles.note}>More partners share the same 50% partner portion. Agree and record the split before proceeding; overlapping claims do not automatically create a shared introduction. The seller’s fee does not increase.</p>
        </section>

        <section className={styles.example} aria-labelledby="example-title">
          <div><p className={styles.label}>A simple example</p><h2 id="example-title">A R500,000 sale.<br />A R15,000 fee.</h2><p>One partner introduces the successful buyer.</p></div>
          <dl className={styles.amounts}>
            <div><dt>Seller receives after the fee</dt><dd>R485,000</dd></div>
            <div><dt>Aim4price earns</dt><dd>R7,500</dd></div>
            <div><dt>Introducing partner earns</dt><dd>R7,500</dd></div>
          </dl>
          <p className={styles.exampleNote}>Illustrative amounts before applicable VAT and any separately approved costs. The buyer pays R500,000 in this example; there is no additional buyer agency fee.</p>
        </section>

        <section className={styles.panel} aria-labelledby="process-title">
          <h2 id="process-title">A clear sale, step by step.</h2>
          <ol className={styles.steps}>{steps.map(([title, detail], index) => <li key={title}><span className={styles.stepNumber} aria-hidden="true">{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol>
          <div className={styles.costNote}><h3>No surprise extras.</h3><p>Travel, inspections, transport and paid advertising require separate approval before costs are incurred. Any change to the agreed price or fee must be approved before accepting an offer.</p></div>
        </section>

        <section className={styles.closing} aria-labelledby="contact-title">
          <div><h2 id="contact-title">Let’s make the next sale clear.</h2><p>Have machinery to sell, or a buyer to introduce? Talk to us about the machinery, the price and your role.</p></div>
          <Link href="/contact-us" className={styles.primary}>Get in touch</Link>
        </section>
      </div>
    </main>
  );
}
