import { redirect } from 'next/navigation';
import PhoneNotificationSettings from '../../../../components/PhoneNotificationSettings';
import { currentPushIdentity } from '../../../../lib/push-access';
import OwnerAppNav from '../../owner-app-nav';
export const dynamic = 'force-dynamic';
export default async function NotificationSettingsPage() {
  const who = await currentPushIdentity();
  if (!who || who.app !== 'owner') redirect('/owner-app/login');
  return <main><OwnerAppNav /><PhoneNotificationSettings app="owner" /></main>;
}
