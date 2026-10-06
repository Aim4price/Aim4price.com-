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
export const metadata={title:'Shared enquiries | Aim4price',robots:{index:false,follow:false}};
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
 return <><AppHeader active="none"/><main><SharedAccountHero count={enquiries.length}/><div className={`${styles.page} ${styles.accountContent}`}>

  {paused?<p className={styles.notice} role="status">Account access is paused. Contact Aim4price to review your access.</p>:returnTo?<Link className={styles.button} href={returnTo}>Return to enquiry</Link>:null}
  <div className={styles.grid}>
   <section id="received-enquiries" className={`${styles.panel} ${styles.enquiriesPanel}`} aria-labelledby="enquiries-title"><h2 id="enquiries-title">Received enquiries <span className={styles.count}>{enquiries.length}</span></h2>
    {!session.user.emailVerified?<p>Verify your email in Account to view enquiries shared with you.</p>:!enquiries.length?<p className={styles.muted}>Your authorised enquiries will appear here. If you received a link by email or WhatsApp, open that link to get started.</p>:enquiries.map(enquiry=><article className={styles.lead} key={enquiry.token}><span className={styles.senderIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/></svg></span><h3>{enquiry.sender||'Asset enquiry'}</h3><p>{enquiry.request}</p><small>{new Date(enquiry.created_at).toLocaleDateString('en-ZA')}</small><Link className={styles.button} href={`/asset-share/${enquiry.token}`}>Open enquiry <span aria-hidden="true">→</span></Link></article>)}
   </section>
   <aside className={`${styles.panel} ${styles.accountAside}`}><h2>Your access</h2><p>The sender controls your access to each asset. Open an enquiry to see the available actions.</p><h2>Your usage</h2><dl className={styles.usageStats}><div><dt>Assets received</dt><dd>{usage.asset_received?.count||0}</dd></div><div><dt>Uploads</dt><dd>{usage.upload?.count||0}</dd></div><div><dt>Contributions</dt><dd>{usage.contribution?.count||0}</dd></div></dl>{Boolean(workspace?.legacyOpened)&&<p>{workspace!.legacyOpened} previously opened {workspace!.legacyOpened===1?'enquiry':'enquiries'} carried over from guest access.</p>}<p className={styles.muted}>Usage is being recorded. No free allowance limits are currently enforced.</p><div className={styles.upgrade}><strong>Ready for Aim4price Desktop?</strong><p className={styles.muted}>Keep your account and existing activity when you upgrade.</p><Link className={styles.secondaryButton} href="/pricing">Explore Desktop plans</Link></div></aside>
  </div>
 </div></main></>;
}
