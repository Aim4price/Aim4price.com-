import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import { getAnyServerSession } from '../../lib/auth-session';
import TeamWorkspaceClient from './team-workspace-client';
import styles from '../../components/team/team.module.css';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'My desktop access', robots: { index: false, follow: false } };
export default async function Page() {
    const session = await getAnyServerSession();
    return <><AppHeader active="none"/>{session?.user ? <TeamWorkspaceClient email={session.user.email} verified={session.user.emailVerified === true}/> : <main className={styles.page}><h1>Your team workspace</h1><p>Use the email address your business owner invited. You do not need your own paid desktop subscription.</p><div className={styles.actions}><Link className={styles.primary} href="/auth?returnTo=/team">Sign in</Link><Link className={styles.button} href="/business/join?returnTo=/team">Create a free account</Link></div><p className={styles.muted}>Each person uses their own login. Access is available only after email verification and invitation acceptance.</p></main>}</>;
}
