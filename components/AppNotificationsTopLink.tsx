'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppHomeIcon from './AppHomeIcon';
import styles from './AppNotificationsTopLink.module.css';

export default function AppNotificationsTopLink({ root }: {
  root: '/owner-app' | '/dealer' | '/middleman' | '/field-manager';
}) {
  const pathname = usePathname();
  if (pathname === `${root}/login` || pathname.startsWith(`${root}/login/`)) return null;

  return (
    <nav className={styles.top} aria-label="App notifications">
      <Link
        className={styles.link}
        href={`${root}/notifications`}
        prefetch={false}
        aria-current={pathname === `${root}/notifications` ? 'page' : undefined}
      >
        <AppHomeIcon name="notifications" />
        <span>Notifications</span>
      </Link>
    </nav>
  );
}
