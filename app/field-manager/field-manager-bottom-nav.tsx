'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import OwnerIcon from '../owner-app/owner-icon';
import { fieldManagerNavigationSection } from './field-manager-navigation';
import styles from './mobile.module.css';

export default function FieldManagerBottomNav() {
  const pathname = usePathname() || '';
  const section = fieldManagerNavigationSection(pathname);
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    if (!section) return;
    const controller = new AbortController();
    fetch('/api/field-manager/session', { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(payload => { if (!controller.signal.aborted) setAuthenticated(Boolean(payload?.ok && payload.manager)); })
      .catch(() => { if (!controller.signal.aborted) setAuthenticated(false); });
    return () => controller.abort();
  }, [pathname, section]);
  if (!section || !authenticated) return null;
  const tabs = [
    { id: 'home', label: 'Home', href: '/field-manager' },
    { id: 'assets', label: 'Assets', href: '/field-manager/assets' },
    { id: 'work', label: 'Work', href: '/field-manager/work' },
    { id: 'more', label: 'More', href: '/field-manager/more' },
  ];
  return <>
    <div className={styles.bottomSpace} data-field-bottom-space aria-hidden="true" />
    <nav className={styles.bottomNav} aria-label="Field Manager navigation">
      {tabs.map(item => <Link key={item.id} href={item.href} prefetch={false} aria-current={section === item.id ? 'page' : undefined} className={styles.bottomTab}><OwnerIcon name={item.id} /><span>{item.label}</span></Link>)}
    </nav>
  </>;
}
