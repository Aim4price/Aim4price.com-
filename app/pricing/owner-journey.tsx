'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './owner-journey.module.css';

const plans = [
  { name: 'Essentials', range: '1–25 assets', limit: 25, monthly: 99, yearly: 999 },
  { name: 'Growth', range: '26–100 assets', limit: 100, monthly: 199, yearly: 1999 },
  { name: 'Business', range: '101–300 assets', limit: 300, monthly: 399, yearly: 3999 },
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
    <h3>Your tools, whether you do it yourself or get help</h3>
    <ul>
      <li><strong>Know what you own.</strong> Asset registers, photographs, documents and value estimates in one place.</li>
      <li><strong>Understand running costs.</strong> Connect invoices, fuel records and budgets to your assets.</li>
      <li><strong>Stay on top of maintenance.</strong> Schedules, reminders and problem reporting.</li>
      <li><strong>Keep useful records.</strong> Ownership, finance and insurance details, PDF reports, Excel/CSV exports and asset QR codes.</li>
    </ul>
    <details><summary>See uploads, Capture and selling tools</summary><p>Manual entry and document uploads have no daily limit and no extra charge. Aim4price Capture includes 10 invoices + 10 fuel slips per Owner account, per day, shared across its users and contributors. The allowance resets at midnight South African time.</p><p>Marketplace access and tools to prepare your assets for sale are also included.</p></details>
  </div>;
}

