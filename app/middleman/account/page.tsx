import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentPushIdentity } from '../../../lib/push-access';
import styles from '../../../components/PhoneNotificationSettings.module.css';
export const dynamic = 'force-dynamic';
export default async function AppAccountPage() {
  const who = await currentPushIdentity();
  if (!who || who.app !== 'middleman') redirect('/middleman/login');
  return <main className={styles.panel}><img className={styles.logo} src="/brand/aim4price-mark-white.png" alt="Aim4price" /><h1>Account</h1>
    <Link className={styles.button} href="/middleman/notifications">Notifications</Link></main>;
}
