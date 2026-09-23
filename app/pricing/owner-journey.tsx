'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './owner-journey.module.css';
import DealerDetails from './dealer-details';

const plans = [
  { name: 'Essentials', range: '1–25', limit: 25, monthly: 99, yearly: 999 },
  { name: 'Growth', range: '26–100', limit: 100, monthly: 199, yearly: 1999 },
  { name: 'Business', range: '101–300', limit: 300, monthly: 399, yearly: 3999 },
];
const adminPlans = [{ hours: 2, price: 499 }, { hours: 5, price: 999 }, { hours: 10, price: 1799 }];
const money = (amount: number) => `R${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
type Setup = 'self' | 'visit' | 'inspection';
type Admin = 'self' | '2' | '5' | '10' | 'custom';

function Choice({ selected, onClick, title, children }: { selected: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return <button type="button" className={styles.choice} aria-pressed={selected} onClick={onClick}>
    <span className={styles.choiceTitle}>{title}<span className={styles.selection} aria-hidden="true">{selected ? '✓' : ''}</span></span>
    <span className={styles.choiceCopy}>{children}</span>
  </button>;
}

export default function PackageJourney({ onTitleChange, audience = 'owner' }: { onTitleChange?: (title: string) => void; audience?: 'owner' | 'dealer' }) {
  const dealer = audience === 'dealer';
  const firstStep = dealer ? 1 : 0;
  const [step, setStep] = useState(firstStep);
  const [detail, setDetail] = useState<'tools' | 'funding' | 'commission' | 'setup' | 'admin' | null>(null);
  const [editing, setEditing] = useState(false);
  const [assetBand, setAssetBand] = useState<number | null>(null);
  const [yearly, setYearly] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [customers, setCustomers] = useState<'self' | 'customers' | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const plan = dealer ? { name: 'Dealer Partner', monthly: 199, yearly: 1999, limit: 0 } : assetBand !== null ? plans[assetBand] : undefined;
  const adminPlan = adminPlans.find(item => String(item.hours) === admin);
  const ready = step === 6 ? customers !== null : step === 0 ? assetBand !== null : step === 1 || step === 5 ? setup !== null : admin !== null;
  const titles = ['How many assets?', dealer ? 'How will you add your stock?' : 'How will you add your assets?', dealer ? 'Who will manage your stock records?' : 'Who will manage your register?', dealer ? 'Your Dealer package' : 'Your Owner package', 'How much admin help do you need?', 'What help do you need?', 'Will you manage customer registers?'];
  const detailTitles = { tools: 'Your Dealer tools', funding: 'Funding customer accounts', commission: 'Partner commission', setup: 'Setup details', admin: 'Monthly admin help' };
  useEffect(() => { onTitleChange?.(detail ? detailTitles[detail] : titles[step]); }, [step, detail, onTitleChange, dealer]);
  const move = (next: number) => {
    setDetail(null);
    setStep(next);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.closest('[data-pricing-content]')?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    });
  };
  const billing = <div className={styles.billing} role="group" aria-label={`${dealer ? 'Dealer' : 'Owner'} billing period`}>
    <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
    <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly</button>
  </div>;
  const setupLabel = setup === 'self' ? dealer ? 'Stock added by our team' : 'Upload my own assets' : setup === 'visit' ? 'Asset recording visit' : 'Formal inspection / valuation';
  const adminLabel = admin === 'self' ? dealer ? 'Managed by our team' : 'Manage it myself' : admin === 'custom' ? 'Custom administration' : `Up to ${adminPlan?.hours} admin hours / month`;

  const openDetail = (next: NonNullable<typeof detail>) => {
    setDetail(next);
    requestAnimationFrame(() => { heading.current?.focus({ preventScroll: true }); heading.current?.closest('[data-pricing-content]')?.scrollTo(0, 0); });
  };

  return <section className={styles.journey} aria-label={`Build your ${dealer ? 'Dealer' : 'Owner'} package`}>
    <div className={styles.panel}>
      <div className={styles.content} data-pricing-content key={detail ?? step}>
      <div className={styles.heading}>
        <p>{step < 3 ? `Step ${step + 1} of 3` : 'Built around your choices'}</p>
        <h2 ref={heading} tabIndex={-1}>{detail ? detailTitles[detail] : titles[step]}</h2>
        {!detail && step !== 3 && <p>{[
          'Choose how many active assets you have.',
          'Do it yourself or get help with the initial setup.',
          'Choose self-service or monthly admin help.',
          'Review your subscription and optional services.',
          'Choose your monthly admin package.',
          'Choose asset recording or a specialist assessment.',
          'Choose how you plan to use your Dealer account.',
        ][step]}</p>}
      </div>

      {!detail && step === 0 && <>
        <div className={styles.assetChoices} role="group" aria-label="Number of active assets">
          {plans.map((item, index) => <Choice key={item.name} selected={assetBand === index} onClick={() => setAssetBand(index)} title={item.range}>{money(item.monthly)}/month · {item.name}</Choice>)}
          <Choice selected={assetBand === 3} onClick={() => setAssetBand(3)} title="301+">Enterprise · custom quote</Choice>
        </div>
      </>}

      {!detail && step === 1 && <>
        <div className={styles.choices} role="group" aria-label="Setup preference">
          <Choice selected={setup === 'self'} onClick={() => setSetup('self')} title={dealer ? 'Our team will add stock' : 'Upload myself'}>{dealer ? 'Add stock details, photos and documents. No setup fee.' : 'Add my details, photos and documents. No setup fee.'}</Choice>
          <Choice selected={setup === 'visit' || setup === 'inspection'} onClick={() => { if (setup === 'self') setSetup(null); move(5); }} title="Arrange a visit">{dealer ? 'Help recording stock details, photos and documents.' : 'Help recording machinery and building my register.'}</Choice>

        </div>
      </>}

      {!detail && step === 5 && <div className={styles.choices} role="group" aria-label="Visit type">
        <Choice selected={setup === 'visit'} onClick={() => setSetup('visit')} title={dealer ? "Record our stock" : "Record my assets"}>Capture details and photos. Per-asset fees + travel.</Choice>
        <Choice selected={setup === 'inspection'} onClick={() => setSetup('inspection')} title="Formal inspection or valuation">Specialist assessment. Separately quoted.</Choice>
      </div>}

      {!detail && step === 2 && <>
        <div className={styles.choices} role="group" aria-label="Ongoing administration">
          <Choice selected={admin === 'self'} onClick={() => { setAdmin('self'); }} title={dealer ? 'Our team will manage it' : 'I’ll manage it'}>No additional admin fee.</Choice>
          <Choice selected={admin !== null && admin !== 'self'} onClick={() => { if (admin === 'self') setAdmin(null); move(4); }} title="I’d like monthly help">{dealer ? 'Help capturing records and keeping stock information organised.' : 'Help capturing records and keeping my register organised.'}</Choice>
        </div>
      </>}

      {!detail && step === 4 && <>
          <div className={styles.assetChoices} role="group" aria-label="Admin package">
            {adminPlans.map(item => <Choice key={item.hours} selected={admin === String(item.hours)} onClick={() => setAdmin(String(item.hours) as Admin)} title={`Up to ${item.hours} hours`}>{money(item.price)}/month</Choice>)}
            <Choice selected={admin === 'custom'} onClick={() => setAdmin('custom')} title="More than 10 hours">Custom quote</Choice>
          </div>
      </>}

      {!detail && dealer && step === 6 && <div className={styles.choices} role="group" aria-label="Customer registers">
        <Choice selected={customers === 'self'} onClick={() => setCustomers('self')} title="Our stock only, for now">Start with our dealership’s stock.</Choice>
        <Choice selected={customers === 'customers'} onClick={() => setCustomers('customers')} title="Stock & customer registers">Manage customer assets with each Owner’s permission.</Choice>
      </div>}

      {!detail && step === 3 && <div className={styles.review}>
        <div className={styles.reviewTotal}>
          <div aria-live="polite">
            <p className={styles.label}>{dealer ? 'Dealer Partner · launch pricing' : plan ? `${plan.name} · up to ${plan.limit} active assets` : 'Enterprise · more than 300 assets'}</p>
            {plan && admin !== 'custom' ? <>
              <p className={styles.price}>{money(yearly ? plan.yearly : plan.monthly + (adminPlan?.price ?? 0))}<span>/{yearly ? 'year' : 'month'}</span></p>
              <p className={styles.totalCaption}>{yearly ? adminPlan ? `+ ${money(adminPlan.price)}/month for admin help.` : 'Base plan billed once a year. No admin fee.' : adminPlan ? 'Base plan and monthly admin help combined.' : 'Subscription only. No admin fee.'}</p>
            </> : <><p className={styles.quoteTitle}>Custom quote</p><p className={styles.totalCaption}>{plan ? `${money(yearly ? plan.yearly : plan.monthly)}/${yearly ? 'year' : 'month'} base plan. Admin quoted separately.` : adminPlan ? `Enterprise plan quoted separately. Admin: ${money(adminPlan.price)}/month.` : 'We’ll confirm pricing for your requirements.'}</p></>}
          </div>
          {plan && <div className={styles.reviewBilling}>{billing}<p className={styles.yearlySaving}><strong>Save {money(plan.monthly * 12 - plan.yearly)}/year</strong><span>{((1 - plan.yearly / (plan.monthly * 12)) * 100).toFixed(1)}% off</span></p><p>Yearly saving on the base plan only</p></div>}
        </div>
        {setup !== 'self' && <p className={styles.serviceNote}>Setup is quoted separately, in addition to your subscription.</p>}
        <div className={styles.reviewRows}>
          <div className={styles.reviewRow}><div><span className={styles.rowLabel}>Base plan</span><strong>{plan ? plan.name : 'Enterprise'}</strong></div><span>{plan ? `${money(yearly ? plan.yearly : plan.monthly)}/${yearly ? 'year' : 'month'}` : 'Custom quote'}</span>{!dealer && <button type="button" aria-label="Change assets" onClick={() => { setEditing(true); move(0); }}>Edit</button>}</div>
          <div className={styles.reviewRow}><div><span className={styles.rowLabel}>Initial setup</span><strong>{setupLabel}</strong></div><span>{setup === 'self' ? 'No setup fee' : setup === 'visit' ? 'Capture + travel, quoted separately' : 'Separate custom quote'}</span><button type="button" aria-label="Change setup" onClick={() => { setEditing(true); move(1); }}>Edit</button></div>
          <div className={styles.reviewRow}><div><span className={styles.rowLabel}>Admin help</span><strong>{adminLabel}</strong></div><span>{adminPlan ? `${money(adminPlan.price)}/month` : admin === 'self' ? 'No admin fee' : 'Custom quote'}</span><button type="button" aria-label="Change help" onClick={() => { setEditing(true); move(2); }}>Edit</button></div>
          {dealer && <div className={styles.reviewRow}><div><span className={styles.rowLabel}>Customer registers</span><strong>{customers === 'customers' ? 'Manage with Owner permission' : 'Add customers later'}</strong></div><span>Owner subscriptions separate</span><button type="button" aria-label="Change customer registers" onClick={() => { setEditing(true); move(6); }}>Edit</button></div>}
        </div>
        <div className={styles.detailLinks}>
          {dealer && <><button type="button" onClick={() => openDetail('tools')}>Dealer tools</button><button type="button" onClick={() => openDetail('funding')}>Customer funding</button><button type="button" onClick={() => openDetail('commission')}>Partner commission</button></>}
          {setup !== 'self' && <button type="button" onClick={() => openDetail('setup')}>View setup details</button>}
          {admin !== 'self' && <button type="button" onClick={() => openDetail('admin')}>View admin details</button>}
        </div>
        {dealer && <p className={styles.reviewNote}>Your Dealer plan supports stock and customer management. Each Owner needs a separate subscription; you can optionally fund it. No customer subscriptions are added to this total.</p>}
        <p className={styles.reviewNote}>Admin help is available anytime. Prices in rand. No payment or booking is made here.</p>

      </div>}

      {detail && <div className={styles.detailPage}>
        {['tools', 'funding', 'commission'].includes(detail) && <DealerDetails topic={detail as 'tools' | 'funding' | 'commission'} />}
        {detail === 'setup' && (setup === 'visit' ? <>
          <p>We record details and photographs to help build an organised {dealer ? 'stock register' : 'asset register'}.</p>
          <dl className={styles.dealerRates}><div><dt>Road-licensed asset</dt><dd>R100 per asset</dd></div><div><dt>Other asset</dt><dd>R50 per asset</dd></div><div><dt>Return travel</dt><dd>R7.50/km</dd></div></dl>
          <p>Travel is charged once per visit. Your quote depends on the asset mix and distance.</p>
          <p>Asset recording is not a formal inspection or certified valuation. These services require a separate quote.</p>
        </> : <><p>A formal inspection or professional valuation is quoted separately for your machinery and requirements.</p><p>It is not included in asset recording, your subscription or admin hours.</p></>)}
        {detail === 'admin' && <>
          <p>We capture supplied records, organise documents and keep {dealer ? 'your stock information' : 'your asset register'} up to date.</p>
          <dl className={styles.dealerRates}><div><dt>Your monthly help</dt><dd>{adminLabel}</dd></div><div><dt>Monthly fee</dt><dd>{adminPlan ? money(adminPlan.price) : 'Custom quote'}</dd></div><div><dt>Additional work</dt><dd>R250/hour</dd></div></dl>
          {dealer && <p>This admin package covers your dealership’s stock records. Assistance with customer registers is scoped separately; it is not unlimited work across customer accounts.</p>}
          <p>Hours expire monthly and do not roll over. Admin is billed monthly, including when your base plan is yearly.</p><p>Travel, formal inspections and professional valuation research are excluded.</p>
        </>}
      </div>}
      </div>
      <div className={styles.navigation}>
        {detail ? <button type="button" className={styles.secondary} onClick={() => move(3)}>Back to package</button> : <>
        {(step === 6 || step === 5 || step === 4 || (!editing && step > firstStep)) ? <button type="button" className={styles.secondary} onClick={() => move(step === 6 ? admin === 'self' ? 2 : 4 : step === 3 && dealer ? 6 : step === 5 ? 1 : step === 4 ? 2 : step === 2 && setup !== 'self' ? 5 : step === 3 && admin !== 'self' ? 4 : step - 1)}>Back</button> : <span className={styles.note}>{editing ? 'Adjust your choice, then update.' : dealer ? 'Dealer Partner · R199/month' : ready ? 'Your base plan is selected.' : 'Choose your asset range.'}</span>}
        {step !== 3 ? <button type="button" className={styles.primary} disabled={!ready} onClick={() => { if (editing) { setEditing(false); move(3); } else move(step === 6 ? 3 : step === 2 || step === 4 ? dealer ? 6 : 3 : step === 5 ? 2 : step + 1); }}>{editing ? 'Update package' : step === 6 || (!dealer && (step === 2 || step === 4)) ? 'See my package' : 'Continue'} </button> : <div className={styles.finalActions}><button type="button" className={styles.restart} onClick={() => { setEditing(false); setAssetBand(null); setSetup(null); setAdmin(null); setCustomers(null); setYearly(false); move(firstStep); }}>Start again</button><Link href={`/auth?accountType=${audience}#signup`} className={styles.primary}>Sign up</Link></div>}
        </>}
      </div>
    </div>
  </section>;
}
