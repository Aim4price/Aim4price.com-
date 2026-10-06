import SharedAccountHero from '../../components/SharedAccountHero';
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
    return <><AppHeader active="none"/><main><SharedAccountHero count={enquiries.length}/><div className={`${styles.page} ${styles.accountContent}`}>

  {!session.user.emailVerified && <p className={styles.notice}>Verify your email using the message sent at registration, then reopen your enquiry.</p>}
  <div className={styles.grid}><section id="received-enquiries" className={`${styles.panel} ${styles.enquiriesPanel}`}><h2>Received enquiries <span className={styles.count}>{enquiries.length}</span></h2>{!enquiries.length ? <p>No authorised enquiries yet. Open a link sent to you to get started.</p> : enquiries.map(enquiry => <article key={enquiry.token} className={styles.lead}><h3>{enquiry.sender || 'Shared asset'}</h3><p>{enquiry.request}</p><Link className={styles.button} href={`/asset-share/${enquiry.token}`}>Open enquiry</Link></article>)}</section>
  <aside className={`${styles.panel} ${styles.accountAside}`}><h2>Your usage</h2><dl className={styles.usageStats}><div><dt>Assets received</dt><dd>{usage.asset_received?.count||0}</dd></div><div><dt>Uploads</dt><dd>{usage.upload?.count||0}</dd></div><div><dt>Contributions</dt><dd>{usage.contribution?.count||0}</dd></div></dl><p className={styles.muted}>Usage is being recorded. No free allowance limits are currently enforced.</p><p>Desktop access requires subscription activation. Your existing account and data stay in place.</p><div className={styles.upgrade}><strong>Ready for Aim4price Desktop?</strong><p className={styles.muted}>Keep your account and existing activity when you upgrade.</p><Link className={styles.secondaryButton} href="/pricing">Explore Desktop plans</Link></div></aside></div>
 </div></main></>;
}
