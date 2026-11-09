'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import OwnerIcon from './owner-icon';
import AppSettings from '../../components/AppSettings';
import { useState, type ReactNode } from 'react';
import { clearCachedHeaderSession } from '../../lib/header-session-cache';
import styles from './owner-app.module.css';

export default function OwnerAppNav({ showBack = true, showSignOut = false, backHref, backLabel = 'Back', backAction, backDisabled = false, className = '', trailingAction }: {
  showBack?: boolean;
  showSignOut?: boolean;
  backHref?: string;
  backLabel?: string;
  backAction?: () => void;
  backDisabled?: boolean;
  className?: string;
  trailingAction?: ReactNode;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  function goBack() {
    if (backDisabled) return;
    if (backAction) { backAction(); return; }
    if (window.history.length > 1) router.back();
    else router.replace('/owner-app');
  }

  async function signOut() {
    if (signingOut) return;
    if ('BroadcastChannel' in window) { const channel = new BroadcastChannel('aim4price-' + ('owner') + '-session'); channel.postMessage('lock'); channel.close(); }
    setSigningOut(true);
    await Promise.allSettled([
      fetch('/api/owner-app/logout', { method: 'POST', credentials: 'include' }),
      fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
    ]);
    clearCachedHeaderSession();
    window.location.replace('/owner-app/login');
  }

  return (
    <header className={`${styles.assetsHeader} ${styles.persistentHeader} ${className}`} aria-label="Aim4price Owner account controls">
      <nav className={styles.topNavigation} aria-label="Page navigation">
        {backHref && !backAction ? (
          <Link className={styles.navButton} href={backHref} prefetch={false} aria-label="Back" title={backLabel === 'Back' ? undefined : `Back to ${backLabel}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7" /></svg>
            <span>Back</span>
          </Link>
        ) : (
          <button type="button" className={styles.navButton} onClick={goBack} disabled={backDisabled} aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7" /></svg>
            <span>Back</span>
          </button>
        )}
        <Link className={`${styles.navButton} ${styles.homeButton}`} href="/owner-app" prefetch={false} aria-label="Owner App home">
          <OwnerIcon name="home" /><span>Home</span>
        </Link>
      </nav>
      {!showBack || showSignOut || trailingAction ? (
        <div className={styles.topUtilities}>
          {!showBack ? <AppSettings offlineHref="/owner-app/offline.html" /> : null}
          {showSignOut ? <button type="button" className={styles.logoutButton} onClick={() => void signOut()} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button> : null}
          {trailingAction ? <div className={styles.topTrailingAction}>{trailingAction}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
