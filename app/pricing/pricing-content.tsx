'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { adminRetainers, assetSaleFees, businessHosting, clientCount, hostingEstimate, ownerHosting, rand, type HostingAudience, type HostingPeriod } from '../../lib/hosting-pricing';
import styles from './pricing.module.css';

const accounts = [
  { id: 'owner', name: 'Owner', intro: 'Manage your own assets.', note: 'Hosting by active asset count.', icon: 'owner' },
  { id: 'dealer', name: 'Dealer', intro: 'Manage stock and client assets.', note: 'Client hosting charged separately.', icon: 'dealer' },
  { id: 'business', name: 'Business', intro: 'Manage assets for your clients.', note: 'Free shared access also available.', icon: 'business' },
  { id: 'middleman', name: 'Middleman', intro: 'Connect owners and opportunities.', note: 'Free basic access. Services separate.', icon: 'middleman' },
] as const;

function Icon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'owner' ? <><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></> : name === 'dealer' ? <><path d="M3 10h18l-2-6H5Z M4 10v10h16V10 M8 20v-6h8v6"/></> : name === 'business' ? <><rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V3h8v4M3 12l9 4 9-4M12 14v4"/></> : name === 'middleman' ? <><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M2 19v-3a4 4 0 0 1 4-4h2m14 7v-3a4 4 0 0 0-4-4h-2M8 18h8m-3-3 3 3-3 3"/></> : name === 'remote' ? <><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8m-4-5v5M7 8h10M7 11h6"/></> : name === 'visit' ? <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></> : <><path d="m5 12 4 4L19 6"/></>}
  </svg>;
}
function Detail({ title, children }: { title: string; children: ReactNode }) {
  return <details className={styles.detail}><summary><span>{title}</span><span className={styles.plus} aria-hidden="true" /></summary><div className={styles.detailBody}>{children}</div></details>;
}

