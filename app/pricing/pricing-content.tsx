'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './pricing.module.css';
import PackageJourney from './owner-journey';
import PricingModal from './pricing-modal';
import ServiceFees from './service-fees';
import { businessHosting, ownerHosting, rand, type HostingAudience } from '../../lib/hosting-pricing';

export default function PricingContent({ signedIn = false, initialAudience = null }: { signedIn?: boolean; initialAudience?: HostingAudience | null }) {
  const [audience, setAudience] = useState<HostingAudience | null>(initialAudience);
  const [feesOpen, setFeesOpen] = useState(false);
  const [feesTopic, setFeesTopic] = useState<'commission' | undefined>();
  const [ownerTitle, setOwnerTitle] = useState('How many assets?');
  return (
    <div className={styles.photoSurface}>
    <div className={styles.shell}>
      <header className={styles.hero}>
        <h1>Subscriptions</h1>
        <p className={styles.heroDescription}>Choose your account. Add help when you need it.</p>
      </header>
      <section className={styles.pricingChoices} aria-label="Choose your account">
        <button className={styles.accountCard} type="button" aria-haspopup="dialog" onClick={() => setAudience('owner')}>
          <strong className={styles.accountTitle}>Owner</strong>
          <span className={styles.cardPrice}><span className={styles.priceLabel}>From</span><span className={styles.priceLine}><strong>{rand(ownerHosting[0].monthly)}</strong><span>/ month</span></span></span>
          <span className={styles.accountDescription}>Manage your own assets, records and running costs.</span>
          <span className={styles.cardNote}>Priced by active assets. Unlimited registers.</span>
          <span className={styles.cardAction}>Explore Owner hosting</span>
        </button>
        <button type="button" aria-haspopup="dialog" onClick={() => setAudience('business')} className={styles.accountCard}>
          <strong className={styles.accountTitle}>Business</strong>
          <span className={styles.cardPrice}><span className={styles.priceLabel}>Hosting</span><span className={styles.priceLine}><strong>{rand(businessHosting.monthly)}</strong><span>/ month</span></span></span>
          <span className={styles.accountDescription}>Manage stock, parts stocklists and your clients’ assets.</span>
          <span className={styles.cardNote}>Client hosting from <span className={styles.rate}>{rand(ownerHosting[0].monthly / 4)} per client/month.</span></span>
          <span className={styles.cardAction}>Explore Business hosting</span>
        </button>
      </section>
      <p className={styles.signIn}><Link href="/business/join">Free Business access for shared assets</Link></p>
      <p className={styles.signIn}>{signedIn ? <>Want to change your package? <Link href="/contact-us">Discuss it with Aim4price</Link></> : <>Already have an account? <Link href="/auth#login">Log in</Link></>}</p>
      <PricingModal owner open={audience === 'owner'} title={ownerTitle} onClose={() => setAudience(null)}><PackageJourney signedIn={signedIn} onTitleChange={setOwnerTitle} /></PricingModal>
      <PricingModal owner open={audience === 'business'} title={ownerTitle} onClose={() => setAudience(null)}><PackageJourney audience="business" signedIn={signedIn} onTitleChange={setOwnerTitle} /></PricingModal>
      <PricingModal open={audience === 'middleman'} title="Middleman access" onClose={() => setAudience(null)}>
        <section className={styles.middlemanAccess} data-middleman-access aria-label="Middleman access and earnings">
          <p className={styles.middlemanIntro}><strong>Free basic access.</strong> Connect owners with opportunities.</p>
          <dl className={styles.middlemanEarnings}>
            <div><dt>Hosting referrals</dt><dd><strong>40%</strong><span>On eligible full-price paid hosting.</span></dd></div>
            <div><dt>Asset recording</dt><dd><strong className={styles.rate}>R270/hour</strong><span>60% of approved on-site work.</span></dd></div>
            <div><dt>Asset sales</dt><dd><strong>Agreed per sale</strong><span>Shared from the total sale fee.</span></dd></div>
          </dl>
          <p className={styles.middlemanNote}>Client hosting and assistance cost extra.</p>
          <div className={styles.middlemanActions}>
            <button type="button" onClick={() => { setFeesTopic('commission'); setAudience(null); setFeesOpen(true); }}>Commission terms</button>
            <Link className={styles.button} href="/contact-us">Discuss access</Link>
          </div>
        </section>
      </PricingModal>
      <PricingModal open={feesOpen} title="Success fees & services" onClose={() => setFeesOpen(false)}><ServiceFees initialTopic={feesTopic} /></PricingModal>
      <details className={styles.pricingIncluded}>
        <summary className={styles.coverageSummary}><h2>What your hosting covers</h2><span className={styles.coverageToggle} aria-hidden="true" /></summary>
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
            <h3>Business</h3>
            <p>Your business stock and parts in one place.</p>
            <ul>
              <li>Your stock workspace is covered by your hosting.</li>
              <li>Upload, update and share your parts stocklists.</li>
              <li>Client hosting is 25% of normal Owner fees, billed to your business.</li>
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
      <p className={styles.additionalLinks}><button type="button" aria-haspopup="dialog" onClick={() => setAudience('middleman')}>Middleman access</button><button type="button" aria-haspopup="dialog" onClick={() => { setFeesTopic(undefined); setFeesOpen(true); }}>Success fees &amp; services</button></p>
      <div className={styles.closing}>
        <div><h2>Still have a question?</h2><p>We’ll help you choose your hosting and support.</p></div>
        <Link className={styles.contactButton} href="/contact-us">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 18H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-7l-4 3v-3Z"/><path d="M7 9h10M7 13h6"/></svg>
          <span>Talk to Aim4price</span>
        </Link>
      </div>
    </div>
    </div>
  );
}
