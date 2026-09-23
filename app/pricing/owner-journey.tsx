'use client';

import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import styles from './owner-journey.module.css';

const plans = [
  { name: 'Essentials', range: '1–25 assets', limit: 25, monthly: 99, yearly: 999 },
  { name: 'Growth', range: '26–100 assets', limit: 100, monthly: 199, yearly: 1999 },
  { name: 'Business', range: '101–300 assets', limit: 300, monthly: 399, yearly: 3999 },
];
const adminPlans = [{ hours: 2, price: 499 }, { hours: 5, price: 999 }, { hours: 10, price: 1799 }];
const money = (amount: number) => `R${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
const steps = ['Your assets', 'Getting set up', 'Ongoing help', 'Your package'];
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

export default function OwnerJourney() {
  const [step, setStep] = useState(0);
  const [copyStatus, setCopyStatus] = useState('');
  const [assetBand, setAssetBand] = useState<number | null>(null);
  const [yearly, setYearly] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const plan = assetBand !== null ? plans[assetBand] : undefined;
  const adminPlan = adminPlans.find(item => String(item.hours) === admin);
  const ready = step === 0 ? assetBand !== null : step === 1 ? setup !== null : admin !== null;
  const titles = ['How many assets do you have?', 'How would you like to get set up?', 'Who will keep your register up to date?', 'Your Aim4price package'];
  const move = (next: number) => {
    setCopyStatus('');
    setStep(next);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    });
  };
  const billing = <div className={styles.billing} role="group" aria-label="Owner billing period">
    <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
    <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly</button>
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
    <ol className={styles.progress} aria-label="Package steps">
      {steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}><span>{index < step ? '✓' : index + 1}</span>{label}</li>)}
    </ol>
    <div className={styles.panel}>
      <div className={styles.heading}>
        <p>{step < 3 ? `Step ${step + 1} of 3` : 'Built around your choices'}</p>
        <h2 ref={heading} tabIndex={-1}>{titles[step]}</h2>
        <p>{[
          'Choose by active assets. Every Owner plan includes the same core tools.',
          'Start on your own, or get help creating a complete asset register.',
          'Use the tools yourself, or choose prepaid time for someone to help with the records.',
          'Your subscription, setup and ongoing help — clearly separated.',
        ][step]}</p>
      </div>

      {step === 0 && <div className={styles.layout}>
        <div>
          <div className={styles.choices} role="group" aria-label="Number of active assets">
            {plans.map((item, index) => <Choice key={item.name} selected={assetBand === index} onClick={() => setAssetBand(index)} title={item.range}>{item.name} · from {money(item.monthly)}/month</Choice>)}
            <Choice selected={assetBand === 3} onClick={() => setAssetBand(3)} title="More than 300 assets">Enterprise · pricing tailored to your operation</Choice>
          </div>
          <p className={styles.note}>Sold and archived assets do not count towards your limit.</p>
          {assetBand !== null && <div className={styles.preview} aria-live="polite">
            <h3>{plan ? `${plan.name} fits your register` : 'Let’s plan for your operation'}</h3>
            {plan ? <>{billing}<p className={styles.price}>{money(yearly ? plan.yearly : plan.monthly)}<span>/{yearly ? 'year' : 'month'}</span></p><p>{yearly ? `Save ${money(plan.monthly * 12 - plan.yearly)} compared with 12 monthly payments.` : `${money(plan.yearly)} if billed yearly.`} Up to {plan.limit} active assets.</p></> : <p>We’ll quote for your asset numbers. Continue to choose the setup and support you need.</p>}
          </div>}
        </div>
        <Included />
      </div>}

      {step === 1 && <div className={styles.layout}>
        <div className={styles.choices} role="group" aria-label="Setup preference">
          <Choice selected={setup === 'self'} onClick={() => setSetup('self')} title="I’ll upload my own assets">Add details, photographs and documents at your own pace. No additional setup fee.</Choice>
          <Choice selected={setup === 'visit'} onClick={() => setSetup('visit')} title="I’d like someone to visit">Help recording your machinery, taking photographs and organising your register.</Choice>
          <Choice selected={setup === 'inspection'} onClick={() => setSetup('inspection')} title="I need an inspection or valuation">Discuss a formal machinery inspection or professional valuation. Quoted separately.</Choice>
        </div>
        <aside className={styles.benefits} aria-live="polite">
          {!setup && <><h3>A good register starts with good information</h3><p>Accurate asset details and useful photographs make it easier to identify machinery, keep records together and prepare for the next step.</p><p>Choose how you’d like to start. You can decide on ongoing help separately.</p></>}
          {setup === 'self' && <><h3>Everything you need to do it yourself</h3><ul><li>Add assets and keep their photos and documents together.</li><li>Record costs, fuel and maintenance as you go.</li><li>Upload invoices and fuel slips for Aim4price Capture instead of typing every record yourself.</li></ul><p><strong>Manual uploads: no daily limit.</strong> Capture includes 10 invoices + 10 fuel slips per Owner account daily, shared across users. Resets at midnight South African time.</p><p className={styles.note}>The Capture allowance is for invoices and fuel slips; it is separate from asset setup.</p></>}
          {setup === 'visit' && <><h3>Get your register off to a stronger start</h3><p>A visit helps gather the details that are easy to miss: serial/VIN numbers, make, model, year, hours or mileage, photographs and basic ownership information.</p><dl className={styles.rates}><div><dt>Road-licensed asset capture</dt><dd>R100 / asset</dd></div><div><dt>Non-road-licensed asset capture</dt><dd>R50 / asset</dd></div><div><dt>Travel</dt><dd>R7.50 / km</dd></div></dl><p className={styles.note}>Travel is charged on the return distance, once per visit. The final amount depends on the asset mix and distance and is confirmed with you. Asset recording is not a formal inspection or certified valuation.</p></>}
          {setup === 'inspection' && <><h3>Help for a specific inspection or valuation</h3><p>Tell us which machinery you need assessed and what the report is for. We’ll discuss the scope and provide a custom quote.</p><p><strong>Quoted separately.</strong> Standard asset capture fees and monthly admin hours do not include formal inspections or professional valuation research.</p></>}
        </aside>
      </div>}

      {step === 2 && <div className={styles.layout}>
        <div className={styles.choices} role="group" aria-label="Ongoing administration">
          <Choice selected={admin === 'self'} onClick={() => setAdmin('self')} title="I’ll manage it myself">No extra administration fee. Keep using all your plan’s tools and daily Capture allowance.</Choice>
          {adminPlans.map(item => <Choice key={item.hours} selected={admin === String(item.hours)} onClick={() => setAdmin(String(item.hours) as Admin)} title={`Up to ${item.hours} hours per month`}>{money(item.price)}/month · Managed Administration</Choice>)}
          <Choice selected={admin === 'custom'} onClick={() => setAdmin('custom')} title="I need more than 10 hours">Let’s discuss your workload and prepare a custom quote.</Choice>
        </div>
        <aside className={styles.benefits} aria-live="polite">
          <h3>{admin === 'self' ? 'You stay in control of your records' : 'Less time on records. More time on your operation.'}</h3>
          {admin === 'self' ? <><p>Use costs, budgets, fuel records and maintenance reminders to keep your register useful as your machinery ages.</p><p>Manual entry and uploads have no daily limit. You still get 10 invoice + 10 fuel-slip captures per Owner account each day.</p><p>You can ask for extra help later if your workload grows.</p></> : <><p>The administration fee pays for time spent capturing, organising and maintaining your records. It is optional help on top of your software subscription.</p><ul><li>Help with additional capture and bulk records.</li><li>Organise supplied documents and asset information.</li><li>Keep your register current as new information comes in.</li></ul><p><strong>You provide the records; we help with the administration.</strong> Choose prepaid hours to match the help you need.</p><details><summary>How admin hours work</summary><p>Hours expire monthly and do not roll over. Additional work is R250 per hour. Travel, formal inspections and professional valuation research are excluded.</p></details></>}
        </aside>
      </div>}

      {step === 3 && <div className={styles.layout}>
        <div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHead}><h3>Base subscription</h3><button type="button" onClick={() => move(0)}>Change assets</button></div>
            <p>{plan ? `${plan.name} · up to ${plan.limit} active assets` : 'Enterprise · more than 300 assets'}</p>
            {plan ? <>{billing}<p className={styles.price}>{money(yearly ? plan.yearly : plan.monthly)}<span>/{yearly ? 'year' : 'month'}</span></p></> : <p className={styles.price}>Custom quote</p>}
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHead}><h3>Initial setup</h3><button type="button" onClick={() => move(1)}>Change setup</button></div>
            <p>{setupLabel}</p>
            {setup === 'self' ? <strong>No additional setup fee</strong> : setup === 'visit' ? <><strong>Once-off capture + travel</strong><p>R100 per road-licensed asset · R50 per non-road-licensed asset · R7.50/km return travel.</p><p className={styles.note}>Final visit cost to be confirmed from asset mix and distance. Does not include a formal inspection.</p></> : <strong>Separate custom quote</strong>}
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHead}><h3>Ongoing administration</h3><button type="button" onClick={() => move(2)}>Change help</button></div>
            <p>{adminLabel}</p><strong>{adminPlan ? `${money(adminPlan.price)}/month` : admin === 'self' ? 'No additional administration fee' : 'Custom quote'}</strong>
            {adminPlan && <p className={styles.note}>Prepaid hours expire monthly. Extra work: R250/hour. Travel, formal inspections and professional valuation research are excluded.</p>}
          </div>
        </div>
        <aside className={styles.total} aria-live="polite">
          <p className={styles.label}>Your ongoing cost</p>
          {plan && admin !== 'custom' ? yearly ? <><p className={styles.price}>{money(plan.yearly)}<span>/year</span></p><p>Base subscription, billed yearly.</p><p><strong>{adminPlan ? `${money(adminPlan.price)}/month for administration` : 'No monthly administration charge.'}</strong></p></> : <><p className={styles.price}>{money(plan.monthly + (adminPlan?.price ?? 0))}<span>/month</span></p><p>Includes your base subscription{adminPlan ? ' and chosen administration package' : ''}.</p></> : <><h3>Let’s confirm your package</h3><p>{plan ? `${money(yearly ? plan.yearly : plan.monthly)}/${yearly ? 'year' : 'month'} base subscription. Administration quoted separately.` : `Enterprise subscription quoted separately.${adminPlan ? ` Administration: ${money(adminPlan.price)}/month.` : admin === 'self' ? ' No administration fee.' : ' Administration also requires a quote.'}`}</p></>}
          {setup !== 'self' && <p className={styles.excluded}>Your {setup === 'visit' ? 'once-off visit' : 'inspection / valuation'} is additional and needs confirmation.</p>}
          <p className={styles.note}>All prices are in South African rand. This is a package guide; choosing options does not create a subscription or book a visit.</p>
          <Link href="/contact-us" className={styles.primary}>Discuss this package <span aria-hidden="true">↗</span></Link>
          <details><summary>Copy your choices for your enquiry</summary><textarea className={styles.copyText} aria-label="Your package summary" readOnly value={packageText} onFocus={event => event.currentTarget.select()} /><button type="button" className={styles.secondary} onClick={copyPackage}>Copy summary</button><p role="status" className={styles.note}>{copyStatus}</p></details>
          <details><summary>What your Owner plan includes</summary><Included /></details>
        </aside>
      </div>}

      <div className={styles.navigation}>
        {step > 0 ? <button type="button" className={styles.secondary} onClick={() => move(step - 1)}>Back</button> : <span className={styles.note}>Choose an asset range to continue.</span>}
        {step < 3 ? <button type="button" className={styles.primary} disabled={!ready} onClick={() => move(step + 1)}>{step === 2 ? 'See my package' : 'Continue'} <span aria-hidden="true">→</span></button> : <button type="button" className={styles.secondary} onClick={() => { setAssetBand(null); setSetup(null); setAdmin(null); setYearly(false); move(0); }}>Start again</button>}
      </div>
    </div>
  </section>;
}