export default function OwnerJourney({ onTitleChange }: { onTitleChange?: (title: string) => void }) {
  const [step, setStep] = useState(0);
  const [copyStatus, setCopyStatus] = useState('');
  const [assetBand, setAssetBand] = useState<number | null>(null);
  const [yearly, setYearly] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [wantsHelp, setWantsHelp] = useState(false);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const plan = assetBand !== null ? plans[assetBand] : undefined;
  const adminPlan = adminPlans.find(item => String(item.hours) === admin);
  const ready = step === 0 ? assetBand !== null : step === 1 ? setup !== null : admin !== null;
  const titles = ['How many assets?', 'How would you like to set up?', 'Who will manage your register?', 'Your package'];
  useEffect(() => { onTitleChange?.(titles[step]); }, [step, onTitleChange]);
  const move = (next: number) => {
    setCopyStatus('');
    setStep(next);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.closest('[class*=body]')?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    });
  };
  const billing = <div className={styles.billing} role="group" aria-label="Owner billing period">
    <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
    <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly{plan && <span className={styles.saving}>Save {((1 - plan.yearly / (plan.monthly * 12)) * 100).toFixed(1)}%</span>}</button>
  </div>;
  const setupLabel = setup === 'self' ? 'Upload my own assets' : setup === 'visit' ? 'Asset recording visit' : 'Formal inspection / valuation';
  const adminLabel = admin === 'self' ? 'Manage it myself' : admin === 'custom' ? 'Custom administration' : `Up to ${adminPlan?.hours} admin hours / month`;

  const packageText = [
    'My Aim4price Owner package',
    plan ? `${plan.name}: ${money(yearly ? plan.yearly : plan.monthly)}/${yearly ? 'year' : 'month'} for up to ${plan.limit} active assets.` : 'Enterprise: more than 300 assets — custom quote.',
    `Setup: ${setupLabel}. ${setup === 'self' ? 'No additional setup fee.' : setup === 'visit' ? 'R100/road-licensed asset; R50/non-road-licensed asset; R7.50/km return travel. Final visit cost to be confirmed; not a formal inspection.' : 'Separate custom quote required.'}`,
    `Administration: ${adminLabel}. ${adminPlan ? `${money(adminPlan.price)}/month. Hours expire monthly; additional work R250/hour. Travel, formal inspections and professional valuation research excluded.` : admin === 'self' ? 'No additional administration fee.' : 'Custom quote required.'}`,
    'Package guide only. All prices in South African rand; no subscription or visit booked.',
  ].join('\n\n');
  const copyPackage = async () => {
    try { await navigator.clipboard.writeText(packageText); setCopyStatus('Package summary copied.'); }
    catch { setCopyStatus('Select the summary text below to copy it.'); }
  };

  return <section className={styles.journey} aria-label="Build your Owner package">
    <div className={styles.panel}>
      <div className={styles.heading}>
        <p>{step < 3 ? `Step ${step + 1} of 3` : 'Built around your choices'}</p>
        <h2 ref={heading} tabIndex={-1}>{titles[step]}</h2>
        <p>{[
          'Same tools. Choose your asset range.',
          'Upload yourself or let us help.',
          'Do it yourself or choose monthly help.',
          'Your plan, setup and monthly help.',
        ][step]}</p>
      </div>

      {step === 0 && <>
        <div className={styles.assetChoices} role="group" aria-label="Number of active assets">
          {plans.map((item, index) => <Choice key={item.name} selected={assetBand === index} onClick={() => setAssetBand(index)} title={item.range}>{money(item.monthly)}/month · {item.name}</Choice>)}
          <Choice selected={assetBand === 3} onClick={() => setAssetBand(3)} title="More than 300">Enterprise · custom quote</Choice>
        </div>
        {plan && <div className={styles.compactPrice}>{billing}<strong>{money(yearly ? plan.yearly : plan.monthly)}/{yearly ? 'year' : 'month'}</strong><span>{yearly ? 'Billed yearly' : `${money(plan.yearly)} billed yearly`}</span></div>}
        <p className={styles.note}>Only active assets count. Sold and archived assets are excluded.</p>
        <details><summary>What’s included?</summary><Included /></details>
      </>}

      {step === 1 && <>
        <div className={styles.choices} role="group" aria-label="Setup preference">
          <Choice selected={setup === 'self'} onClick={() => setSetup('self')} title="Upload myself">Add my details, photos and documents. No setup fee.</Choice>
          <Choice selected={setup === 'visit'} onClick={() => setSetup('visit')} title="Arrange a visit">Help recording machinery and building my register.</Choice>
        </div>
        {setup === 'self' && <div className={styles.tip}><strong>Your tools are included.</strong><p>Unlimited manual uploads. Capture: 10 invoices + 10 fuel slips per Owner account daily.</p><details><summary>Capture details</summary><p>Shared across users and contributors. Resets at midnight South African time. The allowance covers invoices and fuel slips, not asset setup.</p></details></div>}
        {setup === 'visit' && <div className={styles.tip}><strong>A complete register, with less setup work.</strong><p>We help record asset details, photographs and ownership information.</p><dl className={styles.rates}><div><dt>Road-licensed assets</dt><dd>R100 each</dd></div><div><dt>Other assets</dt><dd>R50 each</dd></div><div><dt>Return travel</dt><dd>R7.50/km</dd></div></dl><details><summary>Visit details</summary><p>Includes standard asset details, serial/VIN, make, model, year, hours or mileage and basic ownership information. Travel is charged once per visit. Final cost depends on asset mix and distance. Asset recording is not a formal inspection or certified valuation.</p></details></div>}
        <details><summary>Need a formal inspection or valuation?</summary><p className={styles.note}>Quoted separately. Not included in asset capture or admin hours.</p><Choice selected={setup === 'inspection'} onClick={() => setSetup('inspection')} title="Request an inspection quote">Discuss the machinery and report you need.</Choice></details>
        {setup === 'inspection' && <p className={styles.note} role="status">Selected: formal inspection / valuation · custom quote.</p>}
      </>}

      {step === 2 && <>
        <p className={styles.adminNote}>You can request admin help anytime.</p>
        <div className={styles.choices} role="group" aria-label="Ongoing administration">
          <Choice selected={admin === 'self'} onClick={() => { setWantsHelp(false); setAdmin('self'); }} title="I’ll manage it">All my tools and daily Capture allowance. No admin fee.</Choice>
          <Choice selected={wantsHelp} onClick={() => { if (!wantsHelp) setAdmin(null); setWantsHelp(true); }} title="I’d like monthly help">Help capturing records and keeping my register organised.</Choice>
        </div>
        {wantsHelp && <div className={styles.tip}>
          <p>Prepaid admin time, on top of your subscription.</p>
          <div className={styles.assetChoices} role="group" aria-label="Admin package">
            {adminPlans.map(item => <Choice key={item.hours} selected={admin === String(item.hours)} onClick={() => setAdmin(String(item.hours) as Admin)} title={`Up to ${item.hours} hours`}>{money(item.price)}/month</Choice>)}
            <Choice selected={admin === 'custom'} onClick={() => setAdmin('custom')} title="More than 10 hours">Custom quote</Choice>
          </div>
          <details><summary>What does admin cover?</summary><p>Additional capture, bulk records, organising supplied documents and updating asset information. You supply the records; we help maintain them.</p><p>Hours expire monthly with no rollover. Extra work: R250/hour. Travel, formal inspections and professional valuation research are excluded.</p></details>
        </div>}
        {admin === 'self' && <div className={styles.tip}><strong>Stay in control, at your own pace.</strong><p>Track costs, fuel, budgets and maintenance. Manual uploads have no daily limit.</p><details><summary>Your daily Capture allowance</summary><p>10 invoices + 10 fuel slips per Owner account, shared across users and contributors. Resets at midnight South African time.</p></details></div>}
      </>}

      {step === 3 && <div className={styles.layout}>
        <div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHead}><h3>Base subscription</h3><button type="button" onClick={() => move(0)}>Change assets</button></div>
            <p>{plan ? `${plan.name} · up to ${plan.limit} active assets` : 'Enterprise · more than 300 assets'}</p>
            {plan ? <><p><strong>{money(yearly ? plan.yearly : plan.monthly)}/{yearly ? 'year' : 'month'}</strong></p>{billing}</> : <strong>Custom quote</strong>}
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHead}><h3>Initial setup</h3><button type="button" onClick={() => move(1)}>Change setup</button></div>
            <p>{setupLabel}</p>
            {setup === 'self' ? <strong>No additional setup fee</strong> : setup === 'visit' ? <><strong>Once-off capture + travel</strong><details><summary>Visit rates</summary><p>R100 per road-licensed asset · R50 per non-road-licensed asset · R7.50/km return travel. Final cost confirmed from asset mix and distance. Formal inspections excluded.</p></details></> : <strong>Separate custom quote</strong>}
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHead}><h3>Ongoing administration</h3><button type="button" onClick={() => move(2)}>Change help</button></div>
            <p>{adminLabel}</p><strong>{adminPlan ? `${money(adminPlan.price)}/month` : admin === 'self' ? 'No additional administration fee' : 'Custom quote'}</strong>
            {adminPlan && <details><summary>Admin terms</summary><p className={styles.note}>Prepaid hours expire monthly. Extra work: R250/hour. Travel, formal inspections and professional valuation research are excluded.</p></details>}
          </div>
        </div>
        <aside className={styles.total} aria-live="polite">
          <p className={styles.label}>Your ongoing cost</p>
          {plan && admin !== 'custom' ? yearly ? <><p className={styles.price}>{money(plan.yearly)}<span>/year</span></p><p>Base subscription, billed yearly.</p><p><strong>{adminPlan ? `${money(adminPlan.price)}/month for administration` : 'No monthly administration charge.'}</strong></p></> : <><p className={styles.price}>{money(plan.monthly + (adminPlan?.price ?? 0))}<span>/month</span></p><p>Includes your base subscription{adminPlan ? ' and chosen administration package' : ''}.</p></> : <><h3>Let’s confirm your package</h3><p>{plan ? `${money(yearly ? plan.yearly : plan.monthly)}/${yearly ? 'year' : 'month'} base subscription. Administration quoted separately.` : `Enterprise subscription quoted separately.${adminPlan ? ` Administration: ${money(adminPlan.price)}/month.` : admin === 'self' ? ' No administration fee.' : ' Administration also requires a quote.'}`}</p></>}
          {setup !== 'self' && <p className={styles.excluded}>Your {setup === 'visit' ? 'once-off visit' : 'inspection / valuation'} is additional and needs confirmation.</p>}
          <p className={styles.note}>Admin help is available anytime. Prices in rand. No booking is made here.</p>
          <Link href="/contact-us" className={styles.primary}>Discuss this package </Link>
          <details><summary>Copy your choices for your enquiry</summary><textarea className={styles.copyText} aria-label="Your package summary" readOnly value={packageText} onFocus={event => event.currentTarget.select()} /><button type="button" className={styles.secondary} onClick={copyPackage}>Copy summary</button><p role="status" className={styles.note}>{copyStatus}</p></details>
          <details><summary>What your Owner plan includes</summary><Included /></details>
        </aside>
      </div>}

      <div className={styles.navigation}>
        {step > 0 ? <button type="button" className={styles.secondary} onClick={() => move(step - 1)}>Back</button> : <span className={styles.note}>Select an option to continue.</span>}
        {step < 3 ? <button type="button" className={styles.primary} disabled={!ready} onClick={() => move(step + 1)}>{step === 2 ? 'See my package' : 'Continue'} </button> : <button type="button" className={styles.secondary} onClick={() => { setAssetBand(null); setSetup(null); setAdmin(null); setWantsHelp(false); setYearly(false); move(0); }}>Start again</button>}
      </div>
    </div>
  </section>;
}
