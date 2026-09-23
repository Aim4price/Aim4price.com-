'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import styles from './pricing.module.css';
import OwnerJourney from './owner-journey';
import PricingModal from './pricing-modal';

const ownerPlans = [
  { name: 'Essentials', assets: 25, monthly: 99, yearly: 999, fundedMonthly: 60, fundedYearly: 600 },
  { name: 'Growth', assets: 100, monthly: 199, yearly: 1999, fundedMonthly: 120, fundedYearly: 1200 },
  { name: 'Business', assets: 300, monthly: 399, yearly: 3999, fundedMonthly: 240, fundedYearly: 2400 },
];
const adminPlans = [{ hours: 2, price: 499 }, { hours: 5, price: 999 }, { hours: 10, price: 1799 }];
const money = (amount: number) => `R${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;

function CheckList({ items }: { items: string[] }) {
  return <ul className={styles.checkList}>{items.map(item => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>;
}

function Question({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return <details className={styles.question}>
    <summary><span><strong>{title}</strong><span className={styles.questionHint}>{hint}</span></span><span className={styles.chevron} aria-hidden="true" /></summary>
    <div className={styles.answer}>{children}</div>
  </details>;
}

export default function PricingContent() {
  const [audience, setAudience] = useState<'owner' | 'dealer' | null>(null);
  const [ownerTitle, setOwnerTitle] = useState('How many assets?');
  const [yearly, setYearly] = useState(false);
  const period = yearly ? 'year' : 'month';
  const billingControl = (
    <div className={styles.billingRow}>
      <div className={styles.billingControl}>
        <div className={styles.toggle} role="group" aria-label="Billing period">
          <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
          <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly</button>
        </div>
        <span>Dealer Partner: save 16.3% with yearly billing</span>
      </div>
    </div>
  );
  return (
    <div className={styles.shell}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Aim4price pricing</p>
        <h1>Let’s find your package.</h1>
        <p className={styles.intro}>Choose how you use Aim4price.</p>
        <div className={styles.accountChoices}>
          <button type="button" aria-haspopup="dialog" onClick={() => setAudience('owner')}><strong>Owner</strong><span>Manage my assets</span></button>
          <button type="button" aria-haspopup="dialog" onClick={() => setAudience('dealer')}><strong>Dealer</strong><span>Manage customers &amp; stock</span></button>
        </div>
      </header>
      <PricingModal open={audience === 'owner'} title={ownerTitle} onClose={() => setAudience(null)}><OwnerJourney onTitleChange={setOwnerTitle} /></PricingModal>
      <PricingModal open={audience === 'dealer'} title="Dealer pricing" onClose={() => setAudience(null)}>

      <div id="pricing-selection" className={styles.questions}>

      {audience === 'dealer' && <section id="partners" className={styles.section} aria-label="Partner pricing">
        <Question title="What does a Dealer plan cost?" hint="R199/month or R1 999/year · launch pricing">
        {audience === 'dealer' && billingControl}
        <div className={styles.partnerGrid}>
          <article className={`${styles.planCard} ${styles.dealerCard}`}>
            <p className={styles.planCategory}>Dealer</p><h3>Dealer Partner</h3><p className={styles.planDescription}>Connect customer records, enquiries and your stock.</p>
            <p className={styles.price}><strong>{money(yearly ? 1999 : 199)}</strong><span>/{period}</span></p><p className={styles.billingNote}>{yearly ? 'Billed once per year · launch pricing' : 'R1 999 yearly · launch pricing'}</p>
            <CheckList items={['Customer asset access & history, with permission', 'Leads, Discovery & customer follow-ups', 'Maintenance, staff assignments & client costs', 'Estimates, Ad Studio & reusable branding', 'Public showroom & Marketplace listings', 'Dashboard, notifications & 40% commission opportunities']} />
            <p className={styles.footnote}>Launch pricing may be reviewed for new Dealers as Discovery and leads develop.</p>
          </article>
        </div>
        </Question>
      </section>}

      {audience === 'dealer' && <section id="assistance" className={styles.section} aria-label="Capture and assistance">
        <Question title="Can I upload records myself?" hint="Manual uploads are free · Capture includes 10 invoices + 10 fuel slips daily">
        <div className={styles.allowanceGrid}>
          <article><span className={styles.step}>01</span><h3>Manual entry &amp; uploads</h3><p className={styles.allowanceValue}>Included. No daily limit.</p><p>Enter your own records and upload supporting documents at no extra charge. This does not use your capture allowance.</p></article>
          <article><span className={styles.step}>02</span><h3>Aim4price Capture</h3><p className={styles.allowanceValue}>10 invoices + 10 fuel slips</p><p>Included per owner account, per day. Shared across the account’s users and contributors. Resets at midnight South African time.</p></article>
          <article><span className={styles.step}>03</span><h3>Extra or bulk work</h3><p className={styles.allowanceValue}>Managed Administration</p><p>For additional capture, bulk records and hands-on assistance, open “Need help with extra or bulk work?” for monthly admin packages.</p></article>
        </div>
        </Question>
        <Question title="Need help with extra or bulk work?" hint="Optional Managed Admin packages from R499/month">
        <div className={styles.adminPanel}>
          <p className={styles.sharedNote}>Prepaid time for capturing, organising and maintaining your records.</p>
          <div className={styles.adminGrid}>{adminPlans.map(plan => <article key={plan.hours}><h4>Up to {plan.hours} hours</h4><p className={styles.price}><strong>{money(plan.price)}</strong><span>/month</span></p></article>)}</div>
          <div className={styles.adminExtra}><p><strong>More than 10 hours?</strong> Custom quote.<br />Additional work: <strong>R250 per hour.</strong></p><Link href="/contact-us" className={styles.button}>Discuss your needs </Link></div>
          <p className={styles.footnote}>Hours expire monthly and do not roll over. Travel, formal inspections and professional valuation research are excluded.</p>
        </div>
        </Question>
      </section>}

      <section className={styles.section} aria-label="More pricing questions">
        <div className={styles.detailsList}>
          {audience === 'dealer' && <details><summary>Can a Dealer pay for an Owner account?</summary><div className={styles.detailBody}><p>A Dealer can fund an Owner subscription and manage the account with the Owner’s permission. The Owner keeps their own login, owns their information and can revoke Dealer access.</p>
            {billingControl}<div className={styles.fundedGrid}>{ownerPlans.map(plan => <div key={plan.name}><h4>{plan.name}</h4><strong>{money(yearly ? plan.fundedYearly : plan.fundedMonthly)} /{period}</strong><p>Up to {plan.assets} active assets</p></div>)}</div>
            <p><strong>R99 once-off activation.</strong> Includes account and initial register setup, Dealer linking, the Owner signup email and access checks.</p><p>The Dealer-funded rate already reflects the partner discount; no additional commission is paid. If the Dealer captures the assets, photographs and documents, no per-asset admin fee or Managed Admin Package is required.</p><p>When Dealer funding ends, the Owner is notified and has 30 days to subscribe. Access remains read-only and information is not deleted.</p></div></details>}
          {audience === 'dealer' && <details><summary>What does asset setup or a visit cost?</summary><div className={styles.detailBody}><dl className={styles.serviceList}><div><dt>Road-licensed asset capture</dt><dd>R100 per asset</dd></div><div><dt>Non-road-licensed asset capture</dt><dd>R50 per asset</dd></div><div><dt>Travel</dt><dd>R7.50 per kilometre</dd></div><div><dt>Formal inspection or professional valuation</dt><dd>Custom quote</dd></div></dl><p>Asset setup covers standard details, supplied photographs and documents, serial/VIN, make, model, year, hours or mileage, and basic ownership details. It is separate from the daily invoice and fuel-slip allowance.</p><p>Travel uses the return distance, with one travel charge per visit. Data capture is not a physical inspection or certified valuation.</p></div></details>}
          {audience === 'dealer' && <details><summary>How does partner commission work?</summary><div className={styles.detailBody}><p>Eligible partners earn 40% on referred Owner and Dealer subscriptions and asset data capture. One Partner of Record is linked to each customer and must remain active and compliant.</p><p>Commission is based on qualifying money received, excluding VAT, discounts, refunds and chargebacks. It becomes available after 30 days, with monthly statements and a minimum EFT payout of R500. Smaller balances carry forward.</p><p>Commission credit can fund a Dealer subscription or Dealer-Managed Owner accounts. No commission applies to your own subscription, activation fees or Managed Administration. Dealer-funded subscriptions already include the discount. Travel payments go entirely to the person travelling.</p></div></details>}

        </div>
      </section>
      </div>
      </PricingModal>
      <div className={styles.closing}><div><h2>Still have a question?</h2></div><Link className={styles.button} href="/contact-us">Talk to Aim4price </Link></div>
    </div>
  );
}
