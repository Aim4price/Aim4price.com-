'use client';

import { useState, type ReactNode } from 'react';
import { adminRetainers, assetSaleFees, rand } from '../../lib/hosting-pricing';
import DealerDetails from './dealer-details';
import PricingIcon, { type PricingIconName } from './pricing-icon';
import styles from './pricing.module.css';

type FeeTopic = 'setup' | 'sale' | 'savings' | 'commission' | 'clients' | 'coverage' | 'other';

function Detail({ title, icon, children, open, onToggle }: { title: string; icon: PricingIconName; children: ReactNode; open: boolean; onToggle: () => void }) {
  return <details open={open}><summary onClick={event => { event.preventDefault(); onToggle(); }}><span className={styles.feeTitle}><span className={styles.feeIcon}><PricingIcon name={icon} /></span>{title}</span></summary><div className={styles.detailBody}>{children}</div></details>;
}

export default function ServiceFees({ initialTopic }: { initialTopic?: 'commission' }) {
  const [activeTopic, setActiveTopic] = useState<FeeTopic | null>(initialTopic ?? null);
  const icons: Record<FeeTopic, PricingIconName> = { setup: 'admin', sale: 'sale', savings: 'savings', commission: 'clients', clients: 'link', coverage: 'shield', other: 'services' };
  const section = (topic: FeeTopic) => ({
    icon: icons[topic],
    open: activeTopic === topic,
    onToggle: () => setActiveTopic(current => current === topic ? null : topic),
  });
  return <div className={`${styles.detailsList} ${styles.serviceFees}`} data-service-fees>
      {initialTopic === 'commission' && <Detail title="Partner earnings" {...section('commission')}><DealerDetails topic="commission" /></Detail>}
      <Detail title="Setup & monthly admin" {...section('setup')}>
        <p>Self-service uploads are free; hosting fees still apply. Remote or WhatsApp help is R250/hour: a 15-minute minimum, then R62.50 per 15 minutes.</p>
        <p>On-site capture is R450/hour: a one-hour minimum, then 15-minute increments. Routine office uploading and checking are included. Return travel is R7.50/km; longer trips are quoted upfront.</p>
        <dl className={styles.serviceList}>{adminRetainers.map(plan => <div key={plan.hours}><dt>Up to {plan.hours} admin hours/month</dt><dd>{rand(plan.cents)}/month</dd></div>)}</dl>
        <p>Unused hours expire monthly. We agree a higher retainer before extra work starts. The same assistance rates apply to owners and businesses. All prices are in rand; Aim4price is not VAT registered and adds no VAT.</p>
      </Detail>
      <Detail title="Asset sale success fees" {...section('sale')}><p>Fees are selected using the asset’s selling price excluding VAT. Agree the fee before marketing; payment is due after the sale completes and the seller is paid.</p><div className={styles.tableScroll}><table><thead><tr><th scope="col">Selling price excluding VAT</th><th scope="col">Total sale fee</th></tr></thead><tbody>{assetSaleFees.map(([range, fee]) => <tr key={range}><td>{range}</td><td>{fee}</td></tr>)}</tbody></table></div><p>*Small asset sales are negotiated upfront; the R2 500 band is a guide. Partner shares come from the total fee, not an additional fee per participant.</p></Detail>
      <Detail title="Proven savings success fees" {...section('savings')}><p>We record evidence, agree a comparable baseline and present the results to the owner. Time saved is valued only at an agreed rate.</p><div className={styles.footnote}>Proven savings + agreed improvements − hosting − admin/management − agreed implementation costs = eligible net savings.</div><table><thead><tr><th scope="col">Portion of eligible net savings</th><th scope="col">Fee</th></tr></thead><tbody><tr><td>First R100 000</td><td>15%</td></tr><tr><td>Next R400 000, up to R500 000</td><td>10%</td></tr><tr><td>Next R500 000, up to R1 million</td><td>7.5%</td></tr><tr><td>Portion above R1 million</td><td>Agreed upfront</td></tr></tbody></table><p>These bands apply incrementally over the year. No savings fee applies to a zero or negative balance. Review evidence quarterly; invoice every six months with annual reconciliation and credit for earlier invoices.</p><p>We do not double-count benefits. The owner’s final benefit is the eligible net savings less the success fee. Arrangements for hosted clients go through their dealer/business.</p></Detail>
      {initialTopic !== 'commission' && <Detail title="Partner earnings" {...section('commission')}><DealerDetails topic="commission" /></Detail>}
      <Detail title="Client hosting & your business relationship" {...section('clients')}><DealerDetails topic="funding" /></Detail>
      <Detail title="What hosting and admin cover" {...section('coverage')}><p>Owner hosting includes asset records, documents, costs, fuel, maintenance, sharing and reports. Your active-asset limit applies across all registers; sold and archived assets are excluded.</p><p>Business hosting covers your own stock register and parts stocklists for R199/month or R1 999/year. Each hosted client register adds 25% of the applicable Owner rate.</p><p>Admin retainers cover agreed routine record capture, document organisation and updates. Hours determine the retainer and expire monthly. No automatic hourly overages: agree a higher retainer before extra work begins.</p></Detail>
      <Detail title="Parts, finance, insurance & other services" {...section('other')}><p>Parts supply, insurance and finance arrangements, wholesale, trade and exports are quoted for the opportunity. Any supply margin, referral commission or savings fee is agreed transparently upfront.</p><p>GPS tracking, specialist consultancy and custom data/reporting requirements are discussed separately. These are not included as unlimited services in hosting.</p></Detail>
  </div>;
}
