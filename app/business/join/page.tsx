import { guestCreditLimit } from '../../../lib/guest-enquiry-credits';
import { sharedEnquiryReturnTo } from '../../../lib/external-share-permissions';
import { getGuestViewer } from '../../../lib/guest-business-access';
import GuestEnquiryAccess from '../../../components/GuestEnquiryAccess';
import AppHeader from '../../../components/AppHeader';
import Link from 'next/link';
import JoinForm from './join-client';
import styles from '../page.module.css';
export const metadata = { title: 'Business account | Aim4price' };
export const dynamic = 'force-dynamic';
export default async function JoinPage({searchParams}:{searchParams?:{returnTo?:string;mode?:string}}) {
 const returnTo=sharedEnquiryReturnTo(searchParams?.returnTo);
 if(returnTo&&searchParams?.mode!=='account')return <><AppHeader active="none"/><main className={styles.page}><GuestEnquiryAccess limit={guestCreditLimit()} returnTo={returnTo}/></main></>;
 const account=searchParams?.mode==='account';
 const guest=account?await getGuestViewer():null;
 return <><AppHeader active="none"/><main className={styles.page}>
 {account?<section className={`${styles.panel} ${styles.join}`}><h1 className={styles.guestTitle}>Create your Business account</h1><p className={styles.intro}>Keep your enquiries together. Get estimates, receive leads and browse the marketplace.</p><JoinForm returnTo={returnTo} email={guest?.email}/></section>:<section className={`${styles.panel} ${styles.join}`}><h1 className={styles.guestTitle}>How would you like to start?</h1><div className={styles.form}>
 <Link className={styles.entryCard} href="/business/guest"><strong>Open shared enquiries</strong><span>Free guest access using your email. View and reply, with {guestCreditLimit() ?? 'x'} credits available.</span><small>No personal inbox, saved history or backup service.</small></Link>
 <Link className={styles.entryCard} href="/business/join?mode=account"><strong>Create Business account</strong><span>Keep your enquiries together and access the Basic Business tools.</span></Link>
 </div><div className={styles.guestActions}><Link className={styles.button} href="/auth#login">Already registered? Log in</Link></div></section>}
 </main></>;
}
