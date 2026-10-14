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
        <h1>Let’s find your package.</h1>
      </header>
      <section className={styles.pricingChoices} aria-label="Choose your account">
        <button className={styles.accountCard} type="button" aria-haspopup="dialog" onClick={() => setAudience('owner')}>
          <strong className={styles.accountTitle}>Owner</strong>
          <span className={styles.accountDescription}>For farms, companies and individuals managing their own assets, costs and maintenance.</span>
          <span className={styles.cardPrice}>From <strong>R99</strong> / month</span>
          <span className={styles.cardAction}>Explore Owner pricing</span>
        </button>
        <button type="button" aria-haspopup="dialog" onClick={() => setAudience('dealer')} className={styles.accountCard}>
          <strong className={styles.accountTitle}>Dealer</strong>
          <span className={styles.accountDescription}>For dealerships managing stock, client registers and asset enquiries.</span>
          <span className={styles.cardPrice}><strong>R199</strong> / month</span>
          <span className={styles.accountDescription}>Client registers are billed separately.</span>
          <span className={styles.cardAction}>Explore Dealer pricing</span>
        </button>
        <button type="button" aria-haspopup="dialog" onClick={() => setAudience('business')} className={styles.accountCard}>
          <strong className={styles.accountTitle}>Business</strong>
          <span className={styles.accountDescription}>For service providers, such as repairers, insurers and financiers, working with assets shared by clients.</span>
          <span className={styles.cardPrice}><strong>Free</strong> shared access</span>
          <span className={styles.accountDescription}>Optional Desktop upgrade: R199/month, arranged with Aim4price.</span>
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
      <section className={styles.pricingIncluded} aria-labelledby="included-title">
        <h2 id="included-title">Know what you’re paying for.</h2>
        <p>Owner subscriptions cover your asset records, costs, fuel, maintenance, sharing and reports. Choose a plan by the number of active assets across your account. Unlimited registers are included; sold and archived assets don’t count towards your limit.</p>
        <p>Dealer subscriptions cover your stock workspace. Client registers are billed separately to your dealership. Setup and ongoing administration are optional services, quoted or selected separately.</p>
        <p>Yearly prices apply to the subscription. Optional administration is still billed monthly. Your package preview is an estimate; Aim4price confirms any additional services and charges before work starts.</p>
      </section>
      <div className={styles.closing}><div><h2>Still have a question?</h2></div><Link className={styles.button} href="/contact-us">Talk to Aim4price </Link></div>
    </div>
    </div>
  );
}
