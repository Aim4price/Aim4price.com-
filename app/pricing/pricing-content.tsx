'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './pricing.module.css';
import PackageJourney from './owner-journey';
import PricingModal from './pricing-modal';
import DealerDetails from './dealer-details';
import ServiceFees from './service-fees';
import { businessHosting, ownerHosting, rand, type HostingAudience } from '../../lib/hosting-pricing';

export default function PricingContent({ signedIn = false, initialAudience = null }: { signedIn?: boolean; initialAudience?: HostingAudience | null }) {
  const [audience, setAudience] = useState<HostingAudience | null>(initialAudience);
  const [feesOpen, setFeesOpen] = useState(false);
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
        <button type="button" aria-haspopup="dialog" onClick={() => setAudience('dealer')} className={styles.accountCard}>
          <strong className={styles.accountTitle}>Dealer</strong>
          <span className={styles.cardPrice}><span className={styles.priceLabel}>Hosting</span><span className={styles.priceLine}><strong>{rand(businessHosting.monthly)}</strong><span>/ month</span></span></span>
          <span className={styles.accountDescription}>Manage dealership stock and your clients’ assets.</span>
          <span className={styles.cardNote}>Client hosting from {rand(ownerHosting[0].monthly / 4)} per client/month.</span>
          <span className={styles.cardAction}>Explore Dealer hosting</span>
        </button>
        <button type="button" aria-haspopup="dialog" onClick={() => setAudience('business')} className={styles.accountCard}>
          <strong className={styles.accountTitle}>Business</strong>
          <span className={styles.cardPrice}><span className={styles.priceLabel}>Shared access</span><span className={styles.priceLine}><strong>Free</strong></span></span>
          <span className={styles.accountDescription}>Work with client assets as a repairer, insurer or financier.</span>
          <span className={styles.cardNote}>Your own workspace: R199/month or R1 999/year.</span>
          <span className={styles.cardAction}>Explore Business access</span>
        </button>
      </section>
      <p className={styles.signIn}>{signedIn ? <>Want to change your package? <Link href="/contact-us">Discuss it with Aim4price</Link></> : <>Already have an account? <Link href="/auth#login">Log in</Link></>}</p>
      <PricingModal owner open={audience === 'owner'} title={ownerTitle} onClose={() => setAudience(null)}><PackageJourney signedIn={signedIn} onTitleChange={setOwnerTitle} /></PricingModal>
      <PricingModal owner open={audience === 'dealer'} title={ownerTitle} onClose={() => setAudience(null)}><PackageJourney audience="dealer" signedIn={signedIn} onTitleChange={setOwnerTitle} /></PricingModal>
      <PricingModal open={audience === 'business'} title="Choose your Business access" onClose={() => setAudience(null)}>
        <div className={styles.businessAccess}>
          <section className={styles.accessOption} aria-labelledby="business-shared-title">
            <div className={styles.accessHeading}><h3 id="business-shared-title">Shared access</h3><strong>Free</strong></div>
            <p>Work with assets your clients share. They choose which records you can view or update.</p>
            <Link className={styles.button} href={signedIn ? '/contact-us' : '/business/join'}>{signedIn ? 'Discuss shared access' : 'Create free Business account'}</Link>
          </section>
          <section className={styles.accessOption} aria-labelledby="business-hosting-title">
            <div className={styles.accessHeading}><h3 id="business-hosting-title">Your own workspace</h3><strong>{rand(businessHosting.monthly)}<span>/month</span></strong></div>
            <p className={styles.accessAnnual}>Or {rand(businessHosting.annually)}/year for hosting.</p>
            <p>Manage client records in your Business workspace. Client hosting is separate, from {rand(ownerHosting[0].monthly / 4)} per client/month.</p>
            <Link className={styles.button} href="/contact-us">Discuss Business hosting</Link>
          </section>
          <p className={styles.relationshipNote}><strong>You manage your clients.</strong> Aim4price works through your business.</p>
          <details className={styles.accessDetails}><summary>Client hosting rates &amp; sharing<span className={styles.coverageToggle} aria-hidden="true" /></summary><DealerDetails topic="funding" /></details>
          <p className={styles.accessFootnote}>We confirm paid hosting, access and any assistance before setup.</p>
        </div>
      </PricingModal>
      <PricingModal open={audience === 'middleman'} title="Middleman access" onClose={() => setAudience(null)}>
        <div className={styles.accessExplanation}>
          <h2>Free basic access.</h2>
          <p>Connect owners and opportunities. Paid assistance and client hosting are separate.</p>
          <DealerDetails topic="commission" />
          <Link className={styles.button} href="/contact-us">Discuss Middleman access</Link>
        </div>
      </PricingModal>
      <PricingModal open={feesOpen} title="Success fees & services" onClose={() => setFeesOpen(false)}><ServiceFees /></PricingModal>
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
            <h3>Dealer</h3>
            <p>A workspace for your dealership stock.</p>
            <ul>
              <li>Your stock workspace is covered by your hosting.</li>
              <li>Client hosting is 25% of normal Owner fees, billed to your dealership.</li>
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
      <p className={styles.additionalLinks}><button type="button" aria-haspopup="dialog" onClick={() => setAudience('middleman')}>Middleman access</button><button type="button" aria-haspopup="dialog" onClick={() => setFeesOpen(true)}>Success fees &amp; services</button></p>
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
