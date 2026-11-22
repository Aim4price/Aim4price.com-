'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './owner-journey.module.css';
import DealerDetails from './dealer-details';
import PricingIcon, { type PricingIconName } from './pricing-icon';
import { adminRetainers, businessHosting, ownerHosting, rand } from '../../lib/hosting-pricing';

const planNames = ['Essentials', 'Growth', 'Professional'];
const planLimits = [25, 100, 300];
const plans = ownerHosting.map((plan, index) => ({
  name: planNames[index], range: plan.range, limit: planLimits[index],
  monthly: plan.monthly / 100, yearly: plan.annually / 100,
}));
const adminPlans = adminRetainers.map(plan => ({ hours: plan.hours, price: plan.cents / 100 }));
const money = (amount: number) => rand(Math.round(amount * 100));
type Setup = 'custom' | 'assisted' | 'self' | 'visit' | 'inspection';
type Admin = 'self' | '2' | '5' | '10' | 'custom';

function Choice({ selected, onClick, title, children, icon }: { selected: boolean; onClick: () => void; title: string; children: ReactNode; icon?: PricingIconName }) {
  return <button type="button" className={styles.choice} aria-pressed={selected} onClick={onClick}>
    <span className={styles.choiceTitle}><span className={styles.choiceLabel}>{icon && <span className={styles.choiceIcon}><PricingIcon name={icon} /></span>}{title}</span><span className={styles.selection} aria-hidden="true">{selected && <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3 3 7-7" /></svg>}</span></span>
    <span className={styles.choiceCopy}>{children}</span>
  </button>;
}

export default function PackageJourney({ onTitleChange, audience = 'owner', signedIn = false }: { signedIn?: boolean; onTitleChange?: (title: string) => void; audience?: 'owner' | 'business' }) {
  const dealer = audience === 'business';
  const firstStep = dealer ? 6 : 0;
  const [step, setStep] = useState(firstStep);
  const [detail, setDetail] = useState<'funding' | 'commission' | 'setup' | 'admin' | 'billing' | null>(null);
  const [detailReturn, setDetailReturn] = useState(firstStep);
  const [editing, setEditing] = useState(false);
  const [assetBand, setAssetBand] = useState<number | null>(null);
  const [yearly, setYearly] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(dealer ? null : 'self');
  const [help, setHelp] = useState<'none' | 'setup' | 'admin' | 'both' | null>(null);
  const [customers, setCustomers] = useState<'self' | 'customers' | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(dealer ? null : 'self');
  const heading = useRef<HTMLHeadingElement>(null);
  const plan = dealer ? { name: 'Paid Business', monthly: businessHosting.monthly / 100, yearly: businessHosting.annually / 100, limit: 0 } : assetBand !== null ? plans[assetBand] : undefined;
  const adminPlan = adminPlans.find(item => String(item.hours) === admin);
  const packagePrice = plan ? (yearly ? plan.yearly : plan.monthly + (adminPlan?.price ?? 0)) : null;
  const ready = step === 7 ? help !== null : step === 8 ? setup !== null : step === 6 ? customers !== null : step === 0 ? assetBand !== null : step === 5 ? setup === 'visit' || setup === 'inspection' || setup === 'assisted' : step === 1 ? setup !== null : admin !== null;
  const titles = ['How many assets?', dealer ? 'How will you add your stock?' : 'How will you add your assets?', dealer ? 'Who will manage the records?' : 'Who will manage your register?', dealer ? 'Your Paid Business package' : 'Your Owner package', dealer ? 'Choose monthly admin help' : 'How much admin help do you need?', 'What help do you need?', 'Manage client registers?', 'Choose your support', 'Choose setup help'];
  const detailTitles = { funding: 'Client hosting rates', commission: 'Partner commission', setup: 'Setup details', admin: 'Monthly admin help', billing: 'What your hosting includes' };
  useEffect(() => { onTitleChange?.(detail ? detailTitles[detail] : titles[step]); }, [step, detail, onTitleChange, dealer]);
  const move = (next: number) => {
    if (next === 3) setEditing(false);
    setDetail(null);
    setStep(next);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.closest('[data-pricing-content]')?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    });
  };
  const nextStep = () => {
    if (dealer) {
      if (step === 6) return editing ? 3 : 7;
      if (step === 7) return help === 'setup' || help === 'both' ? 8 : help === 'admin' ? 4 : 3;
      if (step === 8) return help === 'both' ? 4 : 3;
      return 3;
    }
    return 3;
  };
  const previousStep = () => {
    if (dealer) {
      if (step === 7) return 6;
      if (step === 8) return 7;
      if (step === 4) return help === 'both' ? 8 : 7;
      if (step === 3) return help === 'admin' || help === 'both' ? 4 : help === 'setup' ? 8 : 7;
      return 6;
    }
    return step === 3 ? 0 : 3;
  };
  const billing = <div className={styles.billing} role="group" aria-label={`${dealer ? 'Business' : 'Owner'} billing period`}>
    <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
    <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly</button>
  </div>;
  const setupLabel = setup === 'custom' ? 'Setup help · custom quote' : setup === 'assisted' ? 'Remote upload help' : setup === 'self' ? dealer ? 'No setup help needed' : 'Upload my own assets' : setup === 'visit' ? 'Asset recording visit' : 'Formal inspection / valuation';
  const adminLabel = admin === 'self' ? dealer ? 'No ongoing help needed' : 'Manage it myself' : admin === 'custom' ? 'Custom administration' : `Up to ${adminPlan?.hours} admin hours / month`;

  const openDetail = (next: NonNullable<typeof detail>) => {
    setDetailReturn(step);
    setDetail(next);
    requestAnimationFrame(() => { heading.current?.focus({ preventScroll: true }); heading.current?.closest('[data-pricing-content]')?.scrollTo(0, 0); });
  };

  const restart = () => { setEditing(false); setAssetBand(null); setSetup(dealer ? null : 'self'); setAdmin(dealer ? null : 'self'); setCustomers(null); setHelp(null); setYearly(false); move(firstStep); };

  const dealerStage = step === 6 ? 0 : step === 3 ? 2 : 1;

  return <section className={`${styles.journey} ${styles.simpleOwner} ${dealer ? styles.dealerJourney : ''}`} data-dealer-journey={dealer || undefined} data-pricing-view={detail ? 'details' : step === 3 ? 'summary' : 'question'} aria-label={`Build your ${dealer ? 'Business' : 'Owner'} package`}>
    <div className={styles.panel}>
      <div className={styles.content} data-pricing-content tabIndex={0} role="region" aria-label="Package options and details" key={detail ?? step}>
      {dealer && !detail && <ol className={styles.dealerProgress} aria-label="Business package steps">
        {['Clients', 'Support', 'Package'].map((label, index) => <li key={label} aria-current={dealerStage === index ? 'step' : undefined} data-complete={index < dealerStage || undefined}><span>{index < dealerStage ? '✓' : index + 1}</span>{label}</li>)}
      </ol>}
      <div className={styles.heading}>
        <p>Built around your choices</p>
        <h2 ref={heading} tabIndex={-1}>{detail ? detailTitles[detail] : titles[step]}</h2>
        {!detail && step !== 3 && <p>{[
          'Count active assets across your registers. Sold and archived assets are excluded.',
          'Do it yourself or get help with the initial setup.',
          'Choose self-service or monthly admin help.',
          'Review your hosting and optional services.',
          'Choose a monthly retainer. Unused hours expire each month.',
          'Choose remote help, an on-site visit or a specialist assessment.',
          'Choose whether to manage customers’ asset registers.',
          'Work independently or add the help you need.',
          'Choose stock uploads or another setup service.',
        ][step]}</p>}
      </div>

      {!detail && step === 0 && <>
        <div className={styles.assetChoices} role="group" aria-label="Number of active assets">
          {plans.map((item, index) => <Choice key={item.name} selected={assetBand === index} onClick={() => setAssetBand(index)} title={item.range}><span className={styles.choicePrices}><span className={`${styles.choiceRate} ${styles.rate}`}>{money(item.monthly)}/month</span>{' '}<span className={styles.rate}>or {money(item.yearly)}/year</span></span></Choice>)}
          <Choice selected={assetBand === 3} onClick={() => setAssetBand(3)} title="301+">Enterprise · quoted for your asset count</Choice>
        </div>
      </>}

      {!detail && step === 1 && <>
        <div className={styles.choices} role="group" aria-label="Setup preference">
          <Choice selected={setup === 'self'} onClick={() => setSetup('self')} title={dealer ? 'Our team will add stock' : 'Upload myself'}>{dealer ? 'Add stock details, photos and documents. No setup fee.' : 'Add my details, photos and documents. No setup fee.'}</Choice>
          {dealer ? <Choice selected={setup === 'assisted'} onClick={() => setSetup('assisted')} title="Aim4price helps add stock">We add stock from your supplied details, photos and documents.</Choice> : <Choice selected={setup === 'visit' || setup === 'inspection'} onClick={() => { if (setup === 'self') setSetup(null); move(5); }} title="Arrange a visit">{dealer ? 'Help recording stock details, photos and documents.' : 'Help recording machinery and building my register.'}</Choice>}

        </div>
      </>}

      {!detail && step === 5 && <div className={styles.choices} role="group" aria-label="Visit type">
        <Choice selected={setup === 'visit'} onClick={() => setSetup('visit')} title={dealer ? "Record our stock" : "Record my assets"}><span className={styles.choiceRate}>R450/hour + R7.50/km return travel</span><span className={styles.choiceSecondary}>Details and photos · one-hour minimum.</span></Choice>
        <Choice selected={setup === 'assisted'} onClick={() => setSetup('assisted')} title="Remote upload help"><span className={styles.choiceRate}>R250/hour · R62.50 per 15 minutes</span><span className={styles.choiceSecondary}>Send your details and photos · 15-minute minimum.</span></Choice>
        <Choice selected={setup === 'inspection'} onClick={() => setSetup('inspection')} title="Formal inspection or valuation"><span className={styles.choiceRate}>Quoted upfront</span><span className={styles.choiceSecondary}>Specialist assessment for your requirements.</span></Choice>
      </div>}

      {!detail && step === 2 && <>
        <div className={styles.choices} role="group" aria-label="Ongoing administration">
          <Choice selected={admin === 'self'} onClick={() => { setAdmin('self'); }} title={dealer ? 'Our team will manage it' : 'I’ll manage it'}>No additional admin fee.</Choice>
          <Choice selected={admin !== null && admin !== 'self'} onClick={() => { if (admin === 'self') setAdmin(null); move(4); }} title="I’d like monthly help">{dealer ? 'Help capturing records and keeping stock information organised.' : 'Help capturing records and keeping my register organised.'}</Choice>
        </div>
      </>}

      {!detail && step === 4 && <>
          <div className={styles.assetChoices} role="group" aria-label="Admin package">
            {adminPlans.map(item => <Choice key={item.hours} selected={admin === String(item.hours)} onClick={() => setAdmin(String(item.hours) as Admin)} title={`Up to ${item.hours} hours`}><span className={styles.choiceRate}>{money(item.price)}/month</span></Choice>)}
            <Choice selected={admin === 'custom'} onClick={() => setAdmin('custom')} title="More than 10 hours">Custom quote</Choice>
          </div>
          {!dealer && <div className={styles.optionalHelp}><button type="button" onClick={() => { setAdmin('self'); setEditing(false); move(3); }}>No monthly help needed</button><button type="button" onClick={() => openDetail('admin')}>What does admin help include?</button></div>}
      </>}

      {!detail && dealer && step === 6 && <>
        <div className={styles.dealerBase}><span><PricingIcon name="stock" /><strong>Registers, Parts & Stock</strong></span><span className={styles.baseRates}><strong className={styles.rate}>{money(businessHosting.monthly / 100)}/month</strong><span className={styles.rate}>or {money(businessHosting.annually / 100)}/year</span></span></div>
        <div className={`${styles.choices} ${styles.dealerChoices}`} role="group" aria-label="Customer registers">
          <Choice icon="stock" selected={customers === 'self'} onClick={() => setCustomers('self')} title="Our stock only"><span className={styles.choiceRate}>No client hosting fee</span><span className={styles.choiceSecondary}>Add client registers whenever you need them.</span></Choice>
          <Choice icon="clients" selected={customers === 'customers'} onClick={() => setCustomers('customers')} title="Stock and client registers"><span className={styles.choiceRate}>From <span className={styles.rate}>{rand(ownerHosting[0].monthly / 4)} per client/month</span></span><span className={styles.choiceSecondary}>25% of normal Owner hosting fees.</span></Choice>
        </div>
        <div className={styles.clientAssurance}><PricingIcon name="shield" /><p><strong>Your clients stay yours.</strong> Aim4price works through your business.</p><button type="button" onClick={() => openDetail('funding')}>View client hosting rates</button></div>
      </>}

      {!detail && dealer && step === 7 && <div className={styles.assetChoices} role="group" aria-label="Aim4price assistance">
        {([
          ['none', 'No help needed', 'stock', 'No assistance fee', 'Your team handles setup and records.'],
          ['setup', 'Help getting set up', 'setup', 'From R250/hour', 'Upload help or a custom setup quote.'],
          ['admin', 'Monthly admin help', 'admin', `From ${money(adminPlans[0].price)}/month`, 'Up to 2 hours of agreed admin work.'],
          ['both', 'Setup and monthly help', 'support', 'Choose both services', 'Build your setup and admin package.'],
        ] as const).map(([value, title, icon, price, copy]) => <Choice key={value} icon={icon} selected={help === value} title={title} onClick={() => {
          setHelp(value);
          if (value === 'none' || value === 'admin') setSetup('self');
          else if (setup === 'self') setSetup(null);
          if (value === 'none' || value === 'setup') setAdmin('self');
          else if (admin === 'self') setAdmin(null);
        }}><span className={styles.choiceRate}>{price}</span><span className={styles.choiceSecondary}>{copy}</span></Choice>)}
      </div>}
      {!detail && dealer && step === 8 && <div className={`${styles.choices} ${styles.dealerChoices}`} role="group" aria-label="Setup assistance">
        <Choice icon="stock" selected={setup === 'assisted'} onClick={() => setSetup('assisted')} title="Upload our stock"><span className={styles.choiceRate}>R250/hour <span className={styles.rateQualifier}>· remote help</span></span><span className={styles.choiceSecondary}>We upload the details and photos you supply.</span></Choice>
        <Choice icon="setup" selected={setup === 'custom'} onClick={() => setSetup('custom')} title="Other setup help"><span className={styles.choiceRate}>Quoted upfront</span><span className={styles.choiceSecondary}>We agree the work and cost before starting.</span></Choice>
      </div>}

      {!detail && dealer && step === 3 && <div className={styles.review}>
        <div className={styles.reviewTotal}>
          <div aria-live="polite">
            <p className={styles.label}>Paid Business</p>
            <p className={styles.price} data-dealer-package-price>{money(packagePrice ?? 0)}<span>/{yearly ? 'year hosting' : adminPlan ? 'month total' : 'month hosting'}</span></p>
            {adminPlan && (yearly || !plan) && <p className={styles.annualAdmin} data-recurring-admin>+ {money(adminPlan.price)}/month admin</p>}
            {adminPlan && plan && !yearly && <p className={styles.totalCaption}>{money(plan.monthly)}/month hosting + {money(adminPlan.price)}/month admin</p>}
            {admin === 'custom' && <p className={styles.totalCaption}>+ Custom admin retainer, quoted separately.</p>}
            {customers === 'customers' && <p className={styles.totalCaption}>Client hosting is additional, priced per client.</p>}

          </div>
          {plan && <div className={styles.reviewBilling}>{billing}<p className={styles.yearlySaving}><strong>Save {money(plan.monthly * 12 - plan.yearly)}/year</strong><span>on yearly hosting</span></p></div>}
        </div>
        <div className={styles.reviewRows}>
          <div className={styles.reviewRow}><div><span className={styles.rowLabel}>Once-off setup</span><strong>{setupLabel}</strong></div><span>{setup === 'self' ? 'No setup fee' : setup === 'assisted' ? 'R250/hour · once-off' : setup === 'visit' ? 'R450/hour + travel' : 'Separate quote'}</span><button type="button" aria-label="Change setup" onClick={() => { setEditing(true); move(dealer ? 7 : 1); }}>Edit</button></div>
          {dealer && <div className={styles.reviewRow}><div><span className={styles.rowLabel}>Client registers</span><strong>{customers === 'customers' ? 'Controlled by our business' : 'Add customers later'}</strong></div><span>{customers === 'customers' ? `From ${rand(ownerHosting[0][yearly ? 'annually' : 'monthly'] / 4)}/client/${yearly ? 'year' : 'month'}` : 'No client hosting fee'}</span><button type="button" aria-label="Change customer registers" onClick={() => { setEditing(true); move(6); }}>Edit</button></div>}
          <div className={styles.reviewRow}><div><span className={styles.rowLabel}>Admin help</span><strong>{adminLabel}</strong></div><span>{adminPlan ? `+ ${money(adminPlan.price)}/month` : admin === 'self' ? 'No admin fee' : '+ Custom quote'}</span><button type="button" aria-label="Change help" onClick={() => { setEditing(true); move(dealer ? 7 : 2); }}>Edit</button></div>
        </div>
        <div className={styles.detailLinks}>
          {dealer && <><button type="button" onClick={() => openDetail('funding')}>Client hosting rates</button><button type="button" onClick={() => openDetail('commission')}>Partner earnings</button></>}
          {setup !== 'self' && <button type="button" onClick={() => openDetail('setup')}>View setup details</button>}
          {admin !== 'self' && <button type="button" onClick={() => openDetail('admin')}>View admin details</button>}
          <button type="button" className={styles.restart} onClick={restart}>Start again</button>
        </div>
        <div className={styles.summaryFooter}><p><strong>You manage your clients.</strong> Aim4price works through your business.</p><p>Prices in rand · No VAT added · No payment or booking yet.</p></div>

      </div>}

      {!detail && !dealer && step === 3 && <div className={styles.review}>
        <div className={styles.reviewTotal}>
          <div aria-live="polite">
            <p className={styles.label}>{plan ? `${plan.name} · up to ${plan.limit} active assets` : 'Enterprise · 301+ assets'}</p>
            <p className={styles.price} data-owner-package-price>{packagePrice !== null ? money(packagePrice) : 'Custom quote'}{plan && <span>/{yearly ? 'year' : 'month'}{adminPlan && !yearly ? ' total' : ' hosting'}</span>}</p>
            {adminPlan && (yearly || !plan) && <p className={styles.annualAdmin} data-recurring-admin>+ {money(adminPlan.price)}/month admin</p>}
            {adminPlan && plan && !yearly && <p className={styles.totalCaption}>{money(plan.monthly)}/month hosting + {money(adminPlan.price)}/month admin</p>}
            {admin === 'custom' && <p className={styles.totalCaption}>Custom admin help quoted separately.</p>}
            <button type="button" className={styles.restart} onClick={() => { setEditing(true); move(0); }}>Change asset range</button>
          </div>
          {plan && <div className={styles.reviewBilling}>{billing}<p className={styles.yearlySaving}><strong>Save {money(plan.monthly * 12 - plan.yearly)}/year</strong><span>{((1 - plan.yearly / (plan.monthly * 12)) * 100).toFixed(1)}% off hosting</span></p></div>}
        </div>
        <p className={styles.included}>Self-service uploads and unlimited registers included within your asset limit.</p>
        {(setup !== 'self' || admin !== 'self') && <div className={styles.reviewRows} aria-label="Optional services">
          {setup !== 'self' && <div className={styles.reviewRow}><div><span className={styles.rowLabel}>Once-off assistance</span><strong>{setupLabel}</strong></div><span>{setup === 'assisted' ? 'R250/hour' : setup === 'visit' ? 'R450/hour + travel' : 'Separate quote'}</span><button type="button" onClick={() => setSetup('self')}>Remove</button></div>}
          {admin !== 'self' && <div className={styles.reviewRow}><div><span className={styles.rowLabel}>Monthly admin</span><strong>{adminLabel}</strong></div><span>{adminPlan ? `${money(adminPlan.price)}/month${plan && !yearly ? ' included' : ' admin'}` : 'Separate quote'}</span><button type="button" onClick={() => setAdmin('self')}>Remove</button></div>}
          {plan && adminPlan && <p className={styles.packageTotal}>{yearly ? `${money(plan.yearly)}/year hosting + ${money(adminPlan.price)}/month admin` : `${money(plan.monthly + adminPlan.price)}/month total`}{setup !== 'self' ? ', plus quoted setup costs.' : '.'}</p>}
        </div>}
        <div className={styles.optionalHelp} aria-label="Optional help and pricing details">
          <button type="button" onClick={() => openDetail('setup')}>Need help uploading?</button>
          <button type="button" onClick={() => { setEditing(true); move(4); }}>Need monthly admin help?</button>
          <button type="button" onClick={() => openDetail('billing')}>What’s included?</button>
        </div>
      </div>}

      {detail && <div className={styles.detailPage}>
        {detail === 'billing' && <dl className={styles.billingNotes}>
          <div><dt>Your tools</dt><dd>Asset records, documents, costs, fuel, maintenance, sharing and reports. Self-service uploads are free.</dd></div>
          <div><dt>Your asset limit</dt><dd>Only active assets count. Sold and archived assets are excluded.</dd></div>
          <div><dt>Account billing</dt><dd>Hosting is billed to your Owner account’s email. Prices are in rand. Aim4price is not VAT registered; no VAT is added.</dd></div>
          <div><dt>Optional services</dt><dd>Extra costs are confirmed before work starts.</dd></div>
          <div><dt>No commitment yet</dt><dd>No payment or booking is made here.</dd></div>
        </dl>}
        {['funding', 'commission'].includes(detail) && <DealerDetails topic={detail as 'funding' | 'commission'} />}
        {detail === 'setup' && <>
          <p>Upload your own details, photos and documents for free. Hosting fees still apply.</p>
          <dl className={styles.dealerRates}>
            <div><dt>Remote / WhatsApp help</dt><dd>R250/hour</dd></div>
            <div><dt>On-site asset recording</dt><dd>R450/hour</dd></div>
            <div><dt>Return travel</dt><dd>R7.50/km</dd></div>
          </dl>
          <p>Remote help has a 15-minute minimum, then R62.50 per 15 minutes. On-site recording has a one-hour minimum, then 15-minute increments; routine office uploading and checking are included.</p>
          <p>Travel is charged once per visit. Longer trips, formal inspections and professional valuations are quoted separately. The same assistance rates apply to owners and businesses.</p>
          {!dealer && <button type="button" className={styles.secondary} onClick={() => { setEditing(true); move(5); }}>Explore help options</button>}
        </>}
        {detail === 'admin' && <>
          <p>We capture supplied records, organise documents and keep {dealer ? 'your agreed records' : 'your asset register'} up to date.</p>
          <dl className={styles.dealerRates}>{admin === 'self' || admin === null ? adminPlans.map(item => <div key={item.hours}><dt>Up to {item.hours} hours / month</dt><dd>{money(item.price)}/month</dd></div>) : <><div><dt>Your monthly help</dt><dd>{adminLabel}</dd></div><div><dt>Monthly fee</dt><dd>{adminPlan ? money(adminPlan.price) : 'Custom quote'}</dd></div></>}<div><dt>Once-off remote help</dt><dd>R250/hour</dd></div></dl>
          {dealer && <p>We agree which records the work covers before starting. Your business authorises work on its client registers. Admin help covers the agreed scope and hours.</p>}
          <p>Hours expire monthly and do not roll over. If you need more capacity, we agree a higher retainer before extra work starts. No automatic hourly overages. Admin stays monthly when hosting is yearly.</p><p>Travel, formal inspections and professional valuation research are excluded.</p>
        </>}
      </div>}
      </div>
      <div className={styles.navigation}>
        {detail ? <button type="button" className={styles.secondary} onClick={() => move(detailReturn)}>{detailReturn === 3 ? 'Back to package' : 'Back to choices'}</button> : <>
        {(dealer ? step !== firstStep && !editing : step === 5 || step === 4 || (!editing && step > firstStep)) ? <button type="button" className={styles.secondary} onClick={() => move(previousStep())}>Back</button> : <span className={styles.note}>{editing ? 'Adjust your choice, then update.' : dealer ? 'Paid Business · R199/month' : ready ? 'Your base plan is selected.' : 'Choose your asset range.'}</span>}
        {step !== 3 ? <button type="button" className={styles.primary} disabled={!ready} onClick={() => { const next = editing && !dealer ? 3 : nextStep(); if (next === 3) setEditing(false); move(next); }}>{(editing && !dealer) || nextStep() === 3 ? editing ? 'Update package' : 'See my package' : 'Continue'} </button> : <div className={styles.finalActions}>{!dealer && <button type="button" className={styles.restart} onClick={restart}>Start again</button>}<Link href={signedIn || !plan ? "/contact-us" : `/auth?accountType=${audience}#signup`} className={styles.primary}>{signedIn || !plan ? "Discuss my package" : "Sign up"}</Link></div>}
        </>}
      </div>
    </div>
  </section>;
}
