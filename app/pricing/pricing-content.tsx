'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import styles from './pricing.module.css';
import PackageJourney from './owner-journey';
import PricingModal from './pricing-modal';
import ServiceFees from './service-fees';
import PricingIcon, { type PricingIconName } from './pricing-icon';
import { businessHosting, ownerHosting, rand } from '../../lib/hosting-pricing';
import type { PricingAudience } from '../../lib/subscription-options';

function AccountChoice({ title, icon, price, caption, description, features, note, action, onClick }: {
  title: string; icon: PricingIconName; price: string; caption: string; description: string;
  features: string[]; note: ReactNode; action: string; onClick: () => void;
}) {
  return <button className={styles.accountCard} type="button" aria-haspopup="dialog" onClick={onClick}>
    <span className={styles.accountHeading}><span className={styles.accessIcon}><PricingIcon name={icon} /></span><strong className={styles.accountTitle}>{title}</strong></span>
    <span className={styles.cardPrice}><span className={styles.priceLabel}>{title === 'Owner' ? 'From' : 'Subscription'}</span><span className={styles.priceLine}><strong>{price}</strong><span>/ month</span></span><span className={styles.annualCaption}>{caption}</span></span>
    <span className={styles.accountDescription}>{description}</span>
    <span className={styles.planFeatures}>{features.map(feature => <span key={feature}><span aria-hidden="true">✓</span>{feature}</span>)}</span>
    <span className={styles.cardNote}>{note}</span>
    <span className={styles.cardAction}>{action}<span aria-hidden="true">→</span></span>
  </button>;
}

