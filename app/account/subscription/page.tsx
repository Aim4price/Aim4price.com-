import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAnyServerSession } from '../../../lib/auth-session';
import { getAccountProfile } from '../../../lib/account-profile';
import { getBillingAgreement, isAccountBillingHeld } from '../../../lib/billing';
import styles from '../../admin/billing/page.module.css';

export default async function OwnerSubscriptionPage() {
  const session=await getAnyServerSession();
  if(!session?.user) redirect('/auth#login');
  const profile=await getAccountProfile(session.user);
  if(profile.accountType!=='owner' || profile.accountStatus!=='active') redirect('/account');
  if(profile.trialEndsAt) redirect('/account/owner-trial');
  const [agreement,held]=await Promise.all([getBillingAgreement(session.user.id),isAccountBillingHeld(session.user.id)]);
  return <main className={styles.page}><section className={styles.panel}>
    <h1>Manage subscription</h1><h2>Owner account</h2>
    {agreement && <p>Billing interval · {agreement.interval}</p>}
    {held && <p>Billing is on hold. No charge will be taken.</p>}
    <p>Aim4price can help you change your plan or billing interval.</p>
    <div className={styles.actions}><Link className={styles.primary} href="/contact-us">Contact Aim4price</Link>
    <Link className={styles.button} href="/billing">View invoices</Link>
    <Link className={styles.button} href="/account">Back to account</Link></div>
  </section></main>;
}
