import styles from './owner-journey.module.css';
const ownerPlans = [
  { name: 'Essentials', assets: 25, fundedMonthly: 60, fundedYearly: 600 },
  { name: 'Growth', assets: 100, fundedMonthly: 120, fundedYearly: 1200 },
  { name: 'Business', assets: 300, fundedMonthly: 240, fundedYearly: 2400 },
];
const money = (amount: number) => `R${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
export default function DealerDetails({ topic }: { topic: 'funding' | 'commission' }) {
  return <div className={styles.benefits}>
{topic === 'funding' && <div>
            <p>Client Owner accounts created under your dealership are billed to you, alongside your Dealer subscription on one consolidated invoice sent to your Dealer account’s billing email. Each client account is listed separately with its plan and price.</p>
            <div className={styles.fundedRates}>{ownerPlans.map(plan => <div key={plan.name}><h4>{plan.name}</h4><strong>{money(plan.fundedMonthly)}/month or {money(plan.fundedYearly)}/year</strong><p>Up to {plan.assets} active assets per client account</p></div>)}</div>
            <p>Each client account includes unlimited asset registers. Its active-asset limit is shared across all its registers, not across your dealership. Sold and archived assets are excluded. There is no per-register fee.</p>
            <p><strong>R99 once-off activation per client account.</strong> Includes account and initial register setup, Dealer linking, the Owner signup email and access checks. Charges begin when the client account is activated; choosing customer management here adds no charge.</p>
            <p>You can sponsor client accounts or invoice clients yourself at a price you agree with them. Aim4price does not set, collect or administer your charges to clients.</p>
            <p>The client-account rates already include the partner discount; no additional commission is paid. If your team captures the assets, photographs and documents, no additional capture or admin package is required.</p>
            <p>Clients retain ownership of their information and control access. Existing independently billed Owners keep their own billing when they grant you access; a billing transfer must be explicitly agreed.</p>
            <p>When Dealer funding ends, the Owner is notified and has 30 days to subscribe. Access remains read-only and information is not deleted.</p>
          </div>}
          {topic === 'commission' && <div><p>Eligible partners earn 40% on referred Owner and Dealer subscriptions and asset data capture. One Partner of Record is linked to each customer and must remain active and compliant.</p><p>Commission is based on qualifying money received, excluding VAT, discounts, refunds and chargebacks. It becomes available after 30 days, with monthly statements and a minimum EFT payout of R500. Smaller balances carry forward.</p><p>Commission credit can fund a Dealer subscription or Dealer-Managed Owner accounts. No commission applies to your own subscription, activation fees or Managed Administration. Dealer-funded subscriptions already include the discount. Travel payments go entirely to the person travelling.</p></div>}
  </div>;
}
