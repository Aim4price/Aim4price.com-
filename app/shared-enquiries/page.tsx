import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import { getServerSession } from '../../lib/auth-session';
import { getAccountProfile } from '../../lib/account-profile';
import { listReceivedSharedEnquiries } from '../../lib/guest-leads';
import { sharingPlan, sharingUsageSummary } from '../../lib/sharing-foundation';
import styles from '../business/page.module.css';
export const dynamic = 'force-dynamic';
export default async function SharedEnquiries() {
    const session = await getServerSession({ requireActive: false });
    if (!session)
        redirect('/auth?returnTo=/shared-enquiries#login');
    const profile = await getAccountProfile(session.user);
    if (profile.accountType === 'business')
        redirect('/business');
    if (profile.accountStatus === 'suspended')
        redirect('/pending-payment');
    if (await sharingPlan(session.user.id, profile.accountType) !== 'free')
        redirect('/leads');
    const enquiries = session.user.emailVerified ? await listReceivedSharedEnquiries() : [];
    const usage = await sharingUsageSummary(session.user.id);
    return <><AppHeader active="none"/><main className={styles.page}>
  <div className={styles.workspaceHeading}><div><span className={styles.eyebrow}>Free Dealer account</span><h1 className={styles.title}>Shared enquiries</h1><p className={styles.intro}>Your assets, uploads and activity stay with this account when you upgrade.</p></div><Link className={styles.secondaryButton} href="/pricing">Explore Desktop plans</Link></div>
  {!session.user.emailVerified && <p className={styles.notice}>Verify your email using the message sent at registration, then reopen your enquiry.</p>}
  <div className={styles.grid}><section className={styles.panel}><h2>Received enquiries</h2>{!enquiries.length ? <p>No authorised enquiries yet. Open a link sent to you to get started.</p> : enquiries.map(enquiry => <article key={enquiry.token} className={styles.lead}><h3>{enquiry.sender || 'Shared asset'}</h3><p>{enquiry.request}</p><Link className={styles.button} href={`/asset-share/${enquiry.token}`}>Open enquiry</Link></article>)}</section>
  <aside className={styles.panel}><h2>Your usage</h2><p>{usage.asset_received?.count || 0} assets received</p><p>{usage.upload?.count || 0} uploads</p><p>{usage.contribution?.count || 0} contributions</p><p className={styles.muted}>Usage is being recorded. No free allowance limits are currently enforced.</p><p>Desktop access requires subscription activation. Your existing account and data stay in place.</p></aside></div>
 </main></>;
}
