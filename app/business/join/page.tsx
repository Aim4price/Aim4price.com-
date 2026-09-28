import { sharedEnquiryReturnTo } from '../../../lib/external-share-permissions';
import JoinForm from './join-client';
import styles from '../page.module.css';
export const metadata = { title: 'Business account | Aim4price' };
export default function JoinPage({searchParams}:{searchParams?:{returnTo?:string}}) { const returnTo=sharedEnquiryReturnTo(searchParams?.returnTo); return <main className={styles.page}><nav className={styles.nav}><a href="/">Aim4price</a><a href={returnTo?`/auth?returnTo=${encodeURIComponent(returnTo)}#login`:"/auth#login"}>Sign in</a></nav><section className={`${styles.panel} ${styles.join}`}><h1 className={styles.title}>Work together.<br />Keep it simple.</h1><p className={styles.intro}>Home, Get Estimate, Leads and Marketplace. Aim4price verifies your business before shared enquiries become available.</p><JoinForm returnTo={returnTo}/></section></main>; }