export default function PricingContent({ signedIn = false, initialAudience = null }: { signedIn?: boolean; initialAudience?: HostingAudience | null }) {
  const [audience, setAudience] = useState<HostingAudience>(initialAudience ?? 'owner');
  const [period, setPeriod] = useState<HostingPeriod>('monthly');
  const [band, setBand] = useState(0);
  const [clients, setClients] = useState([0, 0, 0]);
  const [customClients, setCustomClients] = useState(false);
  const [adminIndex, setAdminIndex] = useState(-1);
  const partner = audience === 'dealer' || audience === 'business';
  const annual = period === 'annually';
  const unit = annual ? 'year' : 'month';
  const estimate = hostingEstimate(audience, period, band, clients, adminIndex);
  const needsQuote = estimate.customOwner || (partner && customClients);
  const account = accounts.find(item => item.id === audience)!;
  const count = clients.reduce((sum, number) => sum + number, 0);
  const updateClient = (index: number, value: number | string) => setClients(current => current.map((number, i) => i === index ? clientCount(value) : number));
  const accountFee = (id: HostingAudience) => id === 'middleman' ? 'Free' : rand(id === 'owner' ? ownerHosting[0][period] : businessHosting[period]);
  const enquiry = '/contact-us';

  return <div className={styles.photoSurface}><div className={styles.shell}>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>Your assets. Your choice of support.</p>
      <h1>Hosting Fees</h1>
      <p className={styles.heroDescription}>Start with the platform. Add help when you need it.</p>
      <div className={styles.billing} role="group" aria-label="Hosting billing period">
        <button type="button" aria-pressed={!annual} onClick={() => setPeriod('monthly')}>Monthly</button>
        <button type="button" aria-pressed={annual} onClick={() => setPeriod('annually')}>Annually <span>Save</span></button>
      </div>
      <p className={styles.billingHint}>Annual hosting is paid once a year. Admin retainers stay monthly.</p>
    </header>

    <section className={styles.accountGrid} aria-label="Choose your account">
      {accounts.map(item => <button key={item.id} type="button" className={styles.accountCard} aria-pressed={audience === item.id} aria-controls="hosting-options" onClick={() => setAudience(item.id)}>
        <span className={styles.cardTop}><span className={styles.icon}><Icon name={item.icon}/></span><span className={styles.selection} aria-hidden="true">{audience === item.id ? '✓' : ''}</span></span>
        <strong className={styles.accountTitle}>{item.name}</strong>
        <span className={styles.accountDescription}>{item.intro}</span>
        <span className={styles.cardPrice}><span className={styles.priceLabel}>{item.id === 'owner' ? 'Hosting from' : item.id === 'middleman' ? 'Basic access' : 'Account hosting'}</span><span className={styles.priceLine}><strong>{accountFee(item.id)}</strong>{item.id !== 'middleman' && <span>/{unit}</span>}</span></span>
        <span className={styles.cardNote}>{item.note}</span>
      </button>)}
    </section>

    <section id="hosting-options" className={styles.package} aria-label={`${account.name} hosting options`}>
      <div className={styles.packageMain}>
        <div className={styles.sectionHeading}><span className={styles.step}>01</span><div><h2>{audience === 'owner' ? 'How many assets do you own?' : partner ? 'Host your clients’ assets' : 'Make connections. Earn together.'}</h2><p>{audience === 'owner' ? 'The same tools, with room for your asset count.' : partner ? 'Pay just 25% of normal Owner hosting fees per client.' : 'Basic Middleman access is free. Paid assistance is optional.'}</p></div></div>
        {audience === 'owner' && <>
          <div className={styles.bands} role="group" aria-label="Owner active asset count">
            {ownerHosting.map((item, index) => <button type="button" key={item.range} aria-pressed={band === index} onClick={() => setBand(index)}><strong>{item.range}</strong><span>active assets</span><b>{rand(item[period])}<small>/{unit}</small></b></button>)}
            <button type="button" aria-pressed={band === 3} onClick={() => setBand(3)}><strong>301+</strong><span>active assets</span><b>Custom quote</b></button>
          </div>
          <p className={styles.note}>Unlimited registers within your account’s asset limit. Sold and archived assets do not count.</p>
          <div className={styles.benefits}><span><Icon name="check"/>Asset records &amp; documents</span><span><Icon name="check"/>Costs, fuel &amp; maintenance</span><span><Icon name="check"/>Sharing &amp; reports</span><span><Icon name="check"/>Self-service uploads</span></div>
        </>}
        {partner && <>
          <div className={styles.clientIntro}><strong>From {rand(ownerHosting[0][period] / 4)} per client/{unit}</strong><span>Add your client numbers below to see the hosting total.</span></div>
          <div className={styles.clientRows}>
            {ownerHosting.map((item, index) => <div className={styles.clientRow} key={item.range}><div><label htmlFor={`client-count-${index}`}>{item.range} assets per client</label><span>{rand(item[period] / 4)} per client/{unit}</span></div><div className={styles.stepper}><button type="button" aria-label={`Remove a client with ${item.range} assets`} disabled={clients[index] === 0} onClick={() => updateClient(index, clients[index] - 1)}>−</button><input id={`client-count-${index}`} type="number" inputMode="numeric" min="0" max="10000" step="1" value={clients[index]} onChange={event => updateClient(index, event.target.value)}/><button type="button" aria-label={`Add a client with ${item.range} assets`} disabled={clients[index] === 10000} onClick={() => updateClient(index, clients[index] + 1)}>+</button></div></div>)}
          </div>
          <label className={styles.customCheck}><input type="checkbox" checked={customClients} onChange={event => setCustomClients(event.target.checked)}/><span>I also have clients with 301+ assets <strong>Custom quote</strong></span></label>
          <p className={styles.note}>Count active assets per client across their registers. Your own account fee is separate. No referral commission applies to discounted client hosting.</p>
          <div className={styles.relationship}><strong>Your clients. Your relationship.</strong><p>You control the records, client communication and your own charges. Aim4price bills your business and does not approach hosted clients or offer automatic account takeovers. A separate Owner account is not created.</p></div>
          {audience === 'business' && <p className={styles.note}>Only working with assets shared by someone else? <Link href={signedIn ? enquiry : '/business/join'}>{signedIn ? 'Discuss free shared access' : 'Create a free shared-access account'}</Link>. Paid Business hosting is a separate service.</p>}
        </>}
        {audience === 'middleman' && <div className={styles.middleman}><div className={styles.benefits}><span><Icon name="check"/>Introduce customers</span><span><Icon name="check"/>Connect asset opportunities</span><span><Icon name="check"/>Earn agreed partner shares</span></div><p>Earn 40% on eligible full-price hosting referrals, 60% for approved on-site capture you perform, and a negotiated share of completed sales.</p><p className={styles.note}>Free access does not include paid client hosting or assistance. Partner eligibility and transaction terms apply.</p></div>}
        <div className={styles.adminHeading}><h3>Add monthly admin help</h3><span>Optional · same rates for every account</span></div>
        <div className={styles.adminChoices} role="group" aria-label="Monthly admin retainer">
          <button type="button" aria-pressed={adminIndex === -1} onClick={() => setAdminIndex(-1)}><strong>No help needed</strong><span>I’ll manage it</span></button>
          {adminRetainers.map((item, index) => <button type="button" key={item.hours} aria-pressed={adminIndex === index} onClick={() => setAdminIndex(index)}><strong>Up to {item.hours} hours</strong><span>{rand(item.cents)}/month</span></button>)}
        </div>
        <p className={styles.note}>Unused hours expire monthly. Need more capacity? We agree a higher retainer before extra work starts. <Link href={enquiry}>Discuss a custom retainer</Link>.</p>
      </div>
      <aside className={styles.estimate} aria-label="Your estimated costs">
        <p className={styles.eyebrow}>Your estimate</p><h2>{account.name}</h2>
        <div className={styles.breakdown}><div><span>{audience === 'middleman' ? 'Basic access' : 'Account hosting'}</span><strong>{estimate.customOwner ? 'Custom' : estimate.base ? `${rand(estimate.base)}/${unit}` : 'Free'}</strong></div>{partner && <div><span>Client hosting ({count})</span><strong>{rand(estimate.clientHosting)}/{unit}</strong></div>}<div><span>Monthly admin</span><strong>{estimate.admin ? `${rand(estimate.admin)}/month` : 'Not added'}</strong></div></div>
        <div className={styles.total} aria-live="polite" aria-atomic="true" data-hosting-estimate>
          <span>{needsQuote ? 'Priced items, plus custom quote' : audience === 'middleman' && !estimate.admin ? 'Basic access' : annual ? 'Annual hosting' : 'Monthly total'}</span>
          <strong>{estimate.customOwner ? 'Custom quote' : audience === 'middleman' && !estimate.admin ? 'Free' : rand(annual ? estimate.hosting : estimate.monthlyTotal ?? 0)}</strong>
          {!estimate.customOwner && !(audience === 'middleman' && !estimate.admin) && <span>/{unit}{partner && customClients ? ' + custom client hosting' : ''}</span>}
          {annual && estimate.admin > 0 && <b>+ {rand(estimate.admin)}/month admin</b>}
          {estimate.customOwner && estimate.admin > 0 && <b>+ {rand(estimate.admin)}/month admin</b>}
        </div>
        {annual && !needsQuote && audience !== 'middleman' && <p className={styles.saving}>Save {rand(hostingEstimate(audience, 'monthly', band, clients, -1).hosting * 12 - estimate.hosting)} a year on hosting.</p>}
        <p className={styles.estimateNote}>Setup, travel and success fees are separate. This estimate does not activate billing or make a booking.</p>
        <Link href={signedIn || partner || needsQuote || audience === 'middleman' ? enquiry : '/auth?accountType=owner#signup'} className={styles.primary}>{signedIn || partner || needsQuote || audience === 'middleman' ? 'Discuss my package' : 'Create Owner account'}<span aria-hidden="true">↗</span></Link>
        <p className={styles.taxNote}>Prices in rand. Aim4price is not VAT registered. No VAT is added to these fees.</p>
      </aside>
    </section>

    <section className={styles.services} aria-labelledby="assistance-heading">
      <div className={styles.sectionHeading}><span className={styles.step}>02</span><div><h2 id="assistance-heading">A little help, or a hands-on start</h2><p>Choose the assistance you need. We agree the work and cost upfront.</p></div></div>
      <div className={styles.serviceGrid}>
        <article><span className={styles.icon}><Icon name="check"/></span><h3>Do it yourself</h3><p className={styles.servicePrice}>Free</p><p>Add your own assets, photos and documents. Hosting fees still apply.</p><span className={styles.serviceTag}>No assistance charge</span></article>
        <article><span className={styles.icon}><Icon name="remote"/></span><h3>Remote assistance</h3><p className={styles.servicePrice}>R250<span>/hour</span></p><p>Setup, uploads and routine admin via WhatsApp or remotely.</p><span className={styles.serviceTag}>R62.50 per 15 minutes</span><p className={styles.note}>15-minute minimum, then 15-minute increments.</p></article>
        <article><span className={styles.icon}><Icon name="visit"/></span><h3>On-site capture</h3><p className={styles.servicePrice}>R450<span>/hour</span></p><p>We record asset details and photographs. Routine office uploading and checking are included.</p><span className={styles.serviceTag}>Plus R7.50/km return travel</span><p className={styles.note}>1-hour minimum, then 15-minute increments. Longer trips quoted upfront.</p></article>
      </div>
      <p className={styles.note}>The same service rates apply to owners, dealers and businesses. Formal inspections, specialist research and professional valuations are quoted separately.</p>
    </section>

    <section className={styles.more} aria-labelledby="more-heading"><div className={styles.sectionHeading}><span className={styles.step}>03</span><div><h2 id="more-heading">Success fees &amp; useful details</h2><p>Clear terms for the opportunities that follow.</p></div></div>
      <Detail title="Asset sale success fees"><p>Fees are selected using the asset’s selling price excluding VAT. Agree the fee before marketing; payment is due after the sale completes and the seller is paid.</p><div className={styles.tableScroll}><table><thead><tr><th scope="col">Selling price excluding VAT</th><th scope="col">Total sale fee</th></tr></thead><tbody>{assetSaleFees.map(([range, fee]) => <tr key={range}><td>{range}</td><td>{fee}</td></tr>)}</tbody></table></div><p>*Small asset sales are negotiated upfront; the R2 500 band is a guide. Partner shares come from the total fee, not an additional fee per participant.</p></Detail>
      <Detail title="Proven savings success fees"><p>We record evidence, agree a comparable baseline and present the results to the owner. Time saved is valued only at an agreed rate.</p><div className={styles.formula}>Proven savings + agreed improvements − hosting − admin/management − agreed implementation costs = eligible net savings.</div><table><thead><tr><th scope="col">Portion of eligible net savings</th><th scope="col">Fee</th></tr></thead><tbody><tr><td>First R100 000</td><td>15%</td></tr><tr><td>Next R400 000, up to R500 000</td><td>10%</td></tr><tr><td>Next R500 000, up to R1 million</td><td>7.5%</td></tr><tr><td>Portion above R1 million</td><td>Agreed upfront</td></tr></tbody></table><p>These bands apply incrementally over the year. No savings fee applies to a zero or negative balance. Review evidence quarterly; invoice every six months with annual reconciliation and credit for earlier invoices.</p><p>We do not double-count benefits. The owner’s final benefit is the eligible net savings less the success fee. Arrangements for hosted clients go through their dealer/business.</p></Detail>
      <Detail title="Partner earnings"><div className={styles.partnerRates}><article><strong>40%</strong><h3>Hosting referrals</h3><p>On eligible full-price paid hosting. Custom packages by agreement.</p></article><article><strong>60%</strong><h3>On-site capture</h3><p>R270/hour for the person doing approved work. Aim4price retains R180/hour.</p></article><article><strong>Agreed</strong><h3>Completed sales</h3><p>Each partner’s share is negotiated per transaction.</p></article></div><p>Travel payments go entirely to the traveller. No commission on your own hosting, discounted client hosting or Aim4price admin services.</p><p>One active, eligible Partner of Record per referral. Hosting commission is based on qualifying receipts after discounts, refunds and chargebacks. Available after 30 days, with monthly statements and a R500 minimum EFT payout; smaller balances carry forward.</p></Detail>
      <Detail title="Client hosting & your business relationship"><p>Dealer/business-funded hosting costs 25% of normal Owner fees per client. Your account hosting is separate. You can sponsor the hosting or charge clients under your own agreement.</p><p>You control client communication and authorise work on their records. Aim4price deals with your business for billing and support arrangements. If hosting ends, we deal with you; we do not approach hosted clients or offer an automatic Owner account takeover.</p><p>A separate client login is not created. You decide which records to share through the available sharing tools. Ask us about your required client-access arrangement before setup.</p></Detail>
      <Detail title="What hosting and admin cover"><p>Owner hosting includes asset records, documents, costs, fuel, maintenance, sharing and reports. Your active-asset limit applies across all registers; sold and archived assets are excluded.</p><p>Dealer hosting covers your own stock workspace. Client hosting is separate. Business shared access is free for records others share with you; a managed Business workspace is R199/month or R1 999/year, arranged with Aim4price.</p><p>Admin retainers cover agreed routine record capture, document organisation and updates. Hours determine the retainer and expire monthly. No automatic hourly overages: agree a higher retainer before extra work begins.</p></Detail>
      <Detail title="Parts, finance, insurance & other services"><p>Parts supply, insurance and finance arrangements, wholesale, trade and exports are quoted for the opportunity. Any supply margin, referral commission or savings fee is agreed transparently upfront.</p><p>GPS tracking, specialist consultancy and custom data/reporting requirements are discussed separately. These are not included as unlimited services in hosting.</p></Detail>
    </section>
    <div className={styles.closing}><div><h2>Let’s find your starting point.</h2><p>We’ll help you choose the hosting and support that fits.</p></div><Link className={styles.primary} href={enquiry}>Talk to Aim4price <span aria-hidden="true">↗</span></Link></div>
  </div></div>;
}
