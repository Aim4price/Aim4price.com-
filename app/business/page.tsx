import { sharedEnquiryReturnTo } from '../../lib/external-share-permissions';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '../../lib/auth-session';
import { readBusinessAccount, listBusinessEnquiries, canBusinessContribute } from '../../lib/business-accounts';
import BusinessDetails, { SignOut } from './business-client';
import styles from './page.module.css';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Business | Aim4price', robots: { index: false, follow: false } };
export default async function BusinessPage({searchParams}:{searchParams?:{returnTo?:string}}) {
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
    const leads = ready ? await listBusinessEnquiries(s.user) : [];
    return <main className={styles.page}><nav className={styles.nav}><Link href="/">Aim4price</Link><a href="#leads">Leads</a><a href="#details">Business details</a><SignOut /></nav>
 {returnTo&&<p><Link className={styles.button} href={returnTo}>Return to enquiry</Link></p>}
 <h1 className={styles.title}>{profile.businessName || 'Your business'}</h1><p className={styles.intro}>Your free workspace for enquiries shared with you. No paid subscription is required.</p>
 <p className={styles.notice}>{ready ? 'Business verified. Enquiries addressed to your verified email appear below.' : 'Awaiting verification. Confirm your email and business details; Aim4price will review your account.'}</p>
 <div className={styles.grid}><section className={styles.panel} id="leads"><h2>Leads</h2>{!leads.length ? <p className={styles.intro}>{ready ? 'No shared enquiries yet. Ask the sender to use your account email.' : 'Your enquiries will be available once email and business verification are complete.'}</p> : leads.map(l => <article className={styles.lead} key={l.token}><h3>{l.sender}</h3><p>{l.request}</p><small>{new Date(l.created_at).toLocaleDateString('en-ZA')}</small><Link className={styles.button} href={`/asset-share/${l.token}`}>Open enquiry</Link></article>)}</section>
 <section className={styles.panel} id="details"><h2>Business details</h2><BusinessDetails returnTo={returnTo} businessName={profile.businessName || ''} phone={profile.phone || ''} website={review.website} evidence={review.evidence} email={s.user.email} emailVerified={s.user.emailVerified === true}/></section></div></main>;
}
