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

function Included() {
  return <div className={styles.benefits}>
    <h3>Your tools, whether you do it yourself or get help</h3><p>Only active assets count towards your plan. Sold and archived assets are excluded.</p>
    <ul>
      <li><strong>Know what you own.</strong> Asset registers, photographs, documents and value estimates in one place.</li>
      <li><strong>Understand running costs.</strong> Connect invoices, fuel records and budgets to your assets.</li>
      <li><strong>Stay on top of maintenance.</strong> Schedules, reminders and problem reporting.</li>
      <li><strong>Keep useful records.</strong> Ownership, finance and insurance details, PDF reports, Excel/CSV exports and asset QR codes.</li>
    </ul>
    <details><summary>See uploads, Capture and selling tools</summary><p>Manual entry and document uploads have no daily limit and no extra charge. Aim4price Capture includes 10 invoices + 10 fuel slips per Owner account, per day, shared across its users and contributors. The allowance resets at midnight South African time and covers invoices and fuel slips, not asset setup.</p><p>Marketplace access and tools to prepare your assets for sale are also included.</p></details>
  </div>;
}

export default function PackageJourney({ onTitleChange, audience = 'owner' }: { onTitleChange?: (title: string) => void; audience?: 'owner' | 'dealer' }) {
  const dealer = audience === 'dealer';
  const firstStep = dealer ? 1 : 0;
  const [step, setStep] = useState(firstStep);
  const [editing, setEditing] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [assetBand, setAssetBand] = useState<number | null>(null);
  const [yearly, setYearly] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const plan = dealer ? { name: 'Dealer Partner', monthly: 199, yearly: 1999, limit: 0 } : assetBand !== null ? plans[assetBand] : undefined;
  const adminPlan = adminPlans.find(item => String(item.hours) === admin);
  const ready = step === 0 ? assetBand !== null : step === 1 ? setup !== null : admin !== null;
  const titles = ['How many assets?', dealer ? 'How will you add your stock?' : 'How will you add your assets?', dealer ? 'Who will manage your records?' : 'Who will manage your register?', dealer ? 'Your Dealer package' : 'Your Owner package', 'How much admin help do you need?'];
  useEffect(() => { onTitleChange?.(titles[step]); }, [step, onTitleChange, dealer]);
  const move = (next: number) => {
    setCopyStatus('');
    setStep(next);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.closest('[class*=body]')?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    });
  };
  const billing = <div className={styles.billing} role="group" aria-label={`${dealer ? 'Dealer' : 'Owner'} billing period`}>
    <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
    <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly{plan && <span className={styles.saving}>Save {((1 - plan.yearly / (plan.monthly * 12)) * 100).toFixed(1)}%</span>}</button>
  </div>;
  const setupLabel = setup === 'self' ? dealer ? 'Upload my own stock' : 'Upload my own assets' : setup === 'visit' ? 'Asset recording visit' : 'Formal inspection / valuation';
  const adminLabel = admin === 'self' ? 'Manage it myself' : admin === 'custom' ? 'Custom administration' : `Up to ${adminPlan?.hours} admin hours / month`;

  const packageText = [
    `My Aim4price ${dealer ? 'Dealer' : 'Owner'} package`,
    plan ? `${plan.name}: ${money(yearly ? plan.yearly : plan.monthly)}/${yearly ? 'year' : 'month'} ${dealer ? '(launch pricing)' : `for up to ${plan.limit} active assets` }.` : 'Enterprise: more than 300 assets — custom quote.',
    `Setup: ${setupLabel}. ${setup === 'self' ? 'No additional setup fee.' : setup === 'visit' ? 'R100/road-licensed asset; R50/non-road-licensed asset; R7.50/km return travel. Final visit cost to be confirmed; not a formal inspection.' : 'Separate custom quote required.'}`,
    `Administration: ${adminLabel}. ${adminPlan ? `${money(adminPlan.price)}/month. Hours expire monthly; additional work R250/hour. Travel, formal inspections and professional valuation research excluded.` : admin === 'self' ? 'No additional administration fee.' : 'Custom quote required.'}`,
    'Package guide only. All prices in South African rand; no subscription or visit booked.',
  ].join('\n\n');
  const copyPackage = async () => {
    try { await navigator.clipboard.writeText(packageText); setCopyStatus('Package summary copied.'); }
    catch { setCopyStatus('Select the summary text below to copy it.'); }
  };

  return <section className={styles.journey} aria-label={`Build your ${dealer ? 'Dealer' : 'Owner'} package`}>
    <div className={styles.panel}>
      <div className={styles.content} key={step}>
      <div className={styles.heading}>
        <p>{step < 3 ? `Step ${step + 1} of 3` : 'Built around your choices'}</p>
        <h2 ref={heading} tabIndex={-1}>{titles[step]}</h2>
        <p>{[
          'Choose how many active assets you have.',
          'Do it yourself or get help with the initial setup.',
          'Choose self-service or monthly admin help.',
          'Review your subscription and optional services.',
          'Choose your monthly admin package.',
        ][step]}</p>
      </div>

      {step === 0 && <>
        <div className={styles.assetChoices} role="group" aria-label="Number of active assets">
          {plans.map((item, index) => <Choice key={item.name} selected={assetBand === index} onClick={() => setAssetBand(index)} title={item.range}>{money(item.monthly)}/month · {item.name}</Choice>)}
          <Choice selected={assetBand === 3} onClick={() => setAssetBand(3)} title="301+">Enterprise · custom quote</Choice>
        </div>
      </>}

      {step === 1 && <>
        <div className={styles.choices} role="group" aria-label="Setup preference">
          <Choice selected={setup === 'self'} onClick={() => setSetup('self')} title="Upload myself">Add my details, photos and documents. No setup fee.</Choice>
          <Choice selected={setup === 'visit'} onClick={() => setSetup('visit')} title="Arrange a visit">{dealer ? 'Help recording stock details, photos and documents.' : 'Help recording machinery and building my register.'}</Choice>
          <Choice selected={setup === 'inspection'} onClick={() => setSetup('inspection')} title="Formal inspection or valuation">Separate custom quote.</Choice>
        </div>
      </>}

      {step === 2 && <>
        <div className={styles.choices} role="group" aria-label="Ongoing administration">
          <Choice selected={admin === 'self'} onClick={() => { setAdmin('self'); }} title="I’ll manage it">No additional admin fee.</Choice>
          <Choice selected={admin !== null && admin !== 'self'} onClick={() => { if (admin === 'self') setAdmin(null); move(4); }} title="I’d like monthly help">{dealer ? 'Help capturing records and keeping stock information organised.' : 'Help capturing records and keeping my register organised.'}</Choice>
        </div>
      </>}

      {step === 4 && <>
          <div className={styles.assetChoices} role="group" aria-label="Admin package">
            {adminPlans.map(item => <Choice key={item.hours} selected={admin === String(item.hours)} onClick={() => setAdmin(String(item.hours) as Admin)} title={`Up to ${item.hours} hours`}>{money(item.price)}/month</Choice>)}
            <Choice selected={admin === 'custom'} onClick={() => setAdmin('custom')} title="More than 10 hours">Custom quote</Choice>
          </div>
      </>}

      {step === 3 && <div className={styles.review}>
        <div className={styles.reviewTotal}>
          <div aria-live="polite">
            <p className={styles.label}>{dealer ? 'Dealer Partner · launch pricing' : plan ? `${plan.name} · up to ${plan.limit} active assets` : 'Enterprise · more than 300 assets'}</p>
            {plan && admin !== 'custom' ? <>
              <p className={styles.price}>{money(yearly ? plan.yearly : plan.monthly + (adminPlan?.price ?? 0))}<span>/{yearly ? 'year' : 'month'}</span></p>
              <p className={styles.totalCaption}>{yearly ? adminPlan ? `Plus ${money(adminPlan.price)}/month for admin help.` : 'Base plan billed once a year. No admin fee.' : adminPlan ? 'Base plan and monthly admin help combined.' : 'Your base plan. No admin fee.'}</p>
            </> : <><p className={styles.quoteTitle}>Custom quote</p><p className={styles.totalCaption}>{plan ? `${money(yearly ? plan.yearly : plan.monthly)}/${yearly ? 'year' : 'month'} base plan. Admin quoted separately.` : adminPlan ? `Enterprise plan quoted separately. Admin: ${money(adminPlan.price)}/month.` : 'We’ll confirm pricing for your requirements.'}</p></>}
          </div>
          {plan && <div className={styles.reviewBilling}>{billing}<p>Billing period for your base plan</p></div>}
        </div>
        <div className={styles.reviewRows}>
          <div className={styles.reviewRow}><div><span className={styles.rowLabel}>Base plan</span><strong>{plan ? plan.name : 'Enterprise'}</strong></div><span>{plan ? `${money(yearly ? plan.yearly : plan.monthly)}/${yearly ? 'year' : 'month'}` : 'Custom quote'}</span>{!dealer && <button type="button" aria-label="Change assets" onClick={() => { setEditing(true); move(0); }}>Change</button>}</div>
          <div className={styles.reviewRow}><div><span className={styles.rowLabel}>Initial setup</span><strong>{setupLabel}</strong></div><span>{setup === 'self' ? 'No setup fee' : setup === 'visit' ? 'Capture + travel, quoted separately' : 'Separate custom quote'}</span><button type="button" aria-label="Change setup" onClick={() => { setEditing(true); move(1); }}>Change</button></div>
          <div className={styles.reviewRow}><div><span className={styles.rowLabel}>Admin help</span><strong>{adminLabel}</strong></div><span>{adminPlan ? `${money(adminPlan.price)}/month` : admin === 'self' ? 'No admin fee' : 'Custom quote'}</span><button type="button" aria-label="Change help" onClick={() => { setEditing(true); move(2); }}>Change</button></div>
        </div>
        <div className={styles.reviewDetails}>
          <details><summary>Included features</summary>{dealer ? <DealerDetails /> : <Included />}</details>
          {setup !== 'self' && <details><summary>{setup === 'visit' ? 'Visit details & rates' : 'Inspection & valuation'}</summary>{setup === 'visit' ? <><p>We help build your records with asset details, photographs and ownership information, including serial/VIN, make, model, year and hours or mileage.</p><p>R100 per road-licensed asset · R50 per other asset · R7.50/km return travel. Travel is charged once per visit. Final cost depends on asset mix and distance.</p><p>Asset recording is not a formal inspection or certified valuation. Visit costs are additional to the subscription.</p></> : <p>Formal inspections and professional valuations require a separate quote. They are not included in asset capture or admin hours.</p>}</details>}
          {admin !== 'self' && <details><summary>Admin help & terms</summary><p>We capture additional or bulk records, organise supplied documents and keep asset information updated. You supply the records; we help maintain them.</p><p>Prepaid hours expire monthly with no rollover. Extra work: R250/hour. Travel, formal inspections and professional valuation research are excluded. Admin is billed monthly, even with a yearly base plan.</p></details>}
        </div>
        <p className={styles.reviewNote}>You can request admin help anytime. Prices in rand. This is a package preview; no subscription or visit is booked.</p>
        <div className={styles.reviewActions}><button type="button" className={styles.secondary} onClick={copyPackage}>Copy package</button><Link href="/contact-us" className={styles.primary}>Discuss this package</Link></div>
        {copyStatus && <div role="status" className={styles.note}>{copyStatus}{copyStatus.startsWith('Select') && <textarea className={styles.copyText} aria-label="Your package summary" readOnly value={packageText} onFocus={event => event.currentTarget.select()} />}</div>}
      </div>}

      </div>
      <div className={styles.navigation}>
        {(step === 4 || (!editing && step > firstStep)) ? <button type="button" className={styles.secondary} onClick={() => move(step === 4 ? 2 : step === 3 && admin !== 'self' ? 4 : step - 1)}>Back</button> : <span className={styles.note}>{editing ? 'Adjust your choice, then update.' : dealer ? 'Dealer Partner · R199/month' : ready ? 'Your base plan is selected.' : 'Choose your asset range.'}</span>}
        {step !== 3 ? <button type="button" className={styles.primary} disabled={!ready} onClick={() => { if (editing) { setEditing(false); move(3); } else move(step === 4 ? 3 : step + 1); }}>{editing ? 'Update package' : step === 2 || step === 4 ? 'See my package' : 'Continue'} </button> : <button type="button" className={styles.secondary} onClick={() => { setEditing(false); setAssetBand(null); setSetup(null); setAdmin(null); setYearly(false); move(firstStep); }}>Start again</button>}
      </div>
    </div>
  </section>;
}
