import Link from 'next/link';
import AppHeader from '../../../components/AppHeader';
import { getAnyServerSession } from '../../../lib/auth-session';
import { requireTeamOwner } from '../../../lib/team-access';
import { TeamAccessError } from '../../../lib/team-access-policy';
import TeamAccessClient from './team-access-client';
import styles from '../../../components/team/team.module.css';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Desktop users', robots: { index: false, follow: false } };
export default async function Page() {
    const session = await getAnyServerSession();
    let message = '';
    if (session?.user?.id) {
        try { await requireTeamOwner(); }
        catch (error) {
            if (!(error instanceof TeamAccessError)) throw error;
            message = error.message;
        }
        if (!message) return <><AppHeader active="none"/><TeamAccessClient /></>;
    }
    return <><AppHeader active="none"/><main className={styles.page}><Link className={styles.button} href="/account">← Back to account</Link><h1>Desktop users</h1>{!session?.user?.id ? <><p>Sign in to manage desktop access for your business.</p><Link className={styles.primary} href="/auth?returnTo=/account/team-access">Sign in</Link></> : <div className={styles.notice}><p>{message}</p><Link className={styles.button} href="/team">Open my invited desktop access</Link></div>}</main></>;
}
