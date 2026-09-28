import { guestCreditLimit } from '../../../lib/guest-enquiry-credits';
import { sharedEnquiryReturnTo } from '../../../lib/external-share-permissions';
import { getGuestViewer } from '../../../lib/guest-business-access';
import GuestEnquiryAccess from '../../../components/GuestEnquiryAccess';
import SignupFlow from '../../../components/SignupFlow';
import Link from 'next/link';
import AuthClient from '../../auth/auth-client';
import styles from '../../../components/SignupFlow.module.css';
export const metadata = { title: 'Business account | Aim4price' };
export const dynamic = 'force-dynamic';
export default async function JoinPage({searchParams}:{searchParams?:{returnTo?:string;mode?:string;businessType?:string}}) {
 const returnTo=sharedEnquiryReturnTo(searchParams?.returnTo);
 if(returnTo&&searchParams?.mode!=='account')return <GuestEnquiryAccess limit={guestCreditLimit()} returnTo={returnTo}/>;
 const account=searchParams?.mode==='account';
 const guest=account?await getGuestViewer():null;
 if(account)return <AuthClient businessSignup initialBusinessType={searchParams?.businessType} initialEmail={guest?.email} returnTo={returnTo}/>;
 return <SignupFlow title="How would you like to start?" description="Open an invitation or create your Business workspace." returnTo={returnTo}>
 <>
 <div className={styles.choices}>
 <Link className={styles.entryCard} href="/business/guest"><span className={styles.badge}>Free guest access</span><strong>Open shared enquiries</strong><span>View shared information and reply using your email. {guestCreditLimit() ?? 'x'} credits available.</span><small>No personal inbox, saved history or backup.</small><span className={styles.choiceAction}>Continue with email</span></Link>
 <Link className={styles.entryCard} href="/business/join?mode=account"><span className={styles.badge}>Basic Business account</span><strong>Create your account</strong><span>Home, Get Estimate, Leads and Marketplace in one workspace.</span><small>For insurance, finance, licensing and other services.</small><span className={styles.choiceAction}>Set up your business</span></Link>
 </div><div className={styles.footer}><p className={styles.muted}>Already have an account?</p><Link className={styles.secondaryButton} href="/auth#login">Log in</Link></div>
 </>
 </SignupFlow>;
}
