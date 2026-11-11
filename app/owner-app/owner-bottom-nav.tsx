'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import OwnerIcon from './owner-icon';
import { ownerNavigationSection } from './owner-navigation';
import styles from './owner-mobile.module.css';

export default function OwnerBottomNav() {
  const pathname = usePathname() || '';
  const section = ownerNavigationSection(pathname);
  const [permissions, setPermissions] = useState<string[] | null>(null);
  useEffect(() => {
    if (!section) return;
    const controller = new AbortController();
    fetch('/api/owner-app/session', { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(payload => { if (!controller.signal.aborted) setPermissions(payload?.ok && Array.isArray(payload.session?.permissions) ? payload.session.permissions : null); })
      .catch(() => { if (!controller.signal.aborted) setPermissions(null); });
    return () => controller.abort();
  }, [pathname, section]);
  if (!section || !permissions) return null;
  const tabs = [
    { id: 'home', label: 'Home', href: '/owner-app' },
    { id: 'assets', label: 'Assets', href: '/owner-app/assets' },
    { id: 'work', label: 'Work', href: '/owner-app/operations' },
    { id: 'more', label: 'More', href: '/owner-app/more' },
  ];
  return <>
    <div className={styles.bottomSpace} data-owner-bottom-space aria-hidden="true" />
    <nav className={styles.bottomNav} aria-label="Manager App navigation">
      {tabs.map(item => <Link key={item.id} href={item.href} prefetch={false} aria-current={section === item.id ? 'page' : undefined} className={styles.bottomTab}>
        <OwnerIcon name={item.id} /><span>{item.label}</span>
      </Link>)}
    </nav>
  </>;
}
