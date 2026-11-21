import ReceivedShareCard from '../../components/asset-register/ReceivedShareCard';
import SharedAccountHero from '../../components/SharedAccountHero';
import { sharingUsageSummary } from '../../lib/sharing-foundation';
import { listReceivedSharedEnquiries } from '../../lib/guest-leads';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import { sharedEnquiryReturnTo } from '../../lib/external-share-permissions';
import { getServerSession } from '../../lib/auth-session';
import { readBusinessAccount } from '../../lib/business-accounts';
import { businessWorkspaceSummary } from '../../lib/business-workspaces';
import styles from './page.module.css';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const metadata={title:'Shared Assets | Aim4price',robots:{index:false,follow:false}};
export default async function BusinessPage({searchParams}:{searchParams?:{returnTo?:string;details?:string}}) {
 const returnTo=sharedEnquiryReturnTo(searchParams?.returnTo);
 const session=await getServerSession({requireActive:false});
 if(!session?.user)redirect('/business/join'+(returnTo?'?returnTo='+encodeURIComponent(returnTo):''));
 const account=await readBusinessAccount(session.user);
 if(!account)redirect('/account');
 if(searchParams?.details==='1')redirect('/account#account-details');
 const workspace=await businessWorkspaceSummary(session.user.id);
 const paused=account.profile.accountStatus!=='active'||!workspace||workspace.suspended;
 const enquiries=paused?[]:await listReceivedSharedEnquiries();
 const usage=await sharingUsageSummary(session.user.id);
 const assetCount = enquiries.reduce((total, share) => total + share.assetCount, 0);
 return <><AppHeader active="none"/><main><SharedAccountHero count={assetCount}/><div className={`${styles.page} ${styles.accountContent}`}>

  {paused?<p className={styles.notice} role="status">Account access is paused. Contact Aim4price to review your access.</p>:returnTo?<Link className={styles.button} href={returnTo}>Return to shared assets</Link>:null}
  <div className={styles.grid}>
   <section id="received-enquiries" className={`${styles.panel} ${styles.enquiriesPanel}`} aria-labelledby="enquiries-title"><h2 id="enquiries-title">Shared Assets <span className={styles.count}>{assetCount}</span></h2>
    {!session.user.emailVerified?<p>Verify your email in Account to view assets shared with you.</p>:!enquiries.length?<p className={styles.muted}>Assets shared with you will appear here. If you received a link by email or WhatsApp, open that link to get started.</p>:enquiries.map(enquiry=><ReceivedShareCard key={enquiry.token} share={enquiry}/>)}
   </section>
   <aside className={`${styles.panel} ${styles.accountAside}`}><h2>Your access</h2><p>The sender controls your access to each asset. Open a shared asset to see the available actions.</p><h2>Your usage</h2><dl className={styles.usageStats}><div><dt>Assets received</dt><dd>{usage.asset_received?.count||0}</dd></div><div><dt>Uploads</dt><dd>{usage.upload?.count||0}</dd></div><div><dt>Contributions</dt><dd>{usage.contribution?.count||0}</dd></div></dl>{Boolean(workspace?.legacyOpened)&&<p>{workspace!.legacyOpened} previously opened {workspace!.legacyOpened===1?'enquiry':'enquiries'} carried over from guest access.</p>}<Link className={styles.secondaryButton} href="/account#business-credits">View Business credits</Link></aside>
  </div>
 </div></main></>;
}
