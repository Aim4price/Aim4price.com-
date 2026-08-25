'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { clearCachedHeaderSession } from '../../lib/header-session-cache';
import styles from './dealer.module.css';

type DealerNavProps = {
  backHref?: string;
  backLabel?: string;
  showBack?: boolean;
};

export default function DealerNav({
  backHref = '/dealer',
  backLabel = 'Home',
  showBack,
}: DealerNavProps) {
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const isLeadsPage = pathname.startsWith('/dealer/leads');
  const isMaintenancePage = pathname.startsWith('/dealer/maintenance');
  const resolvedShowBack = showBack ?? pathname !== '/dealer';
  const isMaintenanceDetail = pathname.startsWith('/dealer/maintenance/');
  const isInventoryDetail = pathname.startsWith('/dealer/inventory/');
  const resolvedBackHref = backHref === '/dealer' && isMaintenanceDetail
    ? '/dealer/maintenance'
    : backHref === '/dealer' && isInventoryDetail
      ? '/dealer/inventory'
      : backHref;
  const resolvedBackLabel = backLabel === 'Home' && isMaintenanceDetail
    ? 'Maintenance'
    : backLabel === 'Home' && isInventoryDetail
      ? 'My Inventory'
      : backLabel;
  const backIsHome = resolvedShowBack && resolvedBackHref === '/dealer' && resolvedBackLabel === 'Home';
  const navLayoutClass = backIsHome
    ? styles.navSingle
    : resolvedShowBack
      ? styles.navPair
      : styles.navSignOut;
  const workspaceSurfaceClass = isLeadsPage || isMaintenancePage
    ? `${styles.navLeadsSurface} ${styles.navUnifiedSurface}`
    : '';

  if (pathname === '/dealer/login') return null;

  async function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);

    await Promise.allSettled([
      fetch('/api/dealer/logout', { method: 'POST', credentials: 'include' }),
      fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    ]);

    clearCachedHeaderSession();
    window.location.replace('/dealer/login');
  }

  return (
    <header
      className={`${styles.nav} ${navLayoutClass} ${workspaceSurfaceClass}`}
      aria-label="Dealer App navigation"
    >
      {resolvedShowBack ? (
        <>
          <Link className={styles.navButton} href={resolvedBackHref} prefetch={false} aria-label={resolvedBackLabel}>
            <span>{resolvedBackLabel}</span>
          </Link>
          {!backIsHome ? (
            <Link className={`${styles.signOut} ${styles.homeButton}`} href="/dealer" prefetch={false} aria-label="Dealer App home">
              Home
            </Link>
          ) : null}
        </>
      ) : (
        <button
          type="button"
          className={styles.signOut}
          onClick={() => void signOut()}
          disabled={isSigningOut}
        >
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </button>
      )}
    </header>
  );
}
