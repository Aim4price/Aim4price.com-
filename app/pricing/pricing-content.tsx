'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './pricing.module.css';
import PackageJourney from './owner-journey';
import PricingModal from './pricing-modal';

export default function PricingContent() {
  const [audience, setAudience] = useState<'owner' | 'dealer' | null>(null);
  const [ownerTitle, setOwnerTitle] = useState('How many assets?');
  const [dealerTitle, setDealerTitle] = useState('Will you manage customers’ asset registers?');
  return (
    <div className={styles.photoSurface}>
    <div className={styles.shell}>
      <header className={styles.hero}>
        <h1>Let’s find your package.</h1>
        <p className={styles.intro}>Choose how you use Aim4price.</p>
      </header>
      <section className={styles.pricingChoices} aria-label="Choose your account">
        <button className={styles.accountCard} type="button" aria-haspopup="dialog" onClick={() => setAudience('owner')}>
          <strong className={styles.accountTitle}>Owner</strong>
          <span className={styles.accountDescription}>Manage your assets, costs and maintenance.</span>
          <span className={styles.cardPrice}>Your assets. Your package.</span>
          <span className={styles.cardAction}>Explore Owner pricing</span>
        </button>
        <button className={styles.accountCard} type="button" aria-haspopup="dialog" onClick={() => setAudience('dealer')}>
          <strong className={styles.accountTitle}>Dealer</strong>
          <span className={styles.accountDescription}>Manage dealership stock and client registers.</span>
          <span className={styles.cardPrice}>Built around your dealership.</span>
          <span className={styles.cardAction}>Explore Dealer pricing</span>
        </button>
        <Link href="/business/join" className={styles.accountCard}>
          <strong className={styles.accountTitle}>Business</strong>
          <span className={styles.accountDescription}>Get estimates, receive leads and browse the marketplace.</span>
          <span className={styles.cardPrice}><strong>R199</strong> / month after x credits</span>
          <span className={styles.cardAction}>Create Business account</span>
        </Link>
      </section>
      <p className={styles.creditNote}>Business credit allowance is being finalised. x is a placeholder.</p>
      <p className={styles.signIn}>Already have an account? <Link href="/auth#login">Log in</Link></p>
      <PricingModal owner open={audience === 'owner'} title={ownerTitle} onClose={() => setAudience(null)}><PackageJourney onTitleChange={setOwnerTitle} /></PricingModal>
      <PricingModal owner open={audience === 'dealer'} title={dealerTitle} onClose={() => setAudience(null)}><PackageJourney audience="dealer" onTitleChange={setDealerTitle} /></PricingModal>
      <div className={styles.closing}><div><h2>Still have a question?</h2></div><Link className={styles.button} href="/contact-us">Talk to Aim4price </Link></div>
    </div>
    </div>
  );
}
