'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import styles from './pricing.module.css';
import PackageJourney from './owner-journey';
import PricingModal from './pricing-modal';
import ServiceFees from './service-fees';
import PricingIcon from './pricing-icon';
import { businessHosting, ownerHosting, rand } from '../../lib/hosting-pricing';
import type { BillingPlan } from '../../lib/billing-shared';
import type { PricingAudience } from '../../lib/subscription-options';

function AccountChoice({ title, price, caption, description, features, note, action, onClick }: {
  title: string; price: string; caption: string; description: string;
  features: string[]; note: ReactNode; action: string; onClick: () => void;
}) {
  return <button className={styles.accountCard} type="button" aria-haspopup="dialog" onClick={onClick}>
    <span className={styles.accountHeading}><strong className={styles.accountTitle}>{title}</strong></span>
    <span className={styles.cardPrice}><span className={styles.priceLabel}>{title === 'Owner' ? 'From' : 'Subscription'}</span><span className={styles.priceLine}><strong>{price}</strong><span>/ month</span></span><span className={styles.annualCaption}>{caption}</span></span>
    <span className={styles.accountDescription}>{description}</span>
    <span className={styles.planFeatures}>{features.map(feature => <span key={feature}><span aria-hidden="true">✓</span>{feature}</span>)}</span>
    <span className={styles.cardNote}>{note}</span>
    <span className={styles.cardAction}>{action}<span aria-hidden="true">→</span></span>
  </button>;
}

export default function PricingContent({ signedIn = false, initialAudience = null, freeBusinessCredits,referralCredits,offers,trialDays=30 }: { offers?:BillingPlan[];trialDays?:number;signedIn?: boolean; initialAudience?: PricingAudience | null; referralCredits?:number; freeBusinessCredits?: number }) {
  const [audience, setAudience] = useState<PricingAudience | null>(initialAudience);
  const [feesOpen, setFeesOpen] = useState(false);
  const [feesTopic, setFeesTopic] = useState<'commission' | undefined>();
  const [ownerTitle, setOwnerTitle] = useState('How many assets?');
  const publishedRate=(key:string,fallback:number)=>offers?.find(p=>p.key===key)?.amountCents??fallback;
  const creditsLabel = freeBusinessCredits === undefined ? 'Monthly action credits' : `${freeBusinessCredits} monthly action credits`;
  const showFees = (topic?: 'commission') => { setFeesTopic(topic); setFeesOpen(true); };
  return <div className={styles.photoSurface}><div className={styles.shell}>
    <header className={styles.hero}>
      <h1>Subscriptions</h1>
      <p className={styles.heroDescription}>Choose the right account for you.</p>
    </header>
    <section className={styles.pricingChoices} aria-label="Choose your account">
      <AccountChoice title="Owner" price={rand(publishedRate('owner-band-1-monthly',ownerHosting[0].monthly))} caption={`Or ${rand(publishedRate('owner-band-1-annual',ownerHosting[0].annually))}/year · 1–25 assets`}
        description="Know what you own, what it’s worth and what it costs."
        features={['Asset registers, valuations & reports', 'Maintenance, fuel & running costs', 'Documents and asset sharing']}
        note={trialDays+'-day free trial available. Unlimited registers.'} action="Explore Owner plans" onClick={() => setAudience('owner')} />
      <AccountChoice title="Free Business" price="R0" caption="No subscription fee"
        description="Work with the assets and enquiries your clients share."
        features={['Registers, shared assets & valuations', 'Parts, maintenance & advert tools', creditsLabel]}
        note="View shared assets for free. Upgrade when needed." action="Explore Free Business" onClick={() => setAudience('free-business')} />
      <AccountChoice title="Paid Business" price={rand(publishedRate('business-standard-monthly',businessHosting.monthly))} caption={`Or ${rand(publishedRate('business-standard-annual',businessHosting.annually))}/year`}
        description="Manage your stock, clients and team in one workspace."
        features={['Registers, Parts & Stock', 'Maintenance, costs & advert tools', 'Staff access · no monthly credit limit']}
        note={<>Client hosting from <span className={styles.rate}>{rand(ownerHosting[0].monthly / 4)} per client/month.</span></>} action="Explore Paid Business" onClick={() => setAudience('business')} />
    </section>
    <p className={styles.pricingNote}>No VAT added.</p>
    <PricingModal owner open={audience === 'owner'} title={ownerTitle} onClose={() => setAudience(null)}><PackageJourney offers={offers} signedIn={signedIn} onTitleChange={setOwnerTitle} /></PricingModal>
    <PricingModal owner open={audience === 'business'} title={ownerTitle} onClose={() => setAudience(null)}><PackageJourney offers={offers} audience="business" signedIn={signedIn} onTitleChange={setOwnerTitle} /></PricingModal>
    <PricingModal open={audience === 'free-business'} title="Free Business" onClose={() => setAudience(null)}>
      <section className={styles.freeBusiness} data-free-business aria-label="Free Business access">
        <div className={styles.freeSummary}><span className={styles.accessIcon}><PricingIcon name="link" /></span><div><strong>Shared assets. No subscription fee.</strong><p>Work with records your clients choose to share.</p></div><strong className={styles.freePrice}>R0</strong></div>
        <dl className={styles.freeBenefits}>
          <div><dt>Shared Assets</dt><dd>View client assets and enquiries. Manage, message and share where the sender’s permissions allow.</dd></div>
          <div><dt>{creditsLabel}</dt><dd>One completed action uses one credit. Examples include recording a shared cost, adding documents or logging maintenance. Viewing uses no credits. Messages and sharing are free. See your balance and recent activity in Account.</dd></div>
          <div><dt>Invite an owner</dt><dd>Earn {referralCredits ?? 50} extra credits when an invited owner verifies their email and adds their first asset.</dd></div>
          <div><dt>Business workspace</dt><dd>Manage registers, stocklists, your showroom and adverts from your personal workspace.</dd></div>
        </dl>
        <p className={styles.freeUpgrade}>Choose Paid Business for staff access and unlimited actions.</p>
        <div className={styles.freeActions}><button type="button" onClick={() => setAudience('business')}>Compare Paid Business</button><Link className={styles.button} href={signedIn ? '/account' : '/auth?accountType=business&offer=free#signup'}>{signedIn ? 'Go to my account' : 'Create free account'}</Link></div>
      </section>
    </PricingModal>
    <PricingModal open={feesOpen} title="Success fees & services" onClose={() => setFeesOpen(false)}><ServiceFees initialTopic={feesTopic} /></PricingModal>
    <div className={styles.serviceStrip}><div><strong>Extra help, when you need it.</strong><p>Setup, admin and success fees are agreed separately.</p></div><div className={styles.serviceActions}><button type="button" aria-haspopup="dialog" onClick={() => showFees()}>Services &amp; success fees</button><button type="button" aria-haspopup="dialog" onClick={() => showFees('commission')}>Partner earnings</button></div></div>
    <div className={styles.closing}>
      <div><h2>Need a hand choosing?</h2><p>We’ll help you find the right account and support.</p></div>
      <Link className={styles.contactButton} href="/contact-us"><PricingIcon name="support" /><span>Talk to Aim4price</span></Link>
    </div>
  </div></div>;
}
