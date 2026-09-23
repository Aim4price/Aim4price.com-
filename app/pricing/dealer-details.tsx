import styles from './owner-journey.module.css';
const ownerPlans = [
  { name: 'Essentials', assets: 25, fundedMonthly: 60, fundedYearly: 600 },
  { name: 'Growth', assets: 100, fundedMonthly: 120, fundedYearly: 1200 },
  { name: 'Business', assets: 300, fundedMonthly: 240, fundedYearly: 2400 },
];
const money = (amount: number) => `R${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
export default function DealerDetails({ topic }: { topic: 'tools' | 'funding' | 'commission' }) {
  return <div className={styles.benefits}>
    {topic === 'tools' && <><ul>
      <li><strong>Customers & leads.</strong> Customer asset access and history with permission, Discovery and follow-ups.</li>
      <li><strong>Stock & sales.</strong> Estimates, Ad Studio, reusable branding, a public showroom and Marketplace listings.</li>
      <li><strong>Daily work.</strong> Maintenance, staff assignments, client costs, dashboard and notifications.</li>
    </ul>
    <p>Launch pricing may be reviewed for new Dealers as Discovery and leads develop.</p>
    <h3>Manual uploads &amp; Capture</h3><p>Manual entry and document uploads have no daily limit or extra charge. Capture for linked Owner accounts includes 10 invoices + 10 fuel slips per Owner account daily, shared across users and contributors. Resets at midnight South African time. This is an Owner-account allowance, not an additional Dealer allowance.</p></>}
{topic === 'funding' && <div><p>Customer subscriptions are separate from your Dealer plan. The Owner can pay for their own account, or a Dealer can fund an Owner subscription and manage the account with the Owner’s permission. The Owner keeps their own login, owns their information and can revoke Dealer access.</p>
            <div className={styles.fundedRates}>{ownerPlans.map(plan => <div key={plan.name}><h4>{plan.name}</h4><strong>{money(plan.fundedMonthly)}/month or {money(plan.fundedYearly)}/year</strong><p>Up to {plan.assets} active assets</p></div>)}</div>
            <p><strong>R99 once-off activation.</strong> Includes account and initial register setup, Dealer linking, the Owner signup email and access checks.</p><p>The Dealer-funded rate already reflects the partner discount; no additional commission is paid. If the Dealer captures the assets, photographs and documents, no per-asset admin fee or Managed Admin Package is required.</p><p>When Dealer funding ends, the Owner is notified and has 30 days to subscribe. Access remains read-only and information is not deleted.</p></div>}
          {topic === 'commission' && <div><p>Eligible partners earn 40% on referred Owner and Dealer subscriptions and asset data capture. One Partner of Record is linked to each customer and must remain active and compliant.</p><p>Commission is based on qualifying money received, excluding VAT, discounts, refunds and chargebacks. It becomes available after 30 days, with monthly statements and a minimum EFT payout of R500. Smaller balances carry forward.</p><p>Commission credit can fund a Dealer subscription or Dealer-Managed Owner accounts. No commission applies to your own subscription, activation fees or Managed Administration. Dealer-funded subscriptions already include the discount. Travel payments go entirely to the person travelling.</p></div>}
  </div>;
}
