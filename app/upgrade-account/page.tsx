import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import { getAnyServerSession } from '../../lib/auth-session';
import { getAccountProfile } from '../../lib/account-profile';
import { sharingPlan } from '../../lib/sharing-foundation';
import styles from '../auth/page.module.css';
import buttons from '../../components/SignupFlow.module.css';
export const dynamic='force-dynamic';
export default async function UpgradeAccountPage() {
 const session=await getAnyServerSession();
 if(!session?.user)redirect('/auth#login');
 const profile=await getAccountProfile(session.user);
 if(await sharingPlan(session.user.id,profile.accountType)!=='free')redirect('/auth');
 return <main className={`${styles.page} ${styles.switchPage}`}><AppHeader active="none"/>
  <section className={styles.switchShell} aria-labelledby="upgrade-heading"><div className={styles.switchCard}>
   <h1 id="upgrade-heading" className={styles.switchTitle}>Oops, upgrade your account</h1>
   <p className={styles.switchText}>Your free account opens shared assets. Desktop needs an activated subscription.</p>
   <p className={styles.switchText}>Keep the same login, assets and history when you upgrade.</p>
   <div className={buttons.accessChoices}><Link className={buttons.button} href="/pricing">View Desktop plans</Link><Link className={buttons.secondaryButton} href={profile.accountType==='business'?'/business':'/shared-enquiries'}>Back to shared assets</Link></div>
  </div></section>
 </main>;
}
