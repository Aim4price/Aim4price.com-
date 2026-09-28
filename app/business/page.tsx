import AppHeader from '../../components/AppHeader';
import { sharedEnquiryReturnTo } from '../../lib/external-share-permissions';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '../../lib/auth-session';
import { readBusinessAccount, canBusinessContribute } from '../../lib/business-accounts';
import BusinessDetails, { SignOut } from './business-client';
import styles from './page.module.css';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Business | Aim4price', robots: { index: false, follow: false } };
export default async function BusinessPage({searchParams}:{searchParams?:{returnTo?:string;details?:string}}) {
    const returnTo=sharedEnquiryReturnTo(searchParams?.returnTo);
    const s = await getServerSession({ requireActive: false });
    if (!s?.user)
        redirect(returnTo?`/business/join?returnTo=${encodeURIComponent(returnTo)}`:'/business/join');
    const account = await readBusinessAccount(s.user);
    if (!account)
        redirect('/account');
    const { profile, review } = account;
    if (profile.accountStatus === 'suspended')
        redirect('/pending-payment');
    const ready = await canBusinessContribute(s.user);
    if (ready && searchParams?.details !== '1') redirect(returnTo || '/leads');
    return <><AppHeader active="none"/><main className={styles.page}>
 {returnTo&&<p><Link className={styles.button} href={returnTo}>Return to enquiry</Link></p>}
 <h1 className={styles.title}>{ready ? 'Business details' : 'Business pending approval'}</h1>
 <p className={styles.intro}>{ready ? 'Manage your business information.' : 'Verify your email and business details. Aim4price will review your account before your leads become available.'}</p>
 <section className={styles.panel} id="details">
 <BusinessDetails returnTo={returnTo} businessName={profile.businessName || ''} phone={profile.phone || ''} website={review.website} evidence={review.evidence} email={s.user.email} emailVerified={s.user.emailVerified === true}/>
 </section>
 <div className={styles.nav}>{ready && <Link href="/leads">Leads</Link>}<SignOut /></div>
 </main></>;
}
