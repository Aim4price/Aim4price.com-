import styles from './owner-journey.module.css';
const ownerPlans = [
  { name: 'Essentials', assets: 25, fundedMonthly: 60, fundedYearly: 600 },
  { name: 'Growth', assets: 100, fundedMonthly: 120, fundedYearly: 1200 },
  { name: 'Business', assets: 300, fundedMonthly: 240, fundedYearly: 2400 },
];
const money = (amount: number) => `R${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
export default function DealerDetails() {
  return <div className={styles.benefits}>
    <ul>
      <li><strong>Customers & leads.</strong> Customer asset access and history with permission, Discovery and follow-ups.</li>
      <li><strong>Stock & sales.</strong> Estimates, Ad Studio, reusable branding, a public showroom and Marketplace listings.</li>
      <li><strong>Daily work.</strong> Maintenance, staff assignments, client costs, dashboard and notifications.</li>
    </ul>
    <p>Launch pricing may be reviewed for new Dealers as Discovery and leads develop.</p>
    <details><summary>Manual uploads & Capture</summary><p>Manual entry and document uploads have no daily limit or extra charge. Capture for linked Owner accounts includes 10 invoices + 10 fuel slips per Owner account daily, shared across users and contributors. Resets at midnight South African time. This is an Owner-account allowance, not an additional Dealer allowance.</p></details>
<details><summary>Can a Dealer pay for an Owner account?</summary><div><p>A Dealer can fund an Owner subscription and manage the account with the Owner’s permission. The Owner keeps their own login, owns their information and can revoke Dealer access.</p>
            <div className={styles.fundedRates}>{ownerPlans.map(plan => <div key={plan.name}><h4>{plan.name}</h4><strong>{money(plan.fundedMonthly)}/month or {money(plan.fundedYearly)}/year</strong><p>Up to {plan.assets} active assets</p></div>)}</div>
            <p><strong>R99 once-off activation.</strong> Includes account and initial register setup, Dealer linking, the Owner signup email and access checks.</p><p>The Dealer-funded rate already reflects the partner discount; no additional commission is paid. If the Dealer captures the assets, photographs and documents, no per-asset admin fee or Managed Admin Package is required.</p><p>When Dealer funding ends, the Owner is notified and has 30 days to subscribe. Access remains read-only and information is not deleted.</p></div></details>
          <details><summary>What does asset setup or a visit cost?</summary><div><dl className={styles.dealerRates}><div><dt>Road-licensed asset capture</dt><dd>R100 per asset</dd></div><div><dt>Non-road-licensed asset capture</dt><dd>R50 per asset</dd></div><div><dt>Travel</dt><dd>R7.50 per kilometre</dd></div><div><dt>Formal inspection or professional valuation</dt><dd>Custom quote</dd></div></dl><p>Asset setup covers standard details, supplied photographs and documents, serial/VIN, make, model, year, hours or mileage, and basic ownership details. It is separate from the daily invoice and fuel-slip allowance.</p><p>Travel uses the return distance, with one travel charge per visit. Data capture is not a physical inspection or certified valuation.</p></div></details>
          <details><summary>How does partner commission work?</summary><div><p>Eligible partners earn 40% on referred Owner and Dealer subscriptions and asset data capture. One Partner of Record is linked to each customer and must remain active and compliant.</p><p>Commission is based on qualifying money received, excluding VAT, discounts, refunds and chargebacks. It becomes available after 30 days, with monthly statements and a minimum EFT payout of R500. Smaller balances carry forward.</p><p>Commission credit can fund a Dealer subscription or Dealer-Managed Owner accounts. No commission applies to your own subscription, activation fees or Managed Administration. Dealer-funded subscriptions already include the discount. Travel payments go entirely to the person travelling.</p></div></details>
  </div>;
}