export default function PricingContent({ signedIn = false, initialAudience = null, freeBusinessCredits }: { signedIn?: boolean; initialAudience?: PricingAudience | null; freeBusinessCredits?: number }) {
  const [audience, setAudience] = useState<PricingAudience | null>(initialAudience);
  const [feesOpen, setFeesOpen] = useState(false);
  const [feesTopic, setFeesTopic] = useState<'commission' | undefined>();
  const [ownerTitle, setOwnerTitle] = useState('How many assets?');
  const creditsLabel = freeBusinessCredits === undefined ? 'Monthly action credits' : `${freeBusinessCredits} monthly action credits`;
  const showFees = (topic?: 'commission') => { setFeesTopic(topic); setFeesOpen(true); };
  return <div className={styles.photoSurface}><div className={styles.shell}>
    <header className={styles.hero}>
      <h1>Subscriptions</h1>
      <p className={styles.heroDescription}>Three simple options. Choose what fits your work.</p>
    </header>
    <section className={styles.pricingChoices} aria-label="Choose your account">
      <AccountChoice title="Owner" icon="stock" price={rand(ownerHosting[0].monthly)} caption={`Or ${rand(ownerHosting[0].annually)}/year · 1–25 assets`}
        description="Know what you own, what it’s worth and what it costs."
        features={['Asset registers, valuations & reports', 'Maintenance, fuel & running costs', 'Documents and asset sharing']}
        note="Priced by active assets. Unlimited registers." action="Explore Owner plans" onClick={() => setAudience('owner')} />
      <AccountChoice title="Free Business" icon="link" price="R0" caption="No subscription fee"
        description="Work with the assets and enquiries your clients share."
        features={['Shared Assets & client enquiries', 'Value Asset & Marketplace', creditsLabel]}
        note="View shared assets for free. Upgrade when needed." action="Explore Free Business" onClick={() => setAudience('free-business')} />
      <AccountChoice title="Paid Business" icon="workspace" price={rand(businessHosting.monthly)} caption={`Or ${rand(businessHosting.annually)}/year`}
        description="Manage your stock, clients and team in one workspace."
        features={['Registers, Parts & Stock', 'Maintenance, costs & advert tools', 'Staff access · no monthly credit limit']}
        note={<>Client hosting from <span className={styles.rate}>{rand(ownerHosting[0].monthly / 4)} per client/month.</span></>} action="Explore Paid Business" onClick={() => setAudience('business')} />
    </section>
    <p className={styles.pricingNote}>Prices in rand · No VAT added · Optional assistance costs extra.</p>
    <p className={styles.signIn}>{signedIn ? <>Already have an account? <Link href="/account">Manage or upgrade your subscription</Link></> : <>Already have an account? <Link href="/auth#login">Log in</Link></>}</p>
    <PricingModal owner open={audience === 'owner'} title={ownerTitle} onClose={() => setAudience(null)}><PackageJourney signedIn={signedIn} onTitleChange={setOwnerTitle} /></PricingModal>
    <PricingModal owner open={audience === 'business'} title={ownerTitle} onClose={() => setAudience(null)}><PackageJourney audience="business" signedIn={signedIn} onTitleChange={setOwnerTitle} /></PricingModal>
    <PricingModal open={audience === 'free-business'} title="Free Business" onClose={() => setAudience(null)}>
      <section className={styles.freeBusiness} data-free-business aria-label="Free Business access">
        <div className={styles.freeSummary}><span className={styles.accessIcon}><PricingIcon name="link" /></span><div><strong>Shared assets. No subscription fee.</strong><p>Work with records your clients choose to share.</p></div><strong className={styles.freePrice}>R0</strong></div>
        <dl className={styles.freeBenefits}>
          <div><dt>Shared Assets</dt><dd>View client assets and enquiries. Manage, message and share where the sender’s permissions allow.</dd></div>
          <div><dt>{creditsLabel}</dt><dd>One credit per Manage visit, sent message or completed share. Viewing uses no credits. Track your balance in Account.</dd></div>
          <div><dt>Value Asset &amp; Marketplace</dt><dd>Use valuations and explore the marketplace from your workspace.</dd></div>
        </dl>
        <p className={styles.freeUpgrade}>Need your own registers, Parts &amp; Stock or staff access? Choose Paid Business.</p>
        <div className={styles.freeActions}><button type="button" onClick={() => setAudience('business')}>Compare Paid Business</button><Link className={styles.button} href={signedIn ? '/account' : '/business/join'}>{signedIn ? 'Go to my account' : 'Create free account'}</Link></div>
      </section>
    </PricingModal>
    <PricingModal open={feesOpen} title="Success fees & services" onClose={() => setFeesOpen(false)}><ServiceFees initialTopic={feesTopic} /></PricingModal>
    <details className={styles.pricingIncluded}>
      <summary className={styles.coverageSummary}><h2>What each account includes</h2><span className={styles.coverageToggle} aria-hidden="true" /></summary>
      <div className={styles.subscriptionDetails}>
        <article className={styles.subscriptionDetail}><h3>Owner</h3><p>Your assets, organised.</p><ul>
          <li>Asset records, costs, fuel, maintenance, documents, sharing and reports.</li><li>Unlimited registers within your active-asset limit.</li><li>Sold and archived assets don’t count towards your limit.</li>
        </ul></article>
        <article className={styles.subscriptionDetail}><h3>Free Business</h3><p>Start with shared assets.</p><ul>
          <li>Shared Assets, client enquiries, Value Asset and Marketplace.</li><li>{creditsLabel}. Viewing does not use credits.</li><li>Contributions depend on account approval and the sender’s permissions.</li>
        </ul></article>
        <article className={styles.subscriptionDetail}><h3>Paid Business</h3><p>Your full business workspace.</p><ul>
          <li>Stock and client registers, Parts &amp; Stock, maintenance tracking and cost records.</li><li>Staff access, showroom and advert tools. No monthly action-credit limit.</li><li>Client hosting adds 25% of the applicable Owner rate, billed to your business.</li>
        </ul></article>
      </div>
    </details>
    <div className={styles.serviceStrip}><div><strong>Extra help, when you need it.</strong><p>Setup, admin and success fees are agreed separately.</p></div><div className={styles.serviceActions}><button type="button" aria-haspopup="dialog" onClick={() => showFees()}>Services &amp; success fees</button><button type="button" aria-haspopup="dialog" onClick={() => showFees('commission')}>Partner earnings</button></div></div>
    <div className={styles.closing}>
      <div><h2>Need a hand choosing?</h2><p>We’ll help you find the right account and support.</p></div>
      <Link className={styles.contactButton} href="/contact-us"><PricingIcon name="support" /><span>Talk to Aim4price</span></Link>
    </div>
  </div></div>;
}
