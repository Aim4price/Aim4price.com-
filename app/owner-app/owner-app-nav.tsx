'use client';

import Link from 'next/link';
import { useState } from 'react';
import { clearCachedHeaderSession } from '../../lib/header-session-cache';
import styles from './owner-app.module.css';

export default function OwnerAppNav({ showBack = true, backHref = '/owner-app', backLabel = 'Home', backAction, backDisabled = false, className = '' }: {
  showBack?: boolean;
  backHref?: string;
  backLabel?: string;
  backAction?: () => void;
  backDisabled?: boolean;
  className?: string;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const backIsHome = showBack && !backAction && backHref === '/owner-app' && backLabel === 'Home';
  const headerLayoutClass = backIsHome
    ? styles.assetsHeaderSingle
    : showBack
      ? styles.assetsHeaderPair
      : styles.assetsHeaderSignOut;

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    await Promise.allSettled([
      fetch('/api/owner-app/logout', { method: 'POST', credentials: 'include' }),
      fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
    ]);
    clearCachedHeaderSession();
    window.location.replace('/owner-app/login');
  }

  return (
    <header className={`${styles.assetsHeader} ${headerLayoutClass} ${className}`} aria-label="Aim4price Owner account controls">
      {showBack ? (
        <>
          {backAction ? (
            <button type="button" className={styles.navButton} onClick={backAction} disabled={backDisabled} aria-label={backLabel}>
              <span>{backLabel}</span>
            </button>
          ) : (
            <Link className={styles.navButton} href={backHref} prefetch={false} aria-label={backLabel}>
              <span>{backLabel}</span>
            </Link>
          )}
          {!backIsHome ? (
            <Link className={`${styles.logoutButton} ${styles.homeButton}`} href="/owner-app" prefetch={false} aria-label="Owner App home">
              Home
            </Link>
          ) : null}
        </>
      ) : (
        <button type="button" className={styles.logoutButton} onClick={() => void signOut()} disabled={signingOut}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      )}
    </header>
  );
}
