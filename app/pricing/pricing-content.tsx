'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './pricing.module.css';

const ownerPlans = [
  { name: 'Essentials', assets: 25, monthly: 99, yearly: 999, fundedMonthly: 60, fundedYearly: 600, description: 'A clear picture of the assets you own.' },
  { name: 'Growth', assets: 100, monthly: 199, yearly: 1999, fundedMonthly: 120, fundedYearly: 1200, description: 'Keep a growing operation organised.' },
  { name: 'Business', assets: 300, monthly: 399, yearly: 3999, fundedMonthly: 240, fundedYearly: 2400, description: 'Bring a larger asset portfolio together.' },
];
const features = [
  ['Know your assets', 'Asset registers, estimates, current and replacement values, photographs and documents.'],
  ['Understand your costs', 'Cost and invoice records, fuel records, budgets and contributions.'],
  ['Keep work on track', 'Maintenance schedules, reminders, fault reporting and notifications.'],
  ['Keep the full history', 'Ownership, finance and insurance details, connected to each asset.'],
  ['Take your records with you', 'PDF reports, Excel and CSV exports, and asset QR codes.'],
  ['Prepare for the next step', 'Marketplace access and tools to prepare your assets for sale.'],
];
const adminPlans = [{ hours: 2, price: 499 }, { hours: 5, price: 999 }, { hours: 10, price: 1799 }];
const money = (amount: number) => `R${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;

function CheckList({ items }: { items: string[] }) {
  return <ul className={styles.checkList}>{items.map(item => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>;
}

export default function PricingContent() {
  const [audience, setAudience] = useState<'owner' | 'dealer' | 'middleman'>('owner');
  const [yearly, setYearly] = useState(false);
  const period = yearly ? 'year' : 'month';
  return (
    <div className={styles.shell}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Aim4price pricing</p>
        <h1>Your assets.<br /><span>A plan that fits.</span></h1>
        <p className={styles.intro}>Know what you have, what it’s worth and what it costs.<br className={styles.desktopBreak} /> Choose the space you need. Keep all the core tools.</p>
        <div className={styles.audienceButtons} role="group" aria-label="Choose your account type">
          {(['owner', 'dealer', 'middleman'] as const).map(type => (
            <button key={type} type="button" aria-pressed={audience === type} aria-controls="pricing-selection" onClick={() => setAudience(type)}>
              {type === 'owner' ? 'Owners' : type === 'dealer' ? 'Dealers' : 'Middlemen'}
            </button>
          ))}
        </div>
      </header>

      <div id="pricing-selection" key={audience}>
      {audience !== 'middleman' && <div className={styles.billingRow}>          <div className={styles.billingControl}>
            <div className={styles.toggle} role="group" aria-label="Billing period">
              <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
              <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly</button>
            </div>
            <span>Lower total cost with yearly billing</span>
          </div></div>}
      {audience === 'owner' && <section id="owners" className={styles.section} aria-labelledby="owner-title">
        <div className={styles.sectionHeading}>
          <div><p className={styles.eyebrow}>For owners</p><h2 id="owner-title">Same tools. Room to grow.</h2><p>Choose your plan by the number of active assets.</p></div>

        </div>
        <div className={styles.planGrid}>
          {ownerPlans.map(plan => <article key={plan.name} className={styles.planCard}>
            <p className={styles.planCategory}>Owner</p><h3>{plan.name}</h3><p className={styles.planDescription}>{plan.description}</p>
            <p className={styles.price}><strong>{money(yearly ? plan.yearly : plan.monthly)}</strong><span>/{period}</span></p>
            <p className={styles.billingNote}>{yearly ? 'Billed once per year' : `${money(plan.yearly)} when billed yearly`}</p>
            <div className={styles.assetLimit}>Up to <strong>{plan.assets}</strong> active assets</div>
            <CheckList items={['All core Owner features', 'Manual entry & uploads included', 'Daily 10 invoice + 10 fuel-slip capture allowance']} />
          </article>)}
        </div>
        <div className={styles.enterprise}><div><h3>More than 300 active assets?</h3><p>Enterprise pricing tailored to your operation.</p></div><Link href="/contact-us" className={styles.button}>Discuss Enterprise <span aria-hidden="true">↗</span></Link></div>
        <p className={styles.footnote}>Only active assets count. Sold and archived assets are excluded. All prices are in South African rand.</p>
        <div className={styles.included}><h3>Included in every Owner plan</h3><div className={styles.featureGrid}>{features.map(([title, description]) => <div key={title}><h4>{title}</h4><p>{description}</p></div>)}</div></div>
      </section>}

      {audience !== 'owner' && <section id="partners" className={styles.section} aria-labelledby="partner-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>{audience === 'dealer' ? 'For dealers' : 'For middlemen'}</p><h2 id="partner-title">{audience === 'dealer' ? 'Work with assets. Build your business.' : 'Connect assets with their next owner.'}</h2><p>{audience === 'dealer' ? 'Customer tools, stock and enquiries in one workspace.' : 'Choose active partner access or a paid monthly plan.'}</p></div></div>
        <div className={styles.partnerGrid}>
          {audience === 'dealer' ? <article className={`${styles.planCard} ${styles.dealerCard}`}>
            <p className={styles.planCategory}>Dealer</p><h3>Dealer Partner</h3><p className={styles.planDescription}>Connect customer records, enquiries and your stock.</p>
            <p className={styles.price}><strong>{money(yearly ? 1999 : 199)}</strong><span>/{period}</span></p><p className={styles.billingNote}>{yearly ? 'Billed once per year · launch pricing' : 'R1 999 yearly · launch pricing'}</p>
            <CheckList items={['Customer asset access & history, with permission', 'Leads, Discovery & customer follow-ups', 'Maintenance, staff assignments & client costs', 'Estimates, Ad Studio & reusable branding', 'Public showroom & Marketplace listings', 'Dashboard, notifications & 40% commission opportunities']} />
            <p className={styles.footnote}>Launch pricing may be reviewed for new Dealers as Discovery and leads develop.</p>
          </article> :
          <article className={styles.planCard}>
            <p className={styles.planCategory}>Middleman</p><h3>Active Partner</h3><p className={styles.planDescription}>Value, advertise and connect assets with buyers.</p>
            <p className={styles.price}><strong>R0</strong><span>/month</span></p><p className={styles.billingNote}>While activity requirements are met</p>
            <CheckList items={['Estimates, valuations & professional adverts', 'Ad Studio & reusable brand kits', 'Public showroom & Marketplace listings', 'WhatsApp & social media sharing', '40% commission opportunities']} />
            <details className={styles.cardDetails}><summary>How active access works</summary><p>In every rolling 90 days, complete three genuine valuations, adverts or listings, plus one verified Aim4price marketing or referral activity.</p><p>If you fall short, you have 30 days to correct this. After that, choose R199 per month or read-only access at R0. Fake assets, duplicate adverts and self-referrals do not count.</p><p>Dealer Leads, Discovery, maintenance management, staff workflows and Client Costs are excluded.</p></details>
          </article>}
        </div>
      </section>}

      {audience !== 'middleman' && <section id="assistance" className={styles.section} aria-labelledby="capture-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Capture &amp; assistance</p><h2 id="capture-title">Do it yourself. Or let us help.</h2><p>A clear distinction between your own uploads and work handled by Aim4price.</p></div></div>
        <div className={styles.allowanceGrid}>
          <article><span className={styles.step}>01</span><h3>Manual entry &amp; uploads</h3><p className={styles.allowanceValue}>Included. No daily limit.</p><p>Enter your own records and upload supporting documents at no extra charge. This does not use your capture allowance.</p></article>
          <article><span className={styles.step}>02</span><h3>Aim4price Capture</h3><p className={styles.allowanceValue}>10 invoices + 10 fuel slips</p><p>Included per owner account, per day. Shared across the account’s users and contributors. Resets at midnight South African time.</p></article>
          <article><span className={styles.step}>03</span><h3>Extra or bulk work</h3><p className={styles.allowanceValue}>Managed Administration</p><p>For additional capture, bulk records and hands-on assistance, choose a separate monthly admin package below.</p></article>
        </div>
        <div className={styles.adminPanel}>
          <div className={styles.sectionHeading}><div><h3>More help, when you need it.</h3><p>Prepaid time for capturing, organising and maintaining your records.</p></div><span className={styles.smallLabel}>Optional monthly add-on</span></div>
          <div className={styles.adminGrid}>{adminPlans.map(plan => <article key={plan.hours}><h4>Up to {plan.hours} hours</h4><p className={styles.price}><strong>{money(plan.price)}</strong><span>/month</span></p></article>)}</div>
          <div className={styles.adminExtra}><p><strong>More than 10 hours?</strong> Custom quote.<br />Additional work: <strong>R250 per hour.</strong></p><Link href="/contact-us" className={styles.button}>Discuss your needs <span aria-hidden="true">↗</span></Link></div>
          <p className={styles.footnote}>Hours expire monthly and do not roll over. Travel, formal inspections and professional valuation research are excluded.</p>
        </div>
      </section>}

      <section className={styles.section} aria-labelledby="details-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>The details</p><h2 id="details-title">{audience === 'owner' ? 'Your plan, explained.' : audience === 'dealer' ? 'Setup, support and partnership.' : 'Your partnership, explained.'}</h2></div></div>
        <div className={styles.detailsList}>
          {audience === 'dealer' && <details><summary>Dealer-Managed Owner accounts</summary><div className={styles.detailBody}><p>A Dealer can fund an Owner subscription and manage the account with the Owner’s permission. The Owner keeps their own login, owns their information and can revoke Dealer access.</p>
            <div className={styles.fundedGrid}>{ownerPlans.map(plan => <div key={plan.name}><h4>{plan.name}</h4><strong>{money(yearly ? plan.fundedYearly : plan.fundedMonthly)} /{period}</strong><p>Up to {plan.assets} active assets</p></div>)}</div>
            <p><strong>R99 once-off activation.</strong> Includes account and initial register setup, Dealer linking, the Owner signup email and access checks.</p><p>The Dealer-funded rate already reflects the partner discount; no additional commission is paid. If the Dealer captures the assets, photographs and documents, no per-asset admin fee or Managed Admin Package is required.</p><p>When Dealer funding ends, the Owner is notified and has 30 days to subscribe. Access remains read-only and information is not deleted.</p></div></details>}
          {audience !== 'middleman' && <details><summary>Asset setup, travel and specialist work</summary><div className={styles.detailBody}><dl className={styles.serviceList}><div><dt>Road-licensed asset capture</dt><dd>R100 per asset</dd></div><div><dt>Non-road-licensed asset capture</dt><dd>R50 per asset</dd></div><div><dt>Travel</dt><dd>R7.50 per kilometre</dd></div><div><dt>Formal inspection or professional valuation</dt><dd>Custom quote</dd></div></dl><p>Asset setup covers standard details, supplied photographs and documents, serial/VIN, make, model, year, hours or mileage, and basic ownership details. It is separate from the daily invoice and fuel-slip allowance.</p><p>Travel uses the return distance, with one travel charge per visit. Data capture is not a physical inspection or certified valuation.</p></div></details>}
          {audience !== 'owner' && <details><summary>Partner commission</summary><div className={styles.detailBody}><p>Eligible partners earn 40% on referred Owner and Dealer subscriptions and asset data capture. One Partner of Record is linked to each customer and must remain active and compliant.</p><p>Commission is based on qualifying money received, excluding VAT, discounts, refunds and chargebacks. It becomes available after 30 days, with monthly statements and a minimum EFT payout of R500. Smaller balances carry forward.</p><p>Commission credit can fund a Dealer subscription or Dealer-Managed Owner accounts. No commission applies to your own subscription, activation fees or Managed Administration. Dealer-funded subscriptions already include the discount. Travel payments go entirely to the person travelling.</p></div></details>}
          {audience === 'owner' && <details><summary>What counts towards my Owner plan?</summary><div className={styles.detailBody}><p>Only active assets count towards the 25, 100 or 300 asset limit. Sold and archived assets do not count. All Owner plans include the same core features, with pricing based on asset quantity rather than storage. Owner accounts require a paid subscription.</p></div></details>}
        </div>
      </section>
      </div>
      <div className={styles.closing}><div><h2>Let’s find the right fit.</h2><p>Questions about your assets or the support you need?</p></div><Link className={styles.button} href="/contact-us">Talk to Aim4price <span aria-hidden="true">↗</span></Link></div>
    </div>
  );
}
