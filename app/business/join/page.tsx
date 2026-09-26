import JoinForm from './join-client';
import styles from '../page.module.css';
export const metadata = { title: 'Free Business account | Aim4price' };
export default function JoinPage() { return <main className={styles.page}><nav className={styles.nav}><a href="/">Aim4price</a><a href="/auth#login">Sign in</a></nav><section className={`${styles.panel} ${styles.join}`}><h1 className={styles.title}>Work together.<br />Keep it simple.</h1><p className={styles.intro}>Create a free Business account to receive shared enquiries. Aim4price verifies your business before access is approved.</p><JoinForm /></section></main>; }
