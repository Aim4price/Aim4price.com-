import { redirect } from 'next/navigation';
import { desktopNotificationAccount } from '../../../lib/desktop-notification-access';
import DesktopNotificationSettings from './notification-settings-client';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function NotificationSettingsPage() {
  if (!await desktopNotificationAccount()) redirect('/auth#login');
  return <DesktopNotificationSettings />;
}
