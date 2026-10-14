'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './pricing.module.css';
import PackageJourney from './owner-journey';
import PricingModal from './pricing-modal';

export default function PricingContent({ signedIn = false, initialAudience = null }: { signedIn?: boolean; initialAudience?: 'owner' | 'dealer' | 'business' | null }) {
  const [audience, setAudience] = useState<'owner' | 'dealer' | 'business' | null>(initialAudience);
  const [ownerTitle, setOwnerTitle] = useState('How many assets?');
  return (
    <div className={styles.photoSurface}>
    <div className={styles.shell}>
      <header className={styles.hero}>
        <h1>Subscriptions</h1>
        <p className={styles.heroDescription}>Choose the package that fits your work.</p>
      </header>
      <section className={styles.pricingChoices} aria-label="Choose your account">
        <button className={styles.accountCard} type="button" aria-haspopup="dialog" onClick={() => setAudience('owner')}>
          <strong className={styles.accountTitle}>Owner</strong>
          <span className={styles.cardPrice}><span className={styles.priceLabel}>From</span><span className={styles.priceLine}><strong>R99</strong><span>/ month</span></span></span>
          <span className={styles.accountDescription}>For farms, companies and individuals managing their own assets.</span>
          <span className={styles.cardNote}>Choose by active asset count. Unlimited registers included.</span>
          <span className={styles.cardAction}>Explore Owner subscriptions</span>
        </button>
        <button type="button" aria-haspopup="dialog" onClick={() => setAudience('dealer')} className={styles.accountCard}>
          <strong className={styles.accountTitle}>Dealer</strong>
          <span className={styles.cardPrice}><span className={styles.priceLabel}>Subscription</span><span className={styles.priceLine}><strong>R199</strong><span>/ month</span></span></span>
          <span className={styles.accountDescription}>For dealerships managing stock, client registers and asset enquiries.</span>
          <span className={styles.cardNote}>Client registers are billed separately to your dealership.</span>
          <span className={styles.cardAction}>Explore Dealer subscriptions</span>
        </button>
        <button type="button" aria-haspopup="dialog" onClick={() => setAudience('business')} className={styles.accountCard}>
          <strong className={styles.accountTitle}>Business</strong>
          <span className={styles.cardPrice}><span className={styles.priceLabel}>Shared access</span><span className={styles.priceLine}><strong>Free</strong></span></span>
          <span className={styles.accountDescription}>For repairers, insurers and financiers working with assets shared by clients.</span>
          <span className={styles.cardNote}>Optional Desktop: R199/month, arranged with Aim4price.</span>
          <span className={styles.cardAction}>Explore Business access</span>
        </button>
      </section>
      <p className={styles.signIn}>{signedIn ? <>Want to change your package? <Link href="/contact-us">Discuss it with Aim4price</Link></> : <>Already have an account? <Link href="/auth#login">Log in</Link></>}</p>
      <PricingModal owner open={audience === 'owner'} title={ownerTitle} onClose={() => setAudience(null)}><PackageJourney signedIn={signedIn} onTitleChange={setOwnerTitle} /></PricingModal>
      <PricingModal owner open={audience === 'dealer'} title={ownerTitle} onClose={() => setAudience(null)}><PackageJourney audience="dealer" signedIn={signedIn} onTitleChange={setOwnerTitle} /></PricingModal>
      <PricingModal open={audience === 'business'} title="Business access" onClose={() => setAudience(null)}>
        <div className={styles.accessExplanation}>
          <h2>Start with free shared access.</h2>
          <p>Work with assets your clients share with you. The asset owner chooses which records and actions you can access.</p>
          <h3>Need a Desktop workspace?</h3>
          <p>The optional Desktop upgrade is R199/month and is arranged with Aim4price. Contact us to confirm the tools and access your business needs before upgrading.</p>
          <p>Managing your own assets? Choose Owner. Managing dealership stock and client registers? Choose Dealer.</p>
          <Link className={styles.button} href={signedIn ? '/contact-us' : '/business/join'}>{signedIn ? 'Discuss Business access' : 'Create free Business account'}</Link>
        </div>
      </PricingModal>
      <details className={styles.pricingIncluded}>
        <summary className={styles.coverageSummary}><h2>What your subscription covers</h2><span className={styles.coverageToggle} aria-hidden="true" /></summary>
        <div className={styles.subscriptionDetails}>
          <article className={styles.subscriptionDetail}>
            <h3>Owner</h3>
            <p>Manage your assets in one place.</p>
            <ul>
              <li>Asset records, costs, fuel, maintenance, sharing and reports.</li>
              <li>Unlimited registers; your active-asset limit applies across your account.</li>
              <li>Sold and archived assets don’t count towards your limit.</li>
            </ul>
          </article>
          <article className={styles.subscriptionDetail}>
            <h3>Dealer</h3>
            <p>A workspace for your dealership stock.</p>
            <ul>
              <li>Your stock workspace is covered by your subscription.</li>
              <li>Client registers are billed separately to your dealership.</li>
            </ul>
          </article>
          <article className={styles.subscriptionDetail}>
            <h3>Optional services</h3>
            <p>Extra help, when you need it.</p>
            <ul>
              <li>Setup and ongoing admin are charged separately.</li>
              <li>Aim4price confirms additional work and charges before starting.</li>
            </ul>
          </article>
        </div>
      </details>
      <div className={styles.closing}>
        <div><h2>Still have a question?</h2><p>We’ll help you find the right subscription.</p></div>
        <Link className={styles.contactButton} href="/contact-us">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 18H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-7l-4 3v-3Z"/><path d="M7 9h10M7 13h6"/></svg>
          <span>Talk to Aim4price</span>
        </Link>
      </div>
    </div>
    </div>
  );
}
