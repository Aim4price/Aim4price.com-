import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import { sharedEnquiryReturnTo } from '../../lib/external-share-permissions';
import { getServerSession } from '../../lib/auth-session';
import { readBusinessAccount, listBusinessEnquiries } from '../../lib/business-accounts';
import { businessWorkspaceSummary } from '../../lib/business-workspaces';
import BusinessDetails, { SignOut } from './business-client';
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
 const workspace=await businessWorkspaceSummary(session.user.id);
 const paused=account.profile.accountStatus!=='active'||!workspace||workspace.suspended;
 const enquiries=paused?[]:await listBusinessEnquiries(session.user);
 return <><AppHeader active="none"/><main className={styles.page}>
  <div className={styles.workspaceHeading}><div><span className={styles.eyebrow}>Free account</span><h1 className={styles.title}>Shared enquiries</h1><p className={styles.intro}>Open information shared with your business and return to it whenever you need it.</p></div><Link className={styles.secondaryButton} href="/pricing">Explore Desktop plans</Link></div>
  {paused?<p className={styles.notice} role="status">Account access is paused. Contact Aim4price to review your access.</p>:returnTo?<Link className={styles.button} href={returnTo}>Return to enquiry</Link>:null}
  <div className={styles.grid}>
   <section className={styles.panel} aria-labelledby="enquiries-title"><h2 id="enquiries-title">Received enquiries</h2>
    {!session.user.emailVerified?<p>Verify your email below to view enquiries shared with you.</p>:!enquiries.length?<p className={styles.muted}>Your authorised enquiries will appear here. If you received a link by email or WhatsApp, open that link to get started.</p>:enquiries.map(enquiry=><article className={styles.lead} key={enquiry.token}><h3>{enquiry.sender||'Asset enquiry'}</h3><p>{enquiry.request}</p><small>{new Date(enquiry.created_at).toLocaleDateString('en-ZA')}</small><Link className={styles.button} href={`/asset-share/${enquiry.token}`}>Open enquiry</Link></article>)}
   </section>
   <aside className={styles.panel}><h2>Your access</h2><p>View authorised enquiries and reports. Business verification is required before you can submit documents or proposed changes.</p><p className={styles.muted}>Full Aim4price Desktop access requires an upgrade.</p><h2>Credits</h2>{Boolean(workspace?.legacyOpened)&&<p>{workspace!.legacyOpened} previously opened {workspace!.legacyOpened===1?'enquiry':'enquiries'} carried over from guest access.</p>}<p className={styles.muted}>Your free allowance will be shown here once available. No subscription payment is required to create this account.</p></aside>
  </div>
  <details className={`${styles.panel} ${styles.details}`} open={searchParams?.details==='1'||!session.user.emailVerified}><summary>Account details & business verification</summary><BusinessDetails returnTo={returnTo} businessName={account.profile.businessName||''} phone={account.profile.phone||''} website={account.review.website} evidence={account.review.evidence} email={session.user.email} emailVerified={session.user.emailVerified===true}/></details>
  <div className={styles.footer}><SignOut/></div>
 </main></>;
}
