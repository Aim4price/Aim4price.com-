import { ownerHosting, rand } from '../../lib/hosting-pricing';
import styles from './owner-journey.module.css';

export default function DealerDetails({ topic }: { topic: 'funding' | 'commission' }) {
  return <div className={styles.benefits}>
    {topic === 'funding' && <div>
      <p>Client hosting costs 25% of normal Owner hosting fees per client, based on active assets across that client’s registers. Your Dealer or Business account hosting is separate.</p>
      <dl className={styles.dealerRates}>
        {ownerHosting.map(plan => <div key={plan.range}><dt>{plan.range} assets per client</dt><dd>{rand(plan.monthly / 4)}/month · {rand(plan.annually / 4)}/year</dd></div>)}
        <div><dt>301+ assets per client</dt><dd>Custom quote</dd></div>
      </dl>
      <p>Your business controls the records, sharing and client communication. A separate Owner account or client login is not created. You decide which records to share through the available sharing tools.</p>
      <p>Aim4price bills your business and confirms the charges and start date with you. You may sponsor hosting or charge clients under your own agreement.</p>
      <p>Aim4price does not approach your hosted clients or offer an automatic account takeover. If hosting ends, we deal with your business.</p>
    </div>}
    {topic === 'commission' && <div>
      <p>Eligible partners earn 40% on full-price paid hosting referrals. Custom packages are agreed separately. Approved on-site capture pays 60% to the person doing the work: R270/hour, with R180/hour retained by Aim4price.</p>
      <p>Sale commissions are negotiated per transaction and shared from the total sale fee. Travel payments go entirely to the traveller.</p>
      <p>No referral commission applies to your own hosting, discounted client hosting or Aim4price admin services.</p>
      <p>One active, eligible Partner of Record applies per referral. Hosting commission is based on qualifying receipts after discounts, refunds and chargebacks. It becomes available after 30 days, with monthly statements and a minimum EFT payout of R500. Smaller balances carry forward.</p>
    </div>}
  </div>;
}
