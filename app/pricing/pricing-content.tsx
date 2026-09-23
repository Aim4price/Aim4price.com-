'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './pricing.module.css';
import PackageJourney from './owner-journey';
import PricingModal from './pricing-modal';

export default function PricingContent() {
  const [audience, setAudience] = useState<'owner' | 'dealer' | null>(null);
  const [ownerTitle, setOwnerTitle] = useState('How many assets?');
  const [dealerTitle, setDealerTitle] = useState('How will you add your stock?');
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
      <PricingModal owner open={audience === 'owner'} title={ownerTitle} onClose={() => setAudience(null)}><PackageJourney onTitleChange={setOwnerTitle} /></PricingModal>
      <PricingModal owner open={audience === 'dealer'} title={dealerTitle} onClose={() => setAudience(null)}><PackageJourney audience="dealer" onTitleChange={setDealerTitle} /></PricingModal>
      <div className={styles.closing}><div><h2>Still have a question?</h2></div><Link className={styles.button} href="/contact-us">Talk to Aim4price </Link></div>
    </div>
  );
}
