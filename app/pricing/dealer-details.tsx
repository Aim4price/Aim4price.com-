import styles from './owner-journey.module.css';
export default function DealerDetails({ topic }: { topic: 'funding' | 'commission' }) {
  return <div className={styles.benefits}>
{topic === 'funding' && <div>
            <p>Client registers sit inside your Dealer account and are fully controlled by your dealership. Creating a client register does not create an Owner account or give the client a login, invitation or access.</p>
            <p>Client-register hosting is billed to your dealership alongside your Dealer subscription. Invoices go to your Dealer account’s billing email. Your own dealership stock is unlimited.</p>
            <p>Aim4price Admin confirms the hosting charges and billing start date. Client-register billing follows your Dealer billing cycle. Choosing customer management in this preview does not activate charges.</p>
            <p>You may sponsor the service or invoice your clients separately. You decide your prices and collect any client payments; Aim4price does not manage that arrangement.</p>
            <p>Independent Owner accounts are separate: each has unlimited registers within its account-wide active-asset allowance and receives its own invoices. This does not give clients access to registers held in your Dealer account.</p>
          </div>}
          {topic === 'commission' && <div><p>Eligible partners earn 40% on referred Owner and Dealer subscriptions and asset data capture. One Partner of Record is linked to each customer and must remain active and compliant.</p><p>Commission is based on qualifying money received, excluding VAT, discounts, refunds and chargebacks. It becomes available after 30 days, with monthly statements and a minimum EFT payout of R500. Smaller balances carry forward.</p><p>Commission credit can be applied to eligible charges on your Dealer invoice under the partner arrangement. No commission applies to your own subscription, activation fees or Managed Administration. Discounted client-register hosting does not earn additional referral commission. Travel payments go entirely to the person travelling.</p></div>}
  </div>;
}
