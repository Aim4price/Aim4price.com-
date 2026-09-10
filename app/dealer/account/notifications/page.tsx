import { redirect } from 'next/navigation';
import PhoneNotificationSettings from '../../../../components/PhoneNotificationSettings';
import { currentPushIdentity } from '../../../../lib/push-access';

export const dynamic = 'force-dynamic';
export default async function NotificationSettingsPage() {
  const who = await currentPushIdentity();
  if (!who || who.app !== 'dealer') redirect('/dealer/login');
  return <main><PhoneNotificationSettings app="dealer" /></main>;
}
