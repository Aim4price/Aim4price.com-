import Link from 'next/link';
import AppHeader from '../../../components/AppHeader';
import { requireTeamOwner } from '../../../lib/team-access';
import TeamAccessClient from './team-access-client';
import styles from '../../../components/team/team.module.css';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Team access', robots: { index: false, follow: false } };
export default async function Page() {
    try {
        await requireTeamOwner();
    }
    catch {
        return <><AppHeader active="none"/><main className={styles.page}><h1>Team access</h1><p>Sign in with a verified email on an active Owner or Dealer desktop account to manage your team.</p><Link className={styles.primary} href="/auth?returnTo=/account/team-access">Sign in</Link><Link className={styles.button} href="/team">Verify email or switch account</Link></main></>;
    }
    return <><AppHeader active="none"/><TeamAccessClient /></>;
}
