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
type Setup = 'custom' | 'assisted' | 'self' | 'visit' | 'inspection';
type Admin = 'self' | '2' | '5' | '10' | 'custom';

function Choice({ selected, onClick, title, children }: { selected: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return <button type="button" className={styles.choice} aria-pressed={selected} onClick={onClick}>
    <span className={styles.choiceTitle}>{title}<span className={styles.selection} aria-hidden="true">{selected ? '✓' : ''}</span></span>
    <span className={styles.choiceCopy}>{children}</span>
  </button>;
}

export default function PackageJourney({ onTitleChange, audience = 'owner' }: { onTitleChange?: (title: string) => void; audience?: 'owner' | 'dealer' }) {
  const dealer = audience === 'dealer';
  const firstStep = dealer ? 6 : 0;
  const [step, setStep] = useState(firstStep);
  const [detail, setDetail] = useState<'funding' | 'commission' | 'setup' | 'admin' | null>(null);
  const [editing, setEditing] = useState(false);
  const [assetBand, setAssetBand] = useState<number | null>(null);
  const [yearly, setYearly] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [help, setHelp] = useState<'none' | 'setup' | 'admin' | 'both' | null>(null);
  const [customers, setCustomers] = useState<'self' | 'customers' | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const plan = dealer ? { name: 'Dealer Partner', monthly: 199, yearly: 1999, limit: 0 } : assetBand !== null ? plans[assetBand] : undefined;
  const adminPlan = adminPlans.find(item => String(item.hours) === admin);
  const ready = step === 7 ? help !== null : step === 8 ? setup !== null : step === 6 ? customers !== null : step === 0 ? assetBand !== null : step === 1 || step === 5 ? setup !== null : admin !== null;
  const titles = ['How many assets?', dealer ? 'How will you add your stock?' : 'How will you add your assets?', dealer ? 'Who will manage the records?' : 'Who will manage your register?', dealer ? 'Your Dealer package' : 'Your Owner package', 'How much admin help do you need?', 'What help do you need?', 'Will you manage customers’ asset registers?', 'Would you like help from Aim4price?', 'What would you like help setting up?'];
  const detailTitles = { funding: 'Client register billing', commission: 'Partner commission', setup: 'Setup details', admin: 'Monthly admin help' };
  useEffect(() => { onTitleChange?.(detail ? detailTitles[detail] : titles[step]); }, [step, detail, onTitleChange, dealer]);
  const move = (next: number) => {
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
    if (step === 1) return 2;
    if (step === 6 || step === 5) return 2;
    if (step === 2 || step === 4) return 3;
    return 1;
  };
  const previousStep = () => {
    if (dealer) {
      if (step === 7) return 6;
      if (step === 8) return 7;
      if (step === 4) return help === 'both' ? 8 : 7;
      if (step === 3) return help === 'admin' || help === 'both' ? 4 : help === 'setup' ? 8 : 7;
      return 6;
    }
    if (step === 6 || step === 5) return 1;
    if (step === 4) return 2;
    if (step === 2) return dealer ? 6 : setup === 'self' ? 1 : 5;
    if (step === 3) return admin === 'self' ? 2 : 4;
    return 0;
  };
  const billing = <div className={styles.billing} role="group" aria-label={`${dealer ? 'Dealer' : 'Owner'} billing period`}>
    <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
    <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly</button>
  </div>;
  const setupLabel = setup === 'custom' ? 'Setup help · custom quote' : setup === 'assisted' ? 'Aim4price helps add stock' : setup === 'self' ? dealer ? 'No setup help needed' : 'Upload my own assets' : setup === 'visit' ? 'Asset recording visit' : 'Formal inspection / valuation';
  const adminLabel = admin === 'self' ? dealer ? 'No ongoing help needed' : 'Manage it myself' : admin === 'custom' ? 'Custom administration' : `Up to ${adminPlan?.hours} admin hours / month`;

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
          'Choose your total active assets across all registers.',
          'Do it yourself or get help with the initial setup.',
          'Choose self-service or monthly admin help.',
          'Review your subscription and optional services.',
          'Choose your monthly admin package.',
          'Choose asset recording or a specialist assessment.',
          'Your answer does not change the Dealer subscription price.',
          'Choose only the assistance you need.',
          'Tell us what you need to get started.',
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
          {dealer ? <Choice selected={setup === 'assisted'} onClick={() => setSetup('assisted')} title="Aim4price helps add stock">We add stock from your supplied details, photos and documents.</Choice> : <Choice selected={setup === 'visit' || setup === 'inspection'} onClick={() => { if (setup === 'self') setSetup(null); move(5); }} title="Arrange a visit">{dealer ? 'Help recording stock details, photos and documents.' : 'Help recording machinery and building my register.'}</Choice>}

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
        <Choice selected={customers === 'self'} onClick={() => setCustomers('self')} title="Not for now">You can add customer registers later.</Choice>
        <Choice selected={customers === 'customers'} onClick={() => setCustomers('customers')} title="Yes, managed by our dealership">Client registers stay in your Dealer account. Clients have no login or access.</Choice>
      </div>}

      {!detail && dealer && step === 7 && <div className={styles.assetChoices} role="group" aria-label="Aim4price assistance">
        {([
          ['none', 'No help needed', 'Use your Dealer tools independently.'],
          ['setup', 'Help getting set up', 'One-off assistance to get started.'],
          ['admin', 'Ongoing admin help', 'Monthly help maintaining your records.'],
          ['both', 'Both', 'Setup assistance and monthly admin help.'],
        ] as const).map(([value, title, copy]) => <Choice key={value} selected={help === value} title={title} onClick={() => {
          setHelp(value);
          if (value === 'none' || value === 'admin') setSetup('self');
          else if (setup === 'self') setSetup(null);
          if (value === 'none' || value === 'setup') setAdmin('self');
          else if (admin === 'self') setAdmin(null);
        }}>{copy}</Choice>)}
      </div>}
      {!detail && dealer && step === 8 && <div className={styles.choices} role="group" aria-label="Setup assistance">
        <Choice selected={setup === 'assisted'} onClick={() => setSetup('assisted')} title="Add our stock">Capture supplied stock details, photographs and documents.</Choice>
        <Choice selected={setup === 'custom'} onClick={() => setSetup('custom')} title="Other setup help">Tell us what you need. We’ll confirm a quote.</Choice>
      </div>}

      {!detail && step === 3 && <div className={styles.review}>
        <div className={styles.reviewTotal}>
          <div aria-live="polite">
            <p className={styles.label}>{dealer ? 'Dealer Partner · launch pricing' : plan ? `${plan.name} · up to ${plan.limit} active assets` : 'Enterprise · more than 300 assets'}</p>
            {plan ? <p className={styles.price}>{money(yearly ? plan.yearly : plan.monthly)}<span>/{yearly ? 'year' : 'month'} hosting</span></p> : <p className={styles.quoteTitle}>Hosting · custom quote</p>}
            <p className={styles.totalCaption}>Your Aim4price hosting subscription.</p>
            {adminPlan && <p className={styles.totalCaption}><strong>+ {money(adminPlan.price)}/month</strong> admin help</p>}
            {admin === 'custom' && <p className={styles.totalCaption}>+ Admin help · quoted separately</p>}
            {plan && adminPlan && !yearly && <p className={styles.totalCaption}><strong>{money(plan.monthly + adminPlan.price)}/month total</strong> before additional account or setup charges.</p>}
            {yearly && <p className={styles.totalCaption}>Hosting billed yearly{adminPlan ? '; admin billed monthly.' : '.'}</p>}

          </div>
          {plan && <div className={styles.reviewBilling}>{billing}<p className={styles.yearlySaving}><strong>Save {money(plan.monthly * 12 - plan.yearly)}/year</strong><span>{((1 - plan.yearly / (plan.monthly * 12)) * 100).toFixed(1)}% off</span></p><p>Yearly saving on hosting only</p></div>}
        </div>
        {setup !== 'self' && <p className={styles.serviceNote}>+ Setup costs · quoted separately.</p>}
        <div className={styles.reviewRows}>
          <div className={styles.reviewRow}><div><span className={styles.rowLabel}>Hosting subscription</span><strong>{plan ? plan.name : 'Enterprise'}</strong></div><span>{plan ? `${money(yearly ? plan.yearly : plan.monthly)}/${yearly ? 'year' : 'month'}` : 'Custom quote'}</span>{!dealer && <button type="button" aria-label="Change assets" onClick={() => { setEditing(true); move(0); }}>Edit</button>}</div>
          <div className={styles.reviewRow}><div><span className={styles.rowLabel}>Initial setup</span><strong>{setupLabel}</strong></div><span>{setup === 'self' ? 'No setup fee' : setup === 'assisted' ? '+ Stock capture · separate quote' : setup === 'visit' ? '+ Capture & travel · separate quote' : '+ Separate custom quote'}</span><button type="button" aria-label="Change setup" onClick={() => { setEditing(true); move(dealer ? 7 : 1); }}>Edit</button></div>
          {dealer && <div className={styles.reviewRow}><div><span className={styles.rowLabel}>Customer registers</span><strong>{customers === 'customers' ? 'Controlled by our dealership' : 'Add customers later'}</strong></div><span>{customers === 'customers' ? '+ Client hosting · billed to you' : 'No client registers selected'}</span><button type="button" aria-label="Change customer registers" onClick={() => { setEditing(true); move(6); }}>Edit</button></div>}
          <div className={styles.reviewRow}><div><span className={styles.rowLabel}>Admin help</span><strong>{adminLabel}</strong></div><span>{adminPlan ? `+ ${money(adminPlan.price)}/month` : admin === 'self' ? 'No admin fee' : '+ Custom quote'}</span><button type="button" aria-label="Change help" onClick={() => { setEditing(true); move(dealer ? 7 : 2); }}>Edit</button></div>
        </div>
        <div className={styles.detailLinks}>
          {dealer && <><button type="button" onClick={() => openDetail('funding')}>Client register billing</button><button type="button" onClick={() => openDetail('commission')}>Partner commission</button></>}
          {setup !== 'self' && <button type="button" onClick={() => openDetail('setup')}>View setup details</button>}
          {admin !== 'self' && <button type="button" onClick={() => openDetail('admin')}>View admin details</button>}
        </div>
        {dealer ? <p className={styles.reviewNote}>Client-register hosting is billed to your dealership and is not included in this preview. Admin confirms charges and the start date. Your clients have no login or access.</p> : <p className={styles.reviewNote}>Unlimited asset registers. Your active-asset limit is shared across the whole account; sold and archived assets are excluded. No per-register fee. Invoices go to your Owner account’s billing email.</p>}
        <p className={styles.reviewNote}>Admin help is available anytime. Prices in rand. No payment or booking is made here.</p>

      </div>}

      {detail && <div className={styles.detailPage}>
        {['funding', 'commission'].includes(detail) && <DealerDetails topic={detail as 'funding' | 'commission'} />}
        {detail === 'setup' && (setup === 'custom' ? <p>We’ll discuss your setup requirements and confirm a separate quote before starting. No setup fee is included in your subscription total.</p> : setup === 'assisted' ? <>
          <p>Send your stock details, photographs and documents. Aim4price helps capture and organise them in your stock register.</p>
          <dl className={styles.dealerRates}><div><dt>Road-licensed stock</dt><dd>R100 per asset</dd></div><div><dt>Other stock</dt><dd>R50 per asset</dd></div></dl>
          <p>We confirm the scope and cost before starting. This is initial stock capture, separate from monthly admin help. No site visit or formal inspection is included.</p>
        </> : setup === 'visit' ? <>
          <p>We record details and photographs to help build an organised {dealer ? 'stock register' : 'asset register'}.</p>
          <dl className={styles.dealerRates}><div><dt>Road-licensed asset</dt><dd>R100 per asset</dd></div><div><dt>Other asset</dt><dd>R50 per asset</dd></div><div><dt>Return travel</dt><dd>R7.50/km</dd></div></dl>
          <p>Travel is charged once per visit. Your quote depends on the asset mix and distance.</p>
          <p>Asset recording is not a formal inspection or certified valuation. These services require a separate quote.</p>
        </> : <><p>A formal inspection or professional valuation is quoted separately for your machinery and requirements.</p><p>It is not included in asset recording, your subscription or admin hours.</p></>)}
        {detail === 'admin' && <>
          <p>We capture supplied records, organise documents and keep {dealer ? 'your agreed records' : 'your asset register'} up to date.</p>
          <dl className={styles.dealerRates}><div><dt>Your monthly help</dt><dd>{adminLabel}</dd></div><div><dt>Monthly fee</dt><dd>{adminPlan ? money(adminPlan.price) : 'Custom quote'}</dd></div><div><dt>Additional work</dt><dd>R250/hour</dd></div></dl>
          {dealer && <p>We agree which records the work covers before starting. Your dealership authorises work on its client registers. Admin help covers the agreed scope and hours.</p>}
          <p>Hours expire monthly and do not roll over. Admin is billed monthly, including when your base plan is yearly.</p><p>Travel, formal inspections and professional valuation research are excluded.</p>
        </>}
      </div>}
      </div>
      <div className={styles.navigation}>
        {detail ? <button type="button" className={styles.secondary} onClick={() => move(3)}>Back to package</button> : <>
        {(dealer ? step !== firstStep && !editing : step === 5 || step === 4 || (!editing && step > firstStep)) ? <button type="button" className={styles.secondary} onClick={() => move(previousStep())}>Back</button> : <span className={styles.note}>{editing ? 'Adjust your choice, then update.' : dealer ? 'Dealer Partner · R199/month' : ready ? 'Your base plan is selected.' : 'Choose your asset range.'}</span>}
        {step !== 3 ? <button type="button" className={styles.primary} disabled={!ready} onClick={() => { const next = editing && !dealer ? 3 : nextStep(); if (next === 3) setEditing(false); move(next); }}>{(editing && !dealer) || nextStep() === 3 ? editing ? 'Update package' : 'See my package' : 'Continue'} </button> : <div className={styles.finalActions}><button type="button" className={styles.restart} onClick={() => { setEditing(false); setAssetBand(null); setSetup(null); setAdmin(null); setCustomers(null); setHelp(null); setYearly(false); move(firstStep); }}>Start again</button><Link href={`/auth?accountType=${audience}#signup`} className={styles.primary}>Sign up</Link></div>}
        </>}
      </div>
    </div>
  </section>;
}
