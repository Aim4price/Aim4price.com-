import { redirect } from 'next/navigation';
import { currentPushIdentity, resolvePushAccess } from '../../../lib/push-access';
import AppNotificationsClient from '../../../components/AppNotificationsClient';
import styles from '../../dealer/dealer.module.css';
export const dynamic = 'force-dynamic';
export default async function NotificationsPage() {
  const who = await currentPushIdentity();
  if (!who || who.app !== 'middleman' || !await resolvePushAccess(who)) redirect('/middleman/login');
  return <main className={`${styles.module} ${styles.notificationOwnerPage}`}><AppNotificationsClient app="middleman" /></main>;
}
